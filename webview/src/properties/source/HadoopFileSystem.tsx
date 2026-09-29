/**
 * HadoopFileSystem Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam HadoopFileSystem Source nodes
 * representing reads from an HDFS path (e.g. hdfs://namenode:8020/data/*.txt) via Apache Beam's
 * FileSystems subsystem.
 * 
 * Architectural Decisions:
 * - HDFS is a FileSystem registrar (org.apache.beam.sdk.io.hdfs.HadoopFileSystemRegistrar in Java and
 *   apache_beam.io.hadoopfilesystem in Python), rather than a standalone read/write PTransform.
 * - Registering the hdfs:// scheme enables standard Beam file IO transforms (TextIO, AvroIO, ParquetIO,
 *   FileIO) to transparently address HDFS cluster paths.
 * - The node configuration represents "read from an HDFS path", exposing both the file path/pattern and
 *   the underlying Hadoop cluster connection and authentication parameters.
 * - In Java pipelines, cluster configuration is supplied via HadoopFileSystemOptions.setHdfsConfiguration(List<Configuration>).
 * - In Python pipelines, connection parameters flow through hdfs_host, hdfs_port, and hdfs_user pipeline options.
 * - Supports SIMPLE (OS/user-based) and KERBEROS (principal and keytab) authentication mechanisms with conditional rendering.
 * - File Pattern Discovery: Delegates the required file pattern field to the shared StoragePathField primitive.
 *   Provides Cloud Storage bucket datalist suggestions alongside always-visible discovery error alerting for hybrid cloud pipelines.
 * - Advanced tuning accordion exposes file existence validation (validate) and minimum bundle split size (minBundleSize).
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

export interface HadoopFileSystemSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      namenodeHost?: string;
      namenodePort?: string | number;
      hdfsUser?: string;
      authMechanism?: string;
      kerberosPrincipal?: string;
      keytabPath?: string;
      configurationResources?: string;
      format?: string;
      minBundleSize?: string | number;
      validate?: boolean;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface HadoopFileSystemSourcePropertiesProps {
  node: HadoopFileSystemSourceNode;
  onChange: (properties: any) => void;
}

export const HADOOP_AUTH_MECHANISMS: SelectFieldOption[] = [
  { value: 'SIMPLE', label: 'SIMPLE (Simple / OS user authentication)' },
  { value: 'KERBEROS', label: 'KERBEROS (Kerberos ticket / keytab authentication)' }
];

export const HADOOP_SOURCE_FORMATS: SelectFieldOption[] = [
  { value: 'TextIO', label: 'TextIO (Read text lines as String)' },
  { value: 'AvroIO', label: 'AvroIO (Read Avro records)' },
  { value: 'ParquetIO', label: 'ParquetIO (Read Parquet records)' },
  { value: 'FileIO', label: 'FileIO (Match files / read FileIO.ReadableFile)' }
];

export const HadoopFileSystemSourceProperties: React.FC<HadoopFileSystemSourcePropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const namenodeHost = properties.namenodeHost || '';
  const namenodePort = properties.namenodePort ?? 8020;
  const hdfsUser = properties.hdfsUser || '';
  const authMechanism = properties.authMechanism || 'SIMPLE';
  const kerberosPrincipal = properties.kerberosPrincipal || '';
  const keytabPath = properties.keytabPath || '';
  const configurationResources = properties.configurationResources || '';
  const format = properties.format || 'TextIO';
  const validate = properties.validate ?? true;
  const minBundleSize = properties.minBundleSize ?? '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // NOTE: mirrors StoragePathField's own validation rule; used here to gate helper text.
  const isFilePatternInvalid = !filePattern.trim();

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
   * Toggles the advanced tuning accordion state
   */
  const handleToggleAdvanced = () => {
    setIsAdvancedOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* File Pattern Input with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="hadoopSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path"
        tooltip="Target HDFS file path or glob pattern (e.g. hdfs://namenode:8020/data/*.txt or gs://bucket/data/*.txt). Required."
        value={filePattern}
        onChange={handleChange}
        placeholder="hdfs://namenode:8020/data/*.txt"
        errorMessage="File Pattern is required."
        helperText={
          !isFilePatternInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target HDFS path (<code>hdfs://namenode:port/path</code>) or cloud storage pattern for hybrid pipelines.
            </span>
          ) : null
        }
      />

      {/* Transform Format Select */}
      <SelectField
        id="hadoopSourceFormat"
        name="format"
        label="Reader Transform Format"
        tooltip="Underlying Apache Beam file reader transform wrapping the HDFS path (TextIO for plain text, AvroIO for Avro records, ParquetIO for columnar data, FileIO for file matches)."
        value={format}
        options={HADOOP_SOURCE_FORMATS}
        onChange={handleChange}
        helperText={
          <span>
            Beam transform executed against the registered HDFS scheme. Defaults to <code>TextIO</code>.
          </span>
        }
      />

      {/* NameNode Host Input */}
      <PropertyField
        id="hadoopSourceNamenodeHost"
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
        id="hadoopSourceNamenodePort"
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
        id="hadoopSourceHdfsUser"
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
        id="hadoopSourceAuthMechanism"
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
            id="hadoopSourceKerberosPrincipal"
            name="kerberosPrincipal"
            label="Kerberos Principal"
            tooltip="Kerberos principal name for authenticating with secure Hadoop clusters (e.g. hdfs/namenode@REALM.COM)."
            value={kerberosPrincipal}
            onChange={handleChange}
            placeholder="hdfs/namenode@REALM.COM"
            mono={true}
          />

          <PropertyField
            id="hadoopSourceKeytabPath"
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
        id="hadoopSourceConfigurationResources"
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

      {/* Advanced Tuning Accordion */}
      <CollapsibleSection
        title="Read Tuning & Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        {/* Validate Checkbox */}
        <label htmlFor="hadoopSourceValidate" className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            id="hadoopSourceValidate"
            type="checkbox"
            name="validate"
            checked={validate}
            onChange={handleChange}
            className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--vscode-text-secondary)]">
            Validate file existence on pipeline startup
          </span>
          <InfoTooltip text="Validates that input HDFS files exist at pipeline construction time." />
        </label>

        {/* Minimum Bundle Size */}
        <PropertyField
          id="hadoopSourceMinBundleSize"
          type="number"
          name="minBundleSize"
          label="Minimum Bundle Size (bytes)"
          tooltip="Minimum byte size to consider when splitting input HDFS files into bundles for parallel worker execution. Default 0."
          value={minBundleSize}
          onChange={handleChange}
          placeholder="0"
          min="0"
          mono={true}
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="hadoopSourceInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this HadoopFileSystem reader step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Read HDFS files using TextIO.read().from(...) and configure HadoopFileSystemOptions with custom core-site.xml."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
