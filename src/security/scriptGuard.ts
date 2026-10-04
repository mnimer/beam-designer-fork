/** @fileoverview Provides path safety validation, shell metacharacter guards, and runner script allowlists.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as path from 'path';

/**
 * Allowlist of shell script basenames permitted to receive executable permissions (chmod 755).
 * Based on templates in `resources/templates/` and runner script invocations in `src/extension.ts`:
 * - `run_directrunner.sh`
 * - `run_dataflowrunner.sh`
 * - `run_dataflow.sh`
 * - `run_sparkrunner.sh`
 * - `run_spark.sh`
 */
export const ALLOWED_EXECUTABLE_SCRIPTS: ReadonlySet<string> = new Set([
    'run_directrunner.sh',
    'run_dataflowrunner.sh',
    'run_dataflow.sh',
    'run_sparkrunner.sh',
    'run_spark.sh',
]);

/**
 * Validates whether a file is permitted to be marked executable (chmod 755).
 * Enforces an exact allowlist of known runner script basenames to prevent LLM-directed chmod
 * on untrusted scripts (e.g. `evil.sh`) or non-script artifacts.
 *
 * @param filePath The file path or filename to evaluate
 * @returns true if the file basename is in ALLOWED_EXECUTABLE_SCRIPTS and has a .sh extension
 */
export function isAllowedExecutableScript(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') {
        return false;
    }
    const basename = path.basename(filePath.trim());
    if (!basename.endsWith('.sh')) {
        return false;
    }
    return ALLOWED_EXECUTABLE_SCRIPTS.has(basename);
}

/**
 * Resolves and validates a model-supplied candidate filename against a target directory,
 * guaranteeing that the resolved output path is strictly contained within the target folder.
 * 
 * Enforces strict containment security:
 * - Rejects null, undefined, non-string, and empty or whitespace-only inputs
 * - Rejects absolute paths (e.g. `/etc/passwd`)
 * - Rejects Windows drive letters (e.g. `C:\...`, `D:/...`) and UNC paths
 * - Resolves path and verifies it remains strictly inside the target folder
 * - Rejects paths resolving to the target folder itself (e.g. `.` or `./`)
 * - Rejects directory traversal escapes (e.g. `../../`, `src/../../../../tmp/pwned.sh`)
 *
 * @param targetFolderPath The root directory where files are allowed to be written
 * @param filename The model-supplied candidate filename or relative path
 * @returns Fully resolved safe file path, or null if the path is invalid or attempts to escape
 */
export function resolveSafeOutputPath(targetFolderPath: string, filename: string): string | null {
    // Fail fast if arguments are missing or invalid
    if (!targetFolderPath || typeof targetFolderPath !== 'string') {
        return null;
    }
    if (!filename || typeof filename !== 'string') {
        return null;
    }

    const trimmedFilename = filename.trim();
    if (!trimmedFilename) {
        return null;
    }

    // Explicitly reject absolute paths, Windows drive-letter paths (C:..., c:/...), and UNC paths
    if (
        path.isAbsolute(trimmedFilename) ||
        path.win32.isAbsolute(trimmedFilename) ||
        /^[a-zA-Z]:/.test(trimmedFilename) ||
        trimmedFilename.startsWith('/') ||
        trimmedFilename.startsWith('\\')
    ) {
        return null;
    }

    // Normalize Windows backslashes to forward slashes to prevent traversal evasion across platforms
    const normalized = trimmedFilename.replace(/\\/g, '/');
    const resolvedTarget = path.resolve(targetFolderPath);
    const resolvedPath = path.resolve(resolvedTarget, normalized);

    // Compute relative path from target directory to target file
    const rel = path.relative(resolvedTarget, resolvedPath);

    // Assert that the file is strictly inside targetFolderPath:
    // - !rel rejects a filename that resolves to the target folder itself
    // - rel === '.' also rejects the target folder itself
    // - rel.startsWith('..') rejects traversal out of the target folder
    // - path.isAbsolute(rel) / path.win32.isAbsolute(rel) rejects cross-drive or absolute relative paths
    if (!rel || rel === '.' || rel.startsWith('..') || path.isAbsolute(rel) || path.win32.isAbsolute(rel)) {
        return null;
    }

    return resolvedPath;
}

/**
 * Regular expression matching shell metacharacters that must not appear in folder paths
 * passed to terminal execution or path resolution to prevent shell command injection.
 * Prohibits: " ' ` $ ; & | > < \r \n
 */
export const SHELL_METASYMBOLS_REGEX = /["'`$;|&><\r\n]/;

/**
 * Validates whether a folder path or directory name is safe from shell command injection.
 * Rejects null, undefined, non-string, whitespace-only strings, and paths containing shell metacharacters
 * (`"`, `'`, '`', `$`, `;`, `&`, `|`, `>`, `<`, `\n`, `\r`).
 *
 * @param folderPath The directory path or folder name to validate
 * @returns true if the path is valid and free of dangerous shell metacharacters; false otherwise
 */
export function isSafeFolderPath(folderPath: unknown): boolean {
    if (!folderPath || typeof folderPath !== 'string') {
        return false;
    }
    const trimmed = folderPath.trim();
    if (trimmed.length === 0) {
        return false;
    }
    // Reject any string containing shell metacharacters
    if (SHELL_METASYMBOLS_REGEX.test(trimmed)) {
        return false;
    }
    return true;
}

/**
 * Checks whether an existing terminal's creation options specify a cwd matching the desired folder path.
 * Normalizes string and Uri-like cwd values and compares resolved paths to handle trailing slashes
 * and redundant path segments.
 * 
 * @param creationOptions The creationOptions from vscode.Terminal (TerminalOptions | ExtensionTerminalOptions)
 * @param folderPath The target directory path to match
 * @returns true if creationOptions has a cwd matching folderPath; false otherwise
 */
export function terminalCwdMatches(creationOptions: unknown, folderPath: string): boolean {
    if (!creationOptions || typeof creationOptions !== 'object' || !folderPath) {
        return false;
    }
    const opts = creationOptions as { cwd?: string | { fsPath?: string } };
    if (!opts.cwd) {
        return false;
    }
    const cwdStr = typeof opts.cwd === 'string' ? opts.cwd : opts.cwd.fsPath;
    if (!cwdStr || typeof cwdStr !== 'string') {
        return false;
    }
    return path.resolve(cwdStr) === path.resolve(folderPath);
}
