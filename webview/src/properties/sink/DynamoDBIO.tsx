/**
 * DynamoDBIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam DynamoDBIO Write Sink nodes
 * (org.apache.beam.sdk.io.aws2.dynamodb.DynamoDBIO.write() in Java / cross-language external transform in Python).
 *
 * Architectural Decisions:
 * - Table name is required with immediate validation, red border highlighting, and aria-invalid flags.
 * - Standard AWS Region selection with predefined AWS regions and custom region entry.
 * - Write mode toggle (PutItem vs DeleteItem) mapped through withWriteRequestMapperFn.
 * - Key deduplication (withDeduplicateKeys) prevents AWS batch write validation errors on duplicate keys.
 * - Delivery settings enforce DynamoDB BatchWriteItem maximum batch size of 25 items.
 * - Supports AWS Credential configuration: default provider chain vs GCP Secret Manager references.
 *   Uses IPC 'getSecrets' to populate datalist with id 'dynamodb-sink-secret-options'.
 * - Collapsible Advanced Sink Settings: custom service endpoint override (LocalStack),
 *   client max retries, and write capacity throttling configuration/notes.
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Follows the 8pt grid system (p-2, p-3, p-4, gap-2, gap-4) and Tailwind CSS styling.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';

/**
 * Secret item loaded from Secret Manager for AWS DynamoDB credentials.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia) [us-east-1]' },
  { value: 'us-east-2', label: 'US East (Ohio) [us-east-2]' },
  { value: 'us-west-1', label: 'US West (N. California) [us-west-1]' },
  { value: 'us-west-2', label: 'US West (Oregon) [us-west-2]' },
  { value: 'eu-west-1', label: 'Europe (Ireland) [eu-west-1]' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt) [eu-central-1]' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo) [ap-northeast-1]' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore) [ap-southeast-1]' },
  { value: 'sa-east-1', label: 'South America (São Paulo) [sa-east-1]' },
];

/**
 * Props for the DynamoDBIOSinkProperties component.
 */
export interface DynamoDBIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        tableName?: string;
        awsRegion?: string;
        customRegion?: string;
        writeMode?: 'putItem' | 'deleteItem';
        deduplicateKeys?: string;
        batchSize?: number | string;
        retryConfiguration?: string;
        authMode?: 'default' | 'secret_manager';
        accessKeySecret?: string;
        secretKeySecret?: string;
        endpointOverride?: string;
        maxRetries?: number | string;
        writeCapacityUnits?: number | string;
        throttlingNotes?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * DynamoDBIOSinkProperties renders the property configuration form for DynamoDBIO write operations.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const DynamoDBIOSinkProperties: React.FC<DynamoDBIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const tableName = properties.tableName || '';
  const awsRegion = properties.awsRegion || 'us-east-1';
  const customRegion = properties.customRegion || '';
  const writeMode = properties.writeMode || 'putItem';
  const deduplicateKeys = properties.deduplicateKeys || '';
  const batchSize = properties.batchSize ?? '';
  const retryConfiguration = properties.retryConfiguration || '';
  const authMode = properties.authMode || 'default';
  const accessKeySecret = properties.accessKeySecret || '';
  const secretKeySecret = properties.secretKeySecret || '';
  const endpointOverride = properties.endpointOverride || '';
  const maxRetries = properties.maxRetries ?? '';
  const writeCapacityUnits = properties.writeCapacityUnits ?? '';
  const throttlingNotes = properties.throttlingNotes || '';

  // Local state for dynamically loaded GCP Secret Manager secrets
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isTableEmpty = !tableName.trim();

  // Verbatim system instruction fallback chain
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Updates a generic property value and triggers onChange callback.
   *
   * @param name The property name key
   * @param value The updated property value
   */
  const updateProperty = (name: string, value: any) => {
    const updated = { ...properties, [name]: value };
    onChange(updated);
  };

  /**
   * Handles text, select, and radio input changes.
   *
   * @param e Standard React change event
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      updateProperty(name, checked);
    } else {
      updateProperty(name, value);
    }
  };


  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Target DynamoDB Table Name */}
      <PropertyField
        id="dynamodbSinkTableName"
        name="tableName"
        label="Table Name"
        required="Table Name is required"
        tooltip="Target Amazon DynamoDB table name to write items to. Required."
        value={tableName}
        invalid={isTableEmpty}
        error={isTableEmpty ? 'Table Name is required' : null}
        placeholder="e.g. ProcessedEvents"
        onChange={handleChange}
        mono={true}
      />

      {/* AWS Region Selector */}
      <div className="flex flex-col gap-1">
        <label htmlFor="dynamodbSinkAwsRegion" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>AWS Region</span>
          <InfoTooltip text="The AWS Region where the target DynamoDB table resides (e.g. us-east-1)." />
        </label>
        <select
          id="dynamodbSinkAwsRegion"
          name="awsRegion"
          value={awsRegion}
          onChange={handleChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          {AWS_REGIONS.map(r => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
          <option value="custom">Custom Region...</option>
        </select>
        {awsRegion === 'custom' && (
          <PropertyField
            id="dynamodbSinkCustomRegion"
            name="customRegion"
            value={customRegion}
            onChange={handleChange}
            placeholder="e.g. me-central-1"
            className="mt-1 font-mono"
          />
        )}
      </div>

      {/* Mutation & Write Mode */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Write Mode &amp; Key Deduplication</span>
          <InfoTooltip text="Configures whether WriteRequests perform PutItem or DeleteItem operations, and optionally deduplicates keys within batches." />
        </label>

        <div className="flex gap-4 mt-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="writeMode"
              value="putItem"
              checked={writeMode === 'putItem'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>PutItem (Insert / Replace)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="writeMode"
              value="deleteItem"
              checked={writeMode === 'deleteItem'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>DeleteItem (Delete by Key)</span>
          </label>
        </div>

        <PropertyField
          id="dynamodbSinkDeduplicateKeys"
          name="deduplicateKeys"
          label="Deduplicate Keys"
          value={deduplicateKeys}
          onChange={handleChange}
          placeholder="e.g. id, sortKey"
          tooltip="Comma-separated primary key attribute names. DynamoDB BatchWriteItem rejects batches with duplicate keys; withDeduplicateKeys(List<String>) retains only the latest item per key."
          mono={true}
        />
      </div>

      {/* Batching & Delivery Settings */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Delivery &amp; Batching</span>
          <InfoTooltip text="Amazon DynamoDB BatchWriteItem accepts at most 25 items per batch request. Configure batch size and retry behavior." />
        </label>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <PropertyField
            id="dynamodbSinkBatchSize"
            name="batchSize"
            label="Batch Size (max 25)"
            type="number"
            min={1}
            max={25}
            value={batchSize}
            onChange={handleChange}
            placeholder="25"
            tooltip="Amazon DynamoDB BatchWriteItem strictly caps at 25 items per request. Values must be between 1 and 25."
            mono={true}
          />
          <PropertyField
            id="dynamodbSinkRetryConfiguration"
            name="retryConfiguration"
            label="Retry Strategy"
            value={retryConfiguration}
            onChange={handleChange}
            placeholder="exponential_backoff"
            tooltip="Retry behavior for transient throttling and unprocessed batch write items (e.g. exponential_backoff)."
            mono={true}
          />
        </div>
      </div>

      {/* Authentication & AWS Credentials */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Choose AWS credential resolution strategy: default AWS provider chain or Secret Manager references." />
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="default"
              checked={authMode === 'default'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Default Chain</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="secret_manager"
              checked={authMode === 'secret_manager'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Secret Manager</span>
          </label>
        </div>

        {authMode === 'secret_manager' && (
          <div className="flex flex-col gap-2 mt-1">
            <PropertyField
              id="dynamodbSinkAccessKeySecret"
              name="accessKeySecret"
              label="AWS Access Key Secret"
              value={accessKeySecret}
              onChange={handleChange}
              list="dynamodb-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. aws-access-key-id"
              error={secretError}
              invalid={!!secretError}
              mono={true}
            />
            <PropertyField
              id="dynamodbSinkSecretKeySecret"
              name="secretKeySecret"
              label="AWS Secret Key Secret"
              value={secretKeySecret}
              onChange={handleChange}
              list="dynamodb-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. aws-secret-access-key"
              error={secretError}
              invalid={!!secretError}
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Collapsible Advanced Sink Settings */}
      <CollapsibleSection
        title="Advanced Sink Settings"
        isOpen={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        {/* Custom Endpoint Override */}
        <PropertyField
          id="dynamodbSinkEndpointOverride"
          name="endpointOverride"
          label="Service Endpoint Override"
          tooltip="Custom DynamoDB endpoint URL (e.g. http://localhost:8000 or http://localhost:4566 for LocalStack integration testing)."
          value={endpointOverride}
          onChange={handleChange}
          placeholder="http://localhost:8000"
          mono={true}
        />

        {/* Max Retries & Write Capacity Units */}
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="dynamodbSinkMaxRetries"
            name="maxRetries"
            label="Max Retries"
            type="number"
            min={0}
            value={maxRetries}
            onChange={handleChange}
            placeholder="5"
            tooltip="Maximum client retry attempts for unprocessed write items upon ProvisionedThroughputExceededException."
            mono={true}
          />
          <PropertyField
            id="dynamodbSinkWriteCapacityUnits"
            name="writeCapacityUnits"
            label="Write Capacity (WCU) Target"
            type="number"
            min={1}
            value={writeCapacityUnits}
            onChange={handleChange}
            placeholder="Unlimited"
            tooltip="Target write capacity units per second for pipeline rate limiting."
            mono={true}
          />
        </div>

        {/* Write Throttling Notes */}
        <PropertyField
          id="dynamodbSinkThrottlingNotes"
          name="throttlingNotes"
          label="Write Capacity Throttling Notes"
          type="textarea"
          rows={2}
          value={throttlingNotes}
          onChange={handleChange}
          placeholder="Notes on provisioned WCU limits, exponential backoff policies, or alarm thresholds"
          tooltip="Optional operational notes and backoff parameters for write capacity throttling."
          mono={false}
        />
      </CollapsibleSection>

      <SystemInstructionsField
        id="dynamodbSinkInstructions"
        value={systemInstructions}
        tooltip="Optional instructions passed to LLM code generator when synthesizing DynamoDBIO write pipelines."
        placeholder="e.g. Write elements using DynamoDBIO.write().withWriteRequestMapperFn(...) with deduplicateKeys"
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
