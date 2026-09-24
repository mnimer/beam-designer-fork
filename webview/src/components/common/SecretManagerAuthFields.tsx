/**
 * SecretManagerAuthFields Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Shared credential and authentication mode configuration block for Beam transforms
 * integrating with Google Cloud Secret Manager (e.g. AWS SQS, Kinesis, SNS, MQTT).
 * 
 * Architectural Decisions:
 * - Unifies the duplicated authentication mode selector and Secret Manager secret dropdown.
 * - Normalizes secret items so that short secret IDs are bound to form state, handling both
 *   { name, id, fullName, value } objects and plain strings defensively.
 * - Integrates PropertyField and InfoTooltip for verbatim Tailwind classes and 8pt grid spacing.
 */

import React from 'react';
import { InfoTooltip } from '../InfoTooltip';
import { PropertyField } from './PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export interface SecretItem {
  name: string;
  id?: string;
  fullName?: string;
  value?: string;
  [key: string]: any;
}

export interface NormalizedSecret {
  id: string;
  name: string;
  fullName?: string;
}

/**
 * Normalizes a secret item (either object or string) to extract the short secret ID
 * and human-readable name.
 * 
 * In GCP Secret Manager responses from src/extension.ts:
 * Items are shaped { name, id, fullName, value } where name, id, and value contain
 * the short secret ID, while fullName contains the full resource path.
 * Plain strings (both full resource paths and short IDs) are also handled defensively.
 *
 * @param item SecretItem object or raw string identifier
 * @returns NormalizedSecret containing short id and display name
 */
export function normalizeSecretItem(item: SecretItem | string): NormalizedSecret {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    // Handle full resource path: projects/{project}/secrets/{secretId}
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/').filter(Boolean);
      const shortId = parts[parts.length - 1] || trimmed;
      return { id: shortId, name: shortId, fullName: trimmed };
    }
    return { id: trimmed, name: trimmed, fullName: trimmed };
  }

  // Object payload: short ID can be in id, value, or short name
  const rawId = item.id || item.value || '';
  const rawName = item.name || '';
  const fullName = item.fullName || (rawName.includes('/') ? rawName : undefined);

  let shortId = rawId;
  if (!shortId) {
    if (rawName.includes('/')) {
      const parts = rawName.split('/').filter(Boolean);
      shortId = parts[parts.length - 1] || rawName;
    } else {
      shortId = rawName;
    }
  }

  const displayName = rawName || shortId;
  return {
    id: shortId,
    name: displayName,
    fullName
  };
}

export interface AuthModeOption {
  value: string;
  label: string;
}

export interface SecretManagerAuthFieldsProps {
  /** Selected authentication mode (e.g. 'default', 'secretManager', 'static') */
  authMode?: string;
  /** Name/ID of the selected Secret Manager secret */
  secretName?: string;
  /** Service name for tooltips and labels (e.g. 'AWS SQS', 'AWS', 'MQTT') */
  serviceName?: string;
  /** Field name for authMode in form data. Defaults to 'authMode'. */
  authModeName?: string;
  /** Field name for secretName in form data. Defaults to 'secretName'. */
  secretNameName?: string;
  /** HTML id for authMode select */
  authModeId?: string;
  /** HTML id for secretName input */
  secretNameId?: string;
  /** ID for secret datalist element */
  datalistId?: string;
  /** Prefix for generating element IDs if specific IDs are not provided */
  idPrefix?: string;
  /** List of available secrets. If omitted, automatically loads via useAssetLoader('secrets'). */
  secrets?: (SecretItem | string)[];
  /** Tooltip documentation for authentication mode */
  authModeTooltip?: string;
  /** Tooltip documentation for secret name input */
  secretNameTooltip?: string;
  /** Custom authentication mode dropdown options */
  authOptions?: AuthModeOption[];
  /** Which authMode value activates Secret Manager secret input. Defaults to 'secretManager'. */
  secretManagerValue?: string;
  /** Custom placeholder for secretName input */
  secretPlaceholder?: string;
  /** Error message for secretName */
  secretError?: string | null;
  /** Standard change handler dispatched on input or select changes */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

const DEFAULT_AUTH_OPTIONS: AuthModeOption[] = [
  { value: 'default', label: 'Default Credentials Chain (IAM Role / AwsOptions)' },
  { value: 'secretManager', label: 'Google Cloud Secret Manager' },
  { value: 'static', label: 'Static Credentials (Env / Local testing)' }
];

/**
 * SecretManagerAuthFields component providing a unified credentials selection interface.
 */
export const SecretManagerAuthFields: React.FC<SecretManagerAuthFieldsProps> = ({
  authMode = 'default',
  secretName = '',
  serviceName = 'AWS SQS',
  authModeName = 'authMode',
  secretNameName = 'secretName',
  authModeId,
  secretNameId,
  datalistId,
  idPrefix,
  secrets: passedSecrets,
  authModeTooltip,
  secretNameTooltip,
  authOptions = DEFAULT_AUTH_OPTIONS,
  secretManagerValue = 'secretManager',
  secretPlaceholder = 'e.g. aws-sqs-credentials or projects/.../secrets/...',
  secretError,
  onChange
}) => {
  // Only auto-load secrets from extension host if secrets prop was not explicitly provided
  const shouldAutoLoad = passedSecrets === undefined;
  const { items: loadedSecrets, error: assetError, loading: secretsLoading } = useAssetLoader<SecretItem | string>('secrets', {
    enabled: shouldAutoLoad
  });

  const rawSecrets = passedSecrets !== undefined ? passedSecrets : loadedSecrets;
  const normalizedSecrets = (rawSecrets || []).map(normalizeSecretItem);

  const effectiveAuthModeId = authModeId || (idPrefix ? `${idPrefix}AuthMode` : 'authMode');
  const effectiveSecretNameId = secretNameId || (idPrefix ? `${idPrefix}SecretName` : 'secretName');
  const effectiveDatalistId = datalistId || (idPrefix ? `${idPrefix}-secrets-list` : 'secret-manager-secrets-list');

  const defaultAuthTooltip = `How the Apache Beam worker should authenticate to ${serviceName}. Using GCP Secret Manager avoids hardcoding keys.`;
  const defaultSecretTooltip = `Name or resource ID of the Google Cloud secret containing ${serviceName} credentials.`;

  const isSecretManagerActive = authMode === secretManagerValue;
  const effectiveError = secretError || assetError;

  return (
    <>
      {/* Authentication Mode Selector */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor={effectiveAuthModeId}
          className="flex items-center text-xs font-bold uppercase text-slate-500"
        >
          <span>Authentication / Credentials</span>
          <InfoTooltip text={authModeTooltip || defaultAuthTooltip} />
        </label>
        <select
          id={effectiveAuthModeId}
          name={authModeName}
          value={authMode}
          onChange={onChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {authOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Secret Manager Secret Selection (Visible when Secret Manager mode active) */}
      {isSecretManagerActive && (
        <PropertyField
          id={effectiveSecretNameId}
          name={secretNameName}
          label="Secret Manager Secret"
          tooltip={secretNameTooltip || defaultSecretTooltip}
          value={secretName}
          onChange={(e) => {
            // This PropertyField has no `type` override, so it renders an <input> and
            // never a <textarea>. Narrowing to the input case is therefore accurate.
            // The cast is needed because consumers share one handler between this
            // field and the authMode <select> above, giving it an
            // <input> | <select> parameter type that PropertyField's
            // <input> | <textarea> signature will not accept directly.
            onChange(e as React.ChangeEvent<HTMLInputElement>);
          }}
          placeholder={secretPlaceholder}
          list={effectiveDatalistId}
          datalist={normalizedSecrets.map((s) => ({ value: s.id, label: s.name }))}
          loading={secretsLoading}
          error={effectiveError}
          helperText={
            <span>
              Values auto-populated from{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                gcloud secrets list
              </code>
            </span>
          }
        >
          <datalist id={effectiveDatalistId}>
            {normalizedSecrets.map((s, idx) => (
              <option key={`${s.id}-${idx}`} value={s.id}>
                {s.name}
              </option>
            ))}
          </datalist>
        </PropertyField>
      )}
    </>
  );
};
