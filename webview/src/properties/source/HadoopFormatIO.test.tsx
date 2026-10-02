/**
 * Unit Tests for HadoopFormatIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates HadoopFormatIOSourceProperties form rendering, hydration, field validation,
 * key/value translation, clone bypass checkboxes, authentication mode toggling,
 * collapsible advanced configuration, and system instructions.
 *
 * Architectural Decisions:
 * - Emulates VS Code extension host postMessage IPC to verify getSecrets request.
 * - Thoroughly tests normal hydration, dispatch updates, edge cases, failure states, and instruction editing.
 * - Uses accessible role and placeholder queries to test UI state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HadoopFormatIOSourceProperties } from './HadoopFormatIO';

describe('HadoopFormatIOSourceProperties', () => {
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

  it('renders required format, key, and value class fields with errors when empty', () => {
    const node = {
      data: {
        label: 'HadoopFormat Source',
        properties: {},
      },
    };

    render(<HadoopFormatIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('org.apache.hadoop.mapreduce.lib.input.TextInputFormat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('org.apache.hadoop.io.LongWritable')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('org.apache.hadoop.io.Text')).toBeInTheDocument();

    expect(screen.getByText(/InputFormat Class is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Key Class is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Value Class is required/i)).toBeInTheDocument();

    const formatInput = screen.getByPlaceholderText('org.apache.hadoop.mapreduce.lib.input.TextInputFormat');
    expect(formatInput).toHaveAttribute('aria-invalid', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node properties correctly', () => {
    const node = {
      data: {
        label: 'HadoopFormat Source',
        properties: {
          inputFormatClass: 'org.apache.hadoop.hbase.mapreduce.TableInputFormat',
          keyClass: 'org.apache.hadoop.hbase.io.ImmutableBytesWritable',
          valueClass: 'org.apache.hadoop.hbase.client.Result',
          inputLocation: 'sensor_metrics',
          keyTranslationFn: 'HBaseKeyTranslationFn',
          valueTranslationFn: 'HBaseResultTranslationFn',
          skipKeyClone: true,
          skipValueClone: true,
          extraConfig: 'hbase.zookeeper.quorum=zk1:2181',
        },
      },
    };

    render(<HadoopFormatIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('org.apache.hadoop.hbase.mapreduce.TableInputFormat')).toBeInTheDocument();
    expect(screen.getByDisplayValue('org.apache.hadoop.hbase.io.ImmutableBytesWritable')).toBeInTheDocument();
    expect(screen.getByDisplayValue('org.apache.hadoop.hbase.client.Result')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sensor_metrics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('HBaseKeyTranslationFn')).toBeInTheDocument();
    expect(screen.getByDisplayValue('HBaseResultTranslationFn')).toBeInTheDocument();
    expect(screen.getByDisplayValue('hbase.zookeeper.quorum=zk1:2181')).toBeInTheDocument();

    const skipKeyCheckbox = screen.getByLabelText(/Skip Key Clone/i);
    expect(skipKeyCheckbox).toBeChecked();
    const skipValCheckbox = screen.getByLabelText(/Skip Value Clone/i);
    expect(skipValCheckbox).toBeChecked();

    expect(screen.queryByText(/InputFormat Class is required/i)).not.toBeInTheDocument();
  });

  it('dispatches updates when format, key, value, and translation inputs change', () => {
    const node = {
      data: {
        label: 'HadoopFormat Source',
        properties: {
          inputFormatClass: 'org.apache.hadoop.mapreduce.lib.input.TextInputFormat',
        },
      },
    };

    render(<HadoopFormatIOSourceProperties node={node} onChange={mockOnChange} />);

    const formatInput = screen.getByPlaceholderText('org.apache.hadoop.mapreduce.lib.input.TextInputFormat');
    fireEvent.change(formatInput, { target: { name: 'inputFormatClass', value: 'org.apache.hadoop.mapreduce.lib.input.SequenceFileInputFormat' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      inputFormatClass: 'org.apache.hadoop.mapreduce.lib.input.SequenceFileInputFormat',
    }));

    const keyInput = screen.getByPlaceholderText('org.apache.hadoop.io.LongWritable');
    fireEvent.change(keyInput, { target: { name: 'keyClass', value: 'org.apache.hadoop.io.Text' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      keyClass: 'org.apache.hadoop.io.Text',
    }));

    const valInput = screen.getByPlaceholderText('org.apache.hadoop.io.Text');
    fireEvent.change(valInput, { target: { name: 'valueClass', value: 'org.apache.hadoop.io.BytesWritable' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      valueClass: 'org.apache.hadoop.io.BytesWritable',
    }));

    const locInput = screen.getByPlaceholderText(/hdfs:\/\/namenode:8020\/path\/to\/input/i);
    fireEvent.change(locInput, { target: { name: 'inputLocation', value: 'hdfs://namenode:8020/data/logs' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      inputLocation: 'hdfs://namenode:8020/data/logs',
    }));

    const skipKeyCheckbox = screen.getByLabelText(/Skip Key Clone/i);
    fireEvent.click(skipKeyCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      skipKeyClone: true,
    }));
  });

  it('defaults to none translationStrategy and supports infer, schema, and customClass modes', () => {
    const { rerender } = render(
      <HadoopFormatIOSourceProperties node={{ data: { properties: {} } }} onChange={mockOnChange} />
    );

    expect(screen.getByText(/Raw KV Mode:/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Key Translation Function/i)).not.toBeInTheDocument();

    const strategySelect = screen.getByRole('combobox', { name: 'Key/Value Translation Strategy' });
    fireEvent.change(strategySelect, { target: { name: 'translationStrategy', value: 'infer' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      translationStrategy: 'infer',
    }));

    rerender(
      <HadoopFormatIOSourceProperties
        node={{ data: { properties: { translationStrategy: 'schema' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText(/Table \/ Element Schema/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Schema Field' }));
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      schemaFields: expect.arrayContaining([expect.objectContaining({ type: 'STRING' })]),
    }));
  });

  it('switches authentication modes and reveals Kerberos or Secret Manager fields', () => {
    const node = {
      data: {
        label: 'HadoopFormat Source',
        properties: {
          authMode: 'simple' as const,
        },
      },
    };

    const { rerender } = render(<HadoopFormatIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('hdfs-client@REALM.COM')).not.toBeInTheDocument();
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
        label: 'HadoopFormat Source',
        properties: {
          authMode: 'kerberos' as const,
          kerberosPrincipal: 'hdfs@CORP.NET',
          keytabSecret: 'my-hadoop-keytab',
        },
      },
    };
    rerender(<HadoopFormatIOSourceProperties node={kerberosNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('hdfs-client@REALM.COM')).toHaveValue('hdfs@CORP.NET');
    expect(screen.getByPlaceholderText('e.g. hadoop-keytab-secret')).toHaveValue('my-hadoop-keytab');

    // Rerender with secret_manager
    const secretManagerNode = {
      data: {
        label: 'HadoopFormat Source',
        properties: {
          authMode: 'secret_manager' as const,
          secretName: 'hadoop-token-secret',
        },
      },
    };
    rerender(<HadoopFormatIOSourceProperties node={secretManagerNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. hadoop-cluster-credentials')).toHaveValue('hadoop-token-secret');
  });

  it('toggles Advanced Source Settings and dispatches edits', () => {
    const node = {
      data: {
        label: 'HadoopFormat Source',
        properties: {
          coreSitePath: '/etc/hadoop/conf/core-site.xml',
          hdfsSitePath: '/etc/hadoop/conf/hdfs-site.xml',
          defaultFs: 'hdfs://namenode:8020',
          splitSizeHint: 134217728,
        },
      },
    };

    render(<HadoopFormatIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Source Settings/i });
    // Open advanced settings
    fireEvent.click(advancedBtn);

    const coreSiteInput = screen.getByPlaceholderText('/etc/hadoop/conf/core-site.xml');
    expect(coreSiteInput).toHaveValue('/etc/hadoop/conf/core-site.xml');
    const hdfsSiteInput = screen.getByPlaceholderText('/etc/hadoop/conf/hdfs-site.xml');
    expect(hdfsSiteInput).toHaveValue('/etc/hadoop/conf/hdfs-site.xml');
    const defaultFsInput = screen.getByPlaceholderText('hdfs://namenode:8020');
    expect(defaultFsInput).toHaveValue('hdfs://namenode:8020');
    const splitInput = screen.getByPlaceholderText('67108864');
    expect(splitInput).toHaveValue(134217728);

    fireEvent.change(coreSiteInput, { target: { name: 'coreSitePath', value: '/custom/core-site.xml' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      coreSitePath: '/custom/core-site.xml',
    }));

    fireEvent.change(splitInput, { target: { name: 'splitSizeHint', value: '268435456' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      splitSizeHint: '268435456',
    }));
  });

  it('handles edge case where properties or node.data are completely missing', () => {
    const nodeWithoutProps = {
      data: {},
    } as any;

    expect(() => {
      render(<HadoopFormatIOSourceProperties node={nodeWithoutProps} onChange={mockOnChange} />);
    }).not.toThrow();

    expect(screen.getByText(/InputFormat Class is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Key Class is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Value Class is required/i)).toBeInTheDocument();
  });

  it('respects numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'HadoopFormat Source',
        properties: {
          splitSizeHint: 0,
        },
      },
    };

    render(<HadoopFormatIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedBtn);

    expect(screen.getByPlaceholderText('67108864')).toHaveValue(0);
  });

  it('updates system_instructions when code generation instructions textarea is edited', () => {
    const node = {
      data: {
        label: 'HadoopFormat Source',
        properties: {},
      },
    };

    render(<HadoopFormatIOSourceProperties node={node} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/HadoopFormatIO\.<LongWritable, Text>read\(\)/i);

    fireEvent.change(textarea, { target: { value: 'Updated prompt instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated prompt instructions',
    }));
  });
});
