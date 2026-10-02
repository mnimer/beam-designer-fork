/**
 * SelectField Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Shared dropdown primitive for connector property panels (compression codecs, protocol
 * factories, format presets, write dispositions, and similar enumerations). Extracted from the
 * select markup that was copy-pasted across the file connector panels so that new connectors
 * compose one dropdown implementation instead of re-deriving label, tooltip, and select styling.
 * 
 * Architectural Decisions:
 * - Tailwind class strings are copied byte-for-byte from the existing duplicated select markup
 *   (webview/src/properties/sink/ParquetIO.tsx, the Compression Codec dropdown) to guarantee zero
 *   visual drift when panels migrate onto this primitive.
 * - The component is fully controlled: the caller owns `value` and receives the raw change event
 *   (props in, events up). No internal state, no two-way binding, and the native event is passed
 *   through unchanged so panels can keep using a single `handleChange(e)` keyed on `e.target.name`.
 * - `label` + `htmlFor` pairing is mandatory rather than optional, because every existing
 *   duplicated copy labelled its select; keeping it required prevents unlabelled dropdowns.
 * - Options are rendered from a typed `SelectFieldOption[]`; `label` is required on each option so
 *   a dropdown can never silently render a blank entry.
 * - Uses `InfoTooltip` for SDK documentation popups, matching PropertyField.
 * - Spacing stays on the 8pt grid and uses only existing VS Code theme tokens; no inline styles
 *   and no new colors are introduced.
 */

import React from 'react';
import { InfoTooltip } from '../InfoTooltip';

/**
 * Option descriptor for the {@link SelectField} dropdown.
 */
export interface SelectFieldOption {
  /** Value submitted to the change handler and persisted in node properties. */
  value: string;
  /** Human-readable option text rendered in the dropdown. */
  label: string;
}

/**
 * Props for the {@link SelectField} component.
 */
export interface SelectFieldProps {
  /** DOM id of the select element; also targeted by the label's htmlFor. */
  id: string;
  /** Form field name, used by panel-level change handlers to key the property update. */
  name: string;
  /** Human-readable label rendered above the select. */
  label: string;
  /** Optional tooltip text rendered via InfoTooltip next to the label. */
  tooltip?: string;
  /** Currently selected option value. */
  value: string;
  /** Options rendered in the dropdown. */
  options: SelectFieldOption[];
  /** Standard React change handler receiving the native select change event. */
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  /** Optional helper text or description rendered below the select. */
  helperText?: React.ReactNode;
  /** Disables user interaction with the select. */
  disabled?: boolean;
}

/**
 * Renders a labelled, controlled dropdown with optional tooltip and helper text.
 *
 * @param props Controlled select configuration.
 * @returns The label, select element, and optional helper text.
 */
export const SelectField: React.FC<SelectFieldProps> = ({
  id,
  name,
  label,
  tooltip,
  value,
  options,
  onChange,
  helperText,
  disabled
}) => {
  return (
    <div className="flex flex-col justify-end gap-1.5">
      <label
        htmlFor={id}
        className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5"
      >
        <span>{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && (
        <span className="text-[11px] text-[var(--vscode-text-muted)]">
          {helperText}
        </span>
      )}
    </div>
  );
};
