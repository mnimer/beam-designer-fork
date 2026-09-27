/**
 * KineticaDB Source Properties Component (IO70)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for the KineticaDB Source (reader) node
 * (`KineticaIO.read()`) in Apache Beam Java pipelines
 * (`com.kinetica:apache-beam-kineticaio:7.2.0.0`).
 *
 * Architectural Decisions:
 * - Exposes only options documented in `com.kinetica.beam.io.KineticaIO.Read` and
 *   `com.gpudb.RecordObject`: `headNodeURL`, `username`, `passwordSecret`, `table`,
 *   and the declarative RecordObject POJO specification (`entityClassName`, `entityColumns`).
 * - Credentials (`withPassword`) use exclusively `SecretManagerSecretField` (`passwordSecret`,
 *   discovered via `gcloud secrets list`); no plaintext password input is offered (R3/D3).
 * - Declarative `entityClassName` + `entityColumns` allow the code generator to synthesize the
 *   required `public static class <Entity> extends RecordObject implements Serializable` POJO
 *   with `@RecordObject.Column(order = i, properties = {...})` fields and
 *   `SerializableCoder.of(<Entity>.class)` for `withCoder()`.
 * - Omitted upstream options: `withCoder` (always `SerializableCoder.of(Entity.class)`),
 *   `withKineticaService` (programmatic test hook), `minNumberOfSplits` (no public setter in
 *   KineticaIO; reader always uses 1 split), and read filters/expressions (not supported by
 *   `KineticaServiceImpl`, which issues a single `GetRecordsRequest` with empty options).
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';

export const KINETICA_DOC_URL = 'https://github.com/kineticadb/kinetica-connector-beam';

/**
 * Supported Java field types for `com.gpudb.RecordObject` columns (`com.gpudb.Type` L267-270).
 */
const KINETICA_JAVA_TYPES = [
  'String',
  'Integer',
  'Long',
  'Float',
  'Double',
  'ByteBuffer',
] as const;

/**
 * Valid `com.gpudb.ColumnProperty` constants (`kineticadb/kinetica-api-java` `ColumnProperty.java`).
 */
const KINETICA_COLUMN_PROPERTIES = [
  'data',
  'text_search',
  'timestamp',
  'ulong',
  'uuid',
  'decimal',
  'date',
  'time',
  'datetime',
  'char1',
  'char2',
  'char4',
  'char8',
  'char16',
  'char32',
  'char64',
  'char128',
  'char256',
  'boolean',
  'int8',
  'int16',
  'ipv4',
  'array',
  'json',
  'vector',
  'wkt',
  'primary_key',
  'soft_primary_key',
  'shard_key',
  'nullable',
  'compress',
  'dict',
  'init_with_now',
  'init_with_uuid',
  'update_with_now',
  'update_with_user',
  'default',
  'default_sql',
] as const;

const VALID_COLUMN_PROPERTIES_SET: ReadonlySet<string> = new Set(KINETICA_COLUMN_PROPERTIES);

export interface KineticaEntityColumn {
  name: string;
  javaType: string;
  columnProperties: string;
}

/**
 * Opens the Kinetica Beam connector documentation in the external browser via VS Code IPC.
 */
function openKineticaDocs(): void {
  const vscodeApi = (window as unknown as { vscode?: { postMessage: (msg: unknown) => void } }).vscode;
  if (vscodeApi) {
    vscodeApi.postMessage({ command: 'openExternal', url: KINETICA_DOC_URL });
  }
}

/**
 * Validates the Kinetica `headNodeURL` property (single URL or comma-separated HA URLs).
 */
function validateHeadNodeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Head node URL is required.';
  }
  const entries = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  for (const entry of entries) {
    if (/^https?:\/\/[^/\s]*@/i.test(entry)) {
      return 'Do not embed credentials in the URL; use Username and Password Secret.';
    }
    if (!/^https?:\/\/[^\s/@]+(\/\S*)?$/i.test(entry)) {
      return 'Each URL must start with http:// or https:// (e.g. http://127.0.0.1:9191).';
    }
  }
  return null;
}

/**
 * Validates the Java class name for the generated `RecordObject` POJO (`withEntity`).
 */
function validateEntityClassName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Entity class name is required.';
  }
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(trimmed)) {
    return 'Use a Java class name starting with an uppercase letter (e.g. KineticaRecord).';
  }
  return null;
}

/**
 * Validates the `entityColumns` list for `RecordObject` POJO generation.
 */
function validateEntityColumns(columns: KineticaEntityColumn[]): {
  listError: string | null;
  rowErrors: (string | null)[];
} {
  if (columns.length === 0) {
    return {
      listError: 'At least one column is required (RecordObject must have at least one column).',
      rowErrors: [],
    };
  }

  const seen = new Set<string>();
  const rowErrors = columns.map((col) => {
    const trimmedName = col.name.trim();
    if (!trimmedName) {
      return 'Column name is required.';
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedName)) {
      return 'Column name must be a valid Java identifier (letters, digits, _).';
    }
    if (seen.has(trimmedName)) {
      return 'Duplicate column name.';
    }
    seen.add(trimmedName);

    const tokens = col.columnProperties
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    for (const token of tokens) {
      if (!VALID_COLUMN_PROPERTIES_SET.has(token)) {
        return `Unknown column property: ${token}`;
      }
    }
    return null;
  });

  return { listError: null, rowErrors };
}

export interface KineticaEntityColumnsEditorProps {
  idPrefix: string;
  columns: KineticaEntityColumn[];
  onColumnsChange: (columns: KineticaEntityColumn[]) => void;
}

/**
 * Row editor for Kinetica `RecordObject` `@RecordObject.Column` fields.
 */
export const KineticaEntityColumnsEditor: React.FC<KineticaEntityColumnsEditorProps> = ({
  idPrefix,
  columns,
  onColumnsChange,
}) => {
  const { listError, rowErrors } = validateEntityColumns(columns);

  const handleRowChange = (index: number, field: keyof KineticaEntityColumn, value: string) => {
    const next = columns.map((col, idx) => (idx === index ? { ...col, [field]: value } : col));
    onColumnsChange(next);
  };

  const handleAddColumn = () => {
    onColumnsChange([...columns, { name: '', javaType: 'String', columnProperties: '' }]);
  };

  const handleRemoveColumn = (index: number) => {
    onColumnsChange(columns.filter((_, idx) => idx !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <label className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Entity Columns</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Public fields of the entity POJO, each annotated @RecordObject.Column(order = row position, properties = {...}). The field name is used as the Kinetica column name and must match the table's column names." />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        {columns.map((col, index) => {
          const rowError = rowErrors[index];
          const isRowInvalid = Boolean(rowError);
          return (
            <div
              key={index}
              className={`flex flex-col gap-2 bg-slate-800/40 p-2 rounded border ${
                isRowInvalid ? 'border-red-500/80' : 'border-slate-700/50'
              }`}
            >
              <div className="grid grid-cols-12 gap-2 items-center">
                <input
                  id={`${idPrefix}Col${index}Name`}
                  type="text"
                  aria-label={`Column name ${index + 1}`}
                  aria-required="true"
                  aria-invalid={isRowInvalid}
                  value={col.name}
                  onChange={(e) => handleRowChange(index, 'name', e.target.value)}
                  placeholder="name"
                  className={`col-span-4 bg-[#252836] text-white p-2 rounded border text-sm font-mono focus:outline-none ${
                    isRowInvalid
                      ? 'border-red-500/80 focus:border-red-500'
                      : 'border-slate-700 focus:border-blue-500'
                  }`}
                />
                <select
                  id={`${idPrefix}Col${index}Type`}
                  aria-label={`Java type ${index + 1}`}
                  value={col.javaType}
                  onChange={(e) => handleRowChange(index, 'javaType', e.target.value)}
                  className="col-span-3 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
                >
                  {KINETICA_JAVA_TYPES.map((jt) => (
                    <option key={jt} value={jt}>
                      {jt}
                    </option>
                  ))}
                </select>
                <input
                  id={`${idPrefix}Col${index}Props`}
                  type="text"
                  aria-label={`Column properties ${index + 1}`}
                  value={col.columnProperties}
                  onChange={(e) => handleRowChange(index, 'columnProperties', e.target.value)}
                  placeholder="char32, primary_key"
                  className="col-span-4 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  aria-label={`Remove column ${index + 1}`}
                  title={`Remove column ${index + 1}`}
                  onClick={() => handleRemoveColumn(index)}
                  className="col-span-1 text-red-400 hover:text-red-300 hover:bg-red-950/30 p-1.5 rounded transition-all flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {rowError && (
                <span className="text-xs text-red-400" role="alert">
                  {rowError}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {listError && (
        <span className="text-xs text-red-400" role="alert">
          {listError}
        </span>
      )}

      <button
        type="button"
        onClick={handleAddColumn}
        className="flex items-center justify-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors font-semibold w-full mt-1"
      >
        <Plus className="w-3.5 h-3.5" /> Add Column
      </button>
    </div>
  );
};

export interface KineticaDBNodeData {
  properties?: {
    headNodeURL?: string;
    username?: string;
    passwordSecret?: string;
    table?: string;
    entityClassName?: string;
    entityColumns?: KineticaEntityColumn[];
    system_instructions?: string;
    special_instructions?: string;
    [key: string]: unknown;
  };
  system_instructions?: string;
  special_instructions?: string;
  [key: string]: unknown;
}

export interface KineticaDBSourcePropertiesProps {
  node: {
    data: KineticaDBNodeData;
  };
  onChange: (properties: Record<string, unknown>) => void;
}

export const KineticaDBSourceProperties: React.FC<KineticaDBSourcePropertiesProps> = ({
  node,
  onChange,
}) => {
  const properties = node.data.properties || {};

  const headNodeURL = String(properties.headNodeURL ?? '');
  const username = String(properties.username ?? '');
  const passwordSecret = String(properties.passwordSecret ?? '');
  const table = String(properties.table ?? '');
  const entityClassName = String(properties.entityClassName ?? '');
  const entityColumns: KineticaEntityColumn[] = Array.isArray(properties.entityColumns)
    ? properties.entityColumns
    : [];

  const systemInstructions = String(
    node.data.system_instructions ??
      node.data.special_instructions ??
      properties.system_instructions ??
      properties.special_instructions ??
      ''
  );

  const headNodeUrlError = validateHeadNodeUrl(headNodeURL);
  const usernameError = !username.trim() ? 'Username is required.' : null;
  const passwordSecretError = !passwordSecret.trim() ? 'Password secret is required.' : null;
  const tableError = !table.trim() ? 'Table is required.' : null;
  const entityClassError = validateEntityClassName(entityClassName);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    onChange({
      ...properties,
      [name]: value,
    });
  };

  const handleColumnsChange = (nextColumns: KineticaEntityColumn[]) => {
    onChange({
      ...properties,
      entityColumns: nextColumns,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header Docs Link */}
      <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-800/40 px-2.5 py-1.5 rounded border border-slate-700/50">
        <span>
          Transform: <code className="text-slate-300">KineticaIO.read()</code>
        </span>
        <button
          type="button"
          aria-label="Open KineticaIO documentation"
          onClick={openKineticaDocs}
          className="text-blue-400 hover:text-blue-300 font-semibold"
        >
          Docs ↗
        </button>
      </div>

      {/* Section 1: Connection */}
      <div className="flex flex-col gap-3">
        <div className="text-xs font-bold uppercase text-slate-400 border-b border-slate-700/60 pb-1">
          Connection
        </div>

        <PropertyField
          id="kineticaSourceHeadNodeUrl"
          name="headNodeURL"
          label="Head Node URL"
          required
          tooltip="Network address of the Kinetica head node (KineticaIO.read().withHeadNodeURL). A single URL or a comma-separated list of full URLs for HA clusters, e.g. http://127.0.0.1:9191."
          value={headNodeURL}
          error={headNodeUrlError}
          invalid={Boolean(headNodeUrlError)}
          onChange={handleChange}
          placeholder="http://127.0.0.1:9191"
          helperText={
            <span>
              Sample:{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                http://kinetica-host:9191
              </code>
            </span>
          }
        />

        <PropertyField
          id="kineticaSourceUsername"
          name="username"
          label="Username"
          required
          tooltip="Kinetica user used for authentication (withUsername). Read permission on the table is required."
          value={username}
          error={usernameError}
          invalid={Boolean(usernameError)}
          onChange={handleChange}
          placeholder="admin"
          mono={false}
        />

        <SecretManagerSecretField
          id="kineticaSourcePasswordSecret"
          name="passwordSecret"
          label="Password Secret"
          required
          tooltip="Secret Manager secret holding the Kinetica password. Generated code resolves it at pipeline construction via Secret Manager and passes it to withPassword(); no plaintext password is stored in the pipeline."
          value={passwordSecret}
          error={passwordSecretError}
          invalid={Boolean(passwordSecretError)}
          onChange={handleChange}
          placeholder="e.g. kinetica-password"
        />
      </div>

      {/* Section 2: Table */}
      <div className="flex flex-col gap-3">
        <div className="text-xs font-bold uppercase text-slate-400 border-b border-slate-700/60 pb-1">
          Table
        </div>

        <PropertyField
          id="kineticaSourceTable"
          name="table"
          label="Table"
          required
          tooltip="Kinetica table or view to read, in [schema_name.]table_name format (withTable). The connector reads the whole table in one request; filter downstream."
          value={table}
          error={tableError}
          invalid={Boolean(tableError)}
          onChange={handleChange}
          placeholder="ki_home.scientists"
        />
      </div>

      {/* Section 3: Entity (RecordObject POJO) */}
      <div className="flex flex-col gap-3">
        <div className="text-xs font-bold uppercase text-slate-400 border-b border-slate-700/60 pb-1">
          Entity (RecordObject POJO)
        </div>

        <PropertyField
          id="kineticaSourceEntityClassName"
          name="entityClassName"
          label="Entity Class Name"
          required
          tooltip="Name of the generated public static POJO that extends com.gpudb.RecordObject and is passed to withEntity(Entity.class). Codegen adds a public no-arg constructor, equals/hashCode, and SerializableCoder.of(Entity.class) for withCoder()."
          value={entityClassName}
          error={entityClassError}
          invalid={Boolean(entityClassError)}
          onChange={handleChange}
          placeholder="KineticaRecord"
        />

        <KineticaEntityColumnsEditor
          idPrefix="kineticaSource"
          columns={entityColumns}
          onColumnsChange={handleColumnsChange}
        />
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="kineticaSourceSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleChange}
          placeholder="Enter custom instructions for KineticaDB source code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
