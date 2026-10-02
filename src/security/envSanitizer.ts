/**
 * @fileoverview Validation of user-supplied runtime variables before they are
 * merged into the environment of a spawned runner script (finding S1).
 *
 * Runtime variables come from the `.beam` file, which may be authored by
 * someone else (a cloned repo, a shared sample). Letting such a file set
 * variables like `BASH_ENV`, `LD_PRELOAD` or `JAVA_TOOL_OPTIONS` would allow it
 * to execute arbitrary code the moment the user clicks Run, independent of the
 * generated script contents. This module restricts keys to plain identifiers
 * and blocks the variables that control shells, dynamic loaders and language
 * runtimes.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/** Plain POSIX-style environment variable identifier. */
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Exact variable names (compared upper-cased) that change how a shell,
 * interpreter or JVM starts up and therefore must never come from a pipeline.
 */
const DENIED_ENV_KEYS: ReadonlySet<string> = new Set([
    'PATH',
    'BASH_ENV',
    'ENV',
    'SHELLOPTS',
    'BASHOPTS',
    'CDPATH',
    'IFS',
    'PS4',
    'PROMPT_COMMAND',
    'PYTHONPATH',
    'PYTHONSTARTUP',
    'PYTHONHOME',
    'PYTHONINSPECT',
    'JAVA_TOOL_OPTIONS',
    'JDK_JAVA_OPTIONS',
    '_JAVA_OPTIONS',
    'MAVEN_OPTS',
    'NODE_OPTIONS',
]);

/** Prefixes (compared upper-cased) for dynamic-loader control variables. */
const DENIED_ENV_PREFIXES: readonly string[] = ['LD_', 'DYLD_', 'BASH_FUNC_'];

/**
 * Returns true when `key` is a well-formed identifier that is safe to pass
 * into a child process environment.
 *
 * @param key Candidate environment variable name (already trimmed).
 * @returns Whether the key may be set from a runtime variable.
 */
export function isAllowedEnvKey(key: string): boolean {
    if (typeof key !== 'string' || !ENV_KEY_PATTERN.test(key)) {
        return false;
    }
    const upper = key.toUpperCase();
    if (DENIED_ENV_KEYS.has(upper)) {
        return false;
    }
    return !DENIED_ENV_PREFIXES.some((prefix) => upper.startsWith(prefix));
}

/**
 * A single user-defined runtime variable as stored in the pipeline YAML.
 */
export interface RuntimeVariable {
    key: string;
    value: string;
}

/**
 * Copies allowed runtime variables into `env` (mutating it). Blank keys are
 * silently ignored; keys that fail {@link isAllowedEnvKey} are skipped and
 * returned so the caller can surface a warning.
 *
 * @param env Environment map that will be passed to `spawn`.
 * @param variables Runtime variables from the webview message (may be absent).
 * @returns The trimmed keys that were rejected, in input order.
 */
export function applyRuntimeVariables(
    env: Record<string, string>,
    variables: readonly RuntimeVariable[] | undefined
): string[] {
    const rejected: string[] = [];
    if (!Array.isArray(variables)) {
        return rejected;
    }
    for (const variable of variables) {
        const key = typeof variable?.key === 'string' ? variable.key.trim() : '';
        if (!key) {
            continue;
        }
        if (!isAllowedEnvKey(key)) {
            rejected.push(key);
            continue;
        }
        env[key] = variable.value || '';
    }
    return rejected;
}
