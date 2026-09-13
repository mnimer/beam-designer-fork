/**
 * PropertyField Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Standardized form property input field conforming to Apache Beam Designer UI guidelines.
 * Eliminates duplicate Tailwind styling across property components while reproducing
 * the exact visual layout, accessible ARIA attributes, and 8pt grid spacing.
 * 
 * Architectural Decisions:
 * - Uses exact verbatim Tailwind class strings established in property components to prevent visual drift.
 * - Adheres strictly to the 8pt grid (spacing and gaps in multiples of 8px).
 * - Integrates InfoTooltip for SDK documentation popups.
 * - Supports both input and textarea elements seamlessly.
 */

import React, { useId } from 'react';
import { InfoTooltip } from '../InfoTooltip';

export interface PropertyFieldOption {
  value: string;
  label?: string;
}

export interface PropertyFieldProps {
  /** HTML input id. If omitted, a unique accessibility id is automatically generated. */
  id?: string;
  /** HTML input name */
  name?: string;
  /** Human-readable label displayed above the field */
  label?: string;
  /** Optional icon element rendered before the label */
  icon?: React.ReactNode;
  /** Tooltip text displayed via InfoTooltip next to the label */
  tooltip?: string;
  /** Input type ('text', 'number', 'password', 'textarea', etc.). Defaults to 'text'. */
  type?: string;
  /** Current field value */
  value?: string | number | readonly string[];
  /** Placeholder text */
  placeholder?: string;
  /** Marks field as required. If string, used as tooltip title for asterisk. */
  required?: boolean | string;
  /** Error message string, or boolean flag indicating invalid state */
  error?: string | boolean | null;
  /** Explicitly marks field as invalid (e.g. combined validation) */
  invalid?: boolean;
  /** Optional helper text or sample description shown below the input */
  helperText?: React.ReactNode;
  /** ID of an external datalist */
  list?: string;
  /** Array of suggestion options to render in an attached datalist */
  datalist?: (string | PropertyFieldOption)[];
  /** Whether to apply monospace font (font-mono). Defaults to true for technical data fields. */
  mono?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Number of rows when type is 'textarea'. Defaults to 3. */
  rows?: number;
  /** Custom class name overrides or extensions for the input/textarea */
  className?: string;
  /** Custom class name for the wrapper container */
  containerClassName?: string;
  /** Standard React change handler */
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Value-only change handler for convenience */
  onValueChange?: (value: string) => void;
  /** Optional children rendered at the bottom of the container */
  children?: React.ReactNode;
  /** Minimum number (for number inputs) */
  min?: number | string;
  /** Maximum number (for number inputs) */
  max?: number | string;
  /** Step value (for number inputs) */
  step?: number | string;
  /**
   * Standard native input constraints.
   *
   * NOTE: these are declared explicitly rather than by extending
   * React.InputHTMLAttributes, because this component renders EITHER an <input> or a
   * <textarea> and those two element types have conflicting attribute sets. The
   * interface deliberately has no index signature, so anything not listed here is a
   * compile error at the call site rather than a silently dropped attribute.
   */
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  autoComplete?: string;
  spellCheck?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  /** ARIA invalid override */
  'aria-invalid'?: boolean | 'true' | 'false';
  /** ARIA required override */
  'aria-required'?: boolean | 'true' | 'false';
}

/**
 * PropertyField renders a form input or textarea with standardized label, tooltip,
 * error state, and datalist suggestions.
 */
export const PropertyField: React.FC<PropertyFieldProps> = ({
  id,
  name,
  label,
  icon,
  tooltip,
  type = 'text',
  value = '',
  placeholder,
  required,
  error,
  invalid,
  helperText,
  list,
  datalist,
  mono = true,
  disabled,
  readOnly,
  rows = 3,
  className,
  containerClassName = 'flex flex-col gap-2',
  onChange,
  onValueChange,
  children,
  min,
  max,
  step,
  'aria-invalid': ariaInvalidProp,
  'aria-required': ariaRequiredProp,
  ...rest
}) => {
  const generatedId = useId();
  const inputId = id || (name ? `field-${name}` : generatedId);
  const datalistId = list || (datalist && datalist.length > 0 ? `${inputId}-datalist` : undefined);

  // Compute invalid status
  const isInvalid = Boolean(
    invalid ||
    (typeof error === 'string' && error.trim().length > 0) ||
    error === true ||
    ariaInvalidProp === true ||
    ariaInvalidProp === 'true'
  );

  // Error message string to render (if string provided)
  const errorMessage = typeof error === 'string' && error.trim().length > 0 ? error : null;

  // Exact verbatim Tailwind class strings matching the 41 existing property components
  const baseInputClasses = `bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${mono ? 'font-mono' : ''}`;
  const borderClasses = isInvalid
    ? 'border-red-500/80 focus:border-red-500'
    : 'border-slate-700 focus:border-blue-500';

  /**
   * Dispatches change events to both standard onChange and onValueChange callbacks.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e);
    }
    if (onValueChange) {
      onValueChange(e.target.value);
    }
  };

  const isRequired = Boolean(required);
  const requiredTitle = typeof required === 'string' ? required : 'Required';

  return (
    <div className={containerClassName}>
      {/* Field Label */}
      {label && (
        <label htmlFor={inputId} className="flex items-center text-xs font-bold uppercase text-slate-500">
          {icon && <span className="mr-1.5 flex items-center">{icon}</span>}
          <span>{label}</span>
          {isRequired && (
            <span className="text-red-400 ml-1 font-bold" title={requiredTitle}>*</span>
          )}
          {tooltip && <InfoTooltip text={tooltip} />}
        </label>
      )}

      {/* Input or Textarea */}
      {type === 'textarea' ? (
        <textarea
          id={inputId}
          name={name}
          aria-required={ariaRequiredProp ?? isRequired}
          aria-invalid={ariaInvalidProp ?? isInvalid}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          rows={rows}
          className={`${baseInputClasses} ${borderClasses} resize-y ${className || ''}`}
          {...rest}
        />
      ) : (
        <input
          id={inputId}
          type={type}
          name={name}
          aria-required={ariaRequiredProp ?? isRequired}
          aria-invalid={ariaInvalidProp ?? isInvalid}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          list={datalistId}
          min={min}
          max={max}
          step={step}
          className={`${baseInputClasses} ${borderClasses} ${className || ''}`}
          {...rest}
        />
      )}

      {/* Datalist suggestions */}
      {datalist && datalist.length > 0 && datalistId && (
        <datalist id={datalistId}>
          {datalist.map((item, idx) => {
            const optVal = typeof item === 'string' ? item : item.value;
            const optLabel = typeof item === 'string' ? undefined : item.label;
            return (
              <option key={`${optVal}-${idx}`} value={optVal}>
                {optLabel}
              </option>
            );
          })}
        </datalist>
      )}

      {/* Inline Error Message */}
      {errorMessage && (
        <span className="text-xs text-red-400 mt-1" role="alert">
          {errorMessage}
        </span>
      )}

      {/* Optional Helper Text / Description */}
      {helperText && (
        <span className="text-xs text-slate-400">
          {helperText}
        </span>
      )}

      {children}
    </div>
  );
};
