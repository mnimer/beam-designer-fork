/**
 * @fileoverview Shared Secret Manager picker: labeled header with a Refresh
 * action above a free-text PropertyField backed by a datalist of discovered secrets.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Unifies the hand-rolled secret picker blocks in connector panels. Pair it with
 * {@link useSecretOptions} (call the hook once per panel and pass the result to
 * every picker in that panel so secrets are requested only once).
 */

import React from 'react';
import { Key, RefreshCw } from 'lucide-react';
import { InfoTooltip } from '../InfoTooltip';
import { PropertyField } from './PropertyField';
import type { UseSecretOptionsResult } from '../../hooks/useSecretOptions';

/** Helper text shown when secrets were discovered. */
export const SECRET_PICKER_HELP_DISCOVERED = 'Select from discovered secrets or type a custom secret ID.';

/** Helper text shown when no secrets were discovered. */
export const SECRET_PICKER_HELP_EMPTY = 'No secrets automatically loaded. Enter secret resource name directly.';

/**
 * Props for the {@link SecretPicker} component.
 */
export interface SecretPickerProps {
  /** Input id (also used for the label's htmlFor). */
  id: string;
  /** Node property name written by `onChange` (the input's `name`). */
  name: string;
  /** Current secret ID. */
  value: string;
  /** Standard change handler (receives the input change event). */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  /** Secrets state from {@link useSecretOptions}. */
  secrets: UseSecretOptionsResult;
  /** Header label. Defaults to "GCP Secret Manager Secret". */
  label?: string;
  /** Header tooltip text. */
  tooltip?: string;
  /** Input placeholder. */
  placeholder?: string;
  /** Optional helper text override; defaults to discovered/empty guidance. */
  helperText?: React.ReactNode;
}

/**
 * Renders the Secret Manager picker block.
 *
 * @param props Picker configuration.
 * @returns Header row (icon, label, tooltip, Refresh) and the secret input.
 */
export const SecretPicker: React.FC<SecretPickerProps> = ({
  id,
  name,
  value,
  onChange,
  secrets,
  label = 'GCP Secret Manager Secret',
  tooltip,
  placeholder,
  helperText,
}) => (
  <div className="flex flex-col justify-end gap-1.5">
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
        <Key size={12} />
        <span>{label}</span>
        {tooltip && <InfoTooltip text={tooltip} position="auto" />}
      </label>
      <button
        type="button"
        onClick={secrets.refresh}
        disabled={secrets.loading}
        className="text-xs text-blue-400 hover:underline flex items-center gap-1"
        title="Refresh secrets from Secret Manager"
      >
        <RefreshCw size={11} className={secrets.loading ? 'animate-spin' : ''} />
        <span>Refresh</span>
      </button>
    </div>

    <PropertyField
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      datalist={secrets.options}
      loading={secrets.loading}
      error={secrets.error}
      invalid={!!secrets.error}
      helperText={helperText ?? (secrets.options.length > 0 ? SECRET_PICKER_HELP_DISCOVERED : SECRET_PICKER_HELP_EMPTY)}
      mono={true}
    />
  </div>
);
