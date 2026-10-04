/**
 * @fileoverview Pure validation helper functions for Cognite Data Fusion (CDF) connector property panels.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Parses an ISO-8601 duration subset (`PnDTnHnMn.nS`) into milliseconds.
 * Returns null if the string is not a valid duration or has no components.
 *
 * @param input - The duration string to parse (e.g. `PT10S`, `P1DT2H`).
 * @returns Milliseconds represented by the duration, or null if invalid.
 */
export function parseIsoDurationMs(input: string): number | null {
  const trimmed = input.trim();
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,9})?)S)?)?$/i.exec(trimmed);
  if (!match) {
    return null;
  }
  const [, days, hours, minutes, seconds] = match;
  if (days === undefined && hours === undefined && minutes === undefined && seconds === undefined) {
    return null;
  }
  const dMs = days ? Number(days) * 86_400_000 : 0;
  const hMs = hours ? Number(hours) * 3_600_000 : 0;
  const mMs = minutes ? Number(minutes) * 60_000 : 0;
  const sMs = seconds ? Number(seconds) * 1_000 : 0;
  return dMs + hMs + mMs + sMs;
}

/**
 * Validates that an input string represents an integer within a specified [min, max] range (inclusive).
 *
 * @param val - The input string to validate.
 * @param min - Minimum allowed integer value.
 * @param max - Maximum allowed integer value.
 * @returns True if val is a valid integer between min and max inclusive, false otherwise.
 */
export function isIntegerInRange(val: string, min: number, max: number): boolean {
  if (!/^-?\d+$/.test(val.trim())) {
    return false;
  }
  const n = Number(val.trim());
  return n >= min && n <= max;
}
