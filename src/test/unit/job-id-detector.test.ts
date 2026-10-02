/**
 * Unit tests for pure Dataflow job ID detector
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import { detectDataflowJob } from '../../execution/jobIdDetector';

describe('Dataflow Job ID Detector (detectDataflowJob)', () => {
    describe('Standard Beam Runner Output', () => {
        it('detects job ID from "Submitted job: <jobId>" format', () => {
            const line = 'Submitted job: 2026-01-01_00_00_00-1234567890123\n';
            const result = detectDataflowJob(line);

            expect(result).not.toBeNull();
            expect(result?.jobId).toBe('2026-01-01_00_00_00-1234567890123');
            expect(result?.region).toBeUndefined();
            expect(result?.projectId).toBeUndefined();
        });

        it('detects job ID embedded in logging timestamps and log level prefixes', () => {
            const line = '[2026-09-30 02:00:00,123] [INFO] Submitted job: 2026-09-30_02_00_00-9876543210123456789';
            const result = detectDataflowJob(line);

            expect(result).not.toBeNull();
            expect(result?.jobId).toBe('2026-09-30_02_00_00-9876543210123456789');
        });

        it('detects bare job ID token in runner output', () => {
            const line = 'Job 2026-05-10_10_20_30-abcdef1234567890 is currently running.';
            const result = detectDataflowJob(line);

            expect(result).not.toBeNull();
            expect(result?.jobId).toBe('2026-05-10_10_20_30-abcdef1234567890');
        });
    });

    describe('CLI and Structured Output', () => {
        it('detects job ID from "id: \'<jobId>\'" single-quoted format', () => {
            const line = "id: '2026-03-15_14_22_33-abcdef1234567890'";
            const result = detectDataflowJob(line);

            expect(result).not.toBeNull();
            expect(result?.jobId).toBe('2026-03-15_14_22_33-abcdef1234567890');
        });

        it('detects job ID from "id: \\"<jobId>\\"" double-quoted format', () => {
            const line = 'id: "2026-03-15_14_22_33-abcdef1234567890"';
            const result = detectDataflowJob(line);

            expect(result).not.toBeNull();
            expect(result?.jobId).toBe('2026-03-15_14_22_33-abcdef1234567890');
        });

        it('detects job ID from unquoted "id: <jobId>" format', () => {
            const line = 'id: 2026-03-15_14_22_33-abcdef1234567890';
            const result = detectDataflowJob(line);

            expect(result).not.toBeNull();
            expect(result?.jobId).toBe('2026-03-15_14_22_33-abcdef1234567890');
        });
    });

    describe('Cloud Console URLs', () => {
        it('extracts jobId, region, and projectId from standard Cloud Console URL', () => {
            const line = 'To access the documentation on Dataflow jobs: https://console.cloud.google.com/dataflow/jobs/us-central1/2026-09-30_02_00_00-1234567890123456?project=my-gcp-project';
            const result = detectDataflowJob(line);

            expect(result).not.toBeNull();
            expect(result?.jobId).toBe('2026-09-30_02_00_00-1234567890123456');
            expect(result?.region).toBe('us-central1');
            expect(result?.projectId).toBe('my-gcp-project');
        });

        it('extracts jobId, region, and projectId from locations/<region>/jobs format', () => {
            const line = 'Console URL: https://console.cloud.google.com/dataflow/jobs/locations/europe-west1/jobs/2026-09-30_02_00_00-1234567890123456?project=euro-prod-123';
            const result = detectDataflowJob(line);

            expect(result).not.toBeNull();
            expect(result?.jobId).toBe('2026-09-30_02_00_00-1234567890123456');
            expect(result?.region).toBe('europe-west1');
            expect(result?.projectId).toBe('euro-prod-123');
        });

        it('handles Console URL without query parameters', () => {
            const line = 'https://console.cloud.google.com/dataflow/jobs/us-east1/2026-09-30_02_00_00-1234567890123456';
            const result = detectDataflowJob(line);

            expect(result).not.toBeNull();
            expect(result?.jobId).toBe('2026-09-30_02_00_00-1234567890123456');
            expect(result?.region).toBe('us-east1');
            expect(result?.projectId).toBeUndefined();
        });
    });

    describe('Edge Cases and Non-matches', () => {
        it('returns null for empty string or whitespace', () => {
            expect(detectDataflowJob('')).toBeNull();
            expect(detectDataflowJob('   ')).toBeNull();
        });

        it('returns null for non-string input safely', () => {
            expect(detectDataflowJob(null as unknown as string)).toBeNull();
            expect(detectDataflowJob(undefined as unknown as string)).toBeNull();
        });

        it('returns null for generic build and execution logs', () => {
            expect(detectDataflowJob('Running DirectRunner...')).toBeNull();
            expect(detectDataflowJob('Build succeeded with 0 errors.')).toBeNull();
            expect(detectDataflowJob('2026-09-30 12:00:00 Starting pipeline')).toBeNull();
        });

        it('returns null when ID token is too short or malformed', () => {
            expect(detectDataflowJob('Submitted job: 2026-01-01_123')).toBeNull();
            expect(detectDataflowJob('id: 1234567890')).toBeNull();
        });
    });
});
