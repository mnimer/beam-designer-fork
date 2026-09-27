/**
 * KineticaDB Sink Properties Component (IO70)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for the KineticaDB Sink (writer) node
 * (`KineticaIO.write()`) in Apache Beam Java pipelines
 * (`com.kinetica:apache-beam-kineticaio:7.2.0.0`).
 *
 * Architectural Decisions:
 * - Exposes only options documented in `com.kinetica.beam.io.KineticaIO.Write` and
 *   `com.gpudb.RecordObject`: `headNodeURL`, `username`, `passwordSecret`, `table`,
 *   and the declarative RecordObject POJO specification (`entityClassName`, `entityColumns`).
 * - Credentials (`withPassword`) use exclusively `SecretManagerSecretField` (`passwordSecret`,
 *   discovered via `gcloud secrets list`); no plaintext password input is offered (R3/D3).
 * - Reuses validation helpers and `KineticaEntityColumnsEditor` from `../source/KineticaDB`.
 * - Omitted upstream options: `withKineticaService` (programmatic test hook), writer
 *   `batchSize` (100000) and `flushTimerFrequency` (3000 ms) (`private final static` in
 *   `KineticaServiceImpl`, not configurable), and automatic table creation (not performed by
 *   `KineticaIO.write()`; target table must already exist).
 */

import React from 'react';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';
import {
  KINETICA_DOC_URL,
  KineticaEntityColumnsEditor,
} from '../source/KineticaDB';
import type { KineticaDBNodeData, KineticaEntityColumn } from '../source/KineticaDB';

function openKineticaDocs(): void {
  const vscodeApi = (window as unknown as { vscode?: { postMessage: (msg: unknown) => void } }).vscode;
  if (vscodeApi) {
    vscodeApi.postMessage({ command: 'openExternal', url: KINETICA_DOC_URL });
  }
}

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

export interface KineticaDBSinkPropertiesProps {
  node: {
    data: KineticaDBNodeData;
  };
  onChange: (properties: Record<string, unknown>) => void;
}

export const KineticaDBSinkProperties: React.FC<KineticaDBSinkPropertiesProps> = ({
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
          Transform: <code className="text-slate-300">KineticaIO.write()</code>
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
          id="kineticaSinkHeadNodeUrl"
          name="headNodeURL"
          label="Head Node URL"
          required
          tooltip="Network address of the Kinetica head node (KineticaIO.write().withHeadNodeURL). A single URL or a comma-separated list of full URLs for HA clusters, e.g. http://127.0.0.1:9191."
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
          id="kineticaSinkUsername"
          name="username"
          label="Username"
          required
          tooltip="Kinetica user used for authentication (withUsername). Write permission on the table is required."
          value={username}
          error={usernameError}
          invalid={Boolean(usernameError)}
          onChange={handleChange}
          placeholder="admin"
          mono={false}
        />

        <SecretManagerSecretField
          id="kineticaSinkPasswordSecret"
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
          id="kineticaSinkTable"
          name="table"
          label="Table"
          required
          tooltip="Existing Kinetica table to insert into, in [schema_name.]table_name format (withTable). The connector does NOT create the table; its columns must match the entity below."
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
          id="kineticaSinkEntityClassName"
          name="entityClassName"
          label="Entity Class Name"
          required
          tooltip="Name of the generated public static POJO that extends com.gpudb.RecordObject and is passed to withEntity(Entity.class). Codegen adds a public no-arg constructor and equals/hashCode."
          value={entityClassName}
          error={entityClassError}
          invalid={Boolean(entityClassError)}
          onChange={handleChange}
          placeholder="KineticaRecord"
        />

        <KineticaEntityColumnsEditor
          idPrefix="kineticaSink"
          columns={entityColumns}
          onColumnsChange={handleColumnsChange}
        />
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="kineticaSinkSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleChange}
          placeholder="Enter custom instructions for KineticaDB sink code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
