/**
 * AzureBlobStoreFileSystem Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam AzureBlobStoreFileSystem Sink nodes
 * (writing shards to Azure Blob Storage paths using the azfs://account/container/path grammar via
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
 * - Unconditional BlockBlob Writes (NO accessTier or blobType fields): `AzureBlobStoreFileSystem.create()`
 *   hardcodes `blobClient.getBlockBlobClient().getBlobOutputStream()` and never sets an access tier.
 *   Both controls were removed rather than defaulted, because an inert control still communicates a choice.
 * - AccessKey Pairing Requirement: In Java, `DefaultBlobstoreClientBuilderFactory` builds a
 *   `StorageSharedKeyCredential` only when BOTH `accountName` (`storageAccount`, `--accountName`) and
 *   `accessKey` (`accountKey`, `--accessKey`) are non-empty; otherwise the key is silently ignored.
 *   Therefore `storageAccount` is marked required with validation when `authMethod === 'AccessKey'`.
 * - Deliberate deviation: useAssetLoader('storageBuckets') is NOT called because Google Cloud Storage
 *   bucket discovery is irrelevant and actively misleading for Azure Blob Storage URIs.
 *   Instead, PropertyField is used directly with a static datalist of `azfs://account/container/...` URI shapes.
 * - Exposes sharding controls (numShards, shardTemplate) inside a CollapsibleSection accordion.
 * - Uses shared primitives CollapsibleSection, SelectField, and PropertyField without local duplication.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS without inline styles.
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { PropertyField } from '../../components/common/PropertyField';
import { SelectField } from '../../components/common/SelectField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';

export interface AzureBlobStoreFileSystemSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      storageAccount?: string;
      authMethod?: string;
      connectionString?: string;
      sasToken?: string;
      accountKey?: string;
      clientId?: string;
      tenantId?: string;
      clientSecret?: string;
      format?: string;
      compression?: string;
      numShards?: string | number;
      shardTemplate?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface AzureBlobStoreFileSystemSinkPropertiesProps {
  node: AzureBlobStoreFileSystemSinkNode;
  onChange: (properties: any) => void;
}

export const AZURE_SINK_PATH_SUGGESTIONS = [
  'azfs://account/container/output/',
  'azfs://account/container/data/results/',
  'azfs://account/container/archive/',
  'azfs://account/container/processed/',
  'azfs://account/container/events/'
];

export const AZURE_SINK_AUTH_METHODS = [
  { value: 'ConnectionString', label: 'ConnectionString (Azure Connection String)' },
  { value: 'SasToken', label: 'SasToken (Shared Access Signature)' },
  { value: 'AccessKey', label: 'AccessKey (Account Name & Secret Key)' },
  { value: 'ManagedIdentity', label: 'ManagedIdentity (Azure IMDS / DefaultAzureCredential)' },
  { value: 'ClientSecret', label: 'ClientSecret (Service Principal / Entra ID)' }
];

export const AZURE_SINK_FORMATS = [
  { value: 'TextIO', label: 'TextIO (Text / JSON Lines / CSV)' },
  { value: 'AvroIO', label: 'AvroIO (Apache Avro records)' },
  { value: 'ParquetIO', label: 'ParquetIO (Apache Parquet columnar)' },
  { value: 'FileIO', label: 'FileIO (Generic FileIO.write / dynamic)' }
];

export const AZURE_SINK_COMPRESSION_TYPES = [
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Default)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' },
  { value: 'ZSTD', label: 'ZSTD (.zst)' }
];

/**
 * AzureBlobStoreFileSystemSinkProperties renders the configuration form for Azure Blob Storage writes.
 */
export const AzureBlobStoreFileSystemSinkProperties: React.FC<AzureBlobStoreFileSystemSinkPropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '';
  const storageAccount = properties.storageAccount || '';
  const authMethod = properties.authMethod || 'ConnectionString';
  const connectionString = properties.connectionString || '';
  const sasToken = properties.sasToken || '';
  const accountKey = properties.accountKey || '';
  const clientId = properties.clientId || '';
  const tenantId = properties.tenantId || '';
  const clientSecret = properties.clientSecret || '';
  const format = properties.format || 'TextIO';
  const compression = properties.compression || 'UNCOMPRESSED';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';

  const [isShardingOpen, setIsShardingOpen] = useState<boolean>(false);

  // NOTE: Deliberately no useAssetLoader('storageBuckets') call here, as Azure Blob Storage
  // paths resolve against Azure Blob containers rather than Google Cloud Storage buckets.
  // Validation: destination directory/prefix (.to) is required
  const isToInvalid = !to.trim();

  // In Java, DefaultBlobstoreClientBuilderFactory requires BOTH accountName (storageAccount)
  // and accessKey (accountKey) to be non-empty when using AccessKey auth, or it silently drops the key.
  const isStorageAccountRequired = authMethod === 'AccessKey';
  const isStorageAccountInvalid = isStorageAccountRequired && !storageAccount.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

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
   * Updates AI prompt / system instructions
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  /**
   * Toggles the sharding options accordion state
   */
  const handleToggleSharding = () => {
    setIsShardingOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Destination Directory (.to) Input */}
      <PropertyField
        id="azureSinkTo"
        name="to"
        label="Destination Directory / Prefix (.to)"
        required="Destination Directory is required."
        tooltip="Target Azure Blob Storage destination container directory or file prefix using the azfs://account/container/path grammar (e.g. azfs://account/container/output/). Container is segment 2 of the URI. Required."
        aria-required="true"
        aria-invalid={isToInvalid}
        value={to}
        onChange={handleChange}
        placeholder="azfs://account/container/output/"
        invalid={isToInvalid}
        error={isToInvalid ? 'Destination Directory is required.' : null}
        mono={true}
        list="azure-sink-path-options"
        datalist={AZURE_SINK_PATH_SUGGESTIONS}
        helperText={
          !isToInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Base Azure Blob Storage prefix for output files (<code>azfs://account/container/path</code>).
            </span>
          ) : null
        }
      />

      {/* File Name Suffix */}
      <PropertyField
        id="azureSinkSuffix"
        name="suffix"
        label="File Name Suffix"
        tooltip="File extension appended to each shard (e.g. .parquet, .csv, .txt, .json)."
        value={suffix}
        onChange={handleChange}
        placeholder=".parquet"
        mono={true}
      />

      {/* Storage Account Name */}
      <PropertyField
        id="azureSinkStorageAccount"
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
                : 'Azure Storage Account hosting the destination container (BlobstoreOptions.setAccountName / --accountName in Java).'}
            </span>
          ) : null
        }
      />

      {/* Authentication Method Select */}
      <SelectField
        id="azureSinkAuthMethod"
        name="authMethod"
        label="Authentication Method"
        tooltip="Authentication mechanism used to access Azure Blob Storage via BlobstoreOptions (Java) or AzureOptions (Python)."
        value={authMethod}
        options={AZURE_SINK_AUTH_METHODS}
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
            id="azureSinkConnectionString"
            name="connectionString"
            type="password"
            label="Azure Connection String"
            tooltip="Azure Blob Storage connection string (e.g. DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net)."
            value={connectionString}
            onChange={handleChange}
            placeholder="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
            mono={true}
            autoComplete="off"
            helperText="Maps to BlobstoreOptions.setAzureConnectionString() (Java) / --azure_connection_string (Python). Masked for security."
          />
        </div>
      )}

      {authMethod === 'SasToken' && (
        <div className="p-3 rounded-md bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border)] flex flex-col gap-3">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-secondary)]">
            Shared Access Signature (SAS) Authentication
          </span>
          <PropertyField
            id="azureSinkSasToken"
            name="sasToken"
            type="password"
            label="SAS Token"
            tooltip="Azure Blob Storage Shared Access Signature (SAS) token."
            value={sasToken}
            onChange={handleChange}
            placeholder="sp=w&st=2026-01-01T00:00:00Z&se=..."
            mono={true}
            autoComplete="off"
            helperText="Maps to BlobstoreOptions.setSasToken() (--sasToken in Java). Masked for security."
          />
        </div>
      )}

      {authMethod === 'AccessKey' && (
        <div className="p-3 rounded-md bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border)] flex flex-col gap-3">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-secondary)]">
            Storage Account Access Key
          </span>
          <PropertyField
            id="azureSinkAccountKey"
            name="accountKey"
            type="password"
            label="Account Key"
            tooltip="Primary or secondary secret access key for the Azure Storage account. Maps to BlobstoreOptions.setAccessKey(String) (--accessKey) in Java."
            value={accountKey}
            onChange={handleChange}
            placeholder="Base64 encoded storage account access key"
            mono={true}
            autoComplete="off"
            helperText="Maps to BlobstoreOptions.setAccessKey(String) (--accessKey). Requires Storage Account Name (accountName) to be non-empty or DefaultBlobstoreClientBuilderFactory silently drops the key. Masked for security."
          />
        </div>
      )}

      {authMethod === 'ClientSecret' && (
        <div className="p-3 rounded-md bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border)] flex flex-col gap-3">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-secondary)]">
            Microsoft Entra (Azure AD) Service Principal
          </span>
          <PropertyField
            id="azureSinkClientId"
            name="clientId"
            label="Client ID (Application ID)"
            tooltip="Application (client) ID of the Microsoft Entra service principal."
            value={clientId}
            onChange={handleChange}
            placeholder="00000000-0000-0000-0000-000000000000"
            mono={true}
          />
          <PropertyField
            id="azureSinkTenantId"
            name="tenantId"
            label="Tenant ID (Directory ID)"
            tooltip="Directory (tenant) ID of the Azure AD tenant."
            value={tenantId}
            onChange={handleChange}
            placeholder="00000000-0000-0000-0000-000000000000"
            mono={true}
          />
          <PropertyField
            id="azureSinkClientSecret"
            name="clientSecret"
            type="password"
            label="Client Secret"
            tooltip="Secret key for the Microsoft Entra application service principal."
            value={clientSecret}
            onChange={handleChange}
            placeholder="Client secret value"
            mono={true}
            autoComplete="off"
            helperText="Service principal secret key. Masked for security."
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

      {/* Wrapping Writer Format Select */}
      <SelectField
        id="azureSinkFormat"
        name="format"
        label="File Format / Writer"
        tooltip="Underlying Beam I/O transform used to serialize files to Azure Blob Storage (TextIO, AvroIO, ParquetIO, or FileIO)."
        value={format}
        options={AZURE_SINK_FORMATS}
        onChange={handleChange}
        helperText={
          <span>
            Beam I/O sink applied to serialize elements onto AzureBlobStoreFileSystem. Defaults to <code>TextIO</code>.
          </span>
        }
      />

      {/* Compression Select */}
      <SelectField
        id="azureSinkCompression"
        name="compression"
        label="Compression"
        tooltip="Compression algorithm applied to output files. Defaults to UNCOMPRESSED."
        value={compression}
        options={AZURE_SINK_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* Sharding & Output Options Accordion */}
      <CollapsibleSection
        title="Sharding & Shard Template Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isShardingOpen}
        onToggle={handleToggleSharding}
      >
        {/* Number of Shards */}
        <PropertyField
          id="azureSinkNumShards"
          type="number"
          name="numShards"
          label="Number of Shards"
          tooltip="Fixed number of output shards. Set to 0 to let the Beam runner automatically determine sharding dynamically."
          value={numShards}
          onChange={handleChange}
          placeholder="0 (Automatic)"
          min="0"
          mono={true}
          helperText="0 or empty lets the runner automatically size output shards."
        />

        {/* Shard Template */}
        <PropertyField
          id="azureSinkShardTemplate"
          name="shardTemplate"
          label="Shard Name Template (Optional)"
          tooltip="Custom template for shard naming (e.g. -SSSSS-of-NNNNN). Leave blank for Beam standard default."
          value={shardTemplate}
          onChange={handleChange}
          placeholder="-SSSSS-of-NNNNN"
          mono={true}
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="azureSinkInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this AzureBlobStoreFileSystem writer step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Write Parquet output shards to azfs://account/container/output/ with 2 shards."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
