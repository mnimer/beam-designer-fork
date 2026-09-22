import { describe, it, expect } from 'vitest';
import { isIgnoredPath, filterSourceFiles } from './fileFilters';

describe('fileFilters', () => {
  describe('isIgnoredPath', () => {
    it('returns true for empty or falsy paths', () => {
      expect(isIgnoredPath('')).toBe(true);
    });

    it('identifies virtual environment directories as ignored', () => {
      expect(isIgnoredPath('venv/bin/python')).toBe(true);
      expect(isIgnoredPath('venv/lib/python3.11/site-packages/pkg/__init__.py')).toBe(true);
      expect(isIgnoredPath('.venv/lib/site-packages/google/cloud/storage/__init__.py')).toBe(true);
      expect(isIgnoredPath('env/bin/activate')).toBe(true);
      expect(isIgnoredPath('.env')).toBe(true);
      expect(isIgnoredPath('virtualenv/lib/pkg.py')).toBe(true);
    });

    it('identifies package dependency and build cache directories as ignored', () => {
      expect(isIgnoredPath('node_modules/react/index.js')).toBe(true);
      expect(isIgnoredPath('__pycache__/pipeline.cpython-311.pyc')).toBe(true);
      expect(isIgnoredPath('target/classes/Pipeline.class')).toBe(true);
      expect(isIgnoredPath('build/libs/app.jar')).toBe(true);
      expect(isIgnoredPath('dist/index.js')).toBe(true);
      expect(isIgnoredPath('out/bundle.js')).toBe(true);
      expect(isIgnoredPath('.pytest_cache/v/cache')).toBe(true);
      expect(isIgnoredPath('.mypy_cache/3.11/pipeline.data.json')).toBe(true);
      expect(isIgnoredPath('my_package.egg-info/PKG-INFO')).toBe(true);
    });

    it('identifies hidden dot directories as ignored', () => {
      expect(isIgnoredPath('.git/HEAD')).toBe(true);
      expect(isIgnoredPath('.github/workflows/test.yml')).toBe(true);
      expect(isIgnoredPath('.idea/workspace.xml')).toBe(true);
      expect(isIgnoredPath('.vscode/settings.json')).toBe(true);
      expect(isIgnoredPath('.DS_Store')).toBe(true);
    });

    it('allows valid generated ignore files', () => {
      expect(isIgnoredPath('.dockerignore')).toBe(false);
      expect(isIgnoredPath('.gcloudignore')).toBe(false);
    });

    it('allows normal source files and nested user subdirectories', () => {
      expect(isIgnoredPath('pipeline.py')).toBe(false);
      expect(isIgnoredPath('src/main/java/Pipeline.java')).toBe(false);
      expect(isIgnoredPath('transforms/parse.py')).toBe(false);
      expect(isIgnoredPath('requirements.txt')).toBe(false);
      expect(isIgnoredPath('pom.xml')).toBe(false);
    });

    it('handles Windows backslash separators', () => {
      expect(isIgnoredPath('venv\\lib\\site-packages\\pkg.py')).toBe(true);
      expect(isIgnoredPath('src\\main\\java\\Pipeline.java')).toBe(false);
    });
  });

  describe('filterSourceFiles', () => {
    it('filters out non-source files, venv files, and cache files', () => {
      const files = [
        'pipeline.py',
        'transforms/custom_fn.py',
        'Pipeline.java',
        'requirements.txt',
        'pom.xml',
        'venv/lib/python3.11/site-packages/apache_beam/pipeline.py',
        '.venv/lib/site-packages/requests/api.py',
        '__pycache__/pipeline.cpython-311.pyc',
        'target/generated-sources/Proto.java',
        'node_modules/package/index.js'
      ];

      const filtered = filterSourceFiles(files);
      expect(filtered).toEqual([
        'pipeline.py',
        'transforms/custom_fn.py',
        'Pipeline.java'
      ]);
    });

    it('handles empty or null lists safely', () => {
      expect(filterSourceFiles([])).toEqual([]);
      expect(filterSourceFiles(null as any)).toEqual([]);
    });
  });
});
