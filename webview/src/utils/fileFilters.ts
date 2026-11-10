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
    if (part === '.dockerignore' || part === '.gcloudignore' || part === '.gitignore') return false;
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

const IGNORED_GENERATED_FILE_NAMES = new Set([
  'gemini.log',
  '.ds_store',
  'thumbs.db',
]);

/**
 * Filters a list of file paths from the output folder to include all user-facing
 * generated project files (source code, dependencies, README, Dockerfile, scripts,
 * config files) while excluding virtual environments, caches, and internal logs.
 */
export function filterGeneratedFiles(files: string[]): string[] {
  return (files || []).filter((file) => {
    if (!file || isIgnoredPath(file)) return false;
    const lower = file.toLowerCase().replace(/\\/g, '/');
    const baseName = lower.split('/').pop() || lower;
    if (IGNORED_GENERATED_FILE_NAMES.has(baseName)) return false;
    if (
      baseName.endsWith('.pyc') ||
      baseName.endsWith('.pyo') ||
      baseName.endsWith('.class')
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Computes a sort priority for a generated project file so primary pipeline
 * source files appear first, followed by tests, dependencies, docs, Docker/CI,
 * and helper scripts.
 */
function getGeneratedFilePriority(file: string, language: 'Python' | 'Java'): number {
  const normalized = file.replace(/\\/g, '/');
  const baseName = normalized.split('/').pop() || normalized;
  const lower = baseName.toLowerCase();
  const isTargetSource =
    language === 'Java' ? lower.endsWith('.java') : lower.endsWith('.py');
  const isAnySource = lower.endsWith('.py') || lower.endsWith('.java');
  const isTest =
    lower.startsWith('test_') ||
    lower.endsWith('_test.py') ||
    lower.endsWith('test.java') ||
    normalized.toLowerCase().includes('/test/') ||
    normalized.toLowerCase().includes('/tests/');

  if (lower === 'pipeline.py' || lower === 'pipeline.java') {
    return isTargetSource ? 0 : 1;
  }
  if (isTargetSource && !isTest && lower !== '__init__.py') {
    return 1;
  }
  if (isAnySource && !isTest && lower !== '__init__.py') {
    return 2;
  }
  if (isTest) {
    return 3;
  }
  if (
    lower === 'requirements.txt' ||
    lower === 'pom.xml' ||
    lower === 'pyproject.toml' ||
    lower === 'setup.py' ||
    lower === 'build.gradle'
  ) {
    return 4;
  }
  if (lower === 'readme.md' || lower.endsWith('.md')) {
    return 5;
  }
  if (
    lower === 'dockerfile' ||
    lower.startsWith('dockerfile.') ||
    lower === 'cloudbuild.yaml' ||
    lower === 'cloudbuild.yml'
  ) {
    return 6;
  }
  if (lower.endsWith('.sh')) {
    return 7;
  }
  if (lower === '__init__.py') {
    return 9;
  }
  return 8;
}

/**
 * Orders generated files with primary pipeline code first, followed by
 * supporting modules, tests, dependencies, documentation, and container configs.
 */
export function sortGeneratedFiles(
  files: string[],
  language: 'Python' | 'Java' = 'Python',
): string[] {
  return [...files].sort((a, b) => {
    const priorityDiff =
      getGeneratedFilePriority(a, language) - getGeneratedFilePriority(b, language);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return a.localeCompare(b);
  });
}
