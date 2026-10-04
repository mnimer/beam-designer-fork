/**
 * Credential Redaction Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Regression coverage for the C2 finding: plaintext JDBC/JMS passwords were being
 * serialized into the `.beam` pipeline, interpolated into the Gemini code-generation
 * prompt, and written verbatim to `gemini.log`.
 *
 * These tests are the barrier that keeps that from coming back. The highest-value
 * cases here are the ones asserting the reference/value ordering -- `passwordSecret`
 * must survive while `password` must not. Inverting that ordering does not fail
 * loudly; it quietly guts the Secret Manager mechanism the fix depends on, so it is
 * pinned explicitly.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import {
  REDACTION_PLACEHOLDER,
  SECRET_REFERENCE_KEYS,
  normalizeKey,
  tokenizeName,
  hasCredentialToken,
  classifyKey,
  redactCredentialValues,
  redactPipelineYaml,
  buildRedactionPromptNotice,
} from '../../credentialRedaction';

describe('normalizeKey', () => {
  it('lowercases and strips every separator convention in use', () => {
    expect(normalizeKey('secretName')).toBe('secretname');
    expect(normalizeKey('secret_name')).toBe('secretname');
    expect(normalizeKey('secret-name')).toBe('secretname');
    expect(normalizeKey('secret.name')).toBe('secretname');
    expect(normalizeKey('SECRET NAME')).toBe('secretname');
  });

  it('leaves an already-normalized key untouched', () => {
    expect(normalizeKey('password')).toBe('password');
  });

  it('handles the empty string', () => {
    expect(normalizeKey('')).toBe('');
  });
});

describe('classifyKey', () => {
  it('classifies live credential values as secret', () => {
    const secretKeys = [
      'password', 'passwd', 'pwd', 'passphrase',
      'secretAccessKey', 'secretKey', 'privateKey',
      'apiKey', 'authToken', 'bearerToken', 'accessToken', 'refreshToken',
      'clientSecret', 'credentials', 'token', 'secret',
    ];
    for (const key of secretKeys) {
      expect(classifyKey(key), `expected "${key}" to be secret`).toBe('secret');
    }
  });

  it('classifies Secret Manager pointers as reference, not secret', () => {
    // These are the keys the code generator needs in order to emit a working client.
    // If any of these ever start classifying as 'secret', codegen silently breaks.
    const referenceKeys = [
      'authMode', 'secretName', 'secretId', 'secretVersion',
      'secretProject', 'secretManagerProject',
      'passwordSecret', 'accessKeySecret', 'tokenSecret',
      'credentialsSecret', 'apiKeySecret',
    ];
    for (const key of referenceKeys) {
      expect(classifyKey(key), `expected "${key}" to be reference`).toBe('reference');
    }
  });

  it('gives the reference allowlist precedence over the value patterns', () => {
    // This is the crux. Every one of these contains a substring that would otherwise
    // match SECRET_VALUE_PATTERNS. The allowlist must win.
    expect(classifyKey('passwordSecret')).toBe('reference'); // contains "password"
    expect(classifyKey('secretName')).toBe('reference');     // contains "secret"
    expect(classifyKey('accessKeySecret')).toBe('reference'); // contains "secret"
    expect(classifyKey('apiKeySecret')).toBe('reference');   // contains "apikey"

    // ...but the bare value forms are still secrets.
    expect(classifyKey('password')).toBe('secret');
    expect(classifyKey('apiKey')).toBe('secret');
  });

  it('catches vendor-prefixed credential keys via substring matching', () => {
    expect(classifyKey('saslPassword')).toBe('secret');
    expect(classifyKey('sslKeyPassword')).toBe('secret');
    expect(classifyKey('brokerPassword')).toBe('secret');
    expect(classifyKey('awsSecretAccessKey')).toBe('secret');
  });

  it('leaves ordinary pipeline properties alone', () => {
    const safeKeys = ['topic', 'query', 'tableSpec', 'username', 'host', 'port', 'driverClassName'];
    for (const key of safeKeys) {
      expect(classifyKey(key), `expected "${key}" to be safe`).toBe('safe');
    }
  });

  it('treats the documented reference set as normalized', () => {
    // Guards against someone adding a camelCase entry, which would never match.
    for (const key of SECRET_REFERENCE_KEYS) {
      expect(normalizeKey(key)).toBe(key);
    }
  });

  describe('Secret Manager reference keys (*Secret suffix rule) vs credential values', () => {
    it('preserves *Secret Secret Manager reference keys', () => {
      const referenceKeys = [
        'usernameSecret',
        'keytabSecret',
        'serviceAccountSecret',
        'privateKeySecret',
        'oauthTokenSecret',
        'clientIdSecret',
        'sslKeystorePasswordSecret',
      ];
      for (const key of referenceKeys) {
        expect(classifyKey(key), `expected "${key}" to be reference`).toBe('reference');
      }
    });

    it('redacts live credential values including clientSecret and bare secret', () => {
      const secretKeys = [
        'password',
        'secret',
        'clientSecret',
        'secretKey',
        'apiKey',
        'token',
        'awsSecretAccessKey',
        'privateKey',
        'secretAccessKey',
      ];
      for (const key of secretKeys) {
        expect(classifyKey(key), `expected "${key}" to be secret`).toBe('secret');
      }
    });
  });

  describe('webview properties *Secret guard test', () => {
    /**
     * Recursively traverses a directory to find all non-test TSX files.
     *
     * @param dir Directory to traverse.
     * @returns Array of absolute file paths to TSX files.
     */
    function findTsxFiles(dir: string): string[] {
      const results: string[] = [];
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const dirent of list) {
        const fullPath = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
          results.push(...findTsxFiles(fullPath));
        } else if (dirent.isFile() && dirent.name.endsWith('.tsx') && !dirent.name.includes('.test.')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    it('guards that every *Secret reference identifier across property panels is treated as reference', () => {
      const propertiesDir = path.resolve(__dirname, '../../../webview/src/properties');
      const files = findTsxFiles(propertiesDir);
      expect(files.length).toBeGreaterThan(0);

      const matches = new Set<string>();
      const regex = /\b([a-z][A-Za-z0-9]*Secret)\b/g;

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        let m: RegExpExecArray | null;
        while ((m = regex.exec(content)) !== null) {
          matches.add(m[1]);
        }
      }

      expect(matches.size).toBeGreaterThan(0);

      for (const key of Array.from(matches).sort()) {
        if (key === 'clientSecret') {
          // clientSecret is the raw OIDC credential value (AzureBlobStoreFileSystem),
          // not a Secret Manager pointer. It is explicitly kept in SECRET_VALUE_PATTERNS
          // and must remain redacted (tested in Task 2b).
          expect(classifyKey(key), `expected raw "${key}" to remain secret`).toBe('secret');
          continue;
        }
        if (key.endsWith('ClientSecretSecret')) {
          // DOM element IDs in CdapIO, CogniteDataFusion, and GoogleAdsIO where the actual property
          // name is clientSecretSecret (covered by SECRET_REFERENCE_KEYS allowlist).
          expect(classifyKey('clientSecretSecret')).toBe('reference');
          continue;
        }
        expect(classifyKey(key), `expected "${key}" from webview properties to be classified as reference`).toBe('reference');
      }
    });
  });
});

describe('redactCredentialValues', () => {
  it('replaces a plaintext password and reports its path', () => {
    const { value, redactedPaths } = redactCredentialValues({
      transform: 'JdbcIO',
      username: 'admin',
      password: 'hunter2',
    });

    expect(value).toEqual({
      transform: 'JdbcIO',
      username: 'admin',
      password: REDACTION_PLACEHOLDER,
    });
    expect(redactedPaths).toEqual(['password']);
  });

  it('preserves a Secret Manager reference while destroying the adjacent value', () => {
    const { value } = redactCredentialValues({
      authMode: 'secretManager',
      passwordSecret: 'prod-db-password',
      password: 'hunter2',
    }) as { value: Record<string, unknown> };

    expect(value.authMode).toBe('secretManager');
    expect(value.passwordSecret).toBe('prod-db-password');
    expect(value.password).toBe(REDACTION_PLACEHOLDER);
  });

  it('does not mutate the input object', () => {
    const input = { password: 'hunter2' };
    redactCredentialValues(input);
    expect(input.password).toBe('hunter2');
  });

  it('walks arrays and records the index in the reported path', () => {
    const { value, redactedPaths } = redactCredentialValues({
      nodes: [
        { id: 'a', properties: { topic: 't' } },
        { id: 'b', properties: { password: 'hunter2' } },
      ],
    });

    expect(redactedPaths).toEqual(['nodes[1].properties.password']);
    expect((value as any).nodes[1].properties.password).toBe(REDACTION_PLACEHOLDER);
    expect((value as any).nodes[0].properties.topic).toBe('t');
  });

  it('redacts an entire object parked under a secret-classified key', () => {
    // An object under `credentials:` must not be descended into and partially kept.
    const { value, redactedPaths } = redactCredentialValues({
      credentials: { accessKeyId: 'AKIA...', secretAccessKey: 'shhh' },
    });

    expect((value as any).credentials).toBe(REDACTION_PLACEHOLDER);
    expect(redactedPaths).toEqual(['credentials']);
  });

  it('strips a credential embedded in a JDBC connection string', () => {
    const { value, redactedPaths } = redactCredentialValues({
      connectionUrl: 'jdbc:postgresql://db.example.com:5432/app?user=admin&password=hunter2&ssl=true',
    });

    expect((value as any).connectionUrl).toBe(
      `jdbc:postgresql://db.example.com:5432/app?user=admin&password=${REDACTION_PLACEHOLDER}&ssl=true`
    );
    // The host, database and unrelated parameters must survive so codegen still works.
    expect((value as any).connectionUrl).toContain('db.example.com:5432/app');
    expect((value as any).connectionUrl).toContain('ssl=true');
    expect(redactedPaths).toEqual(['connectionUrl']);
  });

  it('leaves empty and absent credential values alone rather than inventing a placeholder', () => {
    const { value, redactedPaths } = redactCredentialValues({
      password: '',
      token: null,
    });

    expect((value as any).password).toBe('');
    expect((value as any).token).toBeNull();
    expect(redactedPaths).toEqual([]);
  });

  it('redacts non-string credential values', () => {
    const { value } = redactCredentialValues({ password: 12345 });
    expect((value as any).password).toBe(REDACTION_PLACEHOLDER);
  });

  it('survives a cyclic object without hanging', () => {
    const cyclic: Record<string, unknown> = { password: 'hunter2' };
    cyclic.self = cyclic;

    const { value } = redactCredentialValues(cyclic);
    expect((value as any).password).toBe(REDACTION_PLACEHOLDER);
  });

  it('handles scalars and empty containers', () => {
    expect(redactCredentialValues('plain').value).toBe('plain');
    expect(redactCredentialValues(42).value).toBe(42);
    expect(redactCredentialValues(null).value).toBeNull();
    expect(redactCredentialValues({}).value).toEqual({});
    expect(redactCredentialValues([]).value).toEqual([]);
  });

  it('reports every leak in a multi-transform pipeline', () => {
    const { redactedPaths } = redactCredentialValues({
      nodes: [
        { properties: { password: 'a' } },
        { properties: { secretAccessKey: 'b' } },
        { properties: { passwordSecret: 'safe-pointer' } },
      ],
    });

    expect(redactedPaths).toEqual([
      'nodes[0].properties.password',
      'nodes[1].properties.secretAccessKey',
    ]);
  });
});

describe('tokenizeName / hasCredentialToken', () => {
  it('splits SCREAMING_SNAKE and camelCase alike', () => {
    expect(tokenizeName('DB_PW')).toEqual(['db', 'pw']);
    expect(tokenizeName('brokerPw')).toEqual(['broker', 'pw']);
    expect(tokenizeName('db.pw')).toEqual(['db', 'pw']);
  });

  it('recognises credential abbreviations only on a token boundary', () => {
    expect(hasCredentialToken('DB_PW')).toBe(true);
    expect(hasCredentialToken('brokerPwd')).toBe(true);
    expect(hasCredentialToken('AWS_CREDS')).toBe(true);
  });

  it('does not fire on words that merely contain the abbreviation', () => {
    // The whole point of token matching rather than substring matching.
    expect(hasCredentialToken('pwa_manifest')).toBe(false);
    expect(hasCredentialToken('networkPolicy')).toBe(false);
    expect(hasCredentialToken('crewSize')).toBe(false);
  });

  it('promotes an abbreviated name to secret via classifyKey', () => {
    expect(classifyKey('DB_PW')).toBe('secret');
    expect(classifyKey('brokerPw')).toBe('secret');
  });
});

describe('redactCredentialValues - name/value pair idiom', () => {
  // Regression: found by adversarial probe, NOT by the original test pass.
  // runtimeVariables carry the credential's identity in a sibling `name` field, so
  // key-based classification alone let the value through in plaintext.
  it('redacts a runtime variable whose name identifies a credential', () => {
    const { value, redactedPaths } = redactCredentialValues({
      runtimeVariables: [
        { name: 'DB_PASSWORD', value: 'hunter2' },
        { name: 'DB_PW', value: 'hunter2' },
        { name: 'BATCH_SIZE', value: '500' },
      ],
    });

    expect((value as any).runtimeVariables[0].value).toBe(REDACTION_PLACEHOLDER);
    expect((value as any).runtimeVariables[1].value).toBe(REDACTION_PLACEHOLDER);
    // A non-credential variable must survive untouched.
    expect((value as any).runtimeVariables[2].value).toBe('500');

    expect(redactedPaths).toEqual([
      'runtimeVariables[0].value (DB_PASSWORD)',
      'runtimeVariables[1].value (DB_PW)',
    ]);
  });

  it('records pair variable name in redactedPaths and notice text for runtime variables', () => {
    const { value, redactedPaths } = redactCredentialValues({
      runtimeVariables: [{ name: 'DB_PASSWORD', value: 'hunter2' }],
    });

    expect(value.runtimeVariables[0].value).toBe(REDACTION_PLACEHOLDER);
    expect(redactedPaths).toContain('runtimeVariables[0].value (DB_PASSWORD)');

    const notice = buildRedactionPromptNotice(redactedPaths);
    expect(notice).toContain('DB_PASSWORD');
  });

  it('preserves the variable name so codegen can still wire up the env var', () => {
    const { value } = redactCredentialValues({
      runtimeVariables: [{ name: 'DB_PASSWORD', value: 'hunter2' }],
    });
    expect((value as any).runtimeVariables[0].name).toBe('DB_PASSWORD');
  });

  it('supports the key/value spelling of the same idiom', () => {
    const { value } = redactCredentialValues({ key: 'API_TOKEN', value: 'abc123' });
    expect((value as any).value).toBe(REDACTION_PLACEHOLDER);
  });

  it('leaves a pair alone when the name is not credential-like', () => {
    const { value, redactedPaths } = redactCredentialValues({ name: 'REGION', value: 'us-central1' });
    expect((value as any).value).toBe('us-central1');
    expect(redactedPaths).toEqual([]);
  });

  it('does not treat an object as a pair when it has no value field', () => {
    const { value, redactedPaths } = redactCredentialValues({ name: 'DB_PASSWORD', description: 'the db password' });
    expect((value as any).description).toBe('the db password');
    expect(redactedPaths).toEqual([]);
  });

  it('does not misfire when name is not a string', () => {
    const { value } = redactCredentialValues({ name: 42, value: 'safe' });
    expect((value as any).value).toBe('safe');
  });
});
describe('redactPipelineYaml', () => {
  it('round-trips a pipeline through YAML with the password removed', () => {
    const yamlText = YAML.stringify({
      nodes: [{ id: 'jdbc', properties: { username: 'admin', password: 'hunter2' } }],
    });

    const { value, redactedPaths } = redactPipelineYaml(yamlText);

    expect(redactedPaths).toEqual(['nodes[0].properties.password']);
    expect(value).not.toContain('hunter2');
    expect(value).toContain(REDACTION_PLACEHOLDER);

    // The rest of the pipeline must still parse and be intact.
    const reparsed = YAML.parse(value);
    expect(reparsed.nodes[0].id).toBe('jdbc');
    expect(reparsed.nodes[0].properties.username).toBe('admin');
  });

  it('returns the original text byte-for-byte when there is nothing to redact', () => {
    // Preserves comments and formatting for the overwhelmingly common clean case.
    const yamlText = '# my pipeline\nnodes:\n  - id: pubsub\n    properties:\n      topic: projects/p/topics/t\n';
    const { value, redactedPaths } = redactPipelineYaml(yamlText);

    expect(redactedPaths).toEqual([]);
    expect(value).toBe(yamlText);
  });

  it('throws rather than passing through unparseable YAML', () => {
    // Malformed input must not become a bypass for the redaction control.
    expect(() => redactPipelineYaml('nodes:\n  - id: a\n   bad indent: [unclosed'))
      .toThrow(/could not be parsed/i);
  });

  it('names the failure clearly enough to act on', () => {
    expect(() => redactPipelineYaml('{ unterminated'))
      .toThrow(/Refusing to send pipeline to the code generator/);
  });

  it('handles an empty or comment-only document', () => {
    expect(redactPipelineYaml('').redactedPaths).toEqual([]);
    expect(redactPipelineYaml('# nothing here\n').redactedPaths).toEqual([]);
  });

  it('does not leak the secret anywhere in the serialized output', () => {
    // Broad backstop: the literal must be absent from the whole document, not just
    // from the key we expected it under.
    const yamlText = YAML.stringify({
      nodes: [
        { properties: { password: 'sup3rs3cr3t' } },
        { properties: { jmsPassword: 'sup3rs3cr3t' } },
        { properties: { connectionUrl: 'jdbc:mysql://h/d?password=sup3rs3cr3t' } },
      ],
    });

    const { value } = redactPipelineYaml(yamlText);
    expect(value).not.toContain('sup3rs3cr3t');
  });
});

describe('buildRedactionPromptNotice', () => {
  it('returns nothing when no credentials were redacted', () => {
    expect(buildRedactionPromptNotice([])).toBe('');
  });

  it('tells the model the placeholder is not a real credential', () => {
    const notice = buildRedactionPromptNotice(['nodes[0].properties.password']);
    expect(notice).toContain(REDACTION_PLACEHOLDER);
    expect(notice).toContain('NOT a real credential');
  });

  it('lists every redacted path and directs the model to environment variables', () => {
    const notice = buildRedactionPromptNotice([
      'nodes[0].properties.password',
      'nodes[1].properties.secretAccessKey',
    ]);

    expect(notice).toContain('nodes[0].properties.password');
    expect(notice).toContain('nodes[1].properties.secretAccessKey');
    expect(notice).toMatch(/environment variable/i);
    expect(notice).toContain('os.environ');
    expect(notice).toContain('System.getenv');
  });
});

describe('code generation prompt templates', () => {
  // The UI has emitted Secret Manager references (secretName / accessKeySecret /
  // passwordSecret) for 22 property forms, but neither prompt template mentioned Secret
  // Manager at all, so the generator silently ignored the reference and produced code
  // that never fetched the secret. These tests pin the guidance in place.
  const templateDir = path.join(__dirname, '..', '..', '..', 'resources');
  const templates = [
    ['python', 'code-gen-prompt-python.txt'],
    ['java', 'code-gen-prompt-java.txt'],
  ] as const;

  for (const [language, filename] of templates) {
    describe(language, () => {
      const content = fs.readFileSync(path.join(templateDir, filename), 'utf-8');

      it('carries the global credential handling section', () => {
        expect(content).toContain('## Credential Handling Rules');
      });

      it('explains that a *Secret property is an ID, not the credential', () => {
        expect(content).toContain('passwordSecret');
        expect(content).toContain('accessKeySecret');
        expect(content).toContain('secretName');
      });

      it('directs the model to resolve secrets once at construction, not per element', () => {
        // Phrased tolerantly: the Java template wraps this sentence across lines, so
        // match the invariant rather than an exact run of words.
        expect(content).toMatch(/Resolve the secret ONCE/);
        expect(content).toMatch(/never[\s\S]{0,40}(per element|DoFn)/i);
      });

      it('uses the exact placeholder the redactor emits', () => {
        // If REDACTION_PLACEHOLDER is ever changed, this fails rather than leaving the
        // template silently describing a string that no longer appears in any prompt.
        expect(content).toContain(REDACTION_PLACEHOLDER);
      });

      it('tells the model not to emit the placeholder as a literal', () => {
        expect(content).toMatch(/environment variable/i);
      });

      it('keys the Secret Manager convention on the "ends in Secret" suffix', () => {
        // clientSecretSecret / secretKeySecret / sessionTokenSecret rely on this rule.
        expect(content).toMatch(/name ends in `Secret`/);
      });
    });
  }
});

describe('IO68–IO79 connector credential keys', () => {
  it('classifies the new connector Secret Manager pointers as reference', () => {
    for (const key of [
      'clientSecretSecret',
      'secretKeySecret',
      'sessionTokenSecret',
      'connectionStringSecret',
      'uriSecret',
    ]) {
      expect(classifyKey(key), key).toBe('reference');
    }
  });

  it('keeps the existing allowlisted keys reused by IO68–IO79 as reference', () => {
    for (const key of ['passwordSecret', 'tokenSecret', 'apiKeySecret', 'accessKeySecret', 'credentialsSecret', 'secretVersion']) {
      expect(classifyKey(key), key).toBe('reference');
    }
  });

  it('still redacts the bare value forms of the new credentials', () => {
    for (const key of ['clientSecret', 'secretKey', 'awsSecretAccessKey', 'sessionToken', 'awsSessionToken', 'connectionStringPassword']) {
      expect(classifyKey(key), key).toBe('secret');
    }
  });

  it('preserves prefixed *Secret reference variants under suffix rule while redacting bare secret values', () => {
    for (const key of ['saslPasswordSecret', 'sourcePasswordSecret', 'dbUrlSecret']) {
      expect(classifyKey(key), key).toBe('reference');
    }
    for (const key of ['saslPassword', 'sourcePassword', 'dbPassword']) {
      expect(classifyKey(key), key).toBe('secret');
    }
  });

  it('pins that the renamed non-credential connector keys are safe', () => {
    const safe = [
      'authServerUrl', 'azureTenantId', 'authType', 'clientId', 'authScopes',
      'ertAuthEnabled', 'ertAuthStoreLocation', 'ertAuthPath', 'authServer', 'authPort',
      'headNodeURL', 'connectionString', 'timestampColumn', 'destDataset',
      'regionName', 'endpointUrl', 'deliveryStreamName', 'ownerAccId',
      'cloudSqlInstance', 'dbDriver', 'extraAttributes', 'datasource', 'columns',
      'consumerConfig', 'producerConfig', 'saslUsername', 'saslMechanism', 'uri', 'consumerTag',
      'resolveOnWorkers', 'connectionProperties', 'driverJars', 'jdbcType',
      'instanceId', 'appProfileId', 'configuration',
    ];
    for (const key of safe) {
      expect(classifyKey(key), key).toBe('safe');
    }
  });

  it('documents the upstream option names that MUST NOT be used as property keys', () => {
    // Non-credential options whose natural names would have their values wiped.
    for (const key of ['tokenUrl', 'tokenAuth', 'tokenStore', 'tokenAuthPath', 'secret_manager']) {
      expect(classifyKey(key), key).toBe('secret');
    }
  });

  it('preserves Cognite, PyIO and TREP pointers end-to-end through redactPipelineYaml', () => {
    const yamlText = YAML.stringify({
      nodes: [
        { properties: { authType: 'clientCredentials', clientId: 'app', clientSecretSecret: 'cdf-client-secret', authServerUrl: 'https://login.microsoftonline.com/t/oauth2/v2.0/token' } },
        { properties: { accessKeySecret: 'aws-key-id', secretKeySecret: 'aws-secret', sessionTokenSecret: 'aws-session' } },
        { properties: { ertAuthEnabled: true, ertAuthStoreLocation: 'gs://b/tmp', passwordSecret: 'trep-pw' } },
        { properties: { connectionStringSecret: 'odbc-conn', uriSecret: 'amqp-uri' } },
      ],
    });
    const { value, redactedPaths } = redactPipelineYaml(yamlText);
    expect(redactedPaths).toEqual([]);
    expect(value).toBe(yamlText);
  });
});

describe('URL credential scrubbing (IO74/IO76/IO78/IO79)', () => {
  const scrub = (key: string, input: string) => {
    const result = redactCredentialValues<Record<string, string>>({ [key]: input });
    return { out: result.value[key], paths: result.redactedPaths };
  };

  it('redacts a password in URI userinfo while keeping user and host', () => {
    const { out, paths } = scrub('uri', 'amqp://guest:hunter2@host:5672/vh');
    expect(out).toBe(`amqp://guest:${REDACTION_PLACEHOLDER}@host:5672/vh`);
    expect(paths).toEqual(['uri']);
  });

  it('redacts userinfo in SQLAlchemy-style URLs and empty-user URIs', () => {
    const sqlalchemy = scrub('dbUrl', 'postgresql+pg8000://user:hunter2@/db?unix_sock=/cloudsql/x');
    expect(sqlalchemy.out).not.toContain('hunter2');
    expect(sqlalchemy.out).toContain('/cloudsql/x');
    expect(sqlalchemy.out).toContain('user:');

    const redis = scrub('url', 'redis://:pw@h');
    expect(redis.out).toBe(`redis://:${REDACTION_PLACEHOLDER}@h`);
  });

  it('redacts a leading PWD= / password= with no delimiter', () => {
    expect(scrub('extraAttributes', 'PWD=hunter2;Encrypt=yes').out).toBe(`PWD=${REDACTION_PLACEHOLDER};Encrypt=yes`);
    expect(scrub('connectionProperties', 'password=hunter2;ssl=true').out).toBe(`password=${REDACTION_PLACEHOLDER};ssl=true`);
  });

  it('redacts PWD= after "; " with whitespace', () => {
    const { out, paths } = scrub('extraAttributes', 'Encrypt=yes; PWD=hunter2');
    expect(out).toBe(`Encrypt=yes; PWD=${REDACTION_PLACEHOLDER}`);
    expect(paths).toEqual(['extraAttributes']);
  });

  it('still redacts the classic query-string form', () => {
    expect(scrub('url', 'jdbc:sqlserver://h:1433;databaseName=d;password=x').out)
      .toBe(`jdbc:sqlserver://h:1433;databaseName=d;password=${REDACTION_PLACEHOLDER}`);
  });

  it('does not touch URLs or strings without embedded credentials', () => {
    for (const s of [
      'http://host:8080/path',
      'gs://bucket/a@b',
      'jdbc:mysql://my-host:3306/database',
      'https://api.tinybird.co',
      'ssh://git@github.com:22/x',
      'user@example.com',
      'SELECT * FROM t WHERE tokenize=1',
    ]) {
      const { out, paths } = scrub('v', s);
      expect(out, s).toBe(s);
      expect(paths, s).toEqual([]);
    }
  });
});

describe('Bigtable configuration map (IO68)', () => {
  it('redacts google.bigtable.auth.json.value in pair and map form', () => {
    const pairs = redactCredentialValues({ configuration: [{ key: 'google.bigtable.auth.json.value', value: '{"k":1}' }] });
    expect(pairs.redactedPaths).toEqual(['configuration[0].value (google.bigtable.auth.json.value)']);
    const map = redactCredentialValues({ configuration: { 'google.bigtable.auth.json.value': '{"k":1}' } });
    expect(map.redactedPaths).toEqual(['configuration.google.bigtable.auth.json.value']);
  });

  it('leaves ordinary Bigtable tuning keys alone', () => {
    const r = redactCredentialValues({ configuration: [{ key: 'google.bigtable.rpc.timeout.ms', value: '5000' }] });
    expect(r.redactedPaths).toEqual([]);
  });
});
