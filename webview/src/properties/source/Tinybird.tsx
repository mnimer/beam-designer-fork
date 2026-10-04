/**
 * Tinybird Source Properties Component (IO77 — D2 Bridge)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * `tinybird-beam` ships only `WriteToTinybird` / `WriteToTinybirdBatch` (ingest-only).
 * Per project decision D2 and the IO22 SnsIO precedent, this Source panel implements
 * a documented HTTP API bridge (generated as a bounded Beam `ParDo`) over the Tinybird
 * Pipes API (`GET {host}/v0/pipes/{pipe}.{format}`) and Query API (`GET|POST {host}/v0/sql?q=…`),
 * authenticating with `Authorization: Bearer <token>` resolved from Google Cloud Secret Manager.
 *
 * Documentation Traceability:
 * - Repository & README: https://github.com/tinybirdco/tinybird-beam
 * - Tinybird API Regions & Endpoints: https://www.tinybird.co/docs/api-reference
 * - Tinybird Pipes API: https://www.tinybird.co/docs/api-reference/pipe-api
 * - Tinybird Query API: https://www.tinybird.co/docs/api-reference/query-api
 * - Tinybird Query Parameters & Pagination: https://www.tinybird.co/docs/work-with-data/query/query-parameters
 * - Tinybird Tokens API: https://www.tinybird.co/docs/api-reference/token-api
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';
import { ExternalDocsLink } from '../../components/common/ExternalDocsLink';
import { useNodeProperties } from '../../hooks/useNodeProperties';
import { DEFAULT_TINYBIRD_HOST, TINYBIRD_DOCS_URL, TINYBIRD_HOSTS } from '../sink/Tinybird';

export type TinybirdQueryMode = 'pipe' | 'sql';
export type TinybirdFormat = 'json' | 'ndjson' | 'csv' | 'parquet';

const RESERVED_PARAM_NAMES = new Set([
  'q',
  'pipeline',
  'output_format_json_quote_64bit_integers',
  '__tb__csv_header',
]);

/**
 * Props for the Tinybird source properties component.
 */
export interface TinybirdSourcePropertiesProps {
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

/**
 * Checks whether a given string represents a positive integer (>= 1).
 *
 * @param raw - The input string to test
 * @returns True if raw parses to a positive integer, false otherwise
 */
function isPositiveInt(raw: string): boolean {
  const num = Number(raw);
  return Number.isInteger(num) && num >= 1;
}

/**
 * Validates newline-separated query parameters.
 *
 * @param raw - Raw multiline query parameter string
 * @param enablePagination - Whether pagination is enabled
 * @param limitParam - Parameter name used for limit
 * @param offsetParam - Parameter name used for offset
 * @returns Error string if validation fails, or null if valid
 */
function validateQueryParams(
  raw: string,
  enablePagination: boolean,
  limitParam: string,
  offsetParam: string
): string | null {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=.*$/.exec(line);
    if (!match) {
      return `Invalid parameter line: ${line} (expected name=value)`;
    }
    const paramName = match[1];
    if (paramName === 'token') {
      return 'Do not pass the token as a parameter; use Auth Token Secret';
    }
    if (RESERVED_PARAM_NAMES.has(paramName)) {
      return `'${paramName}' is reserved; use the dedicated field`;
    }
    if (enablePagination) {
      if (paramName === limitParam.trim() || paramName === offsetParam.trim()) {
        return `'${paramName}' is managed by pagination`;
      }
    }
  }
  return null;
}

/**
 * Properties panel component for configuring Tinybird source transforms.
 */
export const TinybirdSourceProperties: React.FC<TinybirdSourcePropertiesProps> = ({
  node,
  onChange,
}) => {
  const { properties, handleChange } = useNodeProperties(node, onChange);
  const [showPagination, setShowPagination] = useState(false);

  const host = String(properties.host ?? DEFAULT_TINYBIRD_HOST);
  const tokenSecret = String(properties.tokenSecret ?? '');
  const queryMode: TinybirdQueryMode = properties.queryMode === 'sql' ? 'sql' : 'pipe';

  // Pipe mode fields
  const pipeName = String(properties.pipeName ?? '');
  const pipeQuery = String(properties.pipeQuery ?? '');

  // SQL mode fields
  const sqlQuery = String(properties.sqlQuery ?? '');
  const sqlPipeline = String(properties.sqlPipeline ?? '');

  // Common query & format fields
  const queryParams = String(properties.queryParams ?? '');
  const rawFormat = String(properties.format ?? 'json');
  const format: TinybirdFormat =
    rawFormat === 'ndjson' || rawFormat === 'csv' || rawFormat === 'parquet' ? rawFormat : 'json';
  const quote64BitIntegers = Boolean(properties.quote64BitIntegers ?? false);

  // Pagination fields
  const enablePagination = Boolean(properties.enablePagination ?? false);
  const pageSize = String(properties.pageSize ?? '');
  const limitParam = String(properties.limitParam ?? 'limit');
  const offsetParam = String(properties.offsetParam ?? 'offset');
  const maxPages = String(properties.maxPages ?? '');

  const systemInstructions = resolveSystemInstructions(node);

  // Validations & warnings
  const trimmedHost = host.trim();
  const hostError = !trimmedHost ? 'Tinybird API host is required' : null;
  const hostWarning =
    trimmedHost && !/^https:\/\//.test(trimmedHost)
      ? 'Tinybird API hosts use https:// (e.g. https://api.tinybird.co)'
      : null;

  const tokenSecretError = !tokenSecret.trim() ? 'Auth token secret is required' : null;

  let pipeNameError: string | null = null;
  let pipeNameWarning: string | null = null;
  if (queryMode === 'pipe') {
    const trimmedPipe = pipeName.trim();
    if (!trimmedPipe) {
      pipeNameError = 'Pipe name is required';
    } else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedPipe)) {
      pipeNameWarning = 'Tinybird Pipe names contain only letters, digits and underscores';
    }
  }

  let sqlQueryError: string | null = null;
  const sqlWarnings: string[] = [];
  if (queryMode === 'sql') {
    const trimmedSql = sqlQuery.trim();
    if (!trimmedSql) {
      sqlQueryError = 'SQL query is required';
    } else {
      if (/\bFORMAT\s+\w+\s*;?\s*$/i.test(trimmedSql)) {
        sqlWarnings.push('Remove the FORMAT clause; the output format is set by the Format field');
      }
      if (enablePagination && !/\bORDER\s+BY\b/i.test(trimmedSql)) {
        sqlWarnings.push('Add ORDER BY for deterministic pagination');
      }
    }
  }

  const queryParamsError = validateQueryParams(
    queryParams,
    enablePagination,
    limitParam,
    offsetParam
  );

  let pageSizeError: string | null = null;
  let limitParamError: string | null = null;
  let offsetParamError: string | null = null;
  let maxPagesError: string | null = null;

  if (enablePagination) {
    if (!pageSize.trim()) {
      pageSizeError = 'Page size is required when pagination is enabled';
    } else if (!isPositiveInt(pageSize.trim())) {
      pageSizeError = 'Must be an integer ≥ 1';
    }
    if (queryMode === 'pipe') {
      const trimmedLimit = limitParam.trim();
      const trimmedOffset = offsetParam.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedLimit)) {
        limitParamError = 'Invalid parameter name';
      }
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedOffset)) {
        offsetParamError = 'Invalid parameter name';
      } else if (trimmedOffset === trimmedLimit) {
        offsetParamError = 'Limit and offset parameters must differ';
      }
    }
    if (maxPages.trim() && !isPositiveInt(maxPages.trim())) {
      maxPagesError = 'Must be an integer ≥ 1';
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* D2 Bridge Banner + Docs Link */}
      <div
        role="note"
        className="flex flex-col gap-1.5 p-2.5 rounded bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-200">Tinybird Source (Pipes &amp; Query HTTP API)</span>
          <ExternalDocsLink
            url={TINYBIRD_DOCS_URL}
            className="text-blue-400 hover:text-blue-300 hover:underline shrink-0 font-semibold cursor-pointer"
          />
        </div>
        <p className="text-slate-400">
          tinybird-beam is ingest-only; reads are generated as a Beam ParDo over the Tinybird
          Pipes/Query HTTP API (bounded).
        </p>
      </div>

      {/* Host */}
      <PropertyField
        id="tinybirdSourceHost"
        name="host"
        label="Tinybird API Host"
        required="Tinybird API host is required"
        tooltip="Region-specific Tinybird API base URL of the Workspace that owns the Pipe / Data Sources. Use the host that matches your Workspace region."
        value={host}
        onChange={handleChange}
        placeholder={DEFAULT_TINYBIRD_HOST}
        list="tinybird-source-host-options"
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
        id="tinybirdSourceTokenSecret"
        name="tokenSecret"
        label="Auth Token Secret"
        required="Auth token secret is required"
        tooltip="Secret Manager secret holding a Tinybird Auth Token with PIPES:READ scope on the Pipe (Pipe mode) or read access to the queried Pipes/Data Sources (SQL mode). Sent as Authorization: Bearer."
        value={tokenSecret}
        onChange={handleChange}
        invalid={Boolean(tokenSecretError)}
        error={tokenSecretError}
        placeholder="e.g. tinybird-read-token"
      />

      {/* Query Mode Radio Group */}
      <div className="flex flex-col gap-2">
        <span className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Query Mode</span>
          <InfoTooltip text="Pipe: GET /v0/pipes/<pipe>.<format> with template parameters. SQL: /v0/sql with an ad-hoc query (q)." />
        </span>
        <div className="flex flex-col gap-2 bg-[#252836] p-2 rounded border border-slate-700">
          <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
            <input
              id="tinybirdSourceModePipe"
              type="radio"
              name="queryMode"
              value="pipe"
              checked={queryMode === 'pipe'}
              onChange={handleChange}
            />
            <span>Published API Endpoint (Pipes API)</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
            <input
              id="tinybirdSourceModeSql"
              type="radio"
              name="queryMode"
              value="sql"
              checked={queryMode === 'sql'}
              onChange={handleChange}
            />
            <span>SQL Query (Query API)</span>
          </label>
        </div>
      </div>

      {/* Pipe Mode Fields */}
      {queryMode === 'pipe' && (
        <div className="flex flex-col gap-4">
          <PropertyField
            id="tinybirdSourcePipeName"
            name="pipeName"
            label="Pipe (API Endpoint) Name"
            required="Pipe name is required"
            tooltip="Name of the published API Endpoint Pipe."
            value={pipeName}
            onChange={handleChange}
            placeholder="e.g. top_products"
            invalid={Boolean(pipeNameError)}
            error={pipeNameError}
            helperText={
              pipeNameWarning ? <span className="text-amber-400">{pipeNameWarning}</span> : undefined
            }
          />
          <PropertyField
            id="tinybirdSourcePipeQuery"
            name="pipeQuery"
            label="SQL over Endpoint Result (q)"
            type="textarea"
            rows={3}
            tooltip="Optional q parameter: SQL applied to the endpoint result; refer to the endpoint as _ (e.g. SELECT * FROM _ WHERE amount > 10)."
            value={pipeQuery}
            onChange={handleChange}
            placeholder="SELECT * FROM _ WHERE amount > 10"
          />
        </div>
      )}

      {/* SQL Mode Fields */}
      {queryMode === 'sql' && (
        <div className="flex flex-col gap-4">
          <PropertyField
            id="tinybirdSourceSqlQuery"
            name="sqlQuery"
            label="SQL Query (q)"
            type="textarea"
            rows={5}
            required="SQL query is required"
            tooltip="SQL sent as the q parameter to /v0/sql. Long queries are sent via POST."
            value={sqlQuery}
            onChange={handleChange}
            placeholder="SELECT id, amount FROM invoices WHERE amount > 0 ORDER BY id"
            invalid={Boolean(sqlQueryError)}
            error={sqlQueryError}
            helperText={
              sqlWarnings.length > 0 ? (
                <span className="text-amber-400">{sqlWarnings.join(' · ')}</span>
              ) : undefined
            }
          />
          <PropertyField
            id="tinybirdSourceSqlPipeline"
            name="sqlPipeline"
            label="Pipeline (for _ alias)"
            tooltip="Optional pipeline parameter: the Pipe that _ refers to inside the SQL query."
            value={sqlPipeline}
            onChange={handleChange}
            placeholder="e.g. invoices_pipe"
          />
        </div>
      )}

      {/* Query Parameters */}
      <PropertyField
        id="tinybirdSourceQueryParams"
        name="queryParams"
        label="Query Parameters"
        type="textarea"
        rows={3}
        tooltip="Dynamic template parameters defined in the Pipe/SQL with {{Type(name, default)}}; one name=value per line, sent as query-string (GET) or body (POST) parameters."
        value={queryParams}
        onChange={handleChange}
        placeholder={'start_date=2024-01-01\ncurrency=USD'}
        invalid={Boolean(queryParamsError)}
        error={queryParamsError}
      />

      {/* Response Format */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="tinybirdSourceFormat"
          className="flex items-center text-xs font-bold uppercase text-slate-500"
        >
          <span>Response Format</span>
          <InfoTooltip text="Pipe mode: endpoint extension (.json/.ndjson/.csv/.parquet). SQL mode: appended FORMAT clause (JSON / JSONEachRow / CSVWithNames / Parquet). Rows are emitted as dicts." />
        </label>
        <select
          id="tinybirdSourceFormat"
          name="format"
          value={format}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="json">JSON (default)</option>
          <option value="ndjson">NDJSON</option>
          <option value="csv">CSV (with header)</option>
          <option value="parquet">Parquet</option>
        </select>
        {format === 'parquet' && (
          <span className="text-xs text-slate-400">Requires pyarrow on workers</span>
        )}
      </div>

      {/* Quote 64-bit Integers (JSON / NDJSON only) */}
      {format !== 'csv' && format !== 'parquet' && (
        <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
          <input
            id="tinybirdSourceQuote64BitIntegers"
            type="checkbox"
            name="quote64BitIntegers"
            checked={quote64BitIntegers}
            onChange={handleChange}
          />
          <span>Quote 64-bit Integers</span>
          <InfoTooltip text="Controls output_format_json_quote_64bit_integers (1 when checked, 0 when unchecked) so UInt64/Int128 values come back as strings to avoid precision loss." />
        </label>
      )}

      {/* Collapsible Pagination Section */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <button
          type="button"
          onClick={() => setShowPagination((prev) => !prev)}
          className="flex items-center justify-between text-xs font-bold uppercase text-slate-400 hover:text-white py-1"
        >
          <span>Pagination</span>
          <span>{showPagination ? '▲' : '▼'}</span>
        </button>

        {showPagination && (
          <div className="flex flex-col gap-4 pl-2 border-l-2 border-slate-700 pt-2">
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input
                id="tinybirdSourceEnablePagination"
                type="checkbox"
                name="enablePagination"
                checked={enablePagination}
                onChange={handleChange}
              />
              <span>Paginate Results</span>
              <InfoTooltip text="Fetch in pages using LIMIT/OFFSET. In Pipe mode the endpoint must declare the limit/offset template parameters (e.g. LIMIT {{Int32(limit, 10)}} OFFSET {{Int32(offset, 0)}}). In SQL mode the query is wrapped with LIMIT/OFFSET; include ORDER BY for stable pages." />
            </label>

            {enablePagination && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2">
                  <PropertyField
                    id="tinybirdSourcePageSize"
                    name="pageSize"
                    label="Page Size"
                    type="number"
                    min={1}
                    step={1}
                    required="Page size is required when pagination is enabled"
                    tooltip="Rows per request (LIMIT)."
                    value={pageSize}
                    onChange={handleChange}
                    placeholder="1000"
                    invalid={Boolean(pageSizeError)}
                    error={pageSizeError}
                  />
                  <PropertyField
                    id="tinybirdSourceMaxPages"
                    name="maxPages"
                    label="Max Pages"
                    type="number"
                    min={1}
                    step={1}
                    tooltip="Stop after this many pages; otherwise stop when a page returns fewer than Page Size rows."
                    value={maxPages}
                    onChange={handleChange}
                    placeholder="Unlimited"
                    invalid={Boolean(maxPagesError)}
                    error={maxPagesError}
                  />
                </div>

                {queryMode === 'pipe' && (
                  <div className="grid grid-cols-2 gap-2">
                    <PropertyField
                      id="tinybirdSourceLimitParam"
                      name="limitParam"
                      label="Limit Parameter Name"
                      tooltip="Name of the endpoint template parameter used for LIMIT."
                      value={limitParam}
                      onChange={handleChange}
                      placeholder="limit"
                      invalid={Boolean(limitParamError)}
                      error={limitParamError}
                    />
                    <PropertyField
                      id="tinybirdSourceOffsetParam"
                      name="offsetParam"
                      label="Offset Parameter Name"
                      tooltip="Name of the endpoint template parameter used for OFFSET."
                      value={offsetParam}
                      onChange={handleChange}
                      placeholder="offset"
                      invalid={Boolean(offsetParamError)}
                      error={offsetParamError}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="tinybirdSourceSystemInstructions"
        value={systemInstructions}
        placeholder="Optional instructions passed to the LLM code generator..."
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
