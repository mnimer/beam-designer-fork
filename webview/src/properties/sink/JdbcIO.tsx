/**
 * JdbcIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property panel for Apache Beam JdbcIO Database Sink nodes.
 * Supports both Java native JdbcIO (write / writeVoid)
 * and Python Cross-Language API (WriteToJdbc).
 * 
 * Architectural Decisions:
 * - In Apache Beam, a JDBC write requires a driverClassName, connection url, and either a parameterized statement or tableName.
 * - Enforces required field indicators, error messages, aria attributes, and red border highlights on validation failure.
 * - Reuses driver presets and dynamic JDBC URL example generator from source/JdbcIO.
 * - Integrates InfoTooltip components for database sink properties.
 * - Supports authentication mode selection: Google Cloud Secret Manager (passwordSecret) or Plaintext password (with cleartext warning).
 * - Resolves initial authentication mode with backward compatibility for legacy saved pipelines.
 * - Includes a flexible spacer and "Code Generation Instructions" textarea at the bottom for LLM code generation prompt overrides.
 */

import React from 'react';
import { JDBC_DRIVER_PRESETS, getJdbcUrlExample } from '../source/JdbcIO';
import type { JdbcAuthMode } from '../source/JdbcIO';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

interface JdbcIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      driverClassName?: string;
      url?: string;
      authMode?: JdbcAuthMode;
      username?: string;
      password?: string;
      passwordSecret?: string;
      connectionProperties?: string;
      driverJars?: string;
      statement?: string;
      tableName?: string;
      selectType?: 'statement' | 'table';
      batchSize?: string | number;
      autosharding?: boolean;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

interface JdbcIOSinkPropertiesProps {
  node: JdbcIOSinkNode;
  onChange: (properties: any) => void;
}

export const JdbcIOSinkProperties: React.FC<JdbcIOSinkPropertiesProps> = ({ node, onChange }) => {
  // Extract existing properties or fallback to empty object
  const properties = node.data.properties || {};

  // NOTE: Request Secret Manager secrets via useAssetLoader
  const { items: secrets, error: secretError, loading: secretsLoading } = useAssetLoader<SecretItem | string>('secrets');

  const driverClassName = properties.driverClassName || 'org.postgresql.Driver';
  const url = properties.url || '';
  const username = properties.username || '';
  const passwordSecret = properties.passwordSecret || '';
  const connectionProperties = properties.connectionProperties || '';
  const statement = properties.statement || '';
  const tableName = properties.tableName || '';
  const selectType = properties.selectType || (properties.tableName && !properties.statement ? 'table' : 'statement');
  const batchSize = properties.batchSize ?? '1000';
  const autosharding = properties.autosharding ?? false;

  const normalizedSecrets = (secrets || []).map(normalizeSecretItem);

  // Validation states
  const isDriverInvalid = !driverClassName.trim();
  const isUrlInvalid = !url.trim();
  const isStatementInvalid = selectType === 'statement' && !statement.trim();
  const isTableNameInvalid = selectType === 'table' && !tableName.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const exampleUrl = getJdbcUrlExample(driverClassName);

  /**
   * Handles generic text/checkbox input changes.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    const newProperties = {
      ...properties,
      [name]: isCheckbox ? checked : value
    };

    // Ensure plaintext password is removed if present
    delete newProperties.password;

    if (name === 'passwordSecret') {
      if (!newProperties.passwordSecret) {
        delete newProperties.passwordSecret;
      }
    }

    if (name === 'selectType') {
      if (value === 'table') {
        delete newProperties.statement;
      } else if (value === 'statement') {
        delete newProperties.tableName;
      }
    }

    onChange(newProperties);
  };

  /**
   * Handles instructions textarea change
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newInstructions = e.target.value;
    onChange({
      ...properties,
      system_instructions: newInstructions
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Driver Class Name with friendly labels */}
      <div className="flex flex-col gap-2">
        <label htmlFor="jdbcSinkDriverClassName" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Driver Class Name</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Fully qualified Java JDBC driver class name (e.g. org.postgresql.Driver or com.mysql.cj.jdbc.Driver). Required." />
        </label>
        <select
          id="jdbcSinkDriverClassName"
          name="driverClassName"
          aria-required="true"
          aria-invalid={isDriverInvalid}
          value={driverClassName}
          onChange={handleChange}
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
            isDriverInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        >
          {JDBC_DRIVER_PRESETS.map((preset) => (
            <option key={preset.driverClass} value={preset.driverClass}>
              {preset.label}
            </option>
          ))}
        </select>
        {isDriverInvalid && (
          <span className="text-xs text-red-400">Driver class name is required.</span>
        )}
      </div>

      {/* JDBC Connection URL with dynamic example */}
      <div className="flex flex-col gap-2">
        <label htmlFor="jdbcSinkUrl" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>JDBC Connection URL</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="JDBC database connection URL including host, port, and database name. Required." />
        </label>
        <input
          id="jdbcSinkUrl"
          type="text"
          name="url"
          aria-required="true"
          aria-invalid={isUrlInvalid}
          value={url}
          onChange={handleChange}
          placeholder={exampleUrl}
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isUrlInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        {isUrlInvalid ? (
          <span className="text-xs text-red-400">JDBC Connection URL is required.</span>
        ) : (
          <span className="text-xs text-slate-400">
            Example: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">{exampleUrl}</code>
          </span>
        )}
      </div>

      {/* Credentials */}
      <div className="flex flex-col gap-3">
        <PropertyField
          id="jdbcSinkUsername"
          name="username"
          label="Username Secret"
          tooltip="Select or enter the Google Cloud Secret Manager secret containing the database username."
          value={username}
          onChange={handleChange}
          placeholder="e.g. my-database-username"
          list="jdbc-sink-username-secrets-list"
          datalist={normalizedSecrets.map((s) => ({ value: s.id, label: s.name }))}
          loading={secretsLoading}
          mono={true}
        />

        <PropertyField
          id="jdbcSinkPasswordSecret"
          name="passwordSecret"
          label="Password Secret"
          tooltip="Select or enter the Google Cloud Secret Manager secret containing the database password."
          value={passwordSecret}
          onChange={handleChange}
          placeholder="e.g. my-database-password"
          list="jdbc-sink-secrets-list"
          datalist={normalizedSecrets.map((s) => ({ value: s.id, label: s.name }))}
          error={secretError}
          loading={secretsLoading}
          helperText={
            <span>
              Values auto-populated from{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                gcloud secrets list
              </code>
            </span>
          }
        />
      </div>

      {/* Connection Properties */}
      <div className="flex flex-col gap-2">
        <label htmlFor="jdbcSinkConnectionProperties" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Connection Properties</span>
          <InfoTooltip text="Optional key-value connection properties passed to JDBC driver (e.g. useSSL=false;socketTimeout=30)." />
        </label>
        <input
          id="jdbcSinkConnectionProperties"
          type="text"
          name="connectionProperties"
          value={connectionProperties}
          onChange={handleChange}
          placeholder="useSSL=false;allowPublicKeyRetrieval=true"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Select Type (SQL Statement or Table Name) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="jdbcSinkSelectType" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Select Type</span>
          <InfoTooltip text="Choose whether to write using a custom parameterized SQL INSERT statement or a target table name." />
        </label>
        <select
          id="jdbcSinkSelectType"
          name="selectType"
          value={selectType}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="statement">SQL Statement</option>
          <option value="table">Table Name</option>
        </select>
      </div>

      {/* Conditional SQL Statement or Table Name Field */}
      {selectType === 'statement' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="jdbcSinkStatement" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>SQL Statement</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip text="Parameterized SQL statement for inserting or updating rows (e.g. INSERT INTO my_table (id, name) VALUES (?, ?)). Required." />
          </label>
          <textarea
            id="jdbcSinkStatement"
            name="statement"
            aria-required="true"
            aria-invalid={isStatementInvalid}
            value={statement}
            onChange={handleChange}
            placeholder="INSERT INTO my_table (id, name, created_at) VALUES (?, ?, ?)"
            rows={3}
            className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono resize-y ${
              isStatementInvalid
                ? 'border-red-500/80 focus:border-red-500'
                : 'border-slate-700 focus:border-blue-500'
            }`}
          />
          {isStatementInvalid && (
            <span className="text-xs text-red-400">SQL Statement is required.</span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="jdbcSinkTableName" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Table Name</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip text="Destination database table name to insert rows into. Required." />
          </label>
          <input
            id="jdbcSinkTableName"
            type="text"
            name="tableName"
            aria-required="true"
            aria-invalid={isTableNameInvalid}
            value={tableName}
            onChange={handleChange}
            placeholder="my_table"
            className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
              isTableNameInvalid
                ? 'border-red-500/80 focus:border-red-500'
                : 'border-slate-700 focus:border-blue-500'
            }`}
          />
          {isTableNameInvalid && (
            <span className="text-xs text-red-400">Table Name is required.</span>
          )}
        </div>
      )}

      {/* Batch Size */}
      <div className="flex flex-col gap-2">
        <label htmlFor="jdbcSinkBatchSize" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Batch Size</span>
          <InfoTooltip text="Maximum number of statements per batch in JDBC executeBatch()." />
        </label>
        <input
          id="jdbcSinkBatchSize"
          type="number"
          name="batchSize"
          min="1"
          value={batchSize}
          onChange={handleChange}
          placeholder="1000"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Auto Sharding */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="jdbcSinkAutosharding" className="flex items-center gap-2 cursor-pointer">
          <input
            id="jdbcSinkAutosharding"
            type="checkbox"
            name="autosharding"
            checked={autosharding}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Auto Sharding</span>
          <InfoTooltip text="Enables Beam runner to dynamically adjust write sharding and parallelism." />
        </label>
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions Section at Bottom */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="jdbcSinkSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="jdbcSinkSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for JDBC write code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
