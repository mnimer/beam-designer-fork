/**
 * @fileoverview Unit tests for Google Cloud Console URL builder.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import {
  buildDataflowConsoleUrl,
  buildDataprocConsoleUrl,
  buildGcpConsoleUrl,
} from './consoleUrl';

describe('consoleUrl', () => {
  describe('buildDataflowConsoleUrl', () => {
    it('preserves normal IDs unchanged', () => {
      const url = buildDataflowConsoleUrl(
        'my-test-project',
        'us-central1',
        '2026-09-12_12_34_56-123456789'
      );
      expect(url).toBe(
        'https://console.cloud.google.com/dataflow/jobs/us-central1/2026-09-12_12_34_56-123456789?project=my-test-project'
      );
    });

    it('encodes special characters such as / and ? in jobId, region, and projectId', () => {
      const url = buildDataflowConsoleUrl(
        'project/with/slashes?foo=bar',
        'europe-west1/b',
        'job/with/slashes?param=1&other=2'
      );
      expect(url).toBe(
        'https://console.cloud.google.com/dataflow/jobs/europe-west1%2Fb/job%2Fwith%2Fslashes%3Fparam%3D1%26other%3D2?project=project%2Fwith%2Fslashes%3Ffoo%3Dbar'
      );
      expect(url).not.toContain('job/with/slashes');
      expect(url).toContain('job%2Fwith%2Fslashes%3Fparam%3D1%26other%3D2');
      expect(url).toContain('project%2Fwith%2Fslashes%3Ffoo%3Dbar');
    });
  });

  describe('buildDataprocConsoleUrl', () => {
    it('preserves normal IDs unchanged', () => {
      const url = buildDataprocConsoleUrl(
        'my-test-project',
        'us-central1',
        'batch-12345'
      );
      expect(url).toBe(
        'https://console.cloud.google.com/dataproc/batches/us-central1/batch-12345?project=my-test-project'
      );
    });

    it('encodes special characters such as / and ? in batchId, region, and projectId', () => {
      const url = buildDataprocConsoleUrl(
        'proj?id=1',
        'region/zone',
        'batch/id?extra=true'
      );
      expect(url).toBe(
        'https://console.cloud.google.com/dataproc/batches/region%2Fzone/batch%2Fid%3Fextra%3Dtrue?project=proj%3Fid%3D1'
      );
      expect(url).not.toContain('batch/id?extra=true');
      expect(url).toContain('batch%2Fid%3Fextra%3Dtrue');
    });
  });

  describe('buildGcpConsoleUrl', () => {
    it('returns empty string if jobId is undefined or empty', () => {
      expect(buildGcpConsoleUrl('Dataflow', undefined)).toBe('');
      expect(buildGcpConsoleUrl('Dataflow', '')).toBe('');
    });

    it('returns empty string for unsupported runner types', () => {
      expect(buildGcpConsoleUrl('DirectRunner', 'job-123')).toBe('');
      expect(buildGcpConsoleUrl('Flink', 'job-123')).toBe('');
    });

    it('uses default region and projectId when not specified', () => {
      const url = buildGcpConsoleUrl('Dataflow', 'job-123');
      expect(url).toBe(
        'https://console.cloud.google.com/dataflow/jobs/us-central1/job-123?project=YOUR_PROJECT_ID'
      );
    });

    it('builds Dataflow URL when runner is Dataflow', () => {
      const url = buildGcpConsoleUrl(
        'Dataflow',
        '2026-09-12_12_34_56-123456789',
        'us-central1',
        'my-test-project'
      );
      expect(url).toBe(
        'https://console.cloud.google.com/dataflow/jobs/us-central1/2026-09-12_12_34_56-123456789?project=my-test-project'
      );
    });

    it('builds Dataproc URL when runner is Spark', () => {
      const url = buildGcpConsoleUrl(
        'Spark',
        'batch-12345',
        'us-west1',
        'my-spark-project'
      );
      expect(url).toBe(
        'https://console.cloud.google.com/dataproc/batches/us-west1/batch-12345?project=my-spark-project'
      );
    });
  });
});
