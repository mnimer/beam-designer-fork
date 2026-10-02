/**
 * Unit tests for path containment, GCP region validation, and external URI guards.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates security boundary checks:
 * 1. Path containment (isSubPath) prevents sibling prefix confusion and parent traversal.
 * 2. GCP region validation (isValidGcpRegion) enforces standard GCP region syntax.
 * 3. External URI validation (isAllowedExternalUri) restricts opened URLs to HTTPS and local HTTP.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { isSubPath, isValidGcpRegion } from '../../security/pathGuard';
import { isAllowedExternalUri } from '../../security/uriGuard';

describe('pathGuard', () => {
    describe('isSubPath', () => {
        it('returns true when candidate equals parentDir', () => {
            const parent = path.resolve('/home/user/project');
            expect(isSubPath(parent, parent)).toBe(true);
        });

        it('returns true when candidate is a direct or nested child of parentDir', () => {
            const parent = path.resolve('/home/user/project');
            const directChild = path.resolve('/home/user/project/file.txt');
            const nestedChild = path.resolve('/home/user/project/sub/dir/nested.ts');
            expect(isSubPath(parent, directChild)).toBe(true);
            expect(isSubPath(parent, nestedChild)).toBe(true);
        });

        it('returns false for sibling paths that share the parent path as a string prefix', () => {
            const parent = path.resolve('/a/proj');
            const siblingPrefix = path.resolve('/a/proj-other');
            const siblingFile = path.resolve('/a/proj-other/file.txt');
            expect(isSubPath(parent, siblingPrefix)).toBe(false);
            expect(isSubPath(parent, siblingFile)).toBe(false);
        });

        it('returns false when candidate traverses out using parent directory traversal ("..")', () => {
            const parent = path.resolve('/home/user/project');
            const traversal = path.resolve('/home/user/project/../other');
            const directParent = path.resolve('/home/user');
            expect(isSubPath(parent, traversal)).toBe(false);
            expect(isSubPath(parent, directParent)).toBe(false);
            expect(isSubPath(parent, path.join(parent, '..'))).toBe(false);
        });
    });

    describe('isValidGcpRegion', () => {
        it('accepts valid GCP region names', () => {
            expect(isValidGcpRegion('us-central1')).toBe(true);
            expect(isValidGcpRegion('europe-west1')).toBe(true);
            expect(isValidGcpRegion('asia-northeast1')).toBe(true);
            expect(isValidGcpRegion('us-east4')).toBe(true);
        });

        it('rejects invalid inputs and command injection payloads', () => {
            expect(isValidGcpRegion('us-central1 --project=x')).toBe(false);
            expect(isValidGcpRegion('')).toBe(false);
            expect(isValidGcpRegion('US;rm')).toBe(false);
            expect(isValidGcpRegion('us_central1')).toBe(false);
            expect(isValidGcpRegion('us-central1; cat /etc/passwd')).toBe(false);
            expect(isValidGcpRegion('us-central1$(whoami)')).toBe(false);
            expect(isValidGcpRegion('a'.repeat(64))).toBe(false);
            expect(isValidGcpRegion(null)).toBe(false);
            expect(isValidGcpRegion(undefined)).toBe(false);
            expect(isValidGcpRegion(123)).toBe(false);
            expect(isValidGcpRegion({})).toBe(false);
        });
    });
});

describe('uriGuard', () => {
    describe('isAllowedExternalUri', () => {
        it('allows HTTPS URLs', () => {
            expect(isAllowedExternalUri('https://console.cloud.google.com')).toBe(true);
            expect(isAllowedExternalUri('https://cloud.google.com/dataflow')).toBe(true);
            expect(isAllowedExternalUri('https://beam.apache.org/documentation/')).toBe(true);
        });

        it('allows HTTP URLs only for localhost or 127.0.0.1', () => {
            expect(isAllowedExternalUri('http://localhost:3000')).toBe(true);
            expect(isAllowedExternalUri('http://localhost:8080/path?param=1')).toBe(true);
            expect(isAllowedExternalUri('http://127.0.0.1:3000')).toBe(true);
            expect(isAllowedExternalUri('http://127.0.0.1:8080/')).toBe(true);
        });

        it('rejects HTTP URLs for non-local hosts', () => {
            expect(isAllowedExternalUri('http://example.com')).toBe(false);
            expect(isAllowedExternalUri('http://google.com')).toBe(false);
            expect(isAllowedExternalUri('http://192.168.1.1')).toBe(false);
        });

        it('rejects dangerous and disallowed URI schemes', () => {
            expect(isAllowedExternalUri('vscode://x')).toBe(false);
            expect(isAllowedExternalUri('command:foo')).toBe(false);
            expect(isAllowedExternalUri('command:workbench.action.quit')).toBe(false);
            expect(isAllowedExternalUri('file:///etc/passwd')).toBe(false);
            expect(isAllowedExternalUri('javascript:alert(1)')).toBe(false);
            expect(isAllowedExternalUri('data:text/html,<script>alert(1)</script>')).toBe(false);
        });

        it('rejects malformed or non-string inputs', () => {
            expect(isAllowedExternalUri('not a url')).toBe(false);
            expect(isAllowedExternalUri('')).toBe(false);
            expect(isAllowedExternalUri(null)).toBe(false);
            expect(isAllowedExternalUri(undefined)).toBe(false);
            expect(isAllowedExternalUri(12345)).toBe(false);
            expect(isAllowedExternalUri({})).toBe(false);
        });
    });
});
