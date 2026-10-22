/**
 * @fileoverview Color-coding schemes, badges, icon indicators, and descriptions for generated files.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Color and badge metadata for a generated file entry.
 */
export interface FileColorInfo {
  readonly category:
    | 'python'
    | 'java'
    | 'test'
    | 'terraform'
    | 'docker'
    | 'deps'
    | 'config'
    | 'docs'
    | 'script'
    | 'other';
  readonly badgeLabel: string;
  readonly iconColor: string;
  readonly badgeClass: string;
  readonly tabActiveClass: string;
  readonly dotColor: string;
}

/**
 * Returns color-coding metadata and badge classes for a given filename or relative path.
 */
export function getFileColorInfo(fileName: string): FileColorInfo {
  const normalized = (fileName || '').replace(/\\/g, '/');
  const baseName = normalized.split('/').pop() || normalized;
  const lower = baseName.toLowerCase();
  const ext = lower.includes('.') ? lower.split('.').pop() || '' : '';

  // 1. Test files
  if (
    lower.startsWith('test_') ||
    lower.endsWith('_test.py') ||
    lower.endsWith('test.java') ||
    lower.includes('.test.')
  ) {
    return {
      category: 'test',
      badgeLabel: 'TEST',
      iconColor: 'text-pink-400',
      badgeClass: 'bg-pink-950/60 text-pink-300 border-pink-500/40',
      tabActiveClass: 'bg-[#0d1117] text-white border-t-2 border-pink-400 font-semibold',
      dotColor: 'bg-pink-400',
    };
  }

  // 2. Terraform / Infrastructure as Code
  if (ext === 'tf' || ext === 'tfvars' || lower.includes('terraform')) {
    return {
      category: 'terraform',
      badgeLabel: 'IAC',
      iconColor: 'text-purple-400',
      badgeClass: 'bg-purple-950/60 text-purple-300 border-purple-500/40',
      tabActiveClass: 'bg-[#0d1117] text-white border-t-2 border-purple-400 font-semibold',
      dotColor: 'bg-purple-400',
    };
  }

  // 3. Docker / Containers
  if (
    lower === 'dockerfile' ||
    lower === '.dockerignore' ||
    ext === 'dockerfile' ||
    lower.includes('docker-compose')
  ) {
    return {
      category: 'docker',
      badgeLabel: 'DOCKER',
      iconColor: 'text-cyan-400',
      badgeClass: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40',
      tabActiveClass: 'bg-[#0d1117] text-white border-t-2 border-cyan-400 font-semibold',
      dotColor: 'bg-cyan-400',
    };
  }

  // 4. Dependencies & environment configs
  if (
    lower === 'requirements.txt' ||
    lower === 'pom.xml' ||
    lower === 'pyproject.toml' ||
    lower === 'pipfile' ||
    lower.startsWith('.env')
  ) {
    return {
      category: 'deps',
      badgeLabel: 'DEPS',
      iconColor: 'text-amber-400',
      badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
      tabActiveClass: 'bg-[#0d1117] text-white border-t-2 border-amber-400 font-semibold',
      dotColor: 'bg-amber-400',
    };
  }

  // 5. Config files: JSON, JSONL, YAML, TOML, XML
  if (ext === 'json' || ext === 'jsonl' || ext === 'yaml' || ext === 'yml' || ext === 'toml' || ext === 'xml') {
    return {
      category: 'config',
      badgeLabel: ext.toUpperCase(),
      iconColor: 'text-yellow-400',
      badgeClass: 'bg-yellow-950/60 text-yellow-300 border-yellow-500/40',
      tabActiveClass: 'bg-[#0d1117] text-white border-t-2 border-yellow-400 font-semibold',
      dotColor: 'bg-yellow-400',
    };
  }

  // 6. Documentation / Markdown
  if (ext === 'md' || lower.startsWith('readme') || ext === 'rst' || ext === 'txt') {
    return {
      category: 'docs',
      badgeLabel: 'DOC',
      iconColor: 'text-blue-400',
      badgeClass: 'bg-blue-950/60 text-blue-300 border-blue-500/40',
      tabActiveClass: 'bg-[#0d1117] text-white border-t-2 border-blue-400 font-semibold',
      dotColor: 'bg-blue-400',
    };
  }

  // 7. Shell scripts
  if (ext === 'sh' || ext === 'bash' || ext === 'zsh') {
    return {
      category: 'script',
      badgeLabel: 'SH',
      iconColor: 'text-emerald-400',
      badgeClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
      tabActiveClass: 'bg-[#0d1117] text-white border-t-2 border-emerald-400 font-semibold',
      dotColor: 'bg-emerald-400',
    };
  }

  // 8. Python source files
  if (ext === 'py') {
    return {
      category: 'python',
      badgeLabel: 'PY',
      iconColor: 'text-sky-400',
      badgeClass: 'bg-sky-950/60 text-sky-300 border-sky-500/40',
      tabActiveClass: 'bg-[#0d1117] text-white border-t-2 border-sky-400 font-semibold',
      dotColor: 'bg-sky-400',
    };
  }

  // 9. Java source files
  if (ext === 'java') {
    return {
      category: 'java',
      badgeLabel: 'JAVA',
      iconColor: 'text-orange-400',
      badgeClass: 'bg-orange-950/60 text-orange-300 border-orange-500/40',
      tabActiveClass: 'bg-[#0d1117] text-white border-t-2 border-orange-400 font-semibold',
      dotColor: 'bg-orange-400',
    };
  }

  const fallbackLabel = lower.startsWith('.')
    ? lower.slice(1).toUpperCase()
    : ext
      ? ext.toUpperCase()
      : lower.toUpperCase() || 'FILE';

  return {
    category: 'other',
    badgeLabel: fallbackLabel,
    iconColor: 'text-gray-400',
    badgeClass: 'bg-[#21262d] text-gray-300 border-[#30363d]',
    tabActiveClass: 'bg-[#0d1117] text-white border-t-2 border-gray-400 font-semibold',
    dotColor: 'bg-gray-400',
  };
}

/**
 * Returns a concise human-readable description for a generated file in the preview sub-header.
 */
export function getFileDescription(fileName: string): string {
  const normalized = (fileName || '').replace(/\\/g, '/');
  const baseName = normalized.split('/').pop() || normalized;
  const lower = baseName.toLowerCase();

  if (lower === '__init__.py') {
    return 'Python package initialization marker';
  }
  if (
    lower.startsWith('test_') ||
    lower.endsWith('_test.py') ||
    lower.endsWith('test.java') ||
    lower.includes('.test.')
  ) {
    return 'Pipeline unit test suite';
  }
  if (lower.endsWith('.py')) {
    return 'Main Apache Beam pipeline implementation';
  }
  if (lower.endsWith('.java')) {
    return 'Main Apache Beam pipeline implementation';
  }
  if (lower === 'requirements.txt') {
    return 'Python runtime dependencies';
  }
  if (lower === 'pom.xml') {
    return 'Maven build & dependency configuration';
  }
  if (lower === 'readme.md') {
    return 'Pipeline documentation & deployment guide';
  }
  if (lower === 'dockerfile') {
    return 'Container build specification';
  }
  if (lower === '.dockerignore') {
    return 'Docker build context exclusions';
  }
  if (lower === '.gcloudignore') {
    return 'Google Cloud upload exclusions';
  }
  if (lower === '.gitignore') {
    return 'Git version control exclusions';
  }
  if (lower === 'metadata.json') {
    return 'Dataflow Flex Template parameter metadata';
  }
  if (lower === 'cloudbuild.yaml' || lower === 'cloudbuild-build.yaml') {
    return 'Cloud Build container build configuration';
  }
  if (lower === 'run_directrunner.sh') {
    return 'Local DirectRunner execution script';
  }
  if (lower === 'run_dataflowrunner.sh') {
    return 'Google Cloud Dataflow deployment script';
  }
  if (lower === 'run_sparkrunner.sh') {
    return 'Serverless Spark execution script';
  }
  return `${baseName} file`;
}
