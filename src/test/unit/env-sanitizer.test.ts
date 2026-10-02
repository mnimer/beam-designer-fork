/**
 * @fileoverview Tests for the runtime-variable environment sanitizer (finding S1).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import { isAllowedEnvKey, applyRuntimeVariables } from '../../security/envSanitizer';

describe('isAllowedEnvKey', () => {
    it.each(['DB_HOST', 'my_var', '_PRIVATE', 'GCS_BUCKET2', 'Project_Id'])('accepts %s', (key) => {
        expect(isAllowedEnvKey(key)).toBe(true);
    });

    it.each([
        '', ' ', '1ABC', 'A-B', 'A B', 'A=B', 'A;rm', '$(id)', 'X\nY',
    ])('rejects malformed identifier %j', (key) => {
        expect(isAllowedEnvKey(key)).toBe(false);
    });

    it.each([
        'PATH', 'BASH_ENV', 'ENV', 'SHELLOPTS', 'BASHOPTS', 'CDPATH', 'IFS', 'PS4',
        'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES',
        'PYTHONPATH', 'PYTHONSTARTUP', 'PYTHONHOME',
        'JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS', 'NODE_OPTIONS',
        'path', 'ld_preload',
    ])('rejects dangerous variable %s', (key) => {
        expect(isAllowedEnvKey(key)).toBe(false);
    });

    it('rejects non-string input', () => {
        expect(isAllowedEnvKey(undefined as unknown as string)).toBe(false);
        expect(isAllowedEnvKey(42 as unknown as string)).toBe(false);
    });
});

describe('applyRuntimeVariables', () => {
    it('copies allowed keys (trimmed) and reports rejected ones', () => {
        const env: Record<string, string> = { PATH: '/usr/bin' };
        const rejected = applyRuntimeVariables(env, [
            { key: ' DB_HOST ', value: 'db' },
            { key: 'PATH', value: '/evil' },
            { key: 'BASH_ENV', value: '/tmp/x.sh' },
            { key: 'EMPTY', value: undefined as unknown as string },
            { key: '   ', value: 'ignored' },
        ]);
        expect(env).toEqual({ PATH: '/usr/bin', DB_HOST: 'db', EMPTY: '' });
        expect(rejected).toEqual(['PATH', 'BASH_ENV']);
    });

    it('tolerates non-array input', () => {
        const env: Record<string, string> = {};
        expect(applyRuntimeVariables(env, undefined)).toEqual([]);
        expect(applyRuntimeVariables(env, 'nope' as unknown as [])).toEqual([]);
        expect(env).toEqual({});
    });
});
