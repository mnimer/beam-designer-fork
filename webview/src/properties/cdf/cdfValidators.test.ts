/**
 * @fileoverview Unit tests for Cognite Data Fusion validation helpers.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import { parseIsoDurationMs, isIntegerInRange } from './cdfValidators';

describe('cdfValidators', () => {
  describe('parseIsoDurationMs', () => {
    it('parses days component', () => {
      expect(parseIsoDurationMs('P1D')).toBe(86_400_000);
      expect(parseIsoDurationMs('P2D')).toBe(172_800_000);
    });

    it('parses hours component', () => {
      expect(parseIsoDurationMs('PT1H')).toBe(3_600_000);
      expect(parseIsoDurationMs('PT2H')).toBe(7_200_000);
    });

    it('parses minutes component', () => {
      expect(parseIsoDurationMs('PT1M')).toBe(60_000);
      expect(parseIsoDurationMs('PT30M')).toBe(1_800_000);
    });

    it('parses seconds component', () => {
      expect(parseIsoDurationMs('PT1S')).toBe(1_000);
      expect(parseIsoDurationMs('PT10S')).toBe(10_000);
    });

    it('parses fractional seconds', () => {
      expect(parseIsoDurationMs('PT1.5S')).toBe(1_500);
      expect(parseIsoDurationMs('PT0.001S')).toBe(1);
    });

    it('parses combined durations', () => {
      // 1 day + 2 hours + 3 minutes + 4.5 seconds
      // 86,400,000 + 7,200,000 + 180,000 + 4,500 = 93,784,500
      expect(parseIsoDurationMs('P1DT2H3M4.5S')).toBe(93_784_500);
      expect(parseIsoDurationMs('PT1H30M')).toBe(5_400_000);
      expect(parseIsoDurationMs('P1DT30S')).toBe(86_430_000);
    });

    it('trims leading and trailing whitespace and is case-insensitive', () => {
      expect(parseIsoDurationMs('   PT10S  ')).toBe(10_000);
      expect(parseIsoDurationMs('pt2h')).toBe(7_200_000);
      expect(parseIsoDurationMs('p1dt1h')).toBe(90_000_000);
    });

    it('returns null for empty P or PT without components', () => {
      expect(parseIsoDurationMs('P')).toBeNull();
      expect(parseIsoDurationMs('PT')).toBeNull();
      expect(parseIsoDurationMs('  P  ')).toBeNull();
      expect(parseIsoDurationMs('  PT  ')).toBeNull();
    });

    it('returns null for empty strings or whitespace', () => {
      expect(parseIsoDurationMs('')).toBeNull();
      expect(parseIsoDurationMs('   ')).toBeNull();
    });

    it('returns null for invalid strings and unsupported formats', () => {
      expect(parseIsoDurationMs('invalid')).toBeNull();
      expect(parseIsoDurationMs('10S')).toBeNull();
      expect(parseIsoDurationMs('PT-5S')).toBeNull();
      expect(parseIsoDurationMs('P1Y')).toBeNull();
      expect(parseIsoDurationMs('P1W')).toBeNull();
      expect(parseIsoDurationMs('P1M')).toBeNull(); // M before T is months (unsupported)
    });
  });

  describe('isIntegerInRange', () => {
    it('returns true for integers strictly within the range', () => {
      expect(isIntegerInRange('5', 1, 10)).toBe(true);
      expect(isIntegerInRange('0', -5, 5)).toBe(true);
      expect(isIntegerInRange('-3', -5, 5)).toBe(true);
    });

    it('returns true for boundary values (inclusive min and max)', () => {
      expect(isIntegerInRange('1', 1, 10)).toBe(true);
      expect(isIntegerInRange('10', 1, 10)).toBe(true);
      expect(isIntegerInRange('-5', -5, 5)).toBe(true);
      expect(isIntegerInRange('5', -5, 5)).toBe(true);
    });

    it('trims whitespace before checking', () => {
      expect(isIntegerInRange('  4  ', 1, 10)).toBe(true);
      expect(isIntegerInRange('   1   ', 1, 10)).toBe(true);
    });

    it('returns false for integers below min or above max', () => {
      expect(isIntegerInRange('0', 1, 10)).toBe(false);
      expect(isIntegerInRange('-1', 1, 10)).toBe(false);
      expect(isIntegerInRange('11', 1, 10)).toBe(false);
      expect(isIntegerInRange('100', 1, 10)).toBe(false);
      expect(isIntegerInRange('-6', -5, 5)).toBe(false);
      expect(isIntegerInRange('6', -5, 5)).toBe(false);
    });

    it('returns false for floats and non-integers', () => {
      expect(isIntegerInRange('1.5', 1, 10)).toBe(false);
      expect(isIntegerInRange('4.0', 1, 10)).toBe(false);
      expect(isIntegerInRange('-2.5', -5, 5)).toBe(false);
    });

    it('returns false for non-numeric strings', () => {
      expect(isIntegerInRange('abc', 1, 10)).toBe(false);
      expect(isIntegerInRange('10px', 1, 20)).toBe(false);
      expect(isIntegerInRange('', 1, 10)).toBe(false);
      expect(isIntegerInRange('   ', 1, 10)).toBe(false);
    });

    it('returns false for signs other than leading minus on digits', () => {
      expect(isIntegerInRange('+5', 1, 10)).toBe(false);
      expect(isIntegerInRange('--5', 1, 10)).toBe(false);
      expect(isIntegerInRange('5-', 1, 10)).toBe(false);
    });
  });
});
