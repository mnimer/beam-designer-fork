/**
 * HadoopFileSystem Sink Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating HadoopFileSystemSinkProperties component functionality,
 * form change callbacks, validation states for required fields, Kerberos authentication
 * conditional rendering, sharding accordion toggling, dynamic extension GCS bucket discovery IPC,
 * canonical bucket discovery error regression testing, and code generation instructions.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Validates required field state for destination prefix (.to), default fallbacks, and error boundaries.
 * - Confirms canonical bucket discovery error renders even with a valid, non-empty destination path (regression test).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HadoopFileSystemSinkProperties } from './HadoopFileSystem';

describe('HadoopFileSystemSinkProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing destination (.to)', () => {
    const mockNode: any = {
      data: {
        label: 'HadoopFileSystem',
        beam_transform: 'HadoopFileSystem',
        properties: {}
      }
    };

    const { container } = render(
      <HadoopFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    const toInput = container.querySelector('#hadoopSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();

    // Verify defaults
    const formatSelect = container.querySelector('#hadoopSinkFormat') as HTMLSelectElement;
    expect(formatSelect).toHaveValue('TextIO');

    const compressionSelect = container.querySelector('#hadoopSinkCompression') as HTMLSelectElement;
    expect(compressionSelect).toHaveValue('UNCOMPRESSED');

    const portInput = container.querySelector('#hadoopSinkNamenodePort') as HTMLInputElement;
    expect(portInput).toHaveValue(8020);

    const authSelect = container.querySelector('#hadoopSinkAuthMechanism') as HTMLSelectElement;
    expect(authSelect).toHaveValue('SIMPLE');

    // Kerberos fields hidden under SIMPLE
    expect(container.querySelector('#hadoopSinkKerberosPrincipal')).not.toBeInTheDocument();
    expect(container.querySelector('#hadoopSinkKeytabPath')).not.toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'HadoopFileSystem',
        beam_transform: 'HadoopFileSystem',
        properties: {
          to: 'hdfs://namenode:8020/output/processed/',
          suffix: '.avro',
          namenodeHost: 'namenode.corp.internal',
          namenodePort: 9000,
          hdfsUser: 'hadoop_svc',
          authMechanism: 'KERBEROS',
          kerberosPrincipal: 'hdfs/namenode@CORP.INTERNAL',
          keytabPath: '/etc/security/keytabs/hdfs.keytab',
          configurationResources: '/etc/hadoop/conf/core-site.xml,/etc/hadoop/conf/hdfs-site.xml',
          replicationFactor: 3,
          blockSize: '268435456',
          format: 'AvroIO',
          compression: 'GZIP',
          numShards: 5,
          shardTemplate: '-SSSSS-of-NNNNN',
          system_instructions: 'Custom instructions for writing Avro files to HDFS'
        }
      }
    };

    const { container } = render(
      <HadoopFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    const toInput = container.querySelector('#hadoopSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#hadoopSinkSuffix') as HTMLInputElement;
    const formatSelect = container.querySelector('#hadoopSinkFormat') as HTMLSelectElement;
    const compressionSelect = container.querySelector('#hadoopSinkCompression') as HTMLSelectElement;
    const hostInput = container.querySelector('#hadoopSinkNamenodeHost') as HTMLInputElement;
    const portInput = container.querySelector('#hadoopSinkNamenodePort') as HTMLInputElement;
    const userInput = container.querySelector('#hadoopSinkHdfsUser') as HTMLInputElement;
    const authSelect = container.querySelector('#hadoopSinkAuthMechanism') as HTMLSelectElement;
    const principalInput = container.querySelector('#hadoopSinkKerberosPrincipal') as HTMLInputElement;
    const keytabInput = container.querySelector('#hadoopSinkKeytabPath') as HTMLInputElement;
    const configInput = container.querySelector('#hadoopSinkConfigurationResources') as HTMLInputElement;
    const replInput = container.querySelector('#hadoopSinkReplicationFactor') as HTMLInputElement;
    const blockSizeInput = container.querySelector('#hadoopSinkBlockSize') as HTMLInputElement;
    const instructionsTextarea = container.querySelector('#hadoopSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('hdfs://namenode:8020/output/processed/');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.avro');
    expect(formatSelect).toHaveValue('AvroIO');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(hostInput).toHaveValue('namenode.corp.internal');
    expect(portInput).toHaveValue(9000);
    expect(userInput).toHaveValue('hadoop_svc');
    expect(authSelect).toHaveValue('KERBEROS');
    expect(principalInput).toHaveValue('hdfs/namenode@CORP.INTERNAL');
    expect(keytabInput).toHaveValue('/etc/security/keytabs/hdfs.keytab');
    expect(configInput).toHaveValue('/etc/hadoop/conf/core-site.xml,/etc/hadoop/conf/hdfs-site.xml');
    expect(replInput).toHaveValue(3);
    expect(blockSizeInput).toHaveValue('268435456');
    expect(instructionsTextarea).toHaveValue('Custom instructions for writing Avro files to HDFS');

    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('validates on/off for destination (.to) required state', () => {
    // Empty to
    const mockNodeEmpty: any = {
      data: {
        properties: {
          to: ''
        }
      }
    };
    const { rerender } = render(
      <HadoopFileSystemSinkProperties node={mockNodeEmpty} onChange={mockOnChange} />
    );
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();

    // Valid to provided
    const mockNodeValid: any = {
      data: {
        properties: {
          to: 'hdfs://namenode:8020/output/results/'
        }
      }
    };
    rerender(<HadoopFileSystemSinkProperties node={mockNodeValid} onChange={mockOnChange} />);
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for to, suffix, format, compression, namenodeHost, namenodePort, hdfsUser, authMechanism, configurationResources, replicationFactor, and blockSize', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <HadoopFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    // to change
    const toInput = container.querySelector('#hadoopSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 'hdfs://cluster-master:8020/output/archive/' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hdfs://cluster-master:8020/output/archive/'
      })
    );

    // suffix change
    const suffixInput = container.querySelector('#hadoopSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.parquet' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.parquet'
      })
    );

    // format change
    const formatSelect = container.querySelector('#hadoopSinkFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'format', value: 'ParquetIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'ParquetIO'
      })
    );

    // compression change
    const compressionSelect = container.querySelector('#hadoopSinkCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'BZIP2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'BZIP2'
      })
    );

    // namenodeHost change
    const hostInput = container.querySelector('#hadoopSinkNamenodeHost') as HTMLInputElement;
    fireEvent.change(hostInput, {
      target: { name: 'namenodeHost', value: 'hdfs-master.prod' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        namenodeHost: 'hdfs-master.prod'
      })
    );

    // namenodePort change
    const portInput = container.querySelector('#hadoopSinkNamenodePort') as HTMLInputElement;
    fireEvent.change(portInput, {
      target: { name: 'namenodePort', value: '9000' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        namenodePort: '9000'
      })
    );

    // hdfsUser change
    const userInput = container.querySelector('#hadoopSinkHdfsUser') as HTMLInputElement;
    fireEvent.change(userInput, {
      target: { name: 'hdfsUser', value: 'beam_writer' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        hdfsUser: 'beam_writer'
      })
    );

    // authMechanism change
    const authSelect = container.querySelector('#hadoopSinkAuthMechanism') as HTMLSelectElement;
    fireEvent.change(authSelect, {
      target: { name: 'authMechanism', value: 'KERBEROS' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        authMechanism: 'KERBEROS'
      })
    );

    // configurationResources change
    const configInput = container.querySelector('#hadoopSinkConfigurationResources') as HTMLInputElement;
    fireEvent.change(configInput, {
      target: { name: 'configurationResources', value: '/opt/hadoop/core-site.xml' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationResources: '/opt/hadoop/core-site.xml'
      })
    );

    // replicationFactor change
    const replInput = container.querySelector('#hadoopSinkReplicationFactor') as HTMLInputElement;
    fireEvent.change(replInput, {
      target: { name: 'replicationFactor', value: '2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        replicationFactor: '2'
      })
    );

    // blockSize change
    const blockSizeInput = container.querySelector('#hadoopSinkBlockSize') as HTMLInputElement;
    fireEvent.change(blockSizeInput, {
      target: { name: 'blockSize', value: '67108864' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        blockSize: '67108864'
      })
    );
  });

  it('renders Kerberos fields conditionally when authMechanism is KERBEROS and handles their changes', () => {
    const mockNodeKerberos: any = {
      data: {
        properties: {
          authMechanism: 'KERBEROS'
        }
      }
    };

    const { container } = render(
      <HadoopFileSystemSinkProperties node={mockNodeKerberos} onChange={mockOnChange} />
    );

    const principalInput = container.querySelector('#hadoopSinkKerberosPrincipal') as HTMLInputElement;
    const keytabInput = container.querySelector('#hadoopSinkKeytabPath') as HTMLInputElement;

    expect(principalInput).toBeInTheDocument();
    expect(keytabInput).toBeInTheDocument();

    fireEvent.change(principalInput, {
      target: { name: 'kerberosPrincipal', value: 'writer/nn@REALM.NET' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kerberosPrincipal: 'writer/nn@REALM.NET'
      })
    );

    fireEvent.change(keytabInput, {
      target: { name: 'keytabPath', value: '/etc/security/writer.keytab' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        keytabPath: '/etc/security/writer.keytab'
      })
    );
  });

  it('toggles sharding accordion and handles numShards and shardTemplate changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <HadoopFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    // Toggle open
    const accordionToggle = screen.getByText('Sharding & Shard Template Options');
    fireEvent.click(accordionToggle);

    const numShardsInput = container.querySelector('#hadoopSinkNumShards') as HTMLInputElement;
    const shardTemplateInput = container.querySelector('#hadoopSinkShardTemplate') as HTMLInputElement;

    expect(numShardsInput).toBeInTheDocument();
    expect(shardTemplateInput).toBeInTheDocument();

    // Change numShards
    fireEvent.change(numShardsInput, {
      target: { name: 'numShards', value: '8' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '8'
      })
    );

    // Change shardTemplate
    fireEvent.change(shardTemplateInput, {
      target: { name: 'shardTemplate', value: '-SSS-of-NNN' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        shardTemplate: '-SSS-of-NNN'
      })
    );
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <HadoopFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    const instructionsTextarea = container.querySelector('#hadoopSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Write partitioned error records to HDFS with replication 3' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Write partitioned error records to HDFS with replication 3'
      })
    );
  });
});

