/**
 * GoogleAdsIO Source Properties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam GoogleAdsIO Source (Reader) nodes
 * (`org.apache.beam.sdk.io.googleads.GoogleAdsIO.current().read()` and `readAll()`),
 * which read `GoogleAdsRow` protobuf records from the Google Ads API using Google Ads Query Language (GAQL).
 *
 * Architectural Decisions:
 * - Implements ONLY the Source direction (`SOURCE:GoogleAdsIO`), as official Apache Beam
 *   `GoogleAdsIO` (`GoogleAdsV23`) provides only `read()` and `readAll()` transforms and no native Write transform.
 * - Supports both `read()` (single customer ID + GAQL query) and `readAll()` (dynamic `SearchGoogleAdsStreamRequest` inputs).
 * - Validates `customerId` (`withCustomerId`) and `query` (`withQuery`) when `readMode === 'read'`,
 *   including numeric format checks (10-digit customer ID without hyphens).
 * - Uses `SecretManagerAuthFields` and `useAssetLoader('secrets')` so `developerTokenSecret`
 *   (`withDeveloperToken`), `clientSecretSecret` (`setClientSecret`), and `refreshTokenSecret`
 *   (`setRefreshToken`) reference GCP Secret Manager secret IDs rather than storing raw secrets.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerAuthFields } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem, AuthModeOption } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export const GOOGLE_ADS_AUTH_OPTIONS: AuthModeOption[] = [
  { value: 'secretManager', label: 'Google Cloud Secret Manager (Developer Token & OAuth2)' },
  { value: 'adc', label: 'Application Default Credentials / PipelineOptions' },
];

export interface GoogleAdsIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      readMode?: 'read' | 'readAll';
      customerId?: string;
      loginCustomerId?: string;
      linkedCustomerId?: string;
      query?: string;
      authMode?: 'secretManager' | 'adc';
      developerTokenSecret?: string;
      clientId?: string;
      clientSecretSecret?: string;
      refreshTokenSecret?: string;
      googleAdsEndpoint?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface GoogleAdsIOSourcePropertiesProps {
  node: GoogleAdsIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * GoogleAdsIOSourceProperties component rendering the configuration form for GoogleAdsIO reads.
 *
 * @param props Component properties containing the active node and onChange callback.
 * @returns React component.
 */
export const GoogleAdsIOSourceProperties: React.FC<GoogleAdsIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Request GCP Secret Manager secrets via shared useAssetLoader hook
  const { items: secrets } = useAssetLoader<SecretItem | string>('secrets');

  const readMode = properties.readMode || 'read';
  const customerId = properties.customerId || '';
  const loginCustomerId = properties.loginCustomerId || '';
  const linkedCustomerId = properties.linkedCustomerId || '';
  const query = properties.query || '';
  const authMode = properties.authMode || 'secretManager';
  const developerTokenSecret = properties.developerTokenSecret || '';
  const clientId = properties.clientId || '';
  const clientSecretSecret = properties.clientSecretSecret || '';
  const refreshTokenSecret = properties.refreshTokenSecret || '';
  const googleAdsEndpoint = properties.googleAdsEndpoint || 'googleads.googleapis.com:443';

  // Validation: for readMode === 'read', customerId (numeric without hyphens) and GAQL query are required
  const hasHyphensInCustomerId = customerId.includes('-');
  const isCustomerIdInvalid = readMode === 'read' && (!customerId.trim() || hasHyphensInCustomerId);
  const isQueryInvalid = readMode === 'read' && !query.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles standard text and select input changes.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onChange({
      ...properties,
      [name]: value,
    });
  };

  /**
   * Handles code generation instructions textarea change.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Read Mode Selector (read vs readAll) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="googleAdsReadMode" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Read Mode (GoogleAdsV23)</span>
          <InfoTooltip text="Select GoogleAdsIO.current().read() for a configured Customer ID and GAQL query, or readAll() to expand a PCollection of SearchGoogleAdsStreamRequest objects." />
        </label>
        <select
          id="googleAdsReadMode"
          name="readMode"
          value={readMode}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="read">GoogleAdsIO.current().read() — Static Customer ID &amp; GAQL Query</option>
          <option value="readAll">GoogleAdsIO.current().readAll() — Dynamic SearchGoogleAdsStreamRequest</option>
        </select>
      </div>

      {/* Customer ID & GAQL Query Configuration */}
      <details open className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase text-slate-400 flex items-center gap-2 select-none">
          <span>Google Ads Account &amp; GAQL Query</span>
          <InfoTooltip text="Configure Google Ads Customer IDs (without hyphens) and the Google Ads Query Language (GAQL) SELECT statement." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <PropertyField
            id="googleAdsCustomerId"
            name="customerId"
            label="Customer ID (withCustomerId)"
            required={readMode === 'read' ? 'Customer ID is required for read()' : false}
            tooltip="10-digit Google Ads Customer ID without hyphens configured via withCustomerId(Long) (e.g. 1234567890)."
            value={customerId}
            invalid={isCustomerIdInvalid}
            error={
              hasHyphensInCustomerId
                ? 'Enter the 10-digit numeric Customer ID without hyphens (e.g. 1234567890).'
                : isCustomerIdInvalid
                ? 'Customer ID is required when Read Mode is read().'
                : null
            }
            onChange={handleChange}
            placeholder="1234567890"
            helperText="10-digit numeric account ID without hyphens (e.g. 1234567890)"
          />

          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="googleAdsLoginCustomerId"
              name="loginCustomerId"
              label="Login Customer ID (withLoginCustomerId)"
              tooltip="Optional Manager (MCC) account ID (without hyphens) used when accessing client accounts via a manager account."
              value={loginCustomerId}
              onChange={handleChange}
              placeholder="e.g. 9988776655"
            />
            <PropertyField
              id="googleAdsLinkedCustomerId"
              name="linkedCustomerId"
              label="Linked Customer ID (withLinkedCustomerId)"
              tooltip="Optional linked third-party customer ID (without hyphens) configured via withLinkedCustomerId(Long)."
              value={linkedCustomerId}
              onChange={handleChange}
              placeholder="e.g. 1122334455"
            />
          </div>

          <PropertyField
            id="googleAdsQuery"
            name="query"
            type="textarea"
            rows={3}
            label="GAQL Query (withQuery)"
            required={readMode === 'read' ? 'GAQL Query is required for read()' : false}
            tooltip="Google Ads Query Language (GAQL) query passed to withQuery(String) (e.g. SELECT campaign.id, campaign.name, metrics.impressions FROM campaign)."
            value={query}
            invalid={isQueryInvalid}
            error={isQueryInvalid ? 'GAQL Query is required when Read Mode is read().' : null}
            onChange={handleChange}
            placeholder="SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date DURING LAST_7_DAYS"
          />
        </div>
      </details>

      {/* Collapsible Group: Authentication & GoogleAdsOptions */}
      <details open className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase text-slate-400 flex items-center gap-2 select-none">
          <span>Authentication &amp; GoogleAdsOptions</span>
          <InfoTooltip text="Configure the Google Ads Developer Token and OAuth2 credentials via Google Cloud Secret Manager." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <SecretManagerAuthFields
            idPrefix="googleAdsSource"
            datalistId="google-ads-secrets-list"
            authMode={authMode}
            secretName={developerTokenSecret}
            secretNameName="developerTokenSecret"
            secrets={secrets}
            serviceName="Google Ads API"
            authOptions={GOOGLE_ADS_AUTH_OPTIONS}
            authModeTooltip="How the pipeline resolves the Google Ads Developer Token (withDeveloperToken) and OAuth2 credentials."
            secretNameTooltip="Secret Manager secret ID containing the Google Ads Developer Token passed to withDeveloperToken(String)."
            secretPlaceholder="e.g. google-ads-developer-token"
            onChange={handleChange}
          />

          {authMode === 'secretManager' && (
            <>
              <PropertyField
                id="googleAdsClientId"
                name="clientId"
                label="OAuth2 Client ID (setClientId)"
                tooltip="OAuth2 Client ID configured on GoogleAdsOptions.setClientId(String)."
                value={clientId}
                onChange={handleChange}
                placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
              />

              <div className="grid grid-cols-2 gap-4">
                <PropertyField
                  id="googleAdsClientSecretSecret"
                  name="clientSecretSecret"
                  label="Client Secret ID (setClientSecret)"
                  tooltip="Secret Manager secret ID containing the OAuth2 Client Secret for GoogleAdsOptions.setClientSecret(String)."
                  value={clientSecretSecret}
                  onChange={handleChange}
                  list="google-ads-secrets-list"
                  placeholder="e.g. google-ads-client-secret"
                />
                <PropertyField
                  id="googleAdsRefreshTokenSecret"
                  name="refreshTokenSecret"
                  label="Refresh Token Secret ID (setRefreshToken)"
                  tooltip="Secret Manager secret ID containing the OAuth2 Refresh Token for GoogleAdsOptions.setRefreshToken(String)."
                  value={refreshTokenSecret}
                  onChange={handleChange}
                  list="google-ads-secrets-list"
                  placeholder="e.g. google-ads-refresh-token"
                />
              </div>
            </>
          )}

          <PropertyField
            id="googleAdsEndpoint"
            name="googleAdsEndpoint"
            label="Google Ads Endpoint (setGoogleAdsEndpoint)"
            tooltip="Google Ads gRPC API endpoint configured via GoogleAdsOptions.setGoogleAdsEndpoint(String) (default: googleads.googleapis.com:443)."
            value={googleAdsEndpoint}
            onChange={handleChange}
            placeholder="googleads.googleapis.com:443"
          />
        </div>
      </details>

      {/* Spacer to push instructions to the bottom */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
        <label htmlFor="googleAdsSourceInstructions" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Code Generation Instructions</span>
          <InfoTooltip text="Optional custom prompt instructions supplied to Gemini during pipeline code generation (e.g. extracting fields from GoogleAdsRow protobuf messages)." />
        </label>
        <textarea
          id="googleAdsSourceInstructions"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Extract campaign.id, campaign.name, and metrics.impressions from each GoogleAdsRow into a Beam Row..."
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono resize-y"
        />
      </div>
    </div>
  );
};

export const GoogleAdsIOProperties = GoogleAdsIOSourceProperties;
export default GoogleAdsIOSourceProperties;
