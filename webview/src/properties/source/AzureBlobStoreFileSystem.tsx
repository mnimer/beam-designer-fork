/**
 * AzureBlobStoreFileSystem Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam AzureBlobStoreFileSystem Source nodes
 * (reading from Azure Blob Storage paths using the azfs://account/container/path grammar via
 * Apache Beam's FileSystems subsystem, BlobstoreOptions in Java, and AzureOptions in Python).
 * 
 * Architectural Decisions:
 * - Scheme Grammar (azfs:// only): Both org.apache.beam.sdk.io.azure.blobstore.AzureBlobStoreFileSystemRegistrar
 *   (Java) and apache_beam.io.azure.blobstoragefilesystem.BlobStorageFileSystem (Python) register ONLY the
 *   `azfs://` scheme (`azfs://{account}/{container}/{blob}`). `AzfsResourceId.fromUri` actively rejects
 *   `abfss://` URIs with "Invalid AZFS URI scheme".
 * - Native Dual-Language Support (NO expansionService): Python natively ships
 *   `apache_beam.io.azure.blobstoragefilesystem.BlobStorageFileSystem` (`azfs://`) and `AzureOptions`
 *   (`--azure_connection_string`, `--blob_service_endpoint`, `--azure_managed_identity_client_id`).
 *   The former `expansionService` field and cross-language claim were removed.
 * - Container encoded in URI (NO containerName field): The container is segment 2 of
 *   `azfs://account/container/blob`; neither `BlobstoreOptions` nor `AzureOptions` exposes a container setter.
 * - AccessKey Pairing Requirement: In Java, `DefaultBlobstoreClientBuilderFactory` builds a
 *   `StorageSharedKeyCredential` only when BOTH `accountName` (`storageAccount`, `--accountName`) and
 *   `accessKey` (`accountKey`, `--accessKey`) are non-empty; otherwise the key is silently ignored.
 *   Therefore `storageAccount` is marked required with validation when `authMethod === 'AccessKey'`.
 * - Deliberate deviation: useAssetLoader('storageBuckets') is NOT called because Google Cloud Storage
 *   bucket discovery is irrelevant and actively misleading for Azure Blob Storage URIs.
 *   Instead, PropertyField is used directly with a static datalist of `azfs://account/container/...` URI shapes.
 * - Uses shared primitives CollapsibleSection, SelectField, and PropertyField without local duplication.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS without inline styles.
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { SelectField } from '../../components/common/SelectField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { type SecretItem, normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

/** React Flow node shape for the AzureBlobStoreFileSystem source panel, including its persisted configuration data. */
export interface AzureBlobStoreFileSystemSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      storageAccount?: string;
      authMethod?: string;
      connectionString?: string;
      sasToken?: string;
      accountKey?: string;
      clientId?: string;
      tenantId?: string;
      clientSecret?: string;
      format?: string;
      minBundleSize?: string | number;
      validate?: boolean;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/** Props for the {@link AzureBlobStoreFileSystemSourceProperties} component. */
export interface AzureBlobStoreFileSystemSourcePropertiesProps {
  node: AzureBlobStoreFileSystemSourceNode;
  onChange: (properties: any) => void;
}

export const AZURE_SOURCE_PATH_SUGGESTIONS = [
  'azfs://account/container/data/*.parquet',
  'azfs://account/container/input/*.csv',
  'azfs://account/container/logs/*.json',
  'azfs://account/container/path/*.txt',
  'azfs://account/container/data/*.avro'
];

export const AZURE_AUTH_METHODS = [
  { value: 'ConnectionString', label: 'ConnectionString (Azure Connection String)' },
  { value: 'SasToken', label: 'SasToken (Shared Access Signature)' },
  { value: 'AccessKey', label: 'AccessKey (Account Name & Secret Key)' },
  { value: 'ManagedIdentity', label: 'ManagedIdentity (Azure IMDS / DefaultAzureCredential)' },
  { value: 'ClientSecret', label: 'ClientSecret (Service Principal / Entra ID)' }
];

export const AZURE_SOURCE_FORMATS = [
  { value: 'TextIO', label: 'TextIO (Text / JSON Lines / CSV)' },
  { value: 'AvroIO', label: 'AvroIO (Apache Avro records)' },
  { value: 'ParquetIO', label: 'ParquetIO (Apache Parquet columnar)' },
  { value: 'FileIO', label: 'FileIO (Generic Match / ReadMatches)' }
];

/**
 * AzureBlobStoreFileSystemSourceProperties renders the configuration form for Azure Blob Storage reads.
 */
export const AzureBlobStoreFileSystemSourceProperties: React.FC<AzureBlobStoreFileSystemSourcePropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const storageAccount = properties.storageAccount || '';
  const authMethod = properties.authMethod || 'ConnectionString';
  const connectionString = properties.connectionString || '';
  const sasToken = properties.sasToken || '';
  const accountKey = properties.accountKey || '';
  const clientId = properties.clientId || '';
  const tenantId = properties.tenantId || '';
  const clientSecret = properties.clientSecret || '';
  const format = properties.format || 'TextIO';
  const validate = properties.validate ?? true;
  const minBundleSize = properties.minBundleSize ?? '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Load secrets from Google Cloud Secret Manager via extension host IPC
  // NOTE: Deliberately no useAssetLoader('storageBuckets') call here, as Azure Blob Storage
  // paths resolve against Azure Blob containers rather than Google Cloud Storage buckets.
  const { items: loadedSecrets, loading: secretsLoading } = useAssetLoader<SecretItem | string>('secrets');
  const secretOptions = (loadedSecrets || []).map((s) => {
    const normalized = normalizeSecretItem(s);
    return { value: normalized.id, label: normalized.name };
  });

  // Validation: filePattern is required for reading files from Azure Blob Storage
  const isFilePatternInvalid = !filePattern.trim();

  // In Java, DefaultBlobstoreClientBuilderFactory requires BOTH accountName (storageAccount)
  // and accessKey (accountKey) to be non-empty when using AccessKey auth, or it silently drops the key.
  const isStorageAccountRequired = authMethod === 'AccessKey';
  const isStorageAccountInvalid = isStorageAccountRequired && !storageAccount.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles generic input changes for form fields
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    onChange({
      ...properties,
      [name]: isCheckbox ? checked : value
    });
  };

  /**
   * Toggles the advanced tuning accordion state
   */
  const handleToggleAdvanced = () => {
    setIsAdvancedOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* File Pattern Input */}
      <PropertyField
        id="azureSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        required="File Pattern is required."
        tooltip="Target Azure Blob Storage file path or glob pattern using the azfs://account/container/path grammar (e.g. azfs://account/container/data/*.parquet). Container is segment 2 of the URI. Required."
        aria-required="true"
        aria-invalid={isFilePatternInvalid}
        value={filePattern}
        onChange={handleChange}
        placeholder="azfs://account/container/data/*.parquet"
        invalid={isFilePatternInvalid}
        error={isFilePatternInvalid ? 'File Pattern is required.' : null}
        mono={true}
        list="azure-source-path-options"
        datalist={AZURE_SOURCE_PATH_SUGGESTIONS}
        helperText={
          !isFilePatternInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Azure Blob Storage URI pattern (<code>azfs://account/container/path</code>).
            </span>
          ) : null
        }
      />

      {/* Storage Account Name */}
      <PropertyField
        id="azureSourceStorageAccount"
        name="storageAccount"
        label="Storage Account Name"
        required={isStorageAccountRequired ? 'Storage Account Name is required for AccessKey authentication.' : undefined}
        tooltip="Azure Storage Account name (e.g. mystorageaccount). Maps to BlobstoreOptions.setAccountName(String) (--accountName) in Java. Required when Authentication Method is AccessKey."
        aria-required={isStorageAccountRequired ? 'true' : undefined}
        aria-invalid={isStorageAccountInvalid}
        value={storageAccount}
        onChange={handleChange}
        placeholder="mystorageaccount"
        invalid={isStorageAccountInvalid}
        error={isStorageAccountInvalid ? 'Storage Account Name is required for AccessKey authentication.' : null}
        mono={true}
        helperText={
          !isStorageAccountInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              {isStorageAccountRequired
                ? 'Required for AccessKey auth: DefaultBlobstoreClientBuilderFactory requires both accountName (--accountName) and accessKey (--accessKey) to be non-empty.'
                : 'Azure Storage Account hosting the container (BlobstoreOptions.setAccountName / --accountName in Java).'}
            </span>
          ) : null
        }
      />

      {/* Authentication Method Select */}
      <SelectField
        id="azureSourceAuthMethod"
        name="authMethod"
        label="Authentication Method"
        tooltip="Authentication mechanism used to access Azure Blob Storage via BlobstoreOptions (Java) or AzureOptions (Python)."
        value={authMethod}
        options={AZURE_AUTH_METHODS}
        onChange={handleChange}
        helperText="Select credential provider for Azure Blob Storage access."
      />

      {/* Conditional Authentication Fields */}
      {authMethod === 'ConnectionString' && (
        <div className="p-3 rounded-md bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border)] flex flex-col gap-3">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-secondary)]">
            Connection String Authentication
          </span>
          <PropertyField
            id="azureSourceConnectionString"
            name="connectionString"
            label="Connection String Secret (Secret Manager)"
            tooltip="GCP Secret Manager secret name containing the Azure Blob Storage connection string (e.g. DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net)."
            value={connectionString}
            onChange={handleChange}
            placeholder="e.g. azure-blob-connection-string-secret"
            datalist={secretOptions}
            loading={secretsLoading}
            mono={true}
            autoComplete="off"
            helperText="References a GCP Secret Manager secret resolved at runtime for BlobstoreOptions.setAzureConnectionString() (Java) / --azure_connection_string (Python)."
          />
        </div>
      )}

      {authMethod === 'SasToken' && (
        <div className="p-3 rounded-md bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border)] flex flex-col gap-3">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-secondary)]">
            Shared Access Signature (SAS) Authentication
          </span>
          <PropertyField
            id="azureSourceSasToken"
            name="sasToken"
            label="SAS Token Secret (Secret Manager)"
            tooltip="GCP Secret Manager secret name containing the Azure Blob Storage Shared Access Signature (SAS) token."
            value={sasToken}
            onChange={handleChange}
            placeholder="e.g. azure-blob-sas-token-secret"
            datalist={secretOptions}
            loading={secretsLoading}
            mono={true}
            autoComplete="off"
            helperText="References a GCP Secret Manager secret resolved at runtime for BlobstoreOptions.setSasToken() (--sasToken in Java)."
          />
        </div>
      )}

      {authMethod === 'AccessKey' && (
        <div className="p-3 rounded-md bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border)] flex flex-col gap-3">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-secondary)]">
            Storage Account Access Key
          </span>
          <PropertyField
            id="azureSourceAccountKey"
            name="accountKey"
            label="Account Key Secret (Secret Manager)"
            tooltip="GCP Secret Manager secret name containing the primary or secondary secret access key for the Azure Storage account. Maps to BlobstoreOptions.setAccessKey(String) (--accessKey) in Java."
            value={accountKey}
            onChange={handleChange}
            placeholder="e.g. azure-storage-account-key-secret"
            datalist={secretOptions}
            loading={secretsLoading}
            mono={true}
            autoComplete="off"
            helperText="References a GCP Secret Manager secret resolved at runtime for BlobstoreOptions.setAccessKey(String) (--accessKey). Requires Storage Account Name (accountName) to be non-empty or DefaultBlobstoreClientBuilderFactory silently drops the key."
          />
        </div>
      )}

      {authMethod === 'ClientSecret' && (
        <div className="p-3 rounded-md bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border)] flex flex-col gap-3">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-secondary)]">
            Microsoft Entra (Azure AD) Service Principal
          </span>
          <PropertyField
            id="azureSourceClientId"
            name="clientId"
            label="Client ID (Application ID)"
            tooltip="Application (client) ID of the Microsoft Entra service principal."
            value={clientId}
            onChange={handleChange}
            placeholder="00000000-0000-0000-0000-000000000000"
            mono={true}
          />
          <PropertyField
            id="azureSourceTenantId"
            name="tenantId"
            label="Tenant ID (Directory ID)"
            tooltip="Directory (tenant) ID of the Azure AD tenant."
            value={tenantId}
            onChange={handleChange}
            placeholder="00000000-0000-0000-0000-000000000000"
            mono={true}
          />
          <PropertyField
            id="azureSourceClientSecret"
            name="clientSecret"
            label="Client Secret (Secret Manager)"
            tooltip="GCP Secret Manager secret name containing the secret key for the Microsoft Entra application service principal."
            value={clientSecret}
            onChange={handleChange}
            placeholder="e.g. azure-ad-client-secret"
            datalist={secretOptions}
            loading={secretsLoading}
            mono={true}
            autoComplete="off"
            helperText="References a GCP Secret Manager secret containing the service principal secret key resolved at runtime."
          />
        </div>
      )}

      {authMethod === 'ManagedIdentity' && (
        <div className="p-3 rounded-md bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border)] text-xs text-[var(--vscode-text-secondary)]">
          <span className="leading-relaxed">
            <strong>Managed Identity:</strong> Azure Blob Storage access credentials will be resolved automatically from the Azure instance metadata service (IMDS) / DefaultAzureCredential on the running worker environment (<code>--azure_managed_identity_client_id</code> in Python if user-assigned).
          </span>
        </div>
      )}

      {/* Wrapping Reader Format Select */}
      <SelectField
        id="azureSourceFormat"
        name="format"
        label="File Format / Reader"
        tooltip="Underlying Beam I/O transform used to parse Azure Blob file contents (TextIO, AvroIO, ParquetIO, or FileIO)."
        value={format}
        options={AZURE_SOURCE_FORMATS}
        onChange={handleChange}
        helperText={
          <span>
            Beam I/O reader applied to files resolved via AzureBlobStoreFileSystem. Defaults to <code>TextIO</code>.
          </span>
        }
      />

      {/* Advanced Tuning Accordion */}
      <CollapsibleSection
        title="Read Tuning & Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        {/* Validate Checkbox */}
        <label htmlFor="azureSourceValidate" className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            id="azureSourceValidate"
            type="checkbox"
            name="validate"
            checked={validate}
            onChange={handleChange}
            className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--vscode-text-secondary)]">
            Validate file existence on pipeline startup
          </span>
          <InfoTooltip text="Validates input file pattern matches at pipeline construction time." />
        </label>

        {/* Minimum Bundle Size */}
        <PropertyField
          id="azureSourceMinBundleSize"
          type="number"
          name="minBundleSize"
          label="Minimum Bundle Size (bytes)"
          tooltip="Minimum byte size to consider when splitting input into bundles for parallel worker execution. Default 0."
          value={minBundleSize}
          onChange={handleChange}
          placeholder="0"
          min="0"
          mono={true}
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="azureSourceInstructions"
        value={systemInstructions}
        tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this AzureBlobStoreFileSystem reader step."
        placeholder="e.g. Read Parquet files from Azure Blob Storage azfs://account/container/data/ with Managed Identity authentication."
        wrapperClassName="pt-2 border-t border-[var(--vscode-border-light)]"
        textareaClassName="resize-y h-24"
        helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        onChange={(value) =>
          onChange({
            ...properties,
            system_instructions: value,
          })
        }
      />
    </div>
  );
};
