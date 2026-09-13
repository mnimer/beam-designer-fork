/**
 * Generation Manifest and Safe Cleanup Unit Tests (Finding C3)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Exhaustive unit test suite verifying generation manifest validation, folder ownership
 * classification, cleanup plan construction, build artifact allowlisting, and strict
 * path containment guards for finding C3.
 *
 * Security Rationale:
 * This module authorizes irreversible deletion of user files from the output folder.
 * The previous implementation removed everything non-hidden except *.beam before calling
 * Gemini, resulting in catastrophic loss of hand-written files (README, Terraform, scripts)
 * upon generation or API failure. These unit tests serve as the formal specification for
 * the allowlist model and blast-radius bounds.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
    sha256,
    generatePipelineId,
    parseManifest,
    classifyFolder,
    isBuildArtifact,
    foreignLanguageDescriptors,
    planCleanup,
    resolveDeletablePath,
    buildManifest,
    MANIFEST_SCHEMA_VERSION,
    MANIFEST_FILENAME,
    BUILD_ARTIFACT_ALLOWLIST,
    LANGUAGE_DESCRIPTORS,
    GenerationManifest
} from '../generationManifest';

describe('sha256', () => {
    // Standard / simple case: deterministic sha256 output matching known digest
    it('computes stable and accurate sha256 hex digests for text content', () => {
        const input = 'hello world';
        const expected = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
        expect(sha256(input)).toBe(expected);
        // Stability check: multiple invocations must yield identical result
        expect(sha256(input)).toBe(expected);
    });

    // Distinctness: different inputs produce distinct digests
    it('produces different digests for different inputs', () => {
        expect(sha256('pipeline_alpha')).not.toBe(sha256('pipeline_beta'));
    });

    // Extreme / edge case: empty string
    it('correctly handles an empty string', () => {
        const emptySha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        expect(sha256('')).toBe(emptySha);
    });

    // Extreme case: large payload produces valid 64-character lowercase hex format
    it('produces a 64-character lowercase hex string for large multi-line content', () => {
        const largeContent = 'const x = 42;\n'.repeat(5000);
        const digest = sha256(largeContent);
        expect(digest).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('generatePipelineId', () => {
    // Simple case: correct prefix format
    it('generates pipeline identifiers with the bp_ prefix and valid hex characters', () => {
        const id = generatePipelineId();
        expect(id).toMatch(/^bp_[0-9a-f]{24}$/);
    });

    // Extreme case: two consecutive calls never collide across high volume
    it('ensures two calls never collide', () => {
        const idCount = 500;
        const generated = new Set<string>();
        for (let i = 0; i < idCount; i++) {
            generated.add(generatePipelineId());
        }
        expect(generated.size).toBe(idCount);
    });
});

describe('parseManifest', () => {
    /**
     * NOTE on failure degradation direction:
     * Returning null for unreadable or invalid manifest markers is intentionally the
     * safe direction. An unreadable marker degrades to "no marker", which routes into
     * the more cautious 'unowned-nonempty' classification branch in classifyFolder.
     * That branch prevents automatic deletion and forces a user prompt, whereas an
     * overly permissive parser could authorize destroying unknown user data.
     */

    // Simple case: valid manifest round-trips with all fields preserved
    it('successfully parses and normalizes a valid manifest object', () => {
        const validRaw = {
            schemaVersion: 1,
            pipelineId: 'bp_abcdef1234567890abcdef12',
            language: 'python',
            generatedAt: '2026-09-12T12:00:00.000Z',
            files: [
                { path: 'main.py', sha256: 'abc123' },
                { path: 'requirements.txt', sha256: 'def456' }
            ]
        };

        const parsed = parseManifest(validRaw);
        expect(parsed).not.toBeNull();
        expect(parsed?.schemaVersion).toBe(1);
        expect(parsed?.pipelineId).toBe('bp_abcdef1234567890abcdef12');
        expect(parsed?.language).toBe('python');
        expect(parsed?.generatedAt).toBe('2026-09-12T12:00:00.000Z');
        expect(parsed?.files).toEqual([
            { path: 'main.py', sha256: 'abc123' },
            { path: 'requirements.txt', sha256: 'def456' }
        ]);
    });

    // Failure cases: null, undefined, primitive, non-object types
    it('returns null for null, undefined, strings, numbers, and boolean inputs', () => {
        expect(parseManifest(null)).toBeNull();
        expect(parseManifest(undefined)).toBeNull();
        expect(parseManifest('')).toBeNull();
        expect(parseManifest('{}')).toBeNull();
        expect(parseManifest(42)).toBeNull();
        expect(parseManifest(true)).toBeNull();
        expect(parseManifest(false)).toBeNull();
    });

    // Failure cases: missing or empty pipelineId
    it('returns null when pipelineId is missing, empty, or non-string', () => {
        expect(parseManifest({ schemaVersion: 1, language: 'python', files: [] })).toBeNull();
        expect(parseManifest({ pipelineId: '', schemaVersion: 1, language: 'python' })).toBeNull();
        expect(parseManifest({ pipelineId: 12345, schemaVersion: 1, language: 'python' })).toBeNull();
    });

    // Failure cases: missing or empty language
    it('returns null when language is missing, empty, or non-string', () => {
        expect(parseManifest({ pipelineId: 'bp_123', schemaVersion: 1, files: [] })).toBeNull();
        expect(parseManifest({ pipelineId: 'bp_123', language: '', schemaVersion: 1 })).toBeNull();
        expect(parseManifest({ pipelineId: 'bp_123', language: null, schemaVersion: 1 })).toBeNull();
    });

    // Failure cases: non-numeric schemaVersion or missing schemaVersion
    it('returns null when schemaVersion is non-numeric or missing', () => {
        expect(parseManifest({ pipelineId: 'bp_123', language: 'python' })).toBeNull();
        expect(parseManifest({ pipelineId: 'bp_123', language: 'python', schemaVersion: '1' })).toBeNull();
        expect(parseManifest({ pipelineId: 'bp_123', language: 'python', schemaVersion: null })).toBeNull();
        expect(parseManifest({ pipelineId: 'bp_123', language: 'python', schemaVersion: true })).toBeNull();
        expect(parseManifest({ pipelineId: 'bp_123', language: 'python', schemaVersion: {} })).toBeNull();
    });

    // Failure case: schemaVersion greater than MANIFEST_SCHEMA_VERSION
    it('returns null when schemaVersion is greater than MANIFEST_SCHEMA_VERSION', () => {
        // A newer extension version wrote this marker; reading it with stale rules risks deletion bugs
        const futureRaw = {
            schemaVersion: MANIFEST_SCHEMA_VERSION + 1,
            pipelineId: 'bp_future',
            language: 'python',
            files: []
        };
        expect(parseManifest(futureRaw)).toBeNull();
    });

    // Edge case: malformed entries inside files are filtered while valid siblings survive
    it('filters out malformed entries in files while preserving valid entries', () => {
        const mixedRaw = {
            schemaVersion: 1,
            pipelineId: 'bp_test123',
            language: 'python',
            files: [
                { path: 'main.py', sha256: 'hash1' },
                null,
                undefined,
                'invalid-entry',
                { path: 'missing-hash' },
                { sha256: 'missing-path' },
                { path: 123, sha256: 'type-mismatch' },
                { path: 'valid2.py', sha256: 'hash2' }
            ]
        };

        const parsed = parseManifest(mixedRaw);
        expect(parsed).not.toBeNull();
        expect(parsed?.files).toEqual([
            { path: 'main.py', sha256: 'hash1' },
            { path: 'valid2.py', sha256: 'hash2' }
        ]);
    });

    // Edge case: missing files array becomes []
    it('defaults a missing or non-array files property to an empty array', () => {
        const noFiles = {
            schemaVersion: 1,
            pipelineId: 'bp_nofiles',
            language: 'python'
        };
        expect(parseManifest(noFiles)?.files).toEqual([]);

        const nonArrayFiles = {
            schemaVersion: 1,
            pipelineId: 'bp_nonarray',
            language: 'python',
            files: 'not-an-array'
        };
        expect(parseManifest(nonArrayFiles)?.files).toEqual([]);
    });

    // Edge case: non-string generatedAt defaults to empty string
    it('defaults non-string generatedAt to an empty string', () => {
        const noTimestamp = {
            schemaVersion: 1,
            pipelineId: 'bp_timestamp',
            language: 'python',
            files: []
        };
        expect(parseManifest(noTimestamp)?.generatedAt).toBe('');
    });
});

describe('classifyFolder', () => {
    const mockManifest: GenerationManifest = {
        schemaVersion: 1,
        pipelineId: 'bp_owner_123',
        language: 'python',
        generatedAt: '2026-09-12T00:00:00.000Z',
        files: [{ path: 'main.py', sha256: 'sha' }]
    };

    /**
     * Complete Truth Table Coverage:
     * | manifest | folderIsEmpty | requestedPipelineId | expected |
     * | null     | true          | any                 | 'fresh' |
     * | null     | false         | any                 | 'unowned-nonempty' |
     * | present  | either        | different id        | 'foreign' |
     * | present  | either        | matching id         | 'owned' |
     * | present  | either        | empty string        | 'foreign' |
     */

    it('classifies null manifest with empty folder as fresh', () => {
        expect(classifyFolder(null, true, 'bp_any')).toBe('fresh');
        expect(classifyFolder(null, true, '')).toBe('fresh');
    });

    /**
     * CRITICAL SECURITY PROPERTY:
     * The unowned-nonempty case prevents wiping a user's existing project when retargeting
     * output to an existing folder that has no .beamgen.json marker. It must never auto-delete.
     */
    it('classifies null manifest with non-empty folder as unowned-nonempty regardless of pipelineId', () => {
        expect(classifyFolder(null, false, 'bp_any')).toBe('unowned-nonempty');
        expect(classifyFolder(null, false, '')).toBe('unowned-nonempty');
    });

    it('classifies present manifest with different pipelineId as foreign (empty or non-empty)', () => {
        expect(classifyFolder(mockManifest, false, 'bp_different_456')).toBe('foreign');
        expect(classifyFolder(mockManifest, true, 'bp_different_456')).toBe('foreign');
    });

    it('classifies present manifest with matching pipelineId as owned (empty or non-empty)', () => {
        expect(classifyFolder(mockManifest, false, 'bp_owner_123')).toBe('owned');
        expect(classifyFolder(mockManifest, true, 'bp_owner_123')).toBe('owned');
    });

    it('classifies present manifest with empty requestedPipelineId as foreign', () => {
        expect(classifyFolder(mockManifest, false, '')).toBe('foreign');
        expect(classifyFolder(mockManifest, true, '')).toBe('foreign');
    });
});

describe('isBuildArtifact', () => {
    // Simple case: every entry in BUILD_ARTIFACT_ALLOWLIST must return true
    it('returns true for every entry in BUILD_ARTIFACT_ALLOWLIST', () => {
        expect(BUILD_ARTIFACT_ALLOWLIST.length).toBeGreaterThan(0);
        for (const artifactName of BUILD_ARTIFACT_ALLOWLIST) {
            expect(isBuildArtifact(artifactName)).toBe(true);
        }
    });

    // Pattern case: anything ending in .egg-info returns true
    it('returns true for any name ending with .egg-info', () => {
        expect(isBuildArtifact('apache_beam.egg-info')).toBe(true);
        expect(isBuildArtifact('my_custom_package.egg-info')).toBe(true);
        expect(isBuildArtifact('.egg-info')).toBe(true);
    });

    // Security property: near-misses that must NEVER be deleted
    it('returns false for near-misses and user files that must never be deleted', () => {
        const protectedNames = [
            'src',
            'README.md',
            'venv2',
            'my-target',
            'targets',
            '.venv-old',
            'build.gradle', // a file, not the 'build' directory
            '',
            'node_modules_backup',
            'env_backup',
            'target_dir',
            '.env',
            'out_backup'
        ];

        for (const name of protectedNames) {
            expect(isBuildArtifact(name)).toBe(false);
        }
    });

    // Failure / edge case: empty string, falsy, undefined
    it('returns false for empty or falsy names', () => {
        expect(isBuildArtifact('')).toBe(false);
        expect(isBuildArtifact(undefined as unknown as string)).toBe(false);
    });
});

describe('foreignLanguageDescriptors', () => {
    // Simple case: requesting python returns Java descriptors and NOT Python ones
    it('returns Java descriptors and excludes Python descriptors when requesting python', () => {
        const descriptors = foreignLanguageDescriptors('python');
        for (const javaDesc of LANGUAGE_DESCRIPTORS.java) {
            expect(descriptors).toContain(javaDesc);
        }
        for (const pyDesc of LANGUAGE_DESCRIPTORS.python) {
            expect(descriptors).not.toContain(pyDesc);
        }
    });

    // Simple case: requesting java returns Python descriptors and NOT Java ones
    it('returns Python descriptors and excludes Java descriptors when requesting java', () => {
        const descriptors = foreignLanguageDescriptors('java');
        for (const pyDesc of LANGUAGE_DESCRIPTORS.python) {
            expect(descriptors).toContain(pyDesc);
        }
        for (const javaDesc of LANGUAGE_DESCRIPTORS.java) {
            expect(descriptors).not.toContain(javaDesc);
        }
    });

    // Extreme case: case-insensitivity
    it('handles case-insensitive language names correctly', () => {
        const pyUpper = foreignLanguageDescriptors('PYTHON');
        const javaUpper = foreignLanguageDescriptors('JAVA');
        expect(pyUpper).toEqual(foreignLanguageDescriptors('python'));
        expect(javaUpper).toEqual(foreignLanguageDescriptors('java'));
    });

    // Edge / extreme case: unknown language returns descriptors for all known languages
    it('returns descriptors for all known languages when an unknown language is provided', () => {
        const unknownDesc = foreignLanguageDescriptors('go');
        for (const pyDesc of LANGUAGE_DESCRIPTORS.python) {
            expect(unknownDesc).toContain(pyDesc);
        }
        for (const javaDesc of LANGUAGE_DESCRIPTORS.java) {
            expect(unknownDesc).toContain(javaDesc);
        }

        const emptyLangDesc = foreignLanguageDescriptors('');
        for (const pyDesc of LANGUAGE_DESCRIPTORS.python) {
            expect(emptyLangDesc).toContain(pyDesc);
        }
        for (const javaDesc of LANGUAGE_DESCRIPTORS.java) {
            expect(emptyLangDesc).toContain(javaDesc);
        }
    });
});

describe('planCleanup', () => {
    const pythonManifest: GenerationManifest = {
        schemaVersion: 1,
        pipelineId: 'bp_pipeline_1',
        language: 'python',
        generatedAt: '2026-09-12T00:00:00.000Z',
        files: [
            { path: 'main.py', sha256: 'hash_main_v1' },
            { path: 'requirements.txt', sha256: 'hash_req_v1' }
        ]
    };

    // Same-language scenario
    it('includes exactly manifest files and preserves build artifacts on same-language regen', () => {
        const folderEntries = [
            'main.py',
            'requirements.txt',
            '.venv',
            'target',
            'README.md'
        ];

        const plan = planCleanup(pythonManifest, 'python', folderEntries);

        expect(plan.isLanguageSwitch).toBe(false);
        // Manifest files are planned for cleanup
        expect(plan.paths.sort()).toEqual(['main.py', 'requirements.txt'].sort());

        // NOTE: Keeping .venv and target on same-language regen is deliberate.
        // Wiping them costs the user a full reinstall for zero benefit.
        expect(plan.paths).not.toContain('.venv');
        expect(plan.paths).not.toContain('target');
    });

    // Language switch scenario
    it('includes manifest files, present build artifacts, and foreign descriptors on language switch', () => {
        const folderEntries = [
            'main.py',
            'requirements.txt',
            'pom.xml',
            '.venv',
            'target',
            'README.md',
            'metadata.json'
        ];

        // Switching from Python to Java
        const plan = planCleanup(pythonManifest, 'java', folderEntries);

        expect(plan.isLanguageSwitch).toBe(true);
        // Must contain original manifest files
        expect(plan.paths).toContain('main.py');
        expect(plan.paths).toContain('requirements.txt');
        // Must contain present build artifacts
        expect(plan.paths).toContain('.venv');
        expect(plan.paths).toContain('target');
        // For java generation, foreign descriptors are python descriptors (e.g. requirements.txt)
        // Note: pom.xml belongs to Java (the requested language), so it is NOT a foreign descriptor
        expect(plan.paths).not.toContain('pom.xml');
    });

    // Case-insensitive comparison does NOT trigger a language switch
    it('treats case-variations of the same language as same-language without switching', () => {
        const plan = planCleanup(pythonManifest, 'Python', ['main.py', '.venv']);
        expect(plan.isLanguageSwitch).toBe(false);
        expect(plan.paths).toEqual(['main.py', 'requirements.txt']);
        expect(plan.paths).not.toContain('.venv');
    });

    /**
     * CRITICAL SECURITY PROPERTY: BLAST RADIUS BOUNDS
     * Unknown user files in folderEntries (e.g. README.md, metadata.json, infra.tf, notes/)
     * must NEVER be included in the cleanup plan under either same-language or language-switch
     * scenarios. This is the single most important assertion in this module: it bounds the
     * blast radius even if any other heuristic or decision fails.
     */
    it('NEVER includes unknown user files in the cleanup plan in either scenario', () => {
        const userFiles = [
            'README.md',
            'metadata.json',
            'infra.tf',
            'variables.tf',
            'notes.txt',
            'custom_script.sh',
            'Dockerfile'
        ];
        const folderEntries = [
            'main.py',
            'requirements.txt',
            '.venv',
            'target',
            ...userFiles
        ];

        // Same-language scenario
        const samePlan = planCleanup(pythonManifest, 'python', folderEntries);
        for (const userFile of userFiles) {
            expect(samePlan.paths).not.toContain(userFile);
        }

        // Language-switch scenario
        const switchPlan = planCleanup(pythonManifest, 'java', folderEntries);
        for (const userFile of userFiles) {
            expect(switchPlan.paths).not.toContain(userFile);
        }
    });

    // modifiedFiles detection
    it('correctly populates modifiedFiles when hashes differ, excludes matches and missing files', () => {
        const currentHashes: Record<string, string> = {
            'main.py': 'hash_main_edited_by_user', // Modified
            'requirements.txt': 'hash_req_v1' // Untouched / matching
            // Note: third file absent means deleted on disk, which is NOT reported as modified
        };

        const manifestWithThreeFiles: GenerationManifest = {
            ...pythonManifest,
            files: [
                { path: 'main.py', sha256: 'hash_main_v1' },
                { path: 'requirements.txt', sha256: 'hash_req_v1' },
                { path: 'deleted_by_user.py', sha256: 'hash_deleted_v1' }
            ]
        };

        const plan = planCleanup(manifestWithThreeFiles, 'python', ['main.py'], currentHashes);
        expect(plan.modifiedFiles).toEqual(['main.py']);
    });

    // Empty manifest files list produces empty plan for same-language regen
    it('produces an empty plan for same-language regen when manifest files list is empty', () => {
        const emptyManifest: GenerationManifest = {
            ...pythonManifest,
            files: []
        };
        const plan = planCleanup(emptyManifest, 'python', ['.venv', 'README.md']);
        expect(plan.isLanguageSwitch).toBe(false);
        expect(plan.paths).toEqual([]);
    });

    // Deduplication: no duplicate paths when manifest entry is also a build artifact
    it('ensures paths contains no duplicates when a manifest entry overlaps with build artifacts', () => {
        const manifestWithArtifact: GenerationManifest = {
            ...pythonManifest,
            files: [
                { path: 'build', sha256: 'dummy_hash' },
                { path: 'main.py', sha256: 'dummy_hash2' }
            ]
        };

        const plan = planCleanup(manifestWithArtifact, 'java', ['build', 'main.py']);
        const buildOccurrences = plan.paths.filter(p => p === 'build').length;
        expect(buildOccurrences).toBe(1);
    });
});

describe('resolveDeletablePath', () => {
    const baseFolder = '/Users/testuser/projects/dataflow-output';

    /**
     * DEFENCE IN DEPTH RATIONALE:
     * A manifest is on-disk data and therefore attacker-influenced if a malicious repository
     * or .beam project is shared. A crafted manifest entry like `../../.ssh/id_rsa` or
     * `/etc/passwd` must not escape the target folder.
     */

    // Rejection of path traversal escapes
    it('rejects directory traversal escape payloads', () => {
        expect(resolveDeletablePath(baseFolder, '../../../etc/passwd')).toBeNull();
        expect(resolveDeletablePath(baseFolder, 'src/../../../../etc/passwd')).toBeNull();
        expect(resolveDeletablePath(baseFolder, 'subdir/..')).toBeNull();
    });

    // Rejection of absolute paths (POSIX, Windows drive letter, UNC)
    it('rejects absolute paths and network shares', () => {
        expect(resolveDeletablePath(baseFolder, '/etc/passwd')).toBeNull();
        expect(resolveDeletablePath(baseFolder, 'C:\\Windows\\System32')).toBeNull();
        expect(resolveDeletablePath(baseFolder, '\\\\server\\share')).toBeNull();
    });

    // Rejection of empty, whitespace, and current directory references
    it('rejects empty, whitespace-only, and current directory paths', () => {
        expect(resolveDeletablePath(baseFolder, '')).toBeNull();
        expect(resolveDeletablePath(baseFolder, '   ')).toBeNull();
        expect(resolveDeletablePath(baseFolder, '.')).toBeNull();
        expect(resolveDeletablePath(baseFolder, './')).toBeNull();
    });

    // Rejection of manifest marker and .beam pipeline files
    it('rejects the manifest filename (.beamgen.json) and any .beam design files', () => {
        expect(resolveDeletablePath(baseFolder, MANIFEST_FILENAME)).toBeNull();
        expect(resolveDeletablePath(baseFolder, '.beamgen.json')).toBeNull();
        expect(resolveDeletablePath(baseFolder, 'pipeline.beam')).toBeNull();
        expect(resolveDeletablePath(baseFolder, 'nested/design.beam')).toBeNull();
        expect(resolveDeletablePath(baseFolder, 'src/transforms/flow.beam')).toBeNull();
    });

    // Rejection of invalid folder or non-string inputs
    it('rejects empty folderPath or non-string relativePath', () => {
        expect(resolveDeletablePath('', 'main.py')).toBeNull();
        expect(resolveDeletablePath(baseFolder, null as unknown as string)).toBeNull();
        expect(resolveDeletablePath(baseFolder, undefined as unknown as string)).toBeNull();
    });

    // Acceptance of legitimate contained relative files
    it('resolves valid relative paths inside the target folder to absolute paths', () => {
        expect(resolveDeletablePath(baseFolder, 'main.py')).toBe(path.resolve(baseFolder, 'main.py'));
        expect(resolveDeletablePath(baseFolder, 'src/main/java/App.java')).toBe(
            path.resolve(baseFolder, 'src/main/java/App.java')
        );
        expect(resolveDeletablePath(baseFolder, 'subdir/nested/file.txt')).toBe(
            path.resolve(baseFolder, 'subdir/nested/file.txt')
        );
        // Contained internal navigation that stays inside folder
        expect(resolveDeletablePath(baseFolder, 'src/foo/../main.py')).toBe(
            path.resolve(baseFolder, 'src/main.py')
        );
    });
});

describe('buildManifest', () => {
    // Simple case: builds manifest with correct fields and sha256 digests
    it('constructs a valid manifest with correct schemaVersion, hashes, and timestamp', () => {
        const pipelineId = 'bp_abc123';
        const language = 'python';
        const files = [
            { path: 'main.py', content: 'print("hello")\n' },
            { path: 'requirements.txt', content: 'apache-beam>=2.50.0\n' }
        ];

        const manifest = buildManifest(pipelineId, language, files);

        expect(manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
        expect(manifest.pipelineId).toBe(pipelineId);
        expect(manifest.language).toBe(language);
        // Valid ISO-8601 timestamp
        expect(Number.isNaN(Date.parse(manifest.generatedAt))).toBe(false);
        expect(manifest.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

        // Hashes match sha256(content)
        expect(manifest.files).toEqual([
            { path: 'main.py', sha256: sha256('print("hello")\n') },
            { path: 'requirements.txt', sha256: sha256('apache-beam>=2.50.0\n') }
        ]);
    });

    // Serialization round-trip
    it('round-trips cleanly through JSON.stringify -> JSON.parse -> parseManifest', () => {
        const original = buildManifest('bp_roundtrip', 'java', [
            { path: 'pom.xml', content: '<project></project>' },
            { path: 'src/main/java/App.java', content: 'public class App {}' }
        ]);

        const jsonString = JSON.stringify(original);
        const parsedRaw = JSON.parse(jsonString);
        const reconstituted = parseManifest(parsedRaw);

        expect(reconstituted).toEqual(original);
    });

    // Extreme / edge case: empty files list
    it('handles an empty files list gracefully', () => {
        const emptyManifest = buildManifest('bp_empty', 'python', []);
        expect(emptyManifest.files).toEqual([]);
        expect(parseManifest(emptyManifest)?.files).toEqual([]);
    });
});
