/**
 * @fileoverview Unit tests for log line classification and styling.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import { getLogLineColorClass } from './logClassifier';

describe('logClassifier', () => {
  it('classifies execution lifecycle prefix messages', () => {
    expect(getLogLineColorClass('[Execution completed successfully]')).toBe('text-emerald-400 font-bold');
    expect(getLogLineColorClass('[Execution stopped by user]')).toBe('text-amber-400 font-bold');
    expect(getLogLineColorClass('[Execution failed with error code 1]')).toBe('text-rose-400 font-bold');
    expect(getLogLineColorClass('[Process execution error]')).toBe('text-rose-400 font-bold');
    expect(getLogLineColorClass('[Error] failed to start')).toBe('text-rose-400 font-bold');
  });

  it('classifies success keywords in log lines', () => {
    expect(getLogLineColorClass('Step 1: [SUCCESS] Done')).toBe('text-emerald-400');
    expect(getLogLineColorClass('mvn package: BUILD SUCCESS')).toBe('text-emerald-400');
    expect(getLogLineColorClass('SUCCESS: Job submitted')).toBe('text-emerald-400');
    expect(getLogLineColorClass('Pipeline reached STATE DONE')).toBe('text-emerald-400');
    expect(getLogLineColorClass('Pipeline FINISHED SUCCESSFULLY')).toBe('text-emerald-400');
  });

  it('classifies warning keywords in log lines', () => {
    expect(getLogLineColorClass('[WARNING] Disk space low')).toBe('text-amber-400');
    expect(getLogLineColorClass('[WARN] Configuration incomplete')).toBe('text-amber-400');
    expect(getLogLineColorClass('WARN Something odd happened')).toBe('text-amber-400');
    expect(getLogLineColorClass('WARNING: Using default parameters')).toBe('text-amber-400');
    expect(getLogLineColorClass('This feature is DEPRECATED')).toBe('text-amber-400');
  });

  it('classifies error and exception keywords in log lines', () => {
    expect(getLogLineColorClass('[ERROR] Failed to connect')).toBe('text-rose-400');
    expect(getLogLineColorClass('ERROR: NullPointer encountered')).toBe('text-rose-400');
    expect(getLogLineColorClass('java.lang.RuntimeException: EXCEPTION thrown')).toBe('text-rose-400');
    expect(getLogLineColorClass('FATAL: Could not allocate memory')).toBe('text-rose-400');
    expect(getLogLineColorClass('BUILD FAILURE')).toBe('text-rose-400');
  });

  it('classifies info and debug keywords in log lines', () => {
    expect(getLogLineColorClass('[INFO] Starting server')).toBe('text-slate-200');
    expect(getLogLineColorClass('INFO Worker pool initialized')).toBe('text-slate-200');
    expect(getLogLineColorClass('[DEBUG] State transitions: 4')).toBe('text-slate-200');
    expect(getLogLineColorClass('DEBUG verbose details')).toBe('text-slate-200');
  });

  it('handles generic stderr stream when no keywords match', () => {
    expect(getLogLineColorClass('random stderr output', 'stderr')).toBe('text-slate-300');
  });

  it('handles generic stdout stream default', () => {
    expect(getLogLineColorClass('random normal output', 'stdout')).toBe('text-slate-200');
    expect(getLogLineColorClass('random normal output')).toBe('text-slate-200');
  });
});
