/**
 * DynamoDBIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam DynamoDBIO Read Source nodes
 * (org.apache.beam.sdk.io.aws2.dynamodb.DynamoDBIO.read() in Java / cross-language external transform in Python).
 *
 * Architectural Decisions:
 * - Table name is required with instant validation, red border highlighting, and aria-invalid flags.
 * - Standard AWS Region selection with predefined AWS regions and custom region input.
 * - Scan configuration supports total segments, segment id, projection expression, filter expression,
 *   and JSON textareas for expression attribute names and expression attribute values.
 * - Parallel scan and consistent read toggles configured via withScanRequestFn / splits.
 * - Supports AWS Credential configuration: default credential provider chain vs GCP Secret Manager references.
 *   Uses IPC 'getSecrets' to populate datalist with id 'dynamodb-source-secret-options'.
 * - Collapsible Advanced Source Settings: custom service endpoint override (e.g. LocalStack),
 *   read capacity units/rate limiting, and client retry count.
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Follows the 8pt grid system (p-2, p-3, p-4, gap-2, gap-4) and Tailwind CSS styling.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

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

export interface DynamoDBIOSourcePropertiesProps {
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
        totalSegments?: number | string;
        segment?: number | string;
        projectionExpression?: string;
        filterExpression?: string;
        expressionAttributeNames?: string;
        expressionAttributeValues?: string;
        consistentRead?: boolean;
        numberOfSplits?: number | string;
        authMode?: 'default' | 'secret_manager';
        accessKeySecret?: string;
        secretKeySecret?: string;
        endpointOverride?: string;
        readCapacityUnits?: number | string;
        maxRetries?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * DynamoDBIOSourceProperties renders the property configuration form for DynamoDBIO read operations.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const DynamoDBIOSourceProperties: React.FC<DynamoDBIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const tableName = properties.tableName || '';
  const awsRegion = properties.awsRegion || 'us-east-1';
  const customRegion = properties.customRegion || '';
  const totalSegments = properties.totalSegments ?? '';
  const segment = properties.segment ?? '';
  const projectionExpression = properties.projectionExpression || '';
  const filterExpression = properties.filterExpression || '';
  const expressionAttributeNames = properties.expressionAttributeNames || '';
  const expressionAttributeValues = properties.expressionAttributeValues || '';
  const consistentRead = properties.consistentRead ?? false;
  const numberOfSplits = properties.numberOfSplits ?? '';
  const authMode = properties.authMode || 'default';
  const accessKeySecret = properties.accessKeySecret || '';
  const secretKeySecret = properties.secretKeySecret || '';
  const endpointOverride = properties.endpointOverride || '';
  const readCapacityUnits = properties.readCapacityUnits ?? '';
  const maxRetries = properties.maxRetries ?? '';

  // Local state for dynamically loaded GCP Secret Manager secrets
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isTableEmpty = !tableName.trim();

  // Verbatim system instruction fallback chain
  const systemInstructions =
    node?.data?.system_instructions ??
    node?.data?.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

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
   * Handles text, select, and checkbox input changes.
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

  /**
   * Handles system instructions textarea modification.
   *
   * @param e React textarea change event
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Target DynamoDB Table Name */}
      <PropertyField
        id="dynamodbSourceTableName"
        name="tableName"
        label="Table Name"
        required="Table Name is required"
        tooltip="The Amazon DynamoDB table name to read from. Required."
        value={tableName}
        invalid={isTableEmpty}
        error={isTableEmpty ? 'Table Name is required' : null}
        placeholder="e.g. UserEvents"
        onChange={handleChange}
        mono={true}
      />

      {/* AWS Region Selector */}
      <div className="flex flex-col gap-1">
        <label htmlFor="dynamodbSourceAwsRegion" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>AWS Region</span>
          <InfoTooltip text="The AWS Region where the DynamoDB table is hosted (e.g. us-east-1)." />
        </label>
        <select
          id="dynamodbSourceAwsRegion"
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
            id="dynamodbSourceCustomRegion"
            name="customRegion"
            value={customRegion}
            onChange={handleChange}
            placeholder="e.g. me-central-1"
            className="mt-1 font-mono"
          />
        )}
      </div>

      {/* Scan & Partition Configuration */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Scan Configuration</span>
          <InfoTooltip text="Configures the DynamoDB ScanRequest. For parallel processing across Beam workers, set totalSegments and segment count." />
        </label>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <PropertyField
            id="dynamodbSourceTotalSegments"
            name="totalSegments"
            label="Total Segments"
            type="number"
            min={1}
            value={totalSegments}
            onChange={handleChange}
            placeholder="e.g. 4"
            tooltip="DynamoDB parallel scan total segment count configured on ScanRequest via withScanRequestFn."
            mono={true}
          />
          <PropertyField
            id="dynamodbSourceSegment"
            name="segment"
            label="Segment ID"
            type="number"
            min={0}
            value={segment}
            onChange={handleChange}
            placeholder="e.g. 0"
            tooltip="The segment ID (0 to totalSegments - 1) assigned to this scan partition on ScanRequest."
            mono={true}
          />
        </div>

        <PropertyField
          id="dynamodbSourceProjectionExpression"
          name="projectionExpression"
          label="Projection Expression"
          value={projectionExpression}
          onChange={handleChange}
          placeholder="e.g. userId, eventTime, payload"
          tooltip="Comma-separated string of attribute names to retrieve (leave empty for all attributes)."
          mono={true}
        />

        <PropertyField
          id="dynamodbSourceFilterExpression"
          name="filterExpression"
          label="Filter Expression"
          value={filterExpression}
          onChange={handleChange}
          placeholder="e.g. eventType = :t AND status = :s"
          tooltip="Condition determining which items within the scan result to return to the pipeline."
          mono={true}
        />

        <PropertyField
          id="dynamodbSourceExpressionAttributeNames"
          name="expressionAttributeNames"
          label="Expression Attribute Names (JSON)"
          type="textarea"
          rows={2}
          value={expressionAttributeNames}
          onChange={handleChange}
          placeholder='{"#status": "status"}'
          tooltip="JSON map of substitution tokens for attribute names in expressions (e.g. reserved words)."
          mono={true}
        />

        <PropertyField
          id="dynamodbSourceExpressionAttributeValues"
          name="expressionAttributeValues"
          label="Expression Attribute Values (JSON)"
          type="textarea"
          rows={2}
          value={expressionAttributeValues}
          onChange={handleChange}
          placeholder='{":t": {"S": "click"}, ":s": {"S": "active"}}'
          tooltip="JSON map of DynamoDB AttributeValue tokens used in filter expressions."
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2 mt-1">
          <PropertyField
            id="dynamodbSourceNumberOfSplits"
            name="numberOfSplits"
            label="Number of Splits"
            type="number"
            min={1}
            value={numberOfSplits}
            onChange={handleChange}
            placeholder="e.g. 8"
            tooltip="Beam generator context for desired pipeline partition count / runner parallelism guidance (does not map to an aws2 builder call; use Total Segments for AWS parallel scans)."
            mono={true}
          />

          <div className="flex items-center gap-2 mt-6">
            <input
              id="dynamodbSourceConsistentRead"
              type="checkbox"
              name="consistentRead"
              checked={consistentRead}
              onChange={handleChange}
              className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0 cursor-pointer"
            />
            <label htmlFor="dynamodbSourceConsistentRead" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
              <span>Consistent Read</span>
              <InfoTooltip text="If enabled, uses strongly consistent reads rather than eventually consistent reads (consumes 2x read capacity)." />
            </label>
          </div>
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
              id="dynamodbSourceAccessKeySecret"
              name="accessKeySecret"
              label="AWS Access Key Secret"
              value={accessKeySecret}
              onChange={handleChange}
              list="dynamodb-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. aws-access-key-id"
              error={secretError}
              invalid={!!secretError}
              mono={true}
            />
            <PropertyField
              id="dynamodbSourceSecretKeySecret"
              name="secretKeySecret"
              label="AWS Secret Key Secret"
              value={secretKeySecret}
              onChange={handleChange}
              list="dynamodb-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. aws-secret-access-key"
              error={secretError}
              invalid={!!secretError}
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Collapsible Advanced Source Settings */}
      <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
        >
          <span>Advanced Source Settings</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </button>

        {showAdvanced && (
          <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
            {/* Custom Endpoint Override */}
            <PropertyField
              id="dynamodbSourceEndpointOverride"
              name="endpointOverride"
              label="Service Endpoint Override"
              tooltip="Custom DynamoDB endpoint URL (e.g. http://localhost:8000 or http://localhost:4566 for LocalStack integration testing)."
              value={endpointOverride}
              onChange={handleChange}
              placeholder="http://localhost:8000"
              mono={true}
            />

            {/* Read Capacity and Client Retry Count */}
            <div className="grid grid-cols-2 gap-2">
              <PropertyField
                id="dynamodbSourceReadCapacityUnits"
                name="readCapacityUnits"
                label="Read Capacity / Rate Limit"
                type="number"
                min={1}
                value={readCapacityUnits}
                onChange={handleChange}
                placeholder="Unlimited"
                tooltip="Rate-limit target or maximum provisioned read capacity units (RCU) per second."
                mono={true}
              />
              <PropertyField
                id="dynamodbSourceMaxRetries"
                name="maxRetries"
                label="Client Retry Count"
                type="number"
                min={0}
                value={maxRetries}
                onChange={handleChange}
                placeholder="3"
                tooltip="Number of retry attempts on transient DynamoDB service exceptions or throttling."
                mono={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="dynamodbSourceInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Optional instructions passed to LLM code generator when synthesizing DynamoDBIO read pipelines."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Read items using DynamoDBIO.read().withScanRequestFn(...) with 4 segments"
        mono={true}
      />
    </div>
  );
};
