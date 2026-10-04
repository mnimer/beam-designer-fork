/**
 * Unit Tests for HBaseIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates HBaseIOSourceProperties form rendering, hydration, field validation,
 * authentication mode toggling (Simple, Kerberos, Secret Manager),
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
import { HBaseIOSourceProperties } from './HBaseIO';

describe('HBaseIOSourceProperties', () => {
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

  it('renders required cluster and table fields with errors when empty', () => {
    const node = {
      data: {
        label: 'HBase Source',
        properties: {},
      },
    };

    render(<HBaseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('zk1.example.com,zk2.example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. sensor_readings')).toBeInTheDocument();
    expect(screen.getByText(/ZooKeeper Quorum is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Table ID is required/i)).toBeInTheDocument();

    const zkInput = screen.getByPlaceholderText('zk1.example.com,zk2.example.com');
    expect(zkInput).toHaveAttribute('aria-invalid', 'true');
    const tableInput = screen.getByPlaceholderText('e.g. sensor_readings');
    expect(tableInput).toHaveAttribute('aria-invalid', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node properties correctly', () => {
    const node = {
      data: {
        label: 'HBase Source',
        properties: {
          zkQuorum: 'zk1.prod:2181,zk2.prod:2181',
          zkClientPort: 2182,
          znodeParent: '/hbase-secure',
          hbaseRootDir: 'hdfs://namenode:8020/hbase',
          tableId: 'analytics_events',
          keyRangeStart: 'event-0001',
          keyRangeStop: 'event-9999',
          familyFilter: 'metrics',
          qualifierFilter: 'cpu_usage',
          maxVersions: 3,
          scanCacheSize: 1000,
          filterExpression: "RowFilter(EQUAL, 'binary:event-01')",
        },
      },
    };

    render(<HBaseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('zk1.prod:2181,zk2.prod:2181')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2182')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/hbase-secure')).toBeInTheDocument();
    expect(screen.getByDisplayValue('hdfs://namenode:8020/hbase')).toBeInTheDocument();
    expect(screen.getByDisplayValue('analytics_events')).toBeInTheDocument();
    expect(screen.getByDisplayValue('event-0001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('event-9999')).toBeInTheDocument();
    expect(screen.getByDisplayValue('metrics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('cpu_usage')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    expect(screen.getByDisplayValue("RowFilter(EQUAL, 'binary:event-01')")).toBeInTheDocument();

    expect(screen.queryByText(/ZooKeeper Quorum is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Table ID is required/i)).not.toBeInTheDocument();
  });

  it('dispatches updates when cluster, table, and scan inputs change', () => {
    const node = {
      data: {
        label: 'HBase Source',
        properties: {
          zkQuorum: 'zk1.prod',
          tableId: 'raw_logs',
        },
      },
    };

    render(<HBaseIOSourceProperties node={node} onChange={mockOnChange} />);

    const zkInput = screen.getByPlaceholderText('zk1.example.com,zk2.example.com');
    fireEvent.change(zkInput, { target: { name: 'zkQuorum', value: 'zk1.prod,zk2.prod' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      zkQuorum: 'zk1.prod,zk2.prod',
    }));

    const tableInput = screen.getByPlaceholderText('e.g. sensor_readings');
    fireEvent.change(tableInput, { target: { name: 'tableId', value: 'updated_table' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'updated_table',
    }));

    const startKeyInput = screen.getByPlaceholderText('e.g. row-0001');
    fireEvent.change(startKeyInput, { target: { name: 'keyRangeStart', value: 'row-0100' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      keyRangeStart: 'row-0100',
    }));

    const stopKeyInput = screen.getByPlaceholderText('e.g. row-9999');
    fireEvent.change(stopKeyInput, { target: { name: 'keyRangeStop', value: 'row-0500' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      keyRangeStop: 'row-0500',
    }));

    const familyInput = screen.getByPlaceholderText('e.g. metrics');
    fireEvent.change(familyInput, { target: { name: 'familyFilter', value: 'cf_sensor' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      familyFilter: 'cf_sensor',
    }));

    const qualifierInput = screen.getByPlaceholderText('e.g. cpu_usage');
    fireEvent.change(qualifierInput, { target: { name: 'qualifierFilter', value: 'temp_c' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      qualifierFilter: 'temp_c',
    }));
  });

  it('switches authentication modes and reveals Kerberos or Secret Manager fields', () => {
    const node = {
      data: {
        label: 'HBase Source',
        properties: {
          authMode: 'simple',
        },
      },
    };

    const { rerender } = render(<HBaseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('hbase-client@REALM.COM')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. hbase-keytab-secret')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. hbase-connection-credentials')).not.toBeInTheDocument();

    const authSelect = screen.getByRole('combobox');
    fireEvent.change(authSelect, { target: { name: 'authMode', value: 'kerberos' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      authMode: 'kerberos',
    }));

    // Rerender with kerberos
    const kerberosNode = {
      data: {
        label: 'HBase Source',
        properties: {
          authMode: 'kerberos' as const,
          kerberosPrincipal: 'hbase-reader@CORP.NET',
          keytabSecret: 'my-keytab-secret',
        },
      },
    };
    rerender(<HBaseIOSourceProperties node={kerberosNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('hbase-client@REALM.COM')).toHaveValue('hbase-reader@CORP.NET');
    expect(screen.getByPlaceholderText('e.g. hbase-keytab-secret')).toHaveValue('my-keytab-secret');

    // Rerender with secret_manager
    const secretManagerNode = {
      data: {
        label: 'HBase Source',
        properties: {
          authMode: 'secret_manager' as const,
          secretName: 'hbase-vault-secret',
        },
      },
    };
    rerender(<HBaseIOSourceProperties node={secretManagerNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. hbase-connection-credentials')).toHaveValue('hbase-vault-secret');
  });

  it('toggles Advanced Source Settings and dispatches edits', () => {
    const node = {
      data: {
        label: 'HBase Source',
        properties: {
          rpcTimeout: 30000,
          scanBatchSize: 200,
          extraConfig: 'hbase.client.pause=50',
        },
      },
    };

    render(<HBaseIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Source Settings/i });
    // Open advanced settings
    fireEvent.click(advancedBtn);

    const rpcInput = screen.getByPlaceholderText('60000');
    expect(rpcInput).toHaveValue(30000);
    const batchInput = screen.getByPlaceholderText('1000');
    expect(batchInput).toHaveValue(200);
    const extraConfigInput = screen.getByPlaceholderText(/hbase\.client\.retries\.number=3/i);
    expect(extraConfigInput).toHaveValue('hbase.client.pause=50');

    fireEvent.change(rpcInput, { target: { name: 'rpcTimeout', value: '45000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      rpcTimeout: '45000',
    }));

    fireEvent.change(batchInput, { target: { name: 'scanBatchSize', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      scanBatchSize: '500',
    }));
  });

  it('handles edge case where properties or node.data are completely missing', () => {
    const nodeWithoutProps = {
      data: {},
    } as any;

    expect(() => {
      render(<HBaseIOSourceProperties node={nodeWithoutProps} onChange={mockOnChange} />);
    }).not.toThrow();

    expect(screen.getByText(/ZooKeeper Quorum is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Table ID is required/i)).toBeInTheDocument();
  });

  it('respects numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'HBase Source',
        properties: {
          maxVersions: 0,
          scanCacheSize: 0,
          rpcTimeout: 0,
          scanBatchSize: 0,
        },
      },
    };

    render(<HBaseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('1')).toHaveValue(0);
    expect(screen.getByPlaceholderText('500')).toHaveValue(0);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedBtn);

    const rpcInput = screen.getByPlaceholderText('60000');
    expect(rpcInput).toHaveValue(0);
  });

  it('updates system_instructions when code generation instructions textarea is edited', () => {
    const node = {
      data: {
        label: 'HBase Source',
        properties: {},
      },
    };

    render(<HBaseIOSourceProperties node={node} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/Read HBase table using HBaseIO\.read/i);

    fireEvent.change(textarea, { target: { value: 'New prompt instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New prompt instructions',
    }));
  });
});
