/**
 * Unit Tests for HadoopFormatIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates HadoopFormatIOSinkProperties form rendering, hydration, field validation,
 * partitioning toggle, external synchronization, authentication mode toggling,
 * IPC callbacks for Secret Manager, collapsible advanced configuration, and system instructions.
 *
 * Architectural Decisions:
 * - Emulates VS Code extension host postMessage IPC to verify getSecrets request and response.
 * - Thoroughly tests normal hydration, dispatch updates, edge cases, failure states, and instruction fallbacks.
 * - Uses accessible role and placeholder queries to test UI state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HadoopFormatIOSinkProperties } from './HadoopFormatIO';

describe('HadoopFormatIOSinkProperties', () => {
  const mockOnChange = vi.fn();
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    postMessageSpy = vi.fn();
    (window as any).vscode = { postMessage: postMessageSpy };
  });

  afterEach(() => {
    delete (window as any).vscode;
  });

  it('renders required format, key, value, and output dir fields with errors when empty', () => {
    const node = {
      data: {
        label: 'HadoopFormat Sink',
        properties: {},
      },
    };

    render(<HadoopFormatIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('org.apache.hadoop.mapreduce.lib.output.TextOutputFormat')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('org.apache.hadoop.io.Text')[0]).toBeInTheDocument();
    expect(screen.getByPlaceholderText('hdfs://namenode:8020/output/path')).toBeInTheDocument();

    expect(screen.getByText(/OutputFormat Class is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Output Key Class is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Output Value Class is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Output Location is required/i)).toBeInTheDocument();

    const formatInput = screen.getByPlaceholderText('org.apache.hadoop.mapreduce.lib.output.TextOutputFormat');
    expect(formatInput).toHaveAttribute('aria-invalid', 'true');
    const dirInput = screen.getByPlaceholderText('hdfs://namenode:8020/output/path');
    expect(dirInput).toHaveAttribute('aria-invalid', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node properties correctly', () => {
    const node = {
      data: {
        label: 'HadoopFormat Sink',
        properties: {
          outputFormatClass: 'org.apache.hadoop.mapreduce.lib.output.SequenceFileOutputFormat',
          outputKeyClass: 'org.apache.hadoop.io.Text',
          outputValueClass: 'org.apache.hadoop.io.IntWritable',
          outputDir: 'hdfs://namenode:8020/results',
          jobId: 'beam_job_123',
          partitioningEnabled: true,
          numReducers: 16,
          externalSynchronizationClass: 'org.apache.beam.sdk.io.hadoop.format.HDFSSynchronization',
          extraConfig: 'mapreduce.output.fileoutputformat.compress=true',
        },
      },
    };

    render(<HadoopFormatIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('org.apache.hadoop.mapreduce.lib.output.SequenceFileOutputFormat')).toBeInTheDocument();
    expect(screen.getByDisplayValue('org.apache.hadoop.io.Text')).toBeInTheDocument();
    expect(screen.getByDisplayValue('org.apache.hadoop.io.IntWritable')).toBeInTheDocument();
    expect(screen.getByDisplayValue('hdfs://namenode:8020/results')).toBeInTheDocument();
    expect(screen.getByDisplayValue('beam_job_123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16')).toBeInTheDocument();
    expect(screen.getByDisplayValue('org.apache.beam.sdk.io.hadoop.format.HDFSSynchronization')).toBeInTheDocument();

    const partitionCheckbox = screen.getByLabelText(/Enable Dynamic Partitioning/i);
    expect(partitionCheckbox).toBeChecked();

    expect(screen.queryByText(/OutputFormat Class is required/i)).not.toBeInTheDocument();
  });

  it('dispatches updates when format, directory, partitioning, and sync change', () => {
    const node = {
      data: {
        label: 'HadoopFormat Sink',
        properties: {
          outputFormatClass: 'org.apache.hadoop.mapreduce.lib.output.TextOutputFormat',
          outputDir: 'hdfs://namenode:8020/out',
        },
      },
    };

    render(<HadoopFormatIOSinkProperties node={node} onChange={mockOnChange} />);

    const formatInput = screen.getByPlaceholderText('org.apache.hadoop.mapreduce.lib.output.TextOutputFormat');
    fireEvent.change(formatInput, { target: { name: 'outputFormatClass', value: 'my.CustomOutputFormat' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      outputFormatClass: 'my.CustomOutputFormat',
    }));

    const dirInput = screen.getByPlaceholderText('hdfs://namenode:8020/output/path');
    fireEvent.change(dirInput, { target: { name: 'outputDir', value: 'hdfs://namenode:8020/final' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      outputDir: 'hdfs://namenode:8020/final',
    }));

    const jobInput = screen.getByPlaceholderText('job_beam_sink_0001');
    fireEvent.change(jobInput, { target: { name: 'jobId', value: 'beam_job_999' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'beam_job_999',
    }));

    const partitionCheckbox = screen.getByLabelText(/Enable Dynamic Partitioning/i);
    fireEvent.click(partitionCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      partitioningEnabled: true,
    }));

    const syncInput = screen.getByPlaceholderText('org.apache.beam.sdk.io.hadoop.format.HDFSSynchronization');
    fireEvent.change(syncInput, { target: { name: 'externalSynchronizationClass', value: 'custom.Sync' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      externalSynchronizationClass: 'custom.Sync',
    }));
  });

  it('switches authentication modes and reveals Kerberos or Secret Manager fields', () => {
    const node = {
      data: {
        label: 'HadoopFormat Sink',
        properties: {
          authMode: 'simple' as const,
        },
      },
    };

    const { rerender } = render(<HadoopFormatIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('hdfs-writer@REALM.COM')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. hadoop-keytab-secret')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. hadoop-cluster-credentials')).not.toBeInTheDocument();

    const authSelect = screen.getByLabelText(/Auth Mode/i, { selector: 'select' });
    fireEvent.change(authSelect, { target: { name: 'authMode', value: 'kerberos' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      authMode: 'kerberos',
    }));

    // Rerender with kerberos
    const kerberosNode = {
      data: {
        label: 'HadoopFormat Sink',
        properties: {
          authMode: 'kerberos' as const,
          kerberosPrincipal: 'hdfs-sink@CORP.NET',
          keytabSecret: 'my-sink-keytab',
        },
      },
    };
    rerender(<HadoopFormatIOSinkProperties node={kerberosNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('hdfs-writer@REALM.COM')).toHaveValue('hdfs-sink@CORP.NET');
    expect(screen.getByPlaceholderText('e.g. hadoop-keytab-secret')).toHaveValue('my-sink-keytab');

    // Rerender with secret_manager
    const secretManagerNode = {
      data: {
        label: 'HadoopFormat Sink',
        properties: {
          authMode: 'secret_manager' as const,
          secretName: 'hadoop-sink-token',
        },
      },
    };
    rerender(<HadoopFormatIOSinkProperties node={secretManagerNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. hadoop-cluster-credentials')).toHaveValue('hadoop-sink-token');
  });

  it('populates datalist with secrets loaded from extension IPC', () => {
    const node = {
      data: {
        label: 'HadoopFormat Sink',
        properties: {
          authMode: 'secret_manager' as const,
        },
      },
    };

    render(<HadoopFormatIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [
          'projects/my-gcp-proj/secrets/hadoop-sink-token-secret',
          { id: 'hadoop-sink-keytab-id', name: 'Hadoop Sink Keytab' },
        ],
      },
    }));

    const option1 = document.querySelector('datalist#hadoopformat-sink-secret-options option[value="hadoop-sink-token-secret"]');
    const option2 = document.querySelector('datalist#hadoopformat-sink-secret-options option[value="hadoop-sink-keytab-id"]');
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error alert exactly once when secrets loading fails from extension IPC', () => {
    const node = {
      data: {
        label: 'HadoopFormat Sink',
        properties: {},
      },
    };

    render(<HadoopFormatIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        error: 'Failed to load secrets for Hadoop sink',
      },
    }));

    const alerts = screen.getAllByRole('alert');
    const secretAlert = alerts.filter((a) => a.textContent?.includes('Failed to load secrets for Hadoop sink'));
    expect(secretAlert).toHaveLength(1);
  });

  it('toggles Advanced Sink Settings and dispatches edits', () => {
    const node = {
      data: {
        label: 'HadoopFormat Sink',
        properties: {
          coreSitePath: '/etc/hadoop/conf/core-site.xml',
          hdfsSitePath: '/etc/hadoop/conf/hdfs-site.xml',
          defaultFs: 'hdfs://namenode:8020',
          outputCommitAlgorithm: '2',
        },
      },
    };

    render(<HadoopFormatIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    expect(screen.queryByPlaceholderText('/etc/hadoop/conf/core-site.xml')).not.toBeInTheDocument();

    // Open advanced settings
    fireEvent.click(advancedBtn);

    const coreSiteInput = screen.getByPlaceholderText('/etc/hadoop/conf/core-site.xml');
    expect(coreSiteInput).toHaveValue('/etc/hadoop/conf/core-site.xml');
    const hdfsSiteInput = screen.getByPlaceholderText('/etc/hadoop/conf/hdfs-site.xml');
    expect(hdfsSiteInput).toHaveValue('/etc/hadoop/conf/hdfs-site.xml');
    const defaultFsInput = screen.getByPlaceholderText('hdfs://namenode:8020');
    expect(defaultFsInput).toHaveValue('hdfs://namenode:8020');
    const commitAlgInput = screen.getByPlaceholderText('2');
    expect(commitAlgInput).toHaveValue('2');

    fireEvent.change(coreSiteInput, { target: { name: 'coreSitePath', value: '/opt/hadoop/core-site.xml' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      coreSitePath: '/opt/hadoop/core-site.xml',
    }));

    fireEvent.change(commitAlgInput, { target: { name: 'outputCommitAlgorithm', value: '1' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      outputCommitAlgorithm: '1',
    }));

    // Close advanced settings
    fireEvent.click(advancedBtn);
    expect(screen.queryByPlaceholderText('/etc/hadoop/conf/core-site.xml')).not.toBeInTheDocument();
  });

  it('handles edge case where properties or node.data are completely missing', () => {
    const nodeWithoutProps = {
      data: {},
    } as any;

    expect(() => {
      render(<HadoopFormatIOSinkProperties node={nodeWithoutProps} onChange={mockOnChange} />);
    }).not.toThrow();

    expect(screen.getByText(/OutputFormat Class is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Output Key Class is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Output Value Class is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Output Location is required/i)).toBeInTheDocument();
  });

  it('respects numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'HadoopFormat Sink',
        properties: {
          numReducers: 0,
        },
      },
    };

    render(<HadoopFormatIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('10')).toHaveValue(0);
  });

  it('resolves system instructions fallback chain and dispatches updates', () => {
    // 1. Fallback to special_instructions on node.data
    const nodeSpecial = {
      data: {
        special_instructions: 'Custom special prompt for HadoopFormat sink',
        properties: {},
      },
    };

    const { rerender } = render(<HadoopFormatIOSinkProperties node={nodeSpecial} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/HadoopFormatIO\.<Text, Text>write\(\)/i);
    expect(textarea).toHaveValue('Custom special prompt for HadoopFormat sink');

    // 2. Direct property edit
    fireEvent.change(textarea, { target: { value: 'Updated sink prompt' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated sink prompt',
    }));

    // 3. Fallback when system_instructions is directly in properties
    const nodePropInstructions = {
      data: {
        properties: {
          system_instructions: 'Sink property instructions override',
        },
      },
    };
    rerender(<HadoopFormatIOSinkProperties node={nodePropInstructions} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText(/HadoopFormatIO\.<Text, Text>write\(\)/i)).toHaveValue('Sink property instructions override');
  });
});
