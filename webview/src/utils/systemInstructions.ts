/**
 * @fileoverview Utility functions and types for resolving LLM code generation system instructions.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Provides the canonical fallback resolution logic for extracting system/special
 * instructions from pipeline graph nodes across Apache Beam Designer property panels.
 */

/**
 * Loosely typed node definition accepted by property panel components.
 */
export interface SystemInstructionsNode {
  /** Node data containing properties and instruction fields */
  data?: {
    /** Top-level system instructions */
    system_instructions?: string;
    /** Deprecated or alternate special instructions */
    special_instructions?: string;
    /** Nested properties bag */
    properties?: {
      /** Properties-level system instructions */
      system_instructions?: string;
      /** Deprecated or alternate special instructions inside properties */
      special_instructions?: string;
    };
  };
}

/**
 * Resolves the system instructions string from a pipeline node using the standard fallback chain:
 * 1. `node.data.system_instructions`
 * 2. `node.data.special_instructions`
 * 3. `node.data.properties.system_instructions`
 * 4. `node.data.properties.special_instructions`
 * 5. Fallback empty string `''`
 *
 * @param node The graph node whose system instructions to resolve.
 * @returns The resolved system instructions string.
 */
export function resolveSystemInstructions(
  node?: SystemInstructionsNode | null
): string {
  const data = node?.data;
  const properties = data?.properties;
  return (
    data?.system_instructions ??
    data?.special_instructions ??
    (properties?.system_instructions as string | undefined) ??
    (properties?.special_instructions as string | undefined) ??
    ''
  );
}
