/**
 * HadoopFormatIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam HadoopFormatIO Write Sink nodes
 * (org.apache.beam.sdk.io.hadoop.format.HadoopFormatIO.write() in Java / cross-language expansion service in Python).
 * Configures Hadoop OutputFormat class name, Output Key/Value classes, output directory path,
 * MapReduce job ID (mandatory for write), dynamic partitioning (withPartitioning), external synchronization
 * (withExternalSynchronization), reducer parallelism, additional Hadoop Configuration key=value pairs,
 * authentication (Simple, Kerberos, or Secret Manager), and site-XML path overrides.
 *
 * Architectural Decisions:
 * - Real-time validation: Requires OutputFormat Class, Key Class, Value Class, and Output Directory with instant visual cues and ARIA attributes.
 * - Configuration-driven model: Centered around Hadoop Configuration properties (mapreduce.job.outputformat.class,
 *   mapreduce.job.output.key.class, mapreduce.job.output.value.class, mapreduce.job.id, etc.) passed via
 *   HadoopFormatIO.write().withConfiguration(conf).
 * - Real builder methods: Supports withPartitioning() and withExternalSynchronization(ExternalSynchronization).
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to populate
 *   the 'hadoopformat-sink-secret-options' datalist.
 * - Decomposed into local presentational sub-components adhering to "props in, events up" with semantic callbacks (onToggle).
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Strictly follows the 8pt grid system and Tailwind CSS styling using VS Code theme tokens.
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

export type HadoopAuthMode = 'simple' | 'kerberos' | 'secret_manager';

export interface HadoopFormatIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        outputFormatClass?: string;
        outputKeyClass?: string;
        outputValueClass?: string;
        outputDir?: string;
        jobId?: string;
        partitioningEnabled?: boolean;
        numReducers?: number | string;
        externalSynchronizationClass?: string;
        extraConfig?: string;
        authMode?: HadoopAuthMode | string;
        kerberosPrincipal?: string;
        keytabSecret?: string;
        secretName?: string;
        coreSitePath?: string;
        hdfsSitePath?: string;
        defaultFs?: string;
        outputCommitAlgorithm?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

interface SinkFormatSectionProps {
  outputFormatClass: string;
  outputKeyClass: string;
  outputValueClass: string;
  outputDir: string;
  jobId: string;
  isFormatEmpty: boolean;
  isKeyEmpty: boolean;
  isValueEmpty: boolean;
  isDirEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for required Hadoop OutputFormat and Key/Value types.
 */
const SinkFormatSection: React.FC<SinkFormatSectionProps> = ({
  outputFormatClass,
  outputKeyClass,
  outputValueClass,
  outputDir,
  jobId,
  isFormatEmpty,
  isKeyEmpty,
  isValueEmpty,
  isDirEmpty,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Hadoop OutputFormat & Destination</span>
        <InfoTooltip text="Configures the Hadoop OutputFormat class, target directory, output key/value types, and job identifier." />
      </label>

      <PropertyField
        id="hadoop-sink-output-format"
        name="outputFormatClass"
        label="OutputFormat Class"
        tooltip="Fully qualified class name of the Hadoop OutputFormat (maps to mapreduce.job.outputformat.class, e.g. org.apache.hadoop.mapreduce.lib.output.TextOutputFormat)."
        value={outputFormatClass}
        onChange={onChange}
        placeholder="org.apache.hadoop.mapreduce.lib.output.TextOutputFormat"
        required="OutputFormat Class is required"
        invalid={isFormatEmpty}
        error={isFormatEmpty ? 'OutputFormat Class is required' : null}
      />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="hadoop-sink-output-key-class"
          name="outputKeyClass"
          label="Output Key Class"
          tooltip="Fully qualified class name of output record key (maps to mapreduce.job.output.key.class, e.g. org.apache.hadoop.io.Text)."
          value={outputKeyClass}
          onChange={onChange}
          placeholder="org.apache.hadoop.io.Text"
          required="Output Key Class is required"
          invalid={isKeyEmpty}
          error={isKeyEmpty ? 'Output Key Class is required' : null}
        />
        <PropertyField
          id="hadoop-sink-output-value-class"
          name="outputValueClass"
          label="Output Value Class"
          tooltip="Fully qualified class name of output record value (maps to mapreduce.job.output.value.class, e.g. org.apache.hadoop.io.Text or org.apache.hadoop.io.NullWritable)."
          value={outputValueClass}
          onChange={onChange}
          placeholder="org.apache.hadoop.io.Text"
          required="Output Value Class is required"
          invalid={isValueEmpty}
          error={isValueEmpty ? 'Output Value Class is required' : null}
        />
      </div>

      <PropertyField
        id="hadoop-sink-output-dir"
        name="outputDir"
        label="Output Location / Directory"
        tooltip="Destination filesystem path where output files will be written (maps to mapreduce.output.fileoutputformat.outputdir)."
        value={outputDir}
        onChange={onChange}
        placeholder="hdfs://namenode:8020/output/path"
        required="Output Location is required"
        invalid={isDirEmpty}
        error={isDirEmpty ? 'Output Location is required' : null}
      />

      <PropertyField
        id="hadoop-sink-job-id"
        name="jobId"
        label="MapReduce Job ID"
        tooltip="MapReduce job identifier required by Hadoop OutputCommitter (maps to mapreduce.job.id, e.g. job_beam_0001)."
        value={jobId}
        onChange={onChange}
        placeholder="job_beam_sink_0001"
      />
    </div>
  );
};

interface SinkPartitioningSectionProps {
  partitioningEnabled: boolean;
  numReducers: number | string;
  externalSynchronizationClass: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for partitioning and external synchronization.
 */
const SinkPartitioningSection: React.FC<SinkPartitioningSectionProps> = ({
  partitioningEnabled,
  numReducers,
  externalSynchronizationClass,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Partitioning & Synchronization</span>
        <InfoTooltip text="Configures dynamic partitioning (withPartitioning) and multi-worker commit synchronization (withExternalSynchronization)." />
      </label>

      <div className="flex items-center gap-2">
        <input
          id="hadoop-sink-partitioning"
          name="partitioningEnabled"
          type="checkbox"
          checked={partitioningEnabled}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)] cursor-pointer"
        />
        <label htmlFor="hadoop-sink-partitioning" className="text-xs text-[var(--vscode-text-primary)] cursor-pointer flex items-center gap-1.5">
          <span>Enable Dynamic Partitioning</span>
          <InfoTooltip text="Enables partition-based directory output partitioning (maps to HadoopFormatIO.write().withPartitioning())." />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <PropertyField
          id="hadoop-sink-reducers"
          name="numReducers"
          label="Number of Reducers"
          type="number"
          min={1}
          tooltip="Parallel write task count (maps to mapreduce.job.reduces)."
          value={numReducers}
          onChange={onChange}
          placeholder="10"
        />
        <PropertyField
          id="hadoop-sink-external-sync"
          name="externalSynchronizationClass"
          label="External Synchronization Class"
          tooltip="Class coordinating multi-worker file commit locks (maps to withExternalSynchronization). HDFSSynchronization is the standard implementation."
          value={externalSynchronizationClass}
          onChange={onChange}
          placeholder="org.apache.beam.sdk.io.hadoop.format.HDFSSynchronization"
        />
      </div>
    </div>
  );
};

interface SinkAuthSectionProps {
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
const SinkAuthSection: React.FC<SinkAuthSectionProps> = ({
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
        <label htmlFor="hadoop-sink-auth-mode" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Auth Mode</span>
          <InfoTooltip text="Select authentication method for Hadoop cluster." />
        </label>
        <select
          id="hadoop-sink-auth-mode"
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
            id="hadoop-sink-kerberos-principal"
            name="kerberosPrincipal"
            label="Kerberos Principal"
            tooltip="Kerberos client principal name (e.g. hdfs-writer@REALM.COM)."
            value={kerberosPrincipal}
            onChange={onChange}
            placeholder="hdfs-writer@REALM.COM"
          />
          <PropertyField
            id="hadoop-sink-keytab-secret"
            name="keytabSecret"
            label="Keytab Secret Reference"
            tooltip="GCP Secret Manager secret ID referencing the base64-encoded Kerberos keytab."
            value={keytabSecret}
            onChange={onChange}
            placeholder="e.g. hadoop-keytab-secret"
            list="hadoopformat-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
        </div>
      )}

      {authMode === 'secret_manager' && (
        <PropertyField
          id="hadoop-sink-secret-name"
          name="secretName"
          label="Secret Manager Secret"
          tooltip="GCP Secret Manager secret containing Hadoop cluster credentials or tokens."
          value={secretName}
          onChange={onChange}
          placeholder="e.g. hadoop-cluster-credentials"
          list="hadoopformat-sink-secret-options"
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

interface SinkAdvancedSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  coreSitePath: string;
  hdfsSitePath: string;
  defaultFs: string;
  outputCommitAlgorithm: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for collapsible Advanced Sink Settings.
 */
const SinkAdvancedSection: React.FC<SinkAdvancedSectionProps> = ({
  showAdvanced,
  onToggle,
  coreSitePath,
  hdfsSitePath,
  defaultFs,
  outputCommitAlgorithm,
  onChange,
}) => {
  return (
    <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
      >
        <span>Advanced Sink Settings</span>
        <span>{showAdvanced ? '▲' : '▼'}</span>
      </button>

      {showAdvanced && (
        <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
          <div className="grid grid-cols-2 gap-2">
            <PropertyField
              id="hadoop-sink-core-site"
              name="coreSitePath"
              label="Core-Site.xml Path"
              tooltip="Optional filesystem path to core-site.xml configuration file."
              value={coreSitePath}
              onChange={onChange}
              placeholder="/etc/hadoop/conf/core-site.xml"
            />
            <PropertyField
              id="hadoop-sink-hdfs-site"
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
              id="hadoop-sink-default-fs"
              name="defaultFs"
              label="Default FS (fs.defaultFS)"
              tooltip="Default Hadoop file system URI (maps to fs.defaultFS, e.g. hdfs://namenode:8020)."
              value={defaultFs}
              onChange={onChange}
              placeholder="hdfs://namenode:8020"
            />
            <PropertyField
              id="hadoop-sink-commit-algorithm"
              name="outputCommitAlgorithm"
              label="Output Commit Algorithm"
              tooltip="FileOutputCommitter commit algorithm version (1: safe two-stage commit, 2: faster direct commit to final directory)."
              value={outputCommitAlgorithm}
              onChange={onChange}
              placeholder="2"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * HadoopFormatIOSinkProperties renders the configuration form for HadoopFormatIO.write().
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const HadoopFormatIOSinkProperties: React.FC<HadoopFormatIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const outputFormatClass = properties.outputFormatClass || '';
  const outputKeyClass = properties.outputKeyClass || '';
  const outputValueClass = properties.outputValueClass || '';
  const outputDir = properties.outputDir || '';
  const jobId = properties.jobId || '';

  const partitioningEnabled = properties.partitioningEnabled ?? false;
  const numReducers = properties.numReducers ?? '';
  const externalSynchronizationClass = properties.externalSynchronizationClass || '';
  const extraConfig = properties.extraConfig || '';

  const authMode: HadoopAuthMode = (properties.authMode as HadoopAuthMode) || 'simple';
  const kerberosPrincipal = properties.kerberosPrincipal || '';
  const keytabSecret = properties.keytabSecret || '';
  const secretName = properties.secretName || '';

  const coreSitePath = properties.coreSitePath || '';
  const hdfsSitePath = properties.hdfsSitePath || '';
  const defaultFs = properties.defaultFs || '';
  const outputCommitAlgorithm = properties.outputCommitAlgorithm || '';

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isFormatEmpty = !outputFormatClass.trim();
  const isKeyEmpty = !outputKeyClass.trim();
  const isValueEmpty = !outputValueClass.trim();
  const isDirEmpty = !outputDir.trim();

  // Fallback chain for system instructions
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

  /**
   * Handles system instructions textarea modifications.
   *
   * @param e React textarea change event
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* OutputFormat Class and Destination */}
      <SinkFormatSection
        outputFormatClass={outputFormatClass}
        outputKeyClass={outputKeyClass}
        outputValueClass={outputValueClass}
        outputDir={outputDir}
        jobId={jobId}
        isFormatEmpty={isFormatEmpty}
        isKeyEmpty={isKeyEmpty}
        isValueEmpty={isValueEmpty}
        isDirEmpty={isDirEmpty}
        onChange={handleChange}
      />

      {/* Partitioning & Synchronization */}
      <SinkPartitioningSection
        partitioningEnabled={partitioningEnabled}
        numReducers={numReducers}
        externalSynchronizationClass={externalSynchronizationClass}
        onChange={handleChange}
      />

      {/* Additional Hadoop Configuration */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Additional Hadoop Configuration</span>
          <InfoTooltip text="Custom key=value pairs (one per line) loaded into the Hadoop Configuration object." />
        </label>
        <PropertyField
          id="hadoop-sink-extra-config"
          name="extraConfig"
          type="textarea"
          rows={3}
          tooltip="Custom Hadoop configuration properties (key=value per line)."
          value={extraConfig}
          onChange={handleChange}
          placeholder="mapreduce.output.fileoutputformat.compress=true&#10;mapreduce.output.fileoutputformat.compress.codec=org.apache.hadoop.io.compress.GzipCodec"
        />
      </div>

      {/* Authentication & Security */}
      <SinkAuthSection
        authMode={authMode}
        kerberosPrincipal={kerberosPrincipal}
        keytabSecret={keytabSecret}
        secretName={secretName}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Sink Settings */}
      <SinkAdvancedSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        coreSitePath={coreSitePath}
        hdfsSitePath={hdfsSitePath}
        defaultFs={defaultFs}
        outputCommitAlgorithm={outputCommitAlgorithm}
        onChange={handleChange}
      />

      {/* Spacer before Instructions textarea */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions Textarea */}
      <PropertyField
        id="hadoop-sink-instructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Custom system instructions passed to the LLM when generating code for this HadoopFormatIO sink transform."
        type="textarea"
        rows={4}
        mono={false}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Configuration conf = new Configuration(); conf.setClass('mapreduce.job.outputformat.class', TextOutputFormat.class, OutputFormat.class); conf.set('mapreduce.job.id', 'beam_job'); HadoopFormatIO.<Text, Text>write().withConfiguration(conf)"
      />
    </div>
  );
};
