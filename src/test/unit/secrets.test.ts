/**
 * Secret Manager ID Normalization Regression Tests (M1)
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates that Secret Manager secret names/paths are properly converted into short secret IDs.
 * Ensures the generated pipeline receives short IDs rather than fully-qualified resource paths
 * (projects/.../secrets/...) which causes runtime failures on Dataflow jobs.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock vscode module before importing extension
vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock({
    workspace: {
        workspaceFolders: []
    }
}));

import { toShortSecretId, parseSecretManagerOutput } from '../../extension';

describe('Secret Manager ID Parsing (M1)', () => {
    describe('toShortSecretId', () => {
        it('extracts the short secret ID from a fully-qualified GCP resource path', () => {
            // Simple / standard case
            const fullPath = 'projects/123456789/secrets/my-secret';
            expect(toShortSecretId(fullPath)).toBe('my-secret');
        });

        it('handles secret names with no slashes', () => {
            // No slash case
            expect(toShortSecretId('my-secret')).toBe('my-secret');
            expect(toShortSecretId('aws-access-key-id')).toBe('aws-access-key-id');
        });

        it('handles secret paths with trailing slashes (extreme case)', () => {
            // Trailing slash cases
            expect(toShortSecretId('projects/123456/secrets/my-secret/')).toBe('my-secret');
            expect(toShortSecretId('projects/123456/secrets/my-secret///')).toBe('my-secret');
            expect(toShortSecretId('my-secret/')).toBe('my-secret');
        });

        it('handles empty strings, whitespace, and slashes only (failure / edge cases)', () => {
            // Empty / whitespace cases
            expect(toShortSecretId('')).toBe('');
            expect(toShortSecretId('   ')).toBe('');
            expect(toShortSecretId('/')).toBe('');
            expect(toShortSecretId('///')).toBe('');
            expect(toShortSecretId(null)).toBe('');
            expect(toShortSecretId(undefined)).toBe('');
        });

        it('handles multi-segment nested paths', () => {
            expect(toShortSecretId('projects/p/locations/global/secrets/nested-secret')).toBe('nested-secret');
        });
    });

    describe('parseSecretManagerOutput', () => {
        it('transforms gcloud secrets list JSON with full paths into short ID objects', () => {
            const mockGcloudOutput = JSON.stringify([
                { name: 'projects/123456789/secrets/aws-access-key' },
                { name: 'projects/123456789/secrets/aws-secret-key' }
            ]);

            const parsed = parseSecretManagerOutput(mockGcloudOutput);

            expect(parsed).toEqual([
                {
                    name: 'aws-access-key',
                    id: 'aws-access-key',
                    fullName: 'projects/123456789/secrets/aws-access-key',
                    value: 'aws-access-key'
                },
                {
                    name: 'aws-secret-key',
                    id: 'aws-secret-key',
                    fullName: 'projects/123456789/secrets/aws-secret-key',
                    value: 'aws-secret-key'
                }
            ]);
        });

        it('handles secret items that are already short names or have trailing slashes', () => {
            const mockOutput = JSON.stringify([
                { name: 'already-short-secret' },
                { name: 'projects/987/secrets/trailing-slash-secret/' }
            ]);

            const parsed = parseSecretManagerOutput(mockOutput);

            expect(parsed).toEqual([
                {
                    name: 'already-short-secret',
                    id: 'already-short-secret',
                    fullName: 'already-short-secret',
                    value: 'already-short-secret'
                },
                {
                    name: 'trailing-slash-secret',
                    id: 'trailing-slash-secret',
                    fullName: 'projects/987/secrets/trailing-slash-secret/',
                    value: 'trailing-slash-secret'
                }
            ]);
        });

        it('returns empty array when output is empty list or non-array JSON', () => {
            expect(parseSecretManagerOutput('[]')).toEqual([]);
            expect(parseSecretManagerOutput('{}')).toEqual([]);
        });
    });
});
