/**
 * @fileoverview Typed property accessors for dedicated property panels.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * This is NOT a form generator: each connector keeps its own hand-written panel.
 * The hook only removes the copy-pasted plumbing every panel repeats — reading
 * `node.data.properties`, merging a patch into it and emitting `onChange`, and the
 * generic text/select/checkbox `handleChange`.
 */

import { useCallback, useMemo, type ChangeEvent } from 'react';

/** Minimal node shape the hook reads. */
export interface NodeWithProperties<P> {
  data?: { properties?: P } | null;
}

/** Change event emitted by inputs, selects and textareas. */
export type FieldChangeEvent = ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

/**
 * Result of {@link useNodeProperties}.
 */
export interface UseNodePropertiesResult<P extends object> {
  /** Current properties (empty object when the node has none). */
  properties: P;
  /** Merges `patch` into the current properties and emits the result via `onChange`. */
  update: (patch: Partial<P>) => void;
  /** Sets a single property. */
  setProperty: <K extends keyof P>(key: K, value: P[K]) => void;
  /**
   * Generic input handler: writes `e.target.value` (or `checked` for checkboxes)
   * to the property named by `e.target.name`.
   */
  handleChange: (e: FieldChangeEvent) => void;
}

/**
 * Provides typed read/update helpers for a dedicated panel's node properties.
 *
 * @param node The selected node.
 * @param onChange Panel callback that persists the full, updated properties object.
 * @returns Properties plus `update`, `setProperty` and `handleChange` helpers.
 */
export function useNodeProperties<P extends object = Record<string, unknown>>(
  node: NodeWithProperties<P> | null | undefined,
  onChange: (properties: P) => void
): UseNodePropertiesResult<P> {
  const rawProperties = node?.data?.properties;
  const properties = useMemo(() => (rawProperties ?? {}) as P, [rawProperties]);

  const update = useCallback(
    (patch: Partial<P>) => onChange({ ...properties, ...patch }),
    [properties, onChange]
  );

  const setProperty = useCallback(
    <K extends keyof P>(key: K, value: P[K]) => update({ [key]: value } as unknown as Partial<P>),
    [update]
  );

  const handleChange = useCallback(
    (e: FieldChangeEvent) => {
      const { name, value, type } = e.target;
      const isCheckbox = type === 'checkbox';
      const next = isCheckbox ? (e.target as HTMLInputElement).checked : value;
      update({ [name]: next } as unknown as Partial<P>);
    },
    [update]
  );

  return { properties, update, setProperty, handleChange };
}
