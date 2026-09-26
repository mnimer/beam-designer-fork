/**
 * Reusable Multi-Tab Schema Editor Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders a 3-tab schema editor (Field Builder, JSON Schema, Schema String)
 * shared across BigQueryIO and dynamic-code-generation connectors (SingleStoreDBIO,
 * CassandraIO, ClickHouseIO, Neo4jIO, HadoopFormatIO).
 *
 * Tabs:
 * 1. Field Builder: Interactive list with Field Name, Type, Required checkbox, reorder, and delete.
 * 2. JSON Schema: Direct JSON array editor ([{ "name", "type", "mode", "description" }]).
 * 3. Schema String: Compact comma-separated schema string editor (e.g. name:STRING, age:INTEGER:REQUIRED).
 */

import React, { useState, useEffect } from 'react';
import { List, FileCode, Code, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

export interface SchemaField {
  name: string;
  type: string;
  mode: 'NULLABLE' | 'REQUIRED' | 'REPEATED';
  description?: string;
}

export type BigQueryField = SchemaField;

export const BIGQUERY_TYPES = [
  'STRING',
  'INTEGER',
  'FLOAT',
  'BOOLEAN',
  'TIMESTAMP',
  'DATE',
  'DATETIME',
  'TIME',
  'BYTES',
  'NUMERIC',
  'BIGNUMERIC',
  'JSON',
  'RECORD'
] as const;

export const BEAM_SCHEMA_TYPES = [
  'STRING',
  'INTEGER',
  'BIGINT',
  'FLOAT',
  'DOUBLE',
  'BOOLEAN',
  'TIMESTAMP',
  'DATE',
  'DATETIME',
  'TIME',
  'BYTES',
  'DECIMAL',
  'VARCHAR',
  'JSON',
  'RECORD'
] as const;

export interface SchemaEditorProps {
  fields?: SchemaField[];
  types?: readonly string[];
  schemaTitle?: string;
  stringTitle?: string;
  stringPlaceholder?: string;
  jsonTextareaId?: string;
  stringTextareaId?: string;
  onChange: (data: {
    schemaFields: SchemaField[];
    schema: string;
    schemaString: string;
  }) => void;
}

/**
 * Serializes fields to standard TableSchema JSON array.
 */
export function fieldsToJson(fields: SchemaField[]): string {
  const schemaList = fields.map(f => {
    const item: Record<string, any> = {
      name: f.name || '',
      type: f.type || 'STRING',
      mode: f.mode || 'NULLABLE'
    };
    if (f.description?.trim()) {
      item.description = f.description.trim();
    }
    return item;
  });
  return JSON.stringify(schemaList, null, 2);
}

/**
 * Serializes fields to compact comma-separated string (name:TYPE[:MODE]).
 */
export function fieldsToString(fields: SchemaField[]): string {
  return fields
    .filter(f => f.name.trim())
    .map(f => {
      const modeSuffix = f.mode === 'REQUIRED' ? ':REQUIRED' : f.mode === 'REPEATED' ? ':REPEATED' : '';
      return `${f.name.trim()}:${f.type || 'STRING'}${modeSuffix}`;
    })
    .join(', ');
}

/**
 * Parses JSON string into SchemaField array.
 */
export function jsonToFields(jsonStr: string): SchemaField[] | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item: any) => ({
      name: String(item.name || ''),
      type: (item.type || 'STRING').toUpperCase(),
      mode: item.mode === 'REQUIRED' ? 'REQUIRED' : item.mode === 'REPEATED' ? 'REPEATED' : 'NULLABLE',
      description: item.description ? String(item.description) : ''
    }));
  } catch {
    return null;
  }
}

/**
 * Parses comma-separated schema string into SchemaField array.
 */
export function stringToFields(str: string): SchemaField[] {
  if (!str.trim()) return [];
  const tokens = str.split(',');
  return tokens
    .map(tok => tok.trim())
    .filter(Boolean)
    .map(token => {
      const parts = token.split(':').map(p => p.trim());
      const name = parts[0] || '';
      const rawType = (parts[1] || 'STRING').toUpperCase();
      const rawMode = parts[2] ? parts[2].toUpperCase() : 'NULLABLE';
      const mode = rawMode === 'REQUIRED' ? 'REQUIRED' : rawMode === 'REPEATED' ? 'REPEATED' : 'NULLABLE';
      return {
        name,
        type: rawType,
        mode,
        description: ''
      };
    });
}

/**
 * Resolves SchemaField[] from node properties supporting schemaFields, schema (JSON), or schemaString.
 */
export function resolveSchemaFields(properties: Record<string, any>): SchemaField[] {
  if (Array.isArray(properties.schemaFields)) {
    return properties.schemaFields;
  }
  if (typeof properties.schema === 'string' && properties.schema.trim()) {
    const parsed = jsonToFields(properties.schema);
    if (parsed) return parsed;
  }
  if (typeof properties.schemaString === 'string' && properties.schemaString.trim()) {
    return stringToFields(properties.schemaString);
  }
  return [];
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  fields = [],
  types = BIGQUERY_TYPES,
  schemaTitle = 'BigQuery TableSchema Specification',
  stringTitle = 'BigQuery Schema String',
  stringPlaceholder = 'e.g. id:STRING:REQUIRED, name:STRING, age:INTEGER, created_at:TIMESTAMP',
  jsonTextareaId = 'bigQuerySchemaJsonTextarea',
  stringTextareaId = 'bigQuerySchemaStringTextarea',
  onChange
}) => {
  const [activeTab, setActiveTab] = useState<'builder' | 'json' | 'string'>('builder');
  const [jsonText, setJsonText] = useState(() => fieldsToJson(fields));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [stringText, setStringText] = useState(() => fieldsToString(fields));

  // Sync internal text representations when incoming fields change
  useEffect(() => {
    setJsonText(fieldsToJson(fields));
    setStringText(fieldsToString(fields));
    setJsonError(null);
  }, [fields]);

  const emitChange = (newFields: SchemaField[]) => {
    const json = fieldsToJson(newFields);
    const str = fieldsToString(newFields);
    setJsonText(json);
    setStringText(str);
    setJsonError(null);
    onChange({
      schemaFields: newFields,
      schema: json,
      schemaString: str
    });
  };

  // Field Builder handlers
  const handleAddField = () => {
    const newFields: SchemaField[] = [
      ...fields,
      { name: '', type: types[0] || 'STRING', mode: 'NULLABLE', description: '' }
    ];
    emitChange(newFields);
  };

  const handleUpdateField = (index: number, patch: Partial<SchemaField>) => {
    const updated = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    emitChange(updated);
  };

  const handleDeleteField = (index: number) => {
    const updated = fields.filter((_, i) => i !== index);
    emitChange(updated);
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const copy = [...fields];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    emitChange(copy);
  };

  // JSON Tab handler
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);
    const parsed = jsonToFields(text);
    if (parsed !== null) {
      setJsonError(null);
      const str = fieldsToString(parsed);
      setStringText(str);
      onChange({
        schemaFields: parsed,
        schema: text,
        schemaString: str
      });
    } else {
      setJsonError('Invalid JSON array format. Must be an array of { "name", "type", "mode" } objects.');
    }
  };

  // String Tab handler
  const handleStringChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setStringText(text);
    const parsed = stringToFields(text);
    const json = fieldsToJson(parsed);
    setJsonText(json);
    setJsonError(null);
    onChange({
      schemaFields: parsed,
      schema: json,
      schemaString: text
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs Row */}
      <div className="flex items-center gap-1 p-1 bg-[#1a1d29] rounded border border-slate-700/80">
        <button
          type="button"
          onClick={() => setActiveTab('builder')}
          aria-label="Field Builder Tab"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            activeTab === 'builder'
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/70 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <List size={13} />
          <span>Field Builder ({fields.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('json')}
          aria-label="JSON Schema Tab"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            activeTab === 'json'
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/70 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <FileCode size={13} />
          <span>JSON Schema</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('string')}
          aria-label="Schema String Tab"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            activeTab === 'string'
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/70 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Code size={13} />
          <span>Schema String</span>
        </button>
      </div>

      {/* Tab 1: Field Builder */}
      {activeTab === 'builder' && (
        <div className="flex flex-col gap-2">
          {fields.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 bg-[#1e2230]/40 rounded border border-slate-700/50">
              No schema fields defined yet. Click &quot;Add Schema Field&quot; below to configure the table schema.
            </div>
          ) : (
            fields.map((field, idx) => {
              const effectiveTypes =
                field.type && !types.includes(field.type)
                  ? [field.type, ...types]
                  : types;
              return (
                <div
                  key={idx}
                  className="bg-[#1e2230] border border-slate-700/70 rounded-md p-2.5 flex flex-col gap-2"
                >
                  {/* Field Controls Row */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500 w-5 text-right font-bold">
                      #{idx + 1}
                    </span>

                    {/* Field Name */}
                    <input
                      type="text"
                      value={field.name}
                      aria-label={`Field #${idx + 1} Name`}
                      placeholder="field_name"
                      onChange={(e) => handleUpdateField(idx, { name: e.target.value })}
                      className="flex-1 min-w-0 bg-[#252836] text-white px-2 py-1 rounded border border-slate-700 text-xs font-mono focus:outline-none focus:border-blue-500"
                    />

                    {/* Field Type Select */}
                    <select
                      value={field.type}
                      aria-label={`Field #${idx + 1} Type`}
                      onChange={(e) => handleUpdateField(idx, { type: e.target.value })}
                      className="bg-[#252836] text-white px-2 py-1 rounded border border-slate-700 text-xs font-mono focus:outline-none focus:border-blue-500"
                    >
                      {effectiveTypes.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>

                    {/* Required Checkbox (Default Off) */}
                    <label
                      htmlFor={`field-req-${idx}`}
                      title="Toggle Required Mode (REQUIRED vs NULLABLE)"
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold cursor-pointer border select-none transition-colors ${
                        field.mode === 'REQUIRED'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
                      }`}
                    >
                      <input
                        id={`field-req-${idx}`}
                        type="checkbox"
                        aria-label={`Field #${idx + 1} Required`}
                        checked={field.mode === 'REQUIRED'}
                        onChange={(e) =>
                          handleUpdateField(idx, {
                            mode: e.target.checked ? 'REQUIRED' : 'NULLABLE'
                          })
                        }
                        className="w-3.5 h-3.5 rounded border-slate-700 text-rose-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
                      />
                      <span>Req</span>
                    </label>

                    {/* Reorder / Delete Actions */}
                    <div className="flex items-center gap-0.5 ml-auto">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveField(idx, 'up')}
                        aria-label={`Move Field #${idx + 1} Up`}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Move Up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === fields.length - 1}
                        onClick={() => handleMoveField(idx, 'down')}
                        aria-label={`Move Field #${idx + 1} Down`}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Move Down"
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteField(idx)}
                        aria-label={`Delete Field #${idx + 1}`}
                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 ml-1 transition-colors"
                        title="Delete Field"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Field Description Directive */}
                  <input
                    type="text"
                    value={field.description || ''}
                    aria-label={`Field #${idx + 1} Description`}
                    placeholder="Field description directive for LLM..."
                    onChange={(e) => handleUpdateField(idx, { description: e.target.value })}
                    className="bg-[#252836]/70 text-slate-300 px-2.5 py-1 rounded border border-slate-700/60 text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              );
            })
          )}

          {/* Add Field Button */}
          <button
            type="button"
            onClick={handleAddField}
            className="w-full py-2 border border-dashed border-purple-500/40 hover:border-purple-400 hover:bg-purple-900/20 text-purple-300 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus size={14} />
            <span>Add Schema Field</span>
          </button>
        </div>
      )}

      {/* Tab 2: JSON Schema */}
      {activeTab === 'json' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{schemaTitle}</span>
            <span className="font-mono text-purple-300 text-[11px]">JSON Array</span>
          </div>
          <textarea
            id={jsonTextareaId}
            value={jsonText}
            onChange={handleJsonChange}
            rows={8}
            placeholder={`[\n  {\n    "name": "id",\n    "type": "STRING",\n    "mode": "REQUIRED"\n  }\n]`}
            className="w-full bg-[#181b26] text-emerald-400 p-2.5 rounded border border-slate-700 font-mono text-xs focus:outline-none focus:border-purple-500 resize-y"
          />
          {jsonError && (
            <p className="text-red-400 text-xs mt-0.5" role="alert">
              {jsonError}
            </p>
          )}
        </div>
      )}

      {/* Tab 3: Schema String */}
      {activeTab === 'string' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{stringTitle}</span>
            <span className="font-mono text-purple-300 text-[11px]">name:TYPE[:MODE]</span>
          </div>
          <textarea
            id={stringTextareaId}
            value={stringText}
            onChange={handleStringChange}
            rows={4}
            placeholder={stringPlaceholder}
            className="w-full bg-[#181b26] text-blue-300 p-2.5 rounded border border-slate-700 font-mono text-xs focus:outline-none focus:border-purple-500 resize-y"
          />
          <p className="text-[11px] text-slate-400">
            Comma-separated format: <code className="text-purple-300">field_name:TYPE[:MODE]</code>. Mode defaults to NULLABLE if omitted.
          </p>
        </div>
      )}
    </div>
  );
};

export const BigQuerySchemaEditor = SchemaEditor;
export type BigQuerySchemaEditorProps = SchemaEditorProps;
