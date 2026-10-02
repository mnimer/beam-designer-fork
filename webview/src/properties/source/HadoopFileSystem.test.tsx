/**
 * HadoopFileSystem Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating HadoopFileSystemSourceProperties component functionality,
 * form change callbacks, validation states for required fields, Kerberos authentication
 * conditional rendering, accordion toggling,
 * and code generation instructions.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Validates required field state for filePattern, default fallbacks, and error boundaries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HadoopFileSystemSourceProperties } from './HadoopFileSystem';

describe('HadoopFileSystemSourceProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing filePattern', () => {
    const mockNode: any = {
      data: {
        label: 'HadoopFileSystem',
        beam_transform: 'HadoopFileSystem',
        properties: {}
      }
    };

    const { container } = render(
      <HadoopFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const filePatternInput = container.querySelector('#hadoopSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();

    // Verify defaults
    const formatSelect = container.querySelector('#hadoopSourceFormat') as HTMLSelectElement;
    expect(formatSelect).toHaveValue('TextIO');

    const portInput = container.querySelector('#hadoopSourceNamenodePort') as HTMLInputElement;
    expect(portInput).toHaveValue(8020);

    const authSelect = container.querySelector('#hadoopSourceAuthMechanism') as HTMLSelectElement;
    expect(authSelect).toHaveValue('SIMPLE');

    // Kerberos fields hidden under SIMPLE
    expect(container.querySelector('#hadoopSourceKerberosPrincipal')).not.toBeInTheDocument();
    expect(container.querySelector('#hadoopSourceKeytabPath')).not.toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'HadoopFileSystem',
        beam_transform: 'HadoopFileSystem',
        properties: {
          filePattern: 'hdfs://namenode:8020/data/warehouse/*.avro',
          namenodeHost: 'namenode.corp.internal',
          namenodePort: 9000,
          hdfsUser: 'hadoop_svc',
          authMechanism: 'KERBEROS',
          kerberosPrincipal: 'hdfs/namenode@CORP.INTERNAL',
          keytabPath: '/etc/security/keytabs/hdfs.keytab',
          configurationResources: '/etc/hadoop/conf/core-site.xml,/etc/hadoop/conf/hdfs-site.xml',
          format: 'AvroIO',
          validate: false,
          minBundleSize: 65536,
          system_instructions: 'Custom instructions for reading Avro files from HDFS'
        }
      }
    };

    const { container } = render(
      <HadoopFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const filePatternInput = container.querySelector('#hadoopSourceFilePattern') as HTMLInputElement;
    const formatSelect = container.querySelector('#hadoopSourceFormat') as HTMLSelectElement;
    const hostInput = container.querySelector('#hadoopSourceNamenodeHost') as HTMLInputElement;
    const portInput = container.querySelector('#hadoopSourceNamenodePort') as HTMLInputElement;
    const userInput = container.querySelector('#hadoopSourceHdfsUser') as HTMLInputElement;
    const authSelect = container.querySelector('#hadoopSourceAuthMechanism') as HTMLSelectElement;
    const principalInput = container.querySelector('#hadoopSourceKerberosPrincipal') as HTMLInputElement;
    const keytabInput = container.querySelector('#hadoopSourceKeytabPath') as HTMLInputElement;
    const configInput = container.querySelector('#hadoopSourceConfigurationResources') as HTMLInputElement;
    const instructionsTextarea = container.querySelector('#hadoopSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('hdfs://namenode:8020/data/warehouse/*.avro');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(formatSelect).toHaveValue('AvroIO');
    expect(hostInput).toHaveValue('namenode.corp.internal');
    expect(portInput).toHaveValue(9000);
    expect(userInput).toHaveValue('hadoop_svc');
    expect(authSelect).toHaveValue('KERBEROS');
    expect(principalInput).toHaveValue('hdfs/namenode@CORP.INTERNAL');
    expect(keytabInput).toHaveValue('/etc/security/keytabs/hdfs.keytab');
    expect(configInput).toHaveValue('/etc/hadoop/conf/core-site.xml,/etc/hadoop/conf/hdfs-site.xml');
    expect(instructionsTextarea).toHaveValue('Custom instructions for reading Avro files from HDFS');

    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('validates on/off for filePattern required state', () => {
    // Empty filePattern
    const mockNodeEmpty: any = {
      data: {
        properties: {
          filePattern: ''
        }
      }
    };
    const { rerender } = render(
      <HadoopFileSystemSourceProperties node={mockNodeEmpty} onChange={mockOnChange} />
    );
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();

    // Valid filePattern provided
    const mockNodeValid: any = {
      data: {
        properties: {
          filePattern: 'hdfs://namenode:8020/logs/*.txt'
        }
      }
    };
    rerender(<HadoopFileSystemSourceProperties node={mockNodeValid} onChange={mockOnChange} />);
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for filePattern, format, namenodeHost, namenodePort, hdfsUser, authMechanism, and configurationResources', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <HadoopFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    // filePattern change
    const filePatternInput = container.querySelector('#hadoopSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 'hdfs://cluster-master:8020/raw/*.parquet' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 'hdfs://cluster-master:8020/raw/*.parquet'
      })
    );

    // format change
    const formatSelect = container.querySelector('#hadoopSourceFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'format', value: 'ParquetIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'ParquetIO'
      })
    );

    // namenodeHost change
    const hostInput = container.querySelector('#hadoopSourceNamenodeHost') as HTMLInputElement;
    fireEvent.change(hostInput, {
      target: { name: 'namenodeHost', value: 'hdfs-namenode.prod' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        namenodeHost: 'hdfs-namenode.prod'
      })
    );

    // namenodePort change
    const portInput = container.querySelector('#hadoopSourceNamenodePort') as HTMLInputElement;
    fireEvent.change(portInput, {
      target: { name: 'namenodePort', value: '9000' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        namenodePort: '9000'
      })
    );

    // hdfsUser change
    const userInput = container.querySelector('#hadoopSourceHdfsUser') as HTMLInputElement;
    fireEvent.change(userInput, {
      target: { name: 'hdfsUser', value: 'dataflow_user' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        hdfsUser: 'dataflow_user'
      })
    );

    // authMechanism change
    const authSelect = container.querySelector('#hadoopSourceAuthMechanism') as HTMLSelectElement;
    fireEvent.change(authSelect, {
      target: { name: 'authMechanism', value: 'KERBEROS' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        authMechanism: 'KERBEROS'
      })
    );

    // configurationResources change
    const configInput = container.querySelector('#hadoopSourceConfigurationResources') as HTMLInputElement;
    fireEvent.change(configInput, {
      target: { name: 'configurationResources', value: '/opt/hadoop/core-site.xml' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationResources: '/opt/hadoop/core-site.xml'
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
      <HadoopFileSystemSourceProperties node={mockNodeKerberos} onChange={mockOnChange} />
    );

    const principalInput = container.querySelector('#hadoopSourceKerberosPrincipal') as HTMLInputElement;
    const keytabInput = container.querySelector('#hadoopSourceKeytabPath') as HTMLInputElement;

    expect(principalInput).toBeInTheDocument();
    expect(keytabInput).toBeInTheDocument();

    fireEvent.change(principalInput, {
      target: { name: 'kerberosPrincipal', value: 'service/nn@REALM.NET' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kerberosPrincipal: 'service/nn@REALM.NET'
      })
    );

    fireEvent.change(keytabInput, {
      target: { name: 'keytabPath', value: '/etc/security/service.keytab' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        keytabPath: '/etc/security/service.keytab'
      })
    );
  });

  it('toggles read tuning accordion and handles validate and minBundleSize changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <HadoopFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    // Toggle open
    const accordionToggle = screen.getByText('Read Tuning & Options');
    fireEvent.click(accordionToggle);

    const validateCheckbox = container.querySelector('#hadoopSourceValidate') as HTMLInputElement;
    const minBundleSizeInput = container.querySelector('#hadoopSourceMinBundleSize') as HTMLInputElement;

    expect(validateCheckbox).toBeInTheDocument();
    expect(validateCheckbox).toBeChecked();
    expect(minBundleSizeInput).toBeInTheDocument();

    // Toggle validate checkbox
    fireEvent.click(validateCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        validate: false
      })
    );

    // Change minBundleSize
    fireEvent.change(minBundleSizeInput, {
      target: { name: 'minBundleSize', value: '1048576' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        minBundleSize: '1048576'
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
      <HadoopFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const instructionsTextarea = container.querySelector('#hadoopSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Read HDFS logs and extract error metrics' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Read HDFS logs and extract error metrics'
      })
    );
  });


});
