/**
 * @fileoverview Shared SystemInstructionsField component for property panels.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Provides a standardized textarea field for configuring LLM code generation
 * instructions across dedicated connector property panels.
 */

import React from 'react';
import { PropertyField } from './PropertyField';

/**
 * Props for the SystemInstructionsField component.
 */
export interface SystemInstructionsFieldProps {
  /** HTML input id for the underlying PropertyField textarea */
  id: string;
  /** Current system instructions value */
  value: string;
  /** Callback fired with the new string value when the textarea content changes */
  onChange: (value: string) => void;
  /** Placeholder text for the textarea */
  placeholder?: string;
  /** Number of visible text rows for the textarea. Defaults to 3. */
  rows?: number;
  /** Label text displayed above the field. Defaults to "Code Generation Instructions". */
  label?: string;
  /** Optional documentation tooltip text displayed next to the label */
  tooltip?: string;
  /** Custom CSS classes for the outer wrapper div. Defaults to "flex flex-col gap-2 pt-2 border-t border-slate-700/60". */
  wrapperClassName?: string;
  /** Optional guidance rendered beneath the textarea (forwarded to PropertyField's helperText). */
  helperText?: React.ReactNode;
  /** Optional extra CSS classes for the textarea itself, e.g. a fixed height (forwarded to PropertyField's className). */
  textareaClassName?: string;
}

/**
 * Standardized Code Generation Instructions block rendered across connector property panels.
 *
 * Renders a flexible spacer followed by an outer wrapper div around a PropertyField
 * textarea with mono={false}. The spacer (`flex-1 min-h-4`) absorbs any free vertical
 * space in the panel's `flex-1 flex flex-col` root, pushing the instructions block to the
 * bottom so it stands apart from the connector's regular fields. When a panel has too many
 * fields to leave free space, the spacer collapses to its 16px minimum.
 *
 * The component must therefore be rendered as a DIRECT child of the panel's root
 * `flex-1 flex flex-col` container (enforced by `codeGenerationPlacement.test.tsx`).
 */
export const SystemInstructionsField: React.FC<SystemInstructionsFieldProps> = ({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
  label = 'Code Generation Instructions',
  tooltip,
  wrapperClassName = 'flex flex-col gap-2 pt-2 border-t border-slate-700/60',
  helperText,
  textareaClassName,
}) => {
  return (
    <>
      {/* Flexible spacer: pushes the instructions block to the bottom of the panel */}
      <div className="flex-1 min-h-4" aria-hidden="true" data-codegen-spacer="true" />
      <div className={wrapperClassName} data-codegen-instructions="true">
        <PropertyField
          id={id}
          name="system_instructions"
          label={label}
          tooltip={tooltip}
          type="textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          mono={false}
          helperText={helperText}
          className={textareaClassName}
        />
      </div>
    </>
  );
};
