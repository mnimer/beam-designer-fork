/**
 * SecretManagerSecretField Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Single credential input for connector property panels that ONLY accepts a Google Cloud
 * Secret Manager secret reference. It never offers a plaintext credential mode: the stored
 * value is the short secret ID, and generated pipeline code resolves the secret at runtime.
 *
 * Architectural Decisions:
 * - Reuses the PubSubIO discovery pattern: PropertyField + native datalist of string values,
 *   populated through useAssetLoader('secrets') (`getSecrets` -> `gcloud secrets list`).
 * - Accepts an optional preloaded `secrets` list so a panel with several credential fields
 *   issues a single `getSecrets` request and passes the items to each field.
 * - Normalizes SecretItem objects and full resource paths to short IDs via normalizeSecretItem,
 *   and de-duplicates them, so the datalist only ever offers usable secret IDs.
 * - The `name` prop must be a key on the credential redaction allowlist (src/credentialRedaction.ts
 *   SECRET_REFERENCE_KEYS, e.g. passwordSecret) so the reference survives into code generation.
 */

import React from 'react';
import { PropertyField } from './PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from './SecretManagerAuthFields';
import type { SecretItem } from './SecretManagerAuthFields';

export const DEFAULT_SECRET_FIELD_TOOLTIP =
  'Short ID of the Google Cloud Secret Manager secret that holds this credential. ' +
  'The generated pipeline reads the secret from Secret Manager at runtime; the credential itself is never stored in the pipeline.';

export const DEFAULT_SECRET_FIELD_PLACEHOLDER = 'e.g. my-db-password';

/**
 * Props for the {@link SecretManagerSecretField} component.
 */
export interface SecretManagerSecretFieldProps {
  /** HTML id of the input (also used to derive the default datalist id). */
  id: string;
  /** Property key written to node.data.properties. MUST be on the redaction allowlist (e.g. passwordSecret). */
  name: string;
  /** Visible label, e.g. "Password Secret". */
  label: string;
  /** Current short secret ID. */
  value?: string;
  /** Standard change handler (same signature panels use for PropertyField). */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Marks the field as required. If a string, used as the asterisk title. */
  required?: boolean | string;
  /** Tooltip text; defaults to DEFAULT_SECRET_FIELD_TOOLTIP. */
  tooltip?: string;
  /** Placeholder; defaults to DEFAULT_SECRET_FIELD_PLACEHOLDER. */
  placeholder?: string;
  /** Optional preloaded secrets (SecretItem objects or strings). When provided, no getSecrets request is sent. */
  secrets?: (SecretItem | string)[];
  /** Validation error; takes precedence over the discovery error. */
  error?: string | null;
  /** Explicit invalid flag (e.g. required-but-empty). */
  invalid?: boolean;
  /** Override datalist id; defaults to `${id}-secret-options`. */
  datalistId?: string;
  /** Whether preloaded secrets are actively loading from the extension host. */
  loading?: boolean;
}

/**
 * Secret Manager-only credential picker rendered with the shared PropertyField datalist control.
 */
export const SecretManagerSecretField: React.FC<SecretManagerSecretFieldProps> = ({
  id,
  name,
  label,
  value = '',
  onChange,
  required,
  tooltip = DEFAULT_SECRET_FIELD_TOOLTIP,
  placeholder = DEFAULT_SECRET_FIELD_PLACEHOLDER,
  secrets,
  error,
  invalid,
  datalistId,
  loading
}) => {
  // Only fetch when the parent did not preload the list.
  const shouldAutoLoad = secrets === undefined;
  const {
    items: loadedSecrets,
    loading: discoveryLoading,
    error: discoveryError
  } = useAssetLoader<SecretItem | string>('secrets', {
    enabled: shouldAutoLoad
  });

  const source = secrets ?? loadedSecrets;
  const seenSecretIds = new Set<string>();
  const secretOptions: { value: string; label: string }[] = [];
  for (const item of source) {
    const normalized = normalizeSecretItem(item);
    if (normalized.id.length > 0 && !seenSecretIds.has(normalized.id)) {
      seenSecretIds.add(normalized.id);
      secretOptions.push({ value: normalized.id, label: normalized.name });
    }
  }

  return (
    <PropertyField
      id={id}
      name={name}
      label={label}
      required={required}
      tooltip={tooltip}
      value={value}
      invalid={invalid}
      error={error || discoveryError}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete="off"
      list={datalistId ?? `${id}-secret-options`}
      datalist={secretOptions}
      loading={loading ?? discoveryLoading}
      helperText={
        <span>
          Values auto-populated from{' '}
          <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">gcloud secrets list</code>
        </span>
      }
    />
  );
};
