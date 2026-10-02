/**
 * File and directory filtering utilities for Apache Beam Designer.
 * 
 * Purpose:
 * Centralizes directory and file exclusion logic so virtual environments (venv, .venv),
 * package dependencies (node_modules, site-packages), build outputs (target, dist, build),
 * and cache/dot directories are consistently excluded across the UI and file pickers.
 */

export const IGNORED_DIRECTORY_NAMES = new Set([
  'venv',
  '.venv',
  'env',
  '.env',
  'virtualenv',
  '.virtualenv',
  'node_modules',
  '__pycache__',
  'target',
  'build',
  'dist',
  'out',
  'bin',
  'site-packages',
  'dist-packages',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.tox',
  '.nox',
  '.eggs',
  '.git',
  '.github',
  '.idea',
  '.vscode'
]);

/**
 * Checks if a given relative or absolute file path belongs to an ignored directory,
 * virtual environment, or hidden cache structure.
 * 
 * @param filePath The file path to test
 * @returns true if the file should be ignored/hidden
 */
export function isIgnoredPath(filePath: string): boolean {
  if (!filePath) return true;
  const parts = filePath.toLowerCase().replace(/\\/g, '/').split('/');
  return parts.some(part => {
    if (!part) return false;
    if (part === '.dockerignore' || part === '.gcloudignore') return false;
    if (IGNORED_DIRECTORY_NAMES.has(part)) return true;
    if (part.startsWith('.') || part.endsWith('.egg-info')) return true;
    return false;
  });
}

/**
 * Filters a list of file paths to only include visible source code files (.py, .java)
 * that do not belong to virtual environments or build caches.
 * 
 * @param files List of relative file paths
 * @returns Filtered list of valid source code files
 */
export function filterSourceFiles(files: string[]): string[] {
  return (files || []).filter(
    (file) => (file.endsWith('.py') || file.endsWith('.java')) && !isIgnoredPath(file)
  );
}
