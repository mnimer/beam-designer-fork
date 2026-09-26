/**
 * Credential Redaction
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Strips plaintext credentials out of a pipeline definition before that definition
 * leaves the user's machine. The Beam Designer canvas lets a user type a database
 * password (or an AWS secret access key, or a JMS broker password) directly into a
 * property form. That value is serialized into the `.beam` YAML, and the same YAML
 * string is then (a) interpolated into the code-generation prompt sent to the Gemini
 * API and (b) written verbatim to `gemini.log` inside the user's output folder --
 * a file that routinely gets committed to source control.
 *
 * This module is the chokepoint that prevents (a) and (b).
 *
 * Architectural Decisions:
 * - **Structural, not textual.** Redaction parses the YAML and walks the resulting
 *   object tree, rather than running regexes over the raw text. A text-level regex
 *   cannot distinguish the key `password:` from a user's SQL query that happens to
 *   contain the word "password", and would either miss real secrets or corrupt
 *   legitimate content. Key-based classification has no such ambiguity.
 *
 * - **References are preserved; values are destroyed.** The codebase already models
 *   credentials two different ways. `passwordSecret` / `accessKeySecret` / `secretName`
 *   hold the *name of a Secret Manager secret* -- these are pointers, they are not
 *   sensitive, and the code generator genuinely needs them to emit a working client.
 *   `password` / `secretAccessKey` / `token` hold the *actual value*. The classifier
 *   therefore checks the reference allowlist FIRST and lets it win, because several
 *   reference keys embed a secret-ish word (`passwordSecret` contains "password",
 *   `secretName` contains "secret") and a naive substring scan would shred exactly
 *   the mechanism we want users to adopt.
 *
 * - **Ambiguity redacts.** If a key looks credential-bearing and is not on the
 *   reference allowlist, it is redacted. For a security control the safe default is
 *   to over-redact: a missing value produces a visibly wrong generated snippet that
 *   the user immediately notices and fixes, whereas an unredacted value produces a
 *   silent, permanent disclosure to a third-party API and to git history.
 *
 * - **Unparseable input throws.** `redactPipelineYaml` deliberately does NOT fall back
 *   to returning the original string when YAML parsing fails. Falling back would mean
 *   that the single easiest way to defeat this control is to hand it malformed input.
 *   A pipeline whose YAML does not parse cannot be code-generated anyway, so failing
 *   loudly costs the user nothing.
 *
 * Residual risk (deliberately accepted, documented so the next reader does not assume
 * this module is airtight):
 * - A user can still paste a credential into a field this module has no reason to
 *   suspect -- a JDBC `connectionUrl` of the form `jdbc:...?password=hunter2`, or a
 *   free-text transform body. `URL_EMBEDDED_CREDENTIAL_PATTERN` covers the common
 *   connection-string case, but free-text fields are not scanned.
 * - Redaction protects the outbound prompt and the log. It does NOT retroactively
 *   clean a `.beam` file that already contains a plaintext password on disk.
 *   The real fix for that is to stop collecting the plaintext at all, which is why
 *   the JDBC and JMS property forms now default to a Secret Manager reference.
 */

import YAML from 'yaml';

/**
 * Placeholder substituted in place of any redacted credential value.
 *
 * NOTE: This string is intentionally conspicuous and syntactically invalid as a real
 * credential. If it ever shows up in generated code or in a log, that is the control
 * working as designed, not a bug.
 */
export const REDACTION_PLACEHOLDER = '__REDACTED_BY_BEAM_DESIGNER__';

/**
 * Keys whose value is a *pointer* to a credential rather than the credential itself.
 *
 * These are compared after normalization (lowercased, separators stripped), and they
 * are checked before the secret-value patterns so that names like `passwordSecret`
 * survive intact. Removing an entry from this list will silently break code
 * generation for the transform that uses it, because the generator will lose the
 * name of the secret it is supposed to read.
 */
export const SECRET_REFERENCE_KEYS: ReadonlySet<string> = new Set([
  'authmode',
  'secretname',
  'secretid',
  'secretversion',
  'secretproject',
  'secretmanagerproject',
  'passwordsecret',
  'accesskeysecret',
  'tokensecret',
  'credentialssecret',
  'apikeysecret',
  'developertokensecret',
  'clientsecretsecret',
  'refreshtokensecret',
]);

/**
 * Substrings which, when present in a normalized key name, mark that key as holding a
 * live credential value.
 *
 * Matching is substring-based rather than exact so that transform-specific prefixes
 * (`saslPassword`, `sslKeyPassword`, `brokerPassword`, `awsSecretAccessKey`) are all
 * caught without having to enumerate every vendor's naming scheme.
 */
export const SECRET_VALUE_PATTERNS: readonly string[] = [
  'password',
  'passwd',
  'pwd',
  'passphrase',
  'secretaccesskey',
  'secretkey',
  'privatekey',
  'apikey',
  'authtoken',
  'bearertoken',
  'accesstoken',
  'refreshtoken',
  'clientsecret',
  'credential',
  'token',
  'secret',
];

/**
 * Matches a credential embedded in a URI query string or userinfo component, e.g.
 * `jdbc:postgresql://host/db?user=admin&password=hunter2` or `amqp://user:pw@host`.
 *
 * Only the value is replaced; the surrounding connection string is preserved so the
 * generated code still targets the right host and database.
 */
export const URL_EMBEDDED_CREDENTIAL_PATTERN =
  /([?&;](?:password|passwd|pwd|secret|token|apikey|api_key)=)([^&;\s]+)/gi;

/**
 * Classification of a single property key.
 */
export type KeyClassification = 'reference' | 'secret' | 'safe';

/**
 * Normalizes a property key for comparison by lowercasing it and removing the
 * separator characters that distinguish the several naming conventions in use across
 * the property forms (`secret_name`, `secret-name`, `secretName`, `secret.name`).
 *
 * @param key Raw property key as it appears in the pipeline YAML.
 * @returns The key reduced to lowercase alphanumerics.
 */
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_\-.\s]/g, '');
}

/**
 * Abbreviations that identify a credential only when they appear as a whole token.
 *
 * These are deliberately NOT in SECRET_VALUE_PATTERNS. `pw` as a substring would match
 * innocuous keys, but `DB_PW` / `brokerPw` split into tokens where `pw` stands alone.
 * Tokenized matching gets the abbreviation without the false positives.
 */
export const CREDENTIAL_NAME_TOKENS: ReadonlySet<string> = new Set([
  'pw',
  'pwd',
  'creds',
]);

/**
 * Splits a key or variable name into lowercase tokens, handling both the
 * SCREAMING_SNAKE convention used by runtime variables and the camelCase convention
 * used by property keys.
 *
 * @param name Raw key or variable name.
 * @returns Lowercase tokens.
 */
export function tokenizeName(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[_\-.\s]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

/**
 * Reports whether any whole token in a name is a known credential abbreviation.
 *
 * @param name Raw key or variable name.
 * @returns True when the name contains a standalone credential abbreviation.
 */
export function hasCredentialToken(name: string): boolean {
  return tokenizeName(name).some((token) => CREDENTIAL_NAME_TOKENS.has(token));
}

/**
 * Decides whether a given property key holds a credential value, a credential
 * reference, or nothing sensitive.
 *
 * The reference check runs first and short-circuits. See the module header for why
 * that ordering is load-bearing.
 *
 * @param key Raw property key from the pipeline YAML.
 * @returns 'reference' for a Secret Manager pointer, 'secret' for a live credential
 *          value, 'safe' for everything else.
 */
export function classifyKey(key: string): KeyClassification {
  const normalized = normalizeKey(key);

  // Pointers to a secret are not themselves sensitive, and codegen needs them.
  if (SECRET_REFERENCE_KEYS.has(normalized)) {
    return 'reference';
  }

  // Anything else that smells like a credential is treated as one.
  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (normalized.includes(pattern)) {
      return 'secret';
    }
  }

  // Abbreviations that are only safe to match on a token boundary (DB_PW, brokerPw).
  if (hasCredentialToken(key)) {
    return 'secret';
  }

  return 'safe';
}

/**
 * Result of a redaction pass.
 */
export interface RedactionResult<T> {
  /** The redacted payload. */
  value: T;
  /** Dotted paths of every property that was redacted, in traversal order. */
  redactedPaths: string[];
}

/**
 * Recursively walks a parsed pipeline object and replaces every credential value with
 * REDACTION_PLACEHOLDER.
 *
 * Traversal notes:
 * - Arrays are walked by index and the index is recorded in the reported path, so a
 *   caller can tell the user exactly which transform leaked.
 * - A `WeakSet` guards against cyclic references. Pipeline YAML produced by this
 *   extension is acyclic, but this function is exported and a cycle would otherwise
 *   hang the extension host.
 * - Only string values are scanned for URL-embedded credentials; numbers and booleans
 *   under a secret-classified key are still replaced wholesale.
 *
 * @param input Parsed pipeline value (object, array, or scalar).
 * @returns The redacted clone plus the list of paths that were touched.
 */
export function redactCredentialValues<T>(input: T): RedactionResult<T> {
  const redactedPaths: string[] = [];
  const seen = new WeakSet<object>();

  /**
   * Inner recursive walker.
   *
   * @param node Current value under inspection.
   * @param path Dotted path to `node` from the document root.
   * @param inheritedClassification Classification of the key that led to this node,
   *        so that an object or array nested under e.g. `credentials:` is redacted
   *        wholesale rather than only at its leaves.
   */
  const walk = (node: unknown, path: string, inheritedClassification: KeyClassification): unknown => {
    // A secret-classified key wins regardless of the value's shape. An object parked
    // under `credentials:` is redacted entirely rather than descended into.
    if (inheritedClassification === 'secret') {
      if (node !== null && node !== undefined && node !== '') {
        redactedPaths.push(path);
        return REDACTION_PLACEHOLDER;
      }
      return node;
    }

    // Scalars: the only remaining risk is a credential embedded in a connection string.
    if (typeof node === 'string') {
      const scrubbed = node.replace(URL_EMBEDDED_CREDENTIAL_PATTERN, `$1${REDACTION_PLACEHOLDER}`);
      if (scrubbed !== node) {
        redactedPaths.push(path);
      }
      return scrubbed;
    }

    if (node === null || typeof node !== 'object') {
      return node;
    }

    // Cycle guard -- see function docblock.
    if (seen.has(node as object)) {
      return node;
    }
    seen.add(node as object);

    if (Array.isArray(node)) {
      return node.map((item, index) => walk(item, `${path}[${index}]`, 'safe'));
    }

    // Plain object: classify each key and recurse.
    //
    // Before the generic walk, handle the name/value pair idiom. `runtimeVariables`
    // is serialized as [{ name: 'DB_PASSWORD', value: 'hunter2' }, ...], where the
    // credential is identified by a SIBLING field rather than by its own key. Key-based
    // classification is structurally blind to this -- the key is the literal string
    // 'value', which is never suspicious -- so the pair has to be recognised explicitly.
    const entries = Object.entries(node as Record<string, unknown>);
    const pairName = (node as Record<string, unknown>).name ?? (node as Record<string, unknown>).key;
    const isNameValuePair =
      typeof pairName === 'string' &&
      Object.prototype.hasOwnProperty.call(node, 'value') &&
      classifyKey(pairName) === 'secret';

    const result: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      const childPath = path ? `${path}.${key}` : key;

      // The pair's `value` inherits the classification of the pair's `name`.
      if (isNameValuePair && key === 'value') {
        result[key] = walk(value, childPath, 'secret');
        continue;
      }

      const classification = classifyKey(key);
      result[key] = walk(value, childPath, classification);
    }
    return result;
  };

  return {
    value: walk(input, '', 'safe') as T,
    redactedPaths,
  };
}

/**
 * Parses a pipeline YAML string, redacts every credential value in it, and
 * re-serializes it.
 *
 * This is the function the extension calls immediately before interpolating the
 * pipeline into the Gemini prompt. The returned string is what gets sent to the API
 * and what ends up in `gemini.log`.
 *
 * @param yamlText Serialized pipeline definition from the webview.
 * @returns The redacted YAML text plus the paths that were redacted.
 * @throws If `yamlText` is not valid YAML. This is deliberate -- see the module
 *         header. Returning the input unchanged would make malformed YAML a bypass.
 */
export function redactPipelineYaml(yamlText: string): RedactionResult<string> {
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlText);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Refusing to send pipeline to the code generator: its YAML could not be parsed, ` +
      `so credentials inside it cannot be redacted. Fix the pipeline definition and retry. (${detail})`
    );
  }

  // A YAML document consisting only of a comment, or of the literal `null`, parses to
  // null. There is nothing to redact and nothing to leak.
  if (parsed === null || parsed === undefined) {
    return { value: yamlText, redactedPaths: [] };
  }

  const { value, redactedPaths } = redactCredentialValues(parsed);

  // Nothing matched -- return the original text so formatting and comments survive
  // untouched for the common case of a pipeline with no credentials at all.
  if (redactedPaths.length === 0) {
    return { value: yamlText, redactedPaths: [] };
  }

  return {
    value: YAML.stringify(value),
    redactedPaths,
  };
}

/**
 * Builds the instruction appended to the code-generation prompt whenever one or more
 * credentials were redacted.
 *
 * Without this, Gemini sees REDACTION_PLACEHOLDER as an ordinary string literal and
 * faithfully embeds it in the generated source, producing code that fails at runtime
 * with no explanation. With it, the model is told to read the value from the
 * environment instead, which is what the user wanted in the first place.
 *
 * @param redactedPaths Paths reported by the redaction pass.
 * @returns Prompt text to append, or an empty string when nothing was redacted.
 */
export function buildRedactionPromptNotice(redactedPaths: string[]): string {
  if (redactedPaths.length === 0) {
    return '';
  }

  const pathList = redactedPaths.map((p) => `  - ${p}`).join('\n');
  return [
    '',
    '## Redacted Credentials',
    '',
    `The literal value \`${REDACTION_PLACEHOLDER}\` appears in the pipeline definition above.`,
    'It is NOT a real credential. The user\'s actual secret was stripped before this prompt was sent.',
    '',
    'The following properties were redacted:',
    pathList,
    '',
    'For each redacted property, DO NOT emit the placeholder as a string literal.',
    'Instead, read the value at runtime from an environment variable named after the',
    'property in upper snake case (for example, a redacted `password` becomes',
    '`os.environ["PASSWORD"]` in Python or `System.getenv("PASSWORD")` in Java), and',
    'add a brief comment noting that the operator must supply it.',
    '',
  ].join('\n');
}
