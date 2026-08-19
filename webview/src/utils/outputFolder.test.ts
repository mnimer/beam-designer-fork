import { describe, it, expect } from 'vitest';
import { computeUpdatedOutputFolder } from './outputFolder';

describe('computeUpdatedOutputFolder', () => {
  it('returns default output folder when saved folder is empty', () => {
    const result = computeUpdatedOutputFolder(
      '',
      'test/parse message',
      'parse-message-pipeline',
      'test/parse message/parse-message-pipeline'
    );
    expect(result).toBe('test/parse message/parse-message-pipeline');
  });

  it('resets old output folder to clean relative default when beam file is renamed and moved', () => {
    // User renamed test/job1/job1.beam to test/parse message/parse-message-pipeline.beam
    // Old saved output folder was test/job1/job1
    const result = computeUpdatedOutputFolder(
      'test/job1/job1',
      'test/parse message',
      'parse-message-pipeline',
      'test/parse message/parse-message-pipeline'
    );
    expect(result).toBe('test/parse message/parse-message-pipeline');
  });

  it('sanitizes stale nested paths containing foobar and job1-pipeline', () => {
    // Legacy corrupted path in YAML: test/job1/foobar/job1-pipeline or test/parse message/foobar/job1-pipeline/parse-message-pipeline
    const result1 = computeUpdatedOutputFolder(
      'test/job1/foobar/job1-pipeline',
      'test/parse message',
      'parse-message-pipeline',
      'test/parse message/parse-message-pipeline'
    );
    expect(result1).toBe('test/parse message/parse-message-pipeline');

    const result2 = computeUpdatedOutputFolder(
      'test/parse message/foobar/job1-pipeline/parse-message-pipeline',
      'test/parse message',
      'parse-message-pipeline',
      'test/parse message/parse-message-pipeline'
    );
    expect(result2).toBe('test/parse message/parse-message-pipeline');
  });

  it('updates output folder when beam file is renamed in the same directory', () => {
    const result = computeUpdatedOutputFolder(
      'src/pipelines/my-pipeline',
      'src/pipelines',
      'our-pipeline',
      'src/pipelines/our-pipeline'
    );
    expect(result).toBe('src/pipelines/our-pipeline');
  });

  it('handles beam file at workspace root', () => {
    const result = computeUpdatedOutputFolder(
      'job1',
      '',
      'parse-message-pipeline',
      'parse-message-pipeline'
    );
    expect(result).toBe('parse-message-pipeline');
  });

  it('handles moving file from subfolder to workspace root', () => {
    const result = computeUpdatedOutputFolder(
      'test/job1/job1',
      '',
      'job1',
      'job1'
    );
    expect(result).toBe('job1');
  });

  it('handles absolute output folder path by updating last component', () => {
    const result = computeUpdatedOutputFolder(
      '/Users/mikenimer/custom/output/job1',
      'test/parse message',
      'parse-message-pipeline',
      'test/parse message/parse-message-pipeline'
    );
    expect(result).toBe('/Users/mikenimer/custom/output/parse-message-pipeline');
  });

  it('returns unchanged path when output folder is already accurate', () => {
    const result = computeUpdatedOutputFolder(
      'test/parse message/parse-message-pipeline',
      'test/parse message',
      'parse-message-pipeline',
      'test/parse message/parse-message-pipeline'
    );
    expect(result).toBe('test/parse message/parse-message-pipeline');
  });
});
