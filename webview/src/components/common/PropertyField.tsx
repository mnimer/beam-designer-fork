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

import React, { useId, useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
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
  /** Whether suggestions are actively loading from extension host */
  loading?: boolean;
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
  loading = false,
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

  // Extract suggestions from datalist prop
  const optionsFromProp: PropertyFieldOption[] = (datalist || []).map((item) => {
    if (typeof item === 'string') {
      return { value: item, label: item };
    }
    return { value: item.value, label: item.label || item.value };
  });

  // Also extract suggestions from children if a <datalist> was passed as a child
  const optionsFromChildren: PropertyFieldOption[] = [];
  React.Children.forEach(children, (child: any) => {
    if (child && child.type === 'datalist' && child.props && child.props.children) {
      React.Children.forEach(child.props.children, (opt: any) => {
        if (opt && opt.props && opt.props.value !== undefined) {
          optionsFromChildren.push({
            value: String(opt.props.value),
            label: typeof opt.props.children === 'string'
              ? opt.props.children
              : (opt.props.label || String(opt.props.value)),
          });
        }
      });
    }
  });

  const allOptions = optionsFromProp.length > 0 ? optionsFromProp : optionsFromChildren;
  const showCombobox = Boolean((datalist !== undefined || allOptions.length > 0) && type !== 'textarea');

  const [isOpen, setIsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = filterQuery.trim()
    ? allOptions.filter((opt) => {
        const q = filterQuery.toLowerCase();
        return (
          opt.value.toLowerCase().includes(q) ||
          (opt.label && opt.label.toLowerCase().includes(q))
        );
      })
    : allOptions;

  const handleSelectOption = (optValue: string) => {
    if (onChange) {
      const syntheticEvent = {
        target: { name: name || '', value: optValue, type: 'text' },
        currentTarget: { name: name || '', value: optValue, type: 'text' },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
    if (onValueChange) {
      onValueChange(optValue);
    }
    setFilterQuery('');
    setIsOpen(false);
  };

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
    if (showCombobox) {
      setFilterQuery(e.target.value);
      if (!isOpen) {
        setIsOpen(true);
      }
    }
    if (onChange) {
      onChange(e);
    }
    if (onValueChange) {
      onValueChange(e.target.value);
    }
  };

  const handleFocus = () => {
    if (showCombobox && !isOpen) {
      setIsOpen(true);
      setFilterQuery('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' && showCombobox && !isOpen) {
      setIsOpen(true);
      setFilterQuery('');
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
        <div ref={containerRef} className="relative w-full">
          <input
            ref={inputRef}
            id={inputId}
            type={type}
            name={name}
            aria-required={ariaRequiredProp ?? isRequired}
            aria-invalid={ariaInvalidProp ?? isInvalid}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            data-list={datalistId}
            list={datalistId}
            min={min}
            max={max}
            step={step}
            className={`${baseInputClasses} ${borderClasses} ${showCombobox ? 'pr-8' : ''} ${className || ''} w-full`}
            {...rest}
          />
          {showCombobox && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Toggle suggestions"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen((prev) => {
                  if (!prev) {
                    setFilterQuery('');
                  }
                  return !prev;
                });
              }}
              disabled={disabled || readOnly}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
              />
            </button>
          )}

          {/* Combobox Dropdown Menu */}
          {isOpen && showCombobox && (
            <div
              className="absolute left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto bg-[#1e202a] border border-slate-700 rounded shadow-2xl z-50 py-1"
              role="listbox"
            >
              {allOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400 italic">
                  {loading ? 'Loading suggestions...' : 'No suggestions available'}
                </div>
              ) : filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => {
                  const isSelected = String(value) === opt.value;
                  return (
                    <div
                      key={`${opt.value}-${idx}`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectOption(opt.value);
                      }}
                      className={`px-3 py-1.5 text-xs cursor-pointer flex flex-col hover:bg-slate-700/60 ${
                        isSelected
                          ? 'bg-blue-600/20 text-blue-300 font-semibold'
                          : 'text-slate-200'
                      }`}
                    >
                      <span className="font-mono truncate">{opt.label || opt.value}</span>
                      {opt.label && opt.label !== opt.value && (
                        <span className="text-[10px] text-slate-400 font-mono truncate">{opt.value}</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-xs text-slate-400 italic">
                  No matching suggestions
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Datalist suggestions */}
      {datalistId && datalist && (
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
