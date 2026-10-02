/**
 * HadoopFormatIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam HadoopFormatIO Read Source nodes
 * (org.apache.beam.sdk.io.hadoop.format.HadoopFormatIO.read() in Java / cross-language expansion service in Python).
 * Configures Hadoop InputFormat class name, Key class, Value class, input location,
 * key/value translation functions, cloning bypass toggles, additional Hadoop Configuration key=value pairs,
 * authentication (Simple, Kerberos, or Secret Manager), and site-XML path overrides.
 *
 * Architectural Decisions:
 * - Real-time validation: Requires InputFormat Class, Key Class, and Value Class with visual cues and ARIA attributes.
 * - Configuration-driven model: Centered around Hadoop Configuration properties (mapreduce.job.inputformat.class,
 *   key.class, value.class, etc.) passed via HadoopFormatIO.read().withConfiguration(conf).
 * - Real builder methods: Supports withKeyTranslation, withValueTranslation, withSkipKeyClone, and withSkipValueClone.
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to populate
 *   the 'hadoopformat-source-secret-options' datalist for Kerberos keytabs and credential binding.
 * - Decomposed into local presentational sub-components adhering to "props in, events up" with semantic callbacks (onToggle).
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Strictly follows the 8pt grid system and Tailwind CSS styling using VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { MappingStrategyField, type MappingStrategy } from '../../components/common/MappingStrategyField';
import { resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

/** Secret descriptor loaded from the secret manager for HadoopFormatIO authentication. */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type HadoopAuthMode = 'simple' | 'kerberos' | 'secret_manager';

/** Props for the {@link HadoopFormatIOSourceProperties} component. */
export interface HadoopFormatIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        inputFormatClass?: string;
        keyClass?: string;
        valueClass?: string;
        inputLocation?: string;
        translationStrategy?: MappingStrategy | string;
        schema?: string;
        schemaString?: string;
        schemaFields?: SchemaField[];
        keyTranslationFn?: string;
        valueTranslationFn?: string;
        skipKeyClone?: boolean;
        skipValueClone?: boolean;
        extraConfig?: string;
        authMode?: HadoopAuthMode | string;
        kerberosPrincipal?: string;
        keytabSecret?: string;
        secretName?: string;
        coreSitePath?: string;
        hdfsSitePath?: string;
        splitSizeHint?: number | string;
        defaultFs?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/** Props for the Hadoop input format and key/value class configuration section. */
interface SourceFormatSectionProps {
  inputFormatClass: string;
  keyClass: string;
  valueClass: string;
  inputLocation: string;
  isFormatEmpty: boolean;
  isKeyEmpty: boolean;
  isValueEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for required Hadoop InputFormat and Key/Value types.
 */
const SourceFormatSection: React.FC<SourceFormatSectionProps> = ({
  inputFormatClass,
  keyClass,
  valueClass,
  inputLocation,
  isFormatEmpty,
  isKeyEmpty,
  isValueEmpty,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Hadoop InputFormat Configuration</span>
        <InfoTooltip text="Configures the Hadoop InputFormat class and data types passed into Hadoop Configuration." />
      </label>

      <PropertyField
        id="hadoop-source-input-format"
        name="inputFormatClass"
        label="InputFormat Class"
        tooltip="Fully qualified class name of the Hadoop InputFormat (maps to mapreduce.job.inputformat.class, e.g. org.apache.hadoop.mapreduce.lib.input.TextInputFormat or org.apache.hadoop.hbase.mapreduce.TableInputFormat)."
        value={inputFormatClass}
        onChange={onChange}
        placeholder="org.apache.hadoop.mapreduce.lib.input.TextInputFormat"
        required="InputFormat Class is required"
        invalid={isFormatEmpty}
        error={isFormatEmpty ? 'InputFormat Class is required' : null}
      />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="hadoop-source-key-class"
          name="keyClass"
          label="Key Class"
          tooltip="Fully qualified class name of the input record key (maps to key.class, e.g. org.apache.hadoop.io.LongWritable)."
          value={keyClass}
          onChange={onChange}
          placeholder="org.apache.hadoop.io.LongWritable"
          required="Key Class is required"
          invalid={isKeyEmpty}
          error={isKeyEmpty ? 'Key Class is required' : null}
        />
        <PropertyField
          id="hadoop-source-value-class"
          name="valueClass"
          label="Value Class"
          tooltip="Fully qualified class name of the input record value (maps to value.class, e.g. org.apache.hadoop.io.Text)."
          value={valueClass}
          onChange={onChange}
          placeholder="org.apache.hadoop.io.Text"
          required="Value Class is required"
          invalid={isValueEmpty}
          error={isValueEmpty ? 'Value Class is required' : null}
        />
      </div>

      <PropertyField
        id="hadoop-source-input-location"
        name="inputLocation"
        label="Input Location"
        tooltip="Path or identifier for source data. Maps to format-specific config keys, e.g. mapreduce.input.fileinputformat.inputdir for file formats or hbase.mapreduce.inputtable for HBase TableInputFormat."
        value={inputLocation}
        onChange={onChange}
        placeholder="hdfs://namenode:8020/path/to/input or my_table"
      />
    </div>
  );
};

const HADOOP_TRANSLATION_OPTIONS: readonly MappingStrategy[] = ['none', 'infer', 'schema', 'customClass'];

const HADOOP_TRANSLATION_LABELS: Partial<Record<MappingStrategy, string>> = {
  none: 'None — Emit Raw KV<KeyClass, ValueClass> (Default)',
  infer: 'Auto-Infer Inline SimpleFunction Translators',
  schema: 'Define Target Schema (Fields & Types)',
  customClass: 'Custom SimpleFunction Classes (Optional)'
};

/** Props for the Hadoop source key/value translation and schema mapping section. */
interface SourceTranslationSectionProps {
  translationStrategy: MappingStrategy | string;
  schemaFields: SchemaField[];
  onSchemaChange: (data: { schemaFields: SchemaField[]; schema: string; schemaString: string }) => void;
  keyTranslationFn: string;
  valueTranslationFn: string;
  skipKeyClone: boolean;
  skipValueClone: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for Key/Value translation and cloning optimization.
 */
const SourceTranslationSection: React.FC<SourceTranslationSectionProps> = ({
  translationStrategy,
  schemaFields,
  onSchemaChange,
  keyTranslationFn,
  valueTranslationFn,
  skipKeyClone,
  skipValueClone,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Translation & Optimization</span>
        <InfoTooltip text="Configures key/value translation strategy and cloning bypasses for high-throughput reads." />
      </label>

      <MappingStrategyField
        id="hadoopSourceTranslationStrategy"
        strategyName="translationStrategy"
        strategy={translationStrategy}
        options={HADOOP_TRANSLATION_OPTIONS}
        optionLabels={HADOOP_TRANSLATION_LABELS}
        label="Key/Value Translation Strategy"
        tooltip="Choose whether to emit raw KV<KeyClass, ValueClass> (default), let Gemini infer inline SimpleFunction translators, define a target Beam Schema, or specify custom SimpleFunction classes."
        noneDescription={
          <>
            <span className="font-semibold text-slate-200">Raw KV Mode:</span> Omits{' '}
            <code className="font-mono">.withKeyTranslation()</code> and{' '}
            <code className="font-mono">.withValueTranslation()</code>, emitting raw{' '}
            <code className="font-mono">KV&lt;KeyClass, ValueClass&gt;</code> using Hadoop{' '}
            <code className="font-mono">WritableCoder</code>.
          </>
        }
        inferDescription={
          <>
            Gemini will automatically generate inline <code className="font-mono">SimpleFunction</code>{' '}
            translators for <code className="font-mono">.withKeyTranslation()</code> and{' '}
            <code className="font-mono">.withValueTranslation()</code> based on the configured Key/Value classes and downstream transforms.
          </>
        }
        schemaFields={schemaFields}
        onSchemaChange={onSchemaChange}
        onChange={onChange}
        customClassChildren={
          <div className="grid grid-cols-2 gap-2">
            <PropertyField
              id="hadoop-source-key-translation"
          name="keyTranslationFn"
          label="Key Translation Function"
          tooltip="Class name of SimpleFunction converting Hadoop key to a Beam-compatible type (maps to withKeyTranslation)."
          value={keyTranslationFn}
          onChange={onChange}
          placeholder="e.g. MyKeyTranslationFn"
        />
        <PropertyField
          id="hadoop-source-value-translation"
          name="valueTranslationFn"
          label="Value Translation Function"
          tooltip="Class name of SimpleFunction converting Hadoop value to a Beam-compatible type (maps to withValueTranslation)."
          value={valueTranslationFn}
          onChange={onChange}
          placeholder="e.g. MyValueTranslationFn"
        />
      </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="flex items-center gap-2">
          <input
            id="hadoop-source-skip-key-clone"
            name="skipKeyClone"
            type="checkbox"
            checked={skipKeyClone}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] cursor-pointer"
          />
          <label htmlFor="hadoop-source-skip-key-clone" className="text-xs text-[var(--vscode-text-primary)] cursor-pointer flex items-center gap-1.5">
            <span>Skip Key Clone</span>
            <InfoTooltip text="Bypasses defensive cloning of key objects if the InputFormat does not reuse key instances (maps to withSkipKeyClone)." />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="hadoop-source-skip-val-clone"
            name="skipValueClone"
            type="checkbox"
            checked={skipValueClone}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] cursor-pointer"
          />
          <label htmlFor="hadoop-source-skip-val-clone" className="text-xs text-[var(--vscode-text-primary)] cursor-pointer flex items-center gap-1.5">
            <span>Skip Value Clone</span>
            <InfoTooltip text="Bypasses defensive cloning of value objects if the InputFormat does not reuse value instances (maps to withSkipValueClone)." />
          </label>
        </div>
      </div>
    </div>
  );
};

/** Props for the Hadoop authentication configuration section. */
interface SourceAuthSectionProps {
  authMode: HadoopAuthMode;
  kerberosPrincipal: string;
  keytabSecret: string;
  secretName: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for Authentication credentials.
 */
const SourceAuthSection: React.FC<SourceAuthSectionProps> = ({
  authMode,
  kerberosPrincipal,
  keytabSecret,
  secretName,
  secrets,
  secretError,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication & Security</span>
        <InfoTooltip text="Configures Hadoop cluster security: Simple (OS user), Kerberos (principal + keytab), or Secret Manager." />
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="hadoop-source-auth-mode" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Auth Mode</span>
          <InfoTooltip text="Select authentication method for Hadoop cluster." />
        </label>
        <select
          id="hadoop-source-auth-mode"
          name="authMode"
          value={authMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="simple">Simple (Unauthenticated / Default OS User)</option>
          <option value="kerberos">Kerberos (Principal + Keytab)</option>
          <option value="secret_manager">Google Cloud Secret Manager</option>
        </select>
      </div>

      {authMode === 'kerberos' && (
        <div className="flex flex-col gap-2">
          <PropertyField
            id="hadoop-source-kerberos-principal"
            name="kerberosPrincipal"
            label="Kerberos Principal"
            tooltip="Kerberos client principal name (e.g. hdfs-client@REALM.COM)."
            value={kerberosPrincipal}
            onChange={onChange}
            placeholder="hdfs-client@REALM.COM"
          />
          <PropertyField
            id="hadoop-source-keytab-secret"
            name="keytabSecret"
            label="Keytab Secret Reference"
            tooltip="GCP Secret Manager secret ID referencing the base64-encoded Kerberos keytab."
            value={keytabSecret}
            onChange={onChange}
            placeholder="e.g. hadoop-keytab-secret"
            list="hadoopformat-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
        </div>
      )}

      {authMode === 'secret_manager' && (
        <PropertyField
          id="hadoop-source-secret-name"
          name="secretName"
          label="Secret Manager Secret"
          tooltip="GCP Secret Manager secret containing Hadoop cluster credentials or tokens."
          value={secretName}
          onChange={onChange}
          placeholder="e.g. hadoop-cluster-credentials"
          list="hadoopformat-source-secret-options"
          datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
        />
      )}

      {secretError && (
        <span className="text-xs text-red-400 mt-1" role="alert">
          {secretError}
        </span>
      )}
    </div>
  );
};

/** Props for the Hadoop advanced filesystem and split settings section. */
interface SourceAdvancedSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  coreSitePath: string;
  hdfsSitePath: string;
  splitSizeHint: number | string;
  defaultFs: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for collapsible Advanced Source Settings.
 */
const SourceAdvancedSection: React.FC<SourceAdvancedSectionProps> = ({
  showAdvanced,
  onToggle,
  coreSitePath,
  hdfsSitePath,
  splitSizeHint,
  defaultFs,
  onChange,
}) => {
  return (
    <CollapsibleSection
      title="Advanced Source Settings"
      isOpen={showAdvanced}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="hadoop-source-core-site"
          name="coreSitePath"
          label="Core-Site.xml Path"
          tooltip="Optional filesystem path to core-site.xml configuration file."
          value={coreSitePath}
          onChange={onChange}
          placeholder="/etc/hadoop/conf/core-site.xml"
        />
        <PropertyField
          id="hadoop-source-hdfs-site"
          name="hdfsSitePath"
          label="HDFS-Site.xml Path"
          tooltip="Optional filesystem path to hdfs-site.xml configuration file."
          value={hdfsSitePath}
          onChange={onChange}
          placeholder="/etc/hadoop/conf/hdfs-site.xml"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="hadoop-source-default-fs"
          name="defaultFs"
          label="Default FS (fs.defaultFS)"
          tooltip="Default Hadoop file system URI (maps to fs.defaultFS, e.g. hdfs://namenode:8020)."
          value={defaultFs}
          onChange={onChange}
          placeholder="hdfs://namenode:8020"
        />
        <PropertyField
          id="hadoop-source-split-size"
          name="splitSizeHint"
          label="Split Size Hint (Bytes)"
          type="number"
          min={0}
          tooltip="Maximum input split size in bytes (maps to mapreduce.input.fileinputformat.split.maxsize)."
          value={splitSizeHint}
          onChange={onChange}
          placeholder="67108864"
        />
      </div>
    </CollapsibleSection>
  );
};

/**
 * HadoopFormatIOSourceProperties renders the configuration form for HadoopFormatIO.read().
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const HadoopFormatIOSourceProperties: React.FC<HadoopFormatIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const inputFormatClass = properties.inputFormatClass || '';
  const keyClass = properties.keyClass || '';
  const valueClass = properties.valueClass || '';
  const inputLocation = properties.inputLocation || '';

  const keyTranslationFn = properties.keyTranslationFn || '';
  const valueTranslationFn = properties.valueTranslationFn || '';
  const translationStrategy =
    properties.translationStrategy ||
    (keyTranslationFn || valueTranslationFn ? 'customClass' : 'none');
  const schemaFields = resolveSchemaFields(properties);
  const skipKeyClone = properties.skipKeyClone ?? false;
  const skipValueClone = properties.skipValueClone ?? false;
  const extraConfig = properties.extraConfig || '';

  const authMode: HadoopAuthMode = (properties.authMode as HadoopAuthMode) || 'simple';
  const kerberosPrincipal = properties.kerberosPrincipal || '';
  const keytabSecret = properties.keytabSecret || '';
  const secretName = properties.secretName || '';

  const coreSitePath = properties.coreSitePath || '';
  const hdfsSitePath = properties.hdfsSitePath || '';
  const splitSizeHint = properties.splitSizeHint ?? '';
  const defaultFs = properties.defaultFs || '';

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isFormatEmpty = !inputFormatClass.trim();
  const isKeyEmpty = !keyClass.trim();
  const isValueEmpty = !valueClass.trim();

  // Fallback chain for system instructions
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
   * Handles text, select, and textarea input changes.
   *
   * @param e Standard React change event
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type: elemType } = e.target;
    if (elemType === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      updateProperty(name, checked);
    } else {
      updateProperty(name, value);
    }
  };

  const handleSchemaChange = (data: {
    schemaFields: SchemaField[];
    schema: string;
    schemaString: string;
  }) => {
    onChange({
      ...properties,
      schemaFields: data.schemaFields,
      schema: data.schema,
      schemaString: data.schemaString,
    });
  };

  /**
   * Handles system instructions textarea modifications.
   *
   * @param e React textarea change event
   */
  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* InputFormat Class and Types */}
      <SourceFormatSection
        inputFormatClass={inputFormatClass}
        keyClass={keyClass}
        valueClass={valueClass}
        inputLocation={inputLocation}
        isFormatEmpty={isFormatEmpty}
        isKeyEmpty={isKeyEmpty}
        isValueEmpty={isValueEmpty}
        onChange={handleChange}
      />

      {/* Translation & Optimization */}
      <SourceTranslationSection
        translationStrategy={translationStrategy}
        schemaFields={schemaFields}
        onSchemaChange={handleSchemaChange}
        keyTranslationFn={keyTranslationFn}
        valueTranslationFn={valueTranslationFn}
        skipKeyClone={skipKeyClone}
        skipValueClone={skipValueClone}
        onChange={handleChange}
      />

      {/* Additional Hadoop Configuration */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Additional Hadoop Configuration</span>
          <InfoTooltip text="Custom key=value pairs (one per line) loaded into the Hadoop Configuration object." />
        </label>
        <PropertyField
          id="hadoop-source-extra-config"
          name="extraConfig"
          type="textarea"
          rows={3}
          tooltip="Custom Hadoop configuration properties (key=value per line)."
          value={extraConfig}
          onChange={handleChange}
          placeholder="mapreduce.input.lineinputformat.linespermap=1000&#10;dfs.client.use.datanode.hostname=true"
        />
      </div>

      {/* Authentication & Security */}
      <SourceAuthSection
        authMode={authMode}
        kerberosPrincipal={kerberosPrincipal}
        keytabSecret={keytabSecret}
        secretName={secretName}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings */}
      <SourceAdvancedSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        coreSitePath={coreSitePath}
        hdfsSitePath={hdfsSitePath}
        splitSizeHint={splitSizeHint}
        defaultFs={defaultFs}
        onChange={handleChange}
      />

      {/* Code Generation Instructions Textarea */}
      <SystemInstructionsField
        id="hadoop-source-instructions"
        value={systemInstructions}
        tooltip="Custom system instructions passed to the LLM when generating code for this HadoopFormatIO source transform."
        placeholder="e.g. Configuration conf = new Configuration(); conf.setClass('mapreduce.job.inputformat.class', TextInputFormat.class, InputFormat.class); HadoopFormatIO.<LongWritable, Text>read().withConfiguration(conf)"
        rows={4}
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
