/**
 * Tinybird Sink Properties Component (IO77)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for the Tinybird Apache Beam connector
 * (`tinybird.beam.WriteToTinybird(host, token, data_source, columns)`), along with
 * the upstream-required pre-write batching configuration (`BatchElements` or
 * `GroupIntoBatches`, as required by `tinybird-beam` README and `dataflow/dataflow.py`).
 *
 * Documentation Traceability:
 * - Repository & README: https://github.com/tinybirdco/tinybird-beam
 * - Sink implementation: https://github.com/tinybirdco/tinybird-beam/blob/main/tinybird/beam.py
 * - Dataflow example: https://github.com/tinybirdco/tinybird-beam/blob/main/dataflow/dataflow.py
 * - Tinybird API Regions & Endpoints: https://www.tinybird.co/docs/api-reference
 * - Tinybird Data Sources API: https://www.tinybird.co/docs/api-reference/datasource-api
 * - Tinybird Tokens API: https://www.tinybird.co/docs/api-reference/token-api
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import type { PropertyFieldOption } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';

export const TINYBIRD_DOCS_URL = 'https://github.com/tinybirdco/tinybird-beam';
export const DEFAULT_TINYBIRD_HOST = 'https://api.tinybird.co';

export const TINYBIRD_HOSTS: ReadonlyArray<PropertyFieldOption> = [
  { value: 'https://api.tinybird.co', label: 'GCP europe-west3 (Frankfurt) – default' },
  { value: 'https://api.us-east.tinybird.co', label: 'GCP us-east4 (N. Virginia)' },
  { value: 'https://api.europe-west2.gcp.tinybird.co', label: 'GCP europe-west2 (London)' },
  { value: 'https://api.northamerica-northeast2.gcp.tinybird.co', label: 'GCP northamerica-northeast2 (Toronto)' },
  { value: 'https://api.us-east.aws.tinybird.co', label: 'AWS us-east-1 (N. Virginia)' },
  { value: 'https://api.us-west-2.aws.tinybird.co', label: 'AWS us-west-2 (Oregon)' },
  { value: 'https://api.eu-central-1.aws.tinybird.co', label: 'AWS eu-central-1 (Frankfurt)' },
];

export type TinybirdBatchingMode = 'batchElements' | 'groupIntoBatches' | 'none';

export interface TinybirdSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      properties?: Record<string, unknown>;
      system_instructions?: string;
      special_instructions?: string;
    };
  };
  onChange: (properties: Record<string, unknown>) => void;
}

function validateColumns(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'At least one column is required';
  }
  const parts = raw.split(',').map((c) => c.trim());
  if (parts.some((c) => !c)) {
    return 'Column list contains an empty column name';
  }
  const seen = new Set<string>();
  for (const col of parts) {
    if (seen.has(col)) {
      return `Duplicate column: ${col}`;
    }
    seen.add(col);
  }
  return null;
}

function isPositiveInt(raw: string): boolean {
  const num = Number(raw);
  return Number.isInteger(num) && num >= 1;
}

export const TinybirdSinkProperties: React.FC<TinybirdSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const [showBatching, setShowBatching] = useState(true);

  const host = String(properties.host ?? DEFAULT_TINYBIRD_HOST);
  const tokenSecret = String(properties.tokenSecret ?? '');
  const datasource = String(properties.datasource ?? '');
  const columns = String(properties.columns ?? '');

  const rawBatching = String(properties.batchingMode ?? 'batchElements');
  const batchingMode: TinybirdBatchingMode =
    rawBatching === 'groupIntoBatches' || rawBatching === 'none' ? rawBatching : 'batchElements';
  const minBatchSize = String(properties.minBatchSize ?? '');
  const maxBatchSize = String(properties.maxBatchSize ?? '');
  const batchSize = String(properties.batchSize ?? '');
  const maxBufferingDurationSecs = String(properties.maxBufferingDurationSecs ?? '');

  const systemInstructions = String(
    node.data.system_instructions ??
      node.data.special_instructions ??
      properties.system_instructions ??
      properties.special_instructions ??
      ''
  );

  // Validations & warnings
  const trimmedHost = host.trim();
  const hostError = !trimmedHost ? 'Tinybird API host is required' : null;
  const hostWarning =
    trimmedHost && !/^https:\/\//.test(trimmedHost)
      ? 'Tinybird API hosts use https:// (e.g. https://api.tinybird.co)'
      : null;

  const tokenSecretError = !tokenSecret.trim() ? 'Auth token secret is required' : null;

  const trimmedDatasource = datasource.trim();
  const datasourceError = !trimmedDatasource ? 'Data Source name is required' : null;
  const datasourceWarning =
    trimmedDatasource && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedDatasource)
      ? 'Tinybird Data Source names contain only letters, digits and underscores'
      : null;

  const columnsError = validateColumns(columns);

  let minBatchError: string | null = null;
  let maxBatchError: string | null = null;
  if (batchingMode === 'batchElements') {
    const minValid = minBatchSize.trim() ? isPositiveInt(minBatchSize.trim()) : true;
    const maxValid = maxBatchSize.trim() ? isPositiveInt(maxBatchSize.trim()) : true;
    if (!minValid) {
      minBatchError = 'Must be an integer ≥ 1';
    }
    if (!maxValid) {
      maxBatchError = 'Must be an integer ≥ 1';
    } else if (minValid && minBatchSize.trim() && maxBatchSize.trim()) {
      if (Number(maxBatchSize.trim()) < Number(minBatchSize.trim())) {
        maxBatchError = 'Max batch size must be ≥ min batch size';
      }
    }
  }

  let batchSizeError: string | null = null;
  let maxBufferingError: string | null = null;
  if (batchingMode === 'groupIntoBatches') {
    if (!batchSize.trim()) {
      batchSizeError = 'Batch size is required for GroupIntoBatches';
    } else if (!isPositiveInt(batchSize.trim())) {
      batchSizeError = 'Must be an integer ≥ 1';
    }
    if (maxBufferingDurationSecs.trim()) {
      const dur = Number(maxBufferingDurationSecs.trim());
      if (Number.isNaN(dur) || dur <= 0) {
        maxBufferingError = 'Must be > 0';
      }
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    onChange({
      ...properties,
      [name]: value,
    });
  };

  const handleOpenDocs = () => {
    const vscode = (window as unknown as { vscode?: { postMessage?: (msg: unknown) => void } }).vscode;
    if (vscode && typeof vscode.postMessage === 'function') {
      vscode.postMessage({ command: 'openExternal', url: TINYBIRD_DOCS_URL });
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Header + Docs Link */}
      <div className="flex items-center justify-between gap-2 bg-slate-800/60 p-2 rounded border border-slate-700 text-xs text-slate-300">
        <span>Ingest batches to a Tinybird Data Source via tinybird.beam.WriteToTinybird</span>
        <button
          type="button"
          onClick={handleOpenDocs}
          className="text-blue-400 hover:underline shrink-0 font-semibold"
        >
          Docs ↗
        </button>
      </div>

      {/* Host */}
      <PropertyField
        id="tinybirdSinkHost"
        name="host"
        label="Tinybird API Host"
        required="Tinybird API host is required"
        tooltip="Region-specific Tinybird API base URL of the Workspace that owns the Data Source. Use the host that matches your Workspace region."
        value={host}
        onChange={handleChange}
        placeholder={DEFAULT_TINYBIRD_HOST}
        list="tinybird-sink-host-options"
        datalist={[...TINYBIRD_HOSTS]}
        invalid={Boolean(hostError)}
        error={hostError}
        helperText={
          hostWarning ? (
            <span className="text-amber-400">{hostWarning}</span>
          ) : (
            <>
              Sample: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">{DEFAULT_TINYBIRD_HOST}</code>
            </>
          )
        }
      />

      {/* Auth Token Secret */}
      <SecretManagerSecretField
        id="tinybirdSinkTokenSecret"
        name="tokenSecret"
        label="Auth Token Secret"
        required="Auth token secret is required"
        tooltip="Secret Manager secret holding a Tinybird Auth Token with DATASOURCES:APPEND (or DATASOURCES:CREATE) scope on this Data Source (create at ui.tinybird.co/tokens). Resolved at pipeline construction; never stored in the pipeline."
        value={tokenSecret}
        onChange={handleChange}
        invalid={Boolean(tokenSecretError)}
        error={tokenSecretError}
        placeholder="e.g. tinybird-append-token"
      />

      {/* Data Source Name */}
      <PropertyField
        id="tinybirdSinkDatasource"
        name="datasource"
        label="Data Source Name"
        required="Data Source name is required"
        tooltip="Name of the existing Tinybird Data Source to append rows to (mode=append)."
        value={datasource}
        onChange={handleChange}
        placeholder="e.g. pubsub__invoices"
        invalid={Boolean(datasourceError)}
        error={datasourceError}
        helperText={
          datasourceWarning ? <span className="text-amber-400">{datasourceWarning}</span> : undefined
        }
      />

      {/* Columns */}
      <PropertyField
        id="tinybirdSinkColumns"
        name="columns"
        label="Columns"
        required="At least one column is required"
        tooltip="Comma-separated Data Source column names, in Data Source schema order. Each element dict is written as one CSV row using these keys in this order."
        value={columns}
        onChange={handleChange}
        placeholder="id,agent_id,amount,created_at"
        invalid={Boolean(columnsError)}
        error={columnsError}
      />

      {/* Collapsible Batching Section */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <button
          type="button"
          onClick={() => setShowBatching((prev) => !prev)}
          className="flex items-center justify-between text-xs font-bold uppercase text-slate-400 hover:text-white py-1"
        >
          <span>Batching</span>
          <span>{showBatching ? '▲' : '▼'}</span>
        </button>

        {showBatching && (
          <div className="flex flex-col gap-4 pl-2 border-l-2 border-slate-700 pt-2">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="tinybirdSinkBatchingMode"
                className="flex items-center text-xs font-bold uppercase text-slate-500"
              >
                <span>Batching Strategy</span>
                <InfoTooltip text="WriteToTinybird expects each element to be a batch (Iterable[Dict[str, Any]]). The README requires batching beforehand." />
              </label>
              <select
                id="tinybirdSinkBatchingMode"
                name="batchingMode"
                value={batchingMode}
                onChange={handleChange}
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="batchElements">BatchElements (size-adaptive)</option>
                <option value="groupIntoBatches">GroupIntoBatches (keyed, streaming-friendly)</option>
                <option value="none">None – input is already batched</option>
              </select>
            </div>

            {batchingMode === 'batchElements' && (
              <div className="grid grid-cols-2 gap-2">
                <PropertyField
                  id="tinybirdSinkMinBatchSize"
                  name="minBatchSize"
                  label="Min Batch Size"
                  type="number"
                  min={1}
                  step={1}
                  tooltip="BatchElements min_batch_size."
                  value={minBatchSize}
                  onChange={handleChange}
                  placeholder="1"
                  invalid={Boolean(minBatchError)}
                  error={minBatchError}
                />
                <PropertyField
                  id="tinybirdSinkMaxBatchSize"
                  name="maxBatchSize"
                  label="Max Batch Size"
                  type="number"
                  min={1}
                  step={1}
                  tooltip="BatchElements max_batch_size (rows per HTTP append request)."
                  value={maxBatchSize}
                  onChange={handleChange}
                  placeholder="10000"
                  invalid={Boolean(maxBatchError)}
                  error={maxBatchError}
                />
              </div>
            )}

            {batchingMode === 'groupIntoBatches' && (
              <div className="grid grid-cols-2 gap-2">
                <PropertyField
                  id="tinybirdSinkBatchSize"
                  name="batchSize"
                  label="Batch Size"
                  type="number"
                  min={1}
                  step={1}
                  required="Batch size is required for GroupIntoBatches"
                  tooltip="GroupIntoBatches batch_size. Elements are keyed (by the generated code) and grouped; the grouped values are passed to WriteToTinybird."
                  value={batchSize}
                  onChange={handleChange}
                  placeholder="1000"
                  invalid={Boolean(batchSizeError)}
                  error={batchSizeError}
                />
                <PropertyField
                  id="tinybirdSinkMaxBufferingDurationSecs"
                  name="maxBufferingDurationSecs"
                  label="Max Buffering Duration (s)"
                  type="number"
                  min={0}
                  step="any"
                  tooltip="GroupIntoBatches max_buffering_duration_secs: flushes a partial batch after this many seconds (recommended for streaming)."
                  value={maxBufferingDurationSecs}
                  onChange={handleChange}
                  placeholder="30"
                  invalid={Boolean(maxBufferingError)}
                  error={maxBufferingError}
                />
              </div>
            )}

            {batchingMode === 'none' && (
              <span className="text-xs text-amber-400">
                Input elements must already be Iterable[Dict] batches; a single dict will be iterated by its keys.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label
          htmlFor="tinybirdSinkSystemInstructions"
          className="text-xs font-bold uppercase text-slate-500"
        >
          Code Generation Instructions
        </label>
        <textarea
          id="tinybirdSinkSystemInstructions"
          name="system_instructions"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 focus:border-blue-500 text-sm"
          rows={3}
          value={systemInstructions}
          placeholder="Optional instructions passed to the LLM code generator..."
          onChange={(e) => onChange({ ...properties, system_instructions: e.target.value })}
        />
      </div>
    </div>
  );
};
