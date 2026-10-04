/**
 * @fileoverview Tests for the two-phase generated-file writer (F7).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    STAGING_SUFFIX,
    stagingPathFor,
    stageFiles,
    commitStagedFiles,
    discardStagedFiles,
} from '../../generation/stagedWriter';

describe('stagedWriter (F7)', () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'staged-writer-'));
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('stages beside the destination without touching existing files', async () => {
        const dest = path.join(dir, 'a.txt');
        fs.writeFileSync(dest, 'old');

        await stageFiles([{ filePath: dest, content: 'new' }]);

        expect(fs.readFileSync(dest, 'utf-8')).toBe('old');
        expect(fs.readFileSync(stagingPathFor(dest), 'utf-8')).toBe('new');
        expect(stagingPathFor(dest)).toBe(dest + STAGING_SUFFIX);
    });

    it('creates missing parent directories while staging', async () => {
        const dest = path.join(dir, 'src', 'deep', 'pipeline.py');
        await stageFiles([{ filePath: dest, content: 'print(1)' }]);
        await commitStagedFiles([{ filePath: dest, content: 'print(1)' }]);
        expect(fs.readFileSync(dest, 'utf-8')).toBe('print(1)');
    });

    it('rolls back partial staging and leaves existing files intact when a write fails', async () => {
        const existing = path.join(dir, 'a.txt');
        fs.writeFileSync(existing, 'old');
        // A regular file where a directory is needed makes mkdir fail for the second entry.
        fs.writeFileSync(path.join(dir, 'blocker'), 'not a dir');
        const entries = [
            { filePath: existing, content: 'new' },
            { filePath: path.join(dir, 'blocker', 'b.txt'), content: 'b' },
        ];

        await expect(stageFiles(entries)).rejects.toThrow();

        expect(fs.readFileSync(existing, 'utf-8')).toBe('old');
        expect(fs.existsSync(stagingPathFor(existing))).toBe(false);
    });

    it('commit replaces destinations and removes staging files', async () => {
        const a = path.join(dir, 'a.txt');
        const b = path.join(dir, 'b.txt');
        fs.writeFileSync(a, 'old-a');
        const entries = [
            { filePath: a, content: 'new-a' },
            { filePath: b, content: 'new-b' },
        ];

        await stageFiles(entries);
        await commitStagedFiles(entries);

        expect(fs.readFileSync(a, 'utf-8')).toBe('new-a');
        expect(fs.readFileSync(b, 'utf-8')).toBe('new-b');
        expect(fs.readdirSync(dir).some(n => n.endsWith(STAGING_SUFFIX))).toBe(false);
    });

    it('discardStagedFiles removes staging files and tolerates missing ones', async () => {
        const a = path.join(dir, 'a.txt');
        const missing = path.join(dir, 'never-staged.txt');
        await stageFiles([{ filePath: a, content: 'x' }]);

        await discardStagedFiles([{ filePath: a, content: 'x' }, { filePath: missing, content: '' }]);

        expect(fs.existsSync(stagingPathFor(a))).toBe(false);
        expect(fs.existsSync(a)).toBe(false);
    });
});
