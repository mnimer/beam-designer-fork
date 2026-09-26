/**
 * PulsarAuthFields Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Shared authentication and credential configuration block for Apache Beam PulsarIO
 * source and sink property panels.
 * 
 * Architectural Decisions:
 * - Extracted to eliminate duplication across PulsarIO source and sink property panels.
 * - Pure presentational component conforming to "props in, events up": receives current auth values,
 *   Secret Manager secret list, and dispatches change events upward.
 * - Supports four Pulsar authentication modes: 'none' (anonymous), 'token' (JWT via Secret Manager),
 *   'oauth2' (client credentials grant), and 'tls' (mutual TLS certificates).
 * - Integrates with Google Cloud Secret Manager for secure credential storage without hardcoded tokens.
 * - Adheres strictly to the 8pt grid system and verbatim Tailwind classes matching PropertyField.
 */

import React from 'react';
import { Key, Lock, RefreshCw } from 'lucide-react';
import { InfoTooltip } from '../../InfoTooltip';
import { PropertyField } from '../PropertyField';

export interface SecretItem {
  name: string;
  fullName?: string;
  value: string;
  id?: string;
}

export type PulsarAuthMode = 'none' | 'token' | 'oauth2' | 'tls';

export interface PulsarAuthFieldsProps {
  /** Prefix for generating unique element ids (e.g. 'pulsar' or 'pulsar-sink'). */
  idPrefix?: string;
  /** Currently selected authentication mode. Defaults to 'none'. */
  authMode?: PulsarAuthMode;
  /** Name of the Secret Manager secret containing the JWT token. */
  tokenSecretName?: string;
  /** OAuth2 token issuer URL. */
  oauthIssuerUrl?: string;
  /** OAuth2 audience identifier. */
  oauthAudience?: string;
  /** Secret Manager secret name or path containing OAuth2 credentials. */
  oauthKeySecretName?: string;
  /** Client TLS public certificate secret name or path. */
  tlsCertSecretName?: string;
  /** Client TLS private key secret name or path. */
  tlsKeySecretName?: string;
  /** Trusted CA certificate secret name or path. */
  tlsTrustCertSecretName?: string;
  /** Loaded secrets from Secret Manager. */
  secrets?: SecretItem[];
  /** Error message from Secret Manager loading, if any. */
  secretError?: string | null;
  /** Flag indicating whether secrets are actively loading. */
  isLoadingSecrets?: boolean;
  /** Callback to trigger refresh of secrets from extension host. */
  onRefreshSecrets?: () => void;
  /** Standard change handler dispatched on input/select change. */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * PulsarAuthFields renders the authentication mode selector and corresponding credentials fields.
 * 
 * @param props Auth properties, secrets list, and upward event callbacks.
 * @returns React component.
 */
export const PulsarAuthFields: React.FC<PulsarAuthFieldsProps> = ({
  idPrefix = 'pulsar',
  authMode = 'none',
  tokenSecretName = '',
  oauthIssuerUrl = '',
  oauthAudience = '',
  oauthKeySecretName = '',
  tlsCertSecretName = '',
  tlsKeySecretName = '',
  tlsTrustCertSecretName = '',
  secrets = [],
  secretError = null,
  isLoadingSecrets = false,
  onRefreshSecrets,
  onChange
}) => {
  const authModeId = `${idPrefix}-auth-mode`;
  const tokenSecretId = `${idPrefix}-token-secret`;
  const secretsListId = `${idPrefix}-secrets-list`;
  const oauthIssuerId = `${idPrefix}-oauth-issuer`;
  const oauthAudienceId = `${idPrefix}-oauth-audience`;
  const oauthKeySecretId = `${idPrefix}-oauth-key-secret`;
  const tlsCertSecretId = `${idPrefix}-tls-cert-secret`;
  const tlsKeySecretId = `${idPrefix}-tls-key-secret`;
  const tlsTrustSecretId = `${idPrefix}-tls-trust-secret`;

  const secretOptions = secrets.map((s) => ({ value: s.name, label: s.name }));

  return (
    <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
          <Lock size={12} className="text-blue-400" />
          <span>Authentication & Credentials</span>
        </span>
      </div>

      {/* Auth Mode Selection */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={authModeId} className="text-xs font-bold uppercase text-slate-500">
          Authentication Mode
        </label>
        <select
          id={authModeId}
          name="authMode"
          value={authMode}
          onChange={onChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="none">None (Anonymous / Local)</option>
          <option value="token">JWT Token (Secret Manager)</option>
          <option value="oauth2">OAuth 2.0</option>
          <option value="tls">Mutual TLS (mTLS)</option>
        </select>
      </div>

      {/* Token Mode Fields */}
      {authMode === 'token' && (
        <div className="flex flex-col gap-3 pt-2 border-t border-slate-700/60">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={tokenSecretId} className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
                <Key size={12} />
                <span>Pulsar JWT Token Secret</span>
                <InfoTooltip
                  text="Select a secret from Google Cloud Secret Manager containing the Pulsar JWT authentication token."
                  position="auto"
                />
              </label>
              {onRefreshSecrets && (
                <button
                  type="button"
                  onClick={onRefreshSecrets}
                  disabled={isLoadingSecrets}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                  title="Refresh secrets from Secret Manager"
                >
                  <RefreshCw size={11} className={isLoadingSecrets ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            <PropertyField
              id={tokenSecretId}
              name="tokenSecretName"
              value={tokenSecretName}
              onChange={onChange}
              placeholder="e.g. pulsar-jwt-token"
              list={secretsListId}
              datalist={secretOptions}
              loading={isLoadingSecrets}
              error={secretError}
              invalid={!!secretError}
              helperText={
                secrets.length > 0
                  ? 'Select from discovered secrets or type a custom secret ID.'
                  : 'No secrets automatically loaded. Enter secret resource name directly.'
              }
              mono={true}
            />
          </div>
        </div>
      )}

      {/* OAuth2 Mode Fields */}
      {authMode === 'oauth2' && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
          <PropertyField
            id={oauthIssuerId}
            name="oauthIssuerUrl"
            label="OAuth2 Issuer URL"
            tooltip="The URL of the OAuth2 identity provider token issuer."
            value={oauthIssuerUrl}
            onChange={onChange}
            placeholder="https://auth.example.com"
            mono={true}
          />
          <PropertyField
            id={oauthAudienceId}
            name="oauthAudience"
            label="OAuth2 Audience"
            tooltip="The target audience for the OAuth2 client token."
            value={oauthAudience}
            onChange={onChange}
            placeholder="urn:pulsar:cluster"
            mono={true}
          />
          <PropertyField
            id={oauthKeySecretId}
            name="oauthKeySecretName"
            label="OAuth2 Key File / Secret Name"
            tooltip="Secret Manager secret or key file URI containing the OAuth2 client private credentials."
            value={oauthKeySecretName}
            onChange={onChange}
            placeholder="pulsar-oauth2-private-key"
            datalist={secretOptions}
            loading={isLoadingSecrets}
            mono={true}
          />
        </div>
      )}

      {/* TLS Mode Fields */}
      {authMode === 'tls' && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
          <PropertyField
            id={tlsCertSecretId}
            name="tlsCertSecretName"
            label="Client Certificate Secret / Path"
            tooltip="Secret Manager secret or file path for the client TLS public certificate."
            value={tlsCertSecretName}
            onChange={onChange}
            placeholder="pulsar-client-cert"
            datalist={secretOptions}
            loading={isLoadingSecrets}
            mono={true}
          />
          <PropertyField
            id={tlsKeySecretId}
            name="tlsKeySecretName"
            label="Client Private Key Secret / Path"
            tooltip="Secret Manager secret or file path for the client TLS private key."
            value={tlsKeySecretName}
            onChange={onChange}
            placeholder="pulsar-client-key"
            datalist={secretOptions}
            loading={isLoadingSecrets}
            mono={true}
          />
          <PropertyField
            id={tlsTrustSecretId}
            name="tlsTrustCertSecretName"
            label="Trust Certificate (CA) Secret / Path"
            tooltip="Secret Manager secret or file path for the trusted CA certificate."
            value={tlsTrustCertSecretName}
            onChange={onChange}
            placeholder="pulsar-ca-cert"
            datalist={secretOptions}
            loading={isLoadingSecrets}
            mono={true}
          />
        </div>
      )}
    </div>
  );
};
