/**
 * HadoopFileSystem Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam HadoopFileSystem Sink nodes
 * representing writes to an HDFS destination path or prefix (e.g. hdfs://namenode:8020/output/)
 * via Apache Beam's FileSystems subsystem.
 * 
 * Architectural Decisions:
 * - HDFS is a FileSystem registrar (org.apache.beam.sdk.io.hdfs.HadoopFileSystemRegistrar in Java and
 *   apache_beam.io.hadoopfilesystem in Python), rather than a standalone read/write PTransform.
 * - Registering the hdfs:// scheme enables standard Beam file IO writers (TextIO, AvroIO, ParquetIO,
 *   FileIO) to write directly into HDFS clusters.
 * - The node configuration represents "write to an HDFS path", exposing destination prefix (.to),
 *   file naming suffix, HDFS cluster connection / auth parameters, replication, block size,
 *   and writer sharding.
 * - In Java pipelines, cluster configuration is supplied via HadoopFileSystemOptions.setHdfsConfiguration(List<Configuration>).
 * - In Python pipelines, connection parameters flow through hdfs_host, hdfs_port, and hdfs_user pipeline options.
 * - Supports SIMPLE (OS/user-based) and KERBEROS (principal and keytab) authentication mechanisms with conditional rendering.
 * - Destination Location Discovery: Delegates the required destination path/prefix (.to) to the shared StoragePathField primitive.
 *   Provides Cloud Storage bucket datalist suggestions alongside always-visible discovery error alerting for hybrid cloud pipelines.
 * - Exposes sharding controls (numShards, shardTemplate) inside a collapsible accordion.
 * - Shared Primitives Composition: Reuses shared primitives (StoragePathField, CollapsibleSection, SelectField,
 *   PropertyField) to eliminate code duplication and prevent UI drift.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS without inline styles.
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import type { SelectFieldOption } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';

export interface HadoopFileSystemSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      namenodeHost?: string;
      namenodePort?: string | number;
      hdfsUser?: string;
      authMechanism?: string;
      kerberosPrincipal?: string;
      keytabPath?: string;
      configurationResources?: string;
      replicationFactor?: string | number;
      blockSize?: string | number;
      format?: string;
      compression?: string;
      numShards?: string | number;
      shardTemplate?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface HadoopFileSystemSinkPropertiesProps {
  node: HadoopFileSystemSinkNode;
  onChange: (properties: any) => void;
}

export const HADOOP_AUTH_MECHANISMS: SelectFieldOption[] = [
  { value: 'SIMPLE', label: 'SIMPLE (Simple / OS user authentication)' },
  { value: 'KERBEROS', label: 'KERBEROS (Kerberos ticket / keytab authentication)' }
];

export const HADOOP_SINK_FORMATS: SelectFieldOption[] = [
  { value: 'TextIO', label: 'TextIO (Write text lines)' },
  { value: 'AvroIO', label: 'AvroIO (Write Avro records)' },
  { value: 'ParquetIO', label: 'ParquetIO (Write Parquet columnar)' },
  { value: 'FileIO', label: 'FileIO (Write files / custom sinks)' }
];

export const HADOOP_SINK_COMPRESSION_TYPES: SelectFieldOption[] = [
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Default)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' },
  { value: 'ZSTD', label: 'ZSTD (.zst)' }
];

export const HadoopFileSystemSinkProperties: React.FC<HadoopFileSystemSinkPropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '';
  const namenodeHost = properties.namenodeHost || '';
  const namenodePort = properties.namenodePort ?? 8020;
  const hdfsUser = properties.hdfsUser || '';
  const authMechanism = properties.authMechanism || 'SIMPLE';
  const kerberosPrincipal = properties.kerberosPrincipal || '';
  const keytabPath = properties.keytabPath || '';
  const configurationResources = properties.configurationResources || '';
  const replicationFactor = properties.replicationFactor ?? '';
  const blockSize = properties.blockSize ?? '';
  const format = properties.format || 'TextIO';
  const compression = properties.compression || 'UNCOMPRESSED';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // NOTE: mirrors StoragePathField's own validation rule; used here to gate helper text.
  const isToInvalid = !to.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles generic input changes for form fields
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    onChange({
      ...properties,
      [name]: isCheckbox ? checked : value
    });
  };

  /**
   * Updates AI prompt / system instructions
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  /**
   * Toggles the advanced sharding accordion state
   */
  const handleToggleAdvanced = () => {
    setIsAdvancedOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Destination Directory (.to) Input with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="hadoopSinkTo"
        name="to"
        label="Destination Directory / Prefix (.to)"
        tooltip="Target HDFS destination directory path or prefix where files will be written (e.g. hdfs://namenode:8020/output/ or gs://bucket/output/). Required."
        value={to}
        onChange={handleChange}
        placeholder="hdfs://namenode:8020/output/"
        errorMessage="Destination Directory is required."
        helperText={
          !isToInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target HDFS path (<code>hdfs://namenode:port/output/</code>) or cloud storage prefix for hybrid pipelines.
            </span>
          ) : null
        }
      />

      {/* File Suffix Input */}
      <PropertyField
        id="hadoopSinkSuffix"
        name="suffix"
        label="File Name Suffix"
        tooltip="File extension appended to each shard (e.g. .txt, .avro, .parquet). Default is empty."
        value={suffix}
        onChange={handleChange}
        placeholder=".txt"
        mono={true}
      />

      {/* Transform Format Select */}
      <SelectField
        id="hadoopSinkFormat"
        name="format"
        label="Writer Transform Format"
        tooltip="Underlying Apache Beam file writer transform wrapping the HDFS path (TextIO for plain text, AvroIO for Avro records, ParquetIO for columnar data, FileIO for custom file sinks)."
        value={format}
        options={HADOOP_SINK_FORMATS}
        onChange={handleChange}
        helperText={
          <span>
            Beam transform executed against the registered HDFS scheme. Defaults to <code>TextIO</code>.
          </span>
        }
      />

      {/* Compression Select */}
      <SelectField
        id="hadoopSinkCompression"
        name="compression"
        label="Compression"
        tooltip="Compression algorithm applied to output files. Defaults to UNCOMPRESSED."
        value={compression}
        options={HADOOP_SINK_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* NameNode Host Input */}
      <PropertyField
        id="hadoopSinkNamenodeHost"
        name="namenodeHost"
        label="NameNode Host"
        tooltip="Hadoop NameNode hostname or IP address (e.g. namenode.example.com or localhost). Maps to hdfs_host in Python options or fs.defaultFS."
        value={namenodeHost}
        onChange={handleChange}
        placeholder="namenode.example.com"
        mono={true}
      />

      {/* NameNode Port Input */}
      <PropertyField
        id="hadoopSinkNamenodePort"
        name="namenodePort"
        type="number"
        label="NameNode RPC Port"
        tooltip="Hadoop NameNode RPC port. Defaults to 8020 (standard HDFS RPC port is 8020 or 9000)."
        value={namenodePort}
        onChange={handleChange}
        placeholder="8020"
        mono={true}
      />

      {/* HDFS User Input */}
      <PropertyField
        id="hadoopSinkHdfsUser"
        name="hdfsUser"
        label="HDFS User"
        tooltip="HDFS user identity used for cluster operations. Maps to hdfs_user in Python options or HADOOP_USER_NAME."
        value={hdfsUser}
        onChange={handleChange}
        placeholder="hdfs"
        mono={true}
      />

      {/* Authentication Mechanism Select */}
      <SelectField
        id="hadoopSinkAuthMechanism"
        name="authMechanism"
        label="Authentication Mechanism"
        tooltip="Hadoop security authentication mechanism (SIMPLE for unsecured clusters, KERBEROS for Kerberos-authenticated clusters)."
        value={authMechanism}
        options={HADOOP_AUTH_MECHANISMS}
        onChange={handleChange}
      />

      {/* Conditional Kerberos Configuration Fields */}
      {authMechanism === 'KERBEROS' && (
        <div className="p-3 rounded-md bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border)] flex flex-col gap-3">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-secondary)]">
            Kerberos Security Settings
          </span>

          <PropertyField
            id="hadoopSinkKerberosPrincipal"
            name="kerberosPrincipal"
            label="Kerberos Principal"
            tooltip="Kerberos principal name for authenticating with secure Hadoop clusters (e.g. hdfs/namenode@REALM.COM)."
            value={kerberosPrincipal}
            onChange={handleChange}
            placeholder="hdfs/namenode@REALM.COM"
            mono={true}
          />

          <PropertyField
            id="hadoopSinkKeytabPath"
            name="keytabPath"
            label="Keytab File Path"
            tooltip="Local or worker-accessible path to the Kerberos keytab file containing credentials."
            value={keytabPath}
            onChange={handleChange}
            placeholder="/etc/security/keytabs/hdfs.keytab"
            mono={true}
          />
        </div>
      )}

      {/* Configuration Resources Input */}
      <PropertyField
        id="hadoopSinkConfigurationResources"
        name="configurationResources"
        label="Hadoop Configuration Resources"
        tooltip="Comma-separated paths to Hadoop XML configuration files (e.g. /etc/hadoop/conf/core-site.xml,/etc/hadoop/conf/hdfs-site.xml) loaded by HadoopFileSystemOptions.setHdfsConfiguration()."
        value={configurationResources}
        onChange={handleChange}
        placeholder="core-site.xml,hdfs-site.xml"
        mono={true}
        helperText={
          <span className="text-[11px] text-[var(--vscode-text-muted)] leading-relaxed">
            Paths to <code>core-site.xml</code> and <code>hdfs-site.xml</code> for configuring Hadoop client RPC and security settings.
          </span>
        }
      />

      {/* Replication Factor Input */}
      <PropertyField
        id="hadoopSinkReplicationFactor"
        name="replicationFactor"
        type="number"
        label="HDFS Replication Factor"
        tooltip="Block replication factor for files created on HDFS (e.g. 3). Maps to dfs.replication in Hadoop configuration."
        value={replicationFactor}
        onChange={handleChange}
        placeholder="3"
        min="1"
        mono={true}
      />

      {/* Block Size Input */}
      <PropertyField
        id="hadoopSinkBlockSize"
        name="blockSize"
        label="HDFS Block Size (bytes)"
        tooltip="Target HDFS block size in bytes (e.g. 134217728 for 128MB, 268435456 for 256MB). Maps to dfs.blocksize in Hadoop configuration."
        value={blockSize}
        onChange={handleChange}
        placeholder="134217728"
        mono={true}
      />

      {/* Sharding & Output Options Accordion */}
      <CollapsibleSection
        title="Sharding & Shard Template Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        {/* Number of Shards */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="hadoopSinkNumShards"
            className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5"
          >
            <span>Number of Shards</span>
            <InfoTooltip text="Fixed number of output shards written to HDFS. Set to 0 to let the Beam runner automatically determine sharding dynamically." />
          </label>
          <input
            id="hadoopSinkNumShards"
            type="number"
            name="numShards"
            value={numShards}
            onChange={handleChange}
            placeholder="0 (Automatic)"
            min="0"
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
          />
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            0 or empty lets the runner automatically size output shards.
          </span>
        </div>

        {/* Shard Template */}
        <PropertyField
          id="hadoopSinkShardTemplate"
          name="shardTemplate"
          label="Shard Name Template (Optional)"
          tooltip="Custom template for shard naming (e.g. -SSSSS-of-NNNNN). Leave blank for Beam standard default."
          value={shardTemplate}
          onChange={handleChange}
          placeholder="-SSSSS-of-NNNNN"
          mono={true}
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="hadoopSinkInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this HadoopFileSystem writer step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Write records to HDFS destination using TextIO.write().to(...) with custom replication and shard naming."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
