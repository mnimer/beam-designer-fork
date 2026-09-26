/**
 * Unit Tests for HBaseIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates HBaseIOSinkProperties form rendering, hydration, field validation,
 * mutation mode and durability selection, authentication mode toggling (Simple, Kerberos, Secret Manager),
 * IPC callbacks for Google Cloud Secret Manager, collapsible advanced configuration, and system instructions.
 *
 * Architectural Decisions:
 * - Emulates VS Code extension host postMessage IPC to verify getSecrets request and response.
 * - Thoroughly tests normal hydration, dispatch updates, edge cases, failure states, and instruction fallbacks.
 * - Uses accessible role and placeholder queries to test UI state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HBaseIOSinkProperties } from './HBaseIO';

describe('HBaseIOSinkProperties', () => {
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
        label: 'HBase Sink',
        properties: {},
      },
    };

    render(<HBaseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('zk1.example.com,zk2.example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. sensor_aggregates')).toBeInTheDocument();
    expect(screen.getByText(/ZooKeeper Quorum is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Table ID is required/i)).toBeInTheDocument();

    const zkInput = screen.getByPlaceholderText('zk1.example.com,zk2.example.com');
    expect(zkInput).toHaveAttribute('aria-invalid', 'true');
    const tableInput = screen.getByPlaceholderText('e.g. sensor_aggregates');
    expect(tableInput).toHaveAttribute('aria-invalid', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node properties correctly', () => {
    const node = {
      data: {
        label: 'HBase Sink',
        properties: {
          zkQuorum: 'zk1.prod:2181,zk2.prod:2181',
          zkClientPort: 2182,
          znodeParent: '/hbase-secure',
          tableId: 'aggregated_metrics',
          mutationMode: 'delete' as const,
          defaultColumnFamily: 'summary_cf',
          writeBufferSize: 4194304,
          durability: 'ASYNC_WAL' as const,
        },
      },
    };

    render(<HBaseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('zk1.prod:2181,zk2.prod:2181')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2182')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/hbase-secure')).toBeInTheDocument();
    expect(screen.getByDisplayValue('aggregated_metrics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('summary_cf')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4194304')).toBeInTheDocument();

    const mutationSelect = screen.getByLabelText(/Mutation Mode/i, { selector: 'select' });
    expect(mutationSelect).toHaveValue('delete');

    const durabilitySelect = screen.getByLabelText(/Durability/i, { selector: 'select' });
    expect(durabilitySelect).toHaveValue('ASYNC_WAL');

    expect(screen.queryByText(/ZooKeeper Quorum is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Table ID is required/i)).not.toBeInTheDocument();
  });

  it('dispatches updates when cluster, destination, and mutation settings change', () => {
    const node = {
      data: {
        label: 'HBase Sink',
        properties: {
          zkQuorum: 'zk1.prod',
          tableId: 'sink_table',
        },
      },
    };

    render(<HBaseIOSinkProperties node={node} onChange={mockOnChange} />);

    const zkInput = screen.getByPlaceholderText('zk1.example.com,zk2.example.com');
    fireEvent.change(zkInput, { target: { name: 'zkQuorum', value: 'zk1.prod,zk2.prod' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      zkQuorum: 'zk1.prod,zk2.prod',
    }));

    const tableInput = screen.getByPlaceholderText('e.g. sensor_aggregates');
    fireEvent.change(tableInput, { target: { name: 'tableId', value: 'target_table' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      tableId: 'target_table',
    }));

    const cfInput = screen.getByPlaceholderText('e.g. cf');
    fireEvent.change(cfInput, { target: { name: 'defaultColumnFamily', value: 'events_cf' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      defaultColumnFamily: 'events_cf',
    }));

    const bufferInput = screen.getByPlaceholderText('2097152');
    fireEvent.change(bufferInput, { target: { name: 'writeBufferSize', value: '1048576' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      writeBufferSize: '1048576',
    }));

    const mutationSelect = screen.getByLabelText(/Mutation Mode/i, { selector: 'select' });
    fireEvent.change(mutationSelect, { target: { name: 'mutationMode', value: 'increment' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      mutationMode: 'increment',
    }));

    const durabilitySelect = screen.getByLabelText(/Durability/i, { selector: 'select' });
    fireEvent.change(durabilitySelect, { target: { name: 'durability', value: 'SKIP_WAL' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      durability: 'SKIP_WAL',
    }));
  });

  it('switches authentication modes and reveals Kerberos or Secret Manager fields', () => {
    const node = {
      data: {
        label: 'HBase Sink',
        properties: {
          authMode: 'simple',
        },
      },
    };

    const { rerender } = render(<HBaseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('hbase-writer@REALM.COM')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. hbase-keytab-secret')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. hbase-connection-credentials')).not.toBeInTheDocument();

    const authSelect = screen.getByLabelText(/Auth Mode/i, { selector: 'select' });
    fireEvent.change(authSelect, { target: { name: 'authMode', value: 'kerberos' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      authMode: 'kerberos',
    }));

    // Rerender with kerberos
    const kerberosNode = {
      data: {
        label: 'HBase Sink',
        properties: {
          authMode: 'kerberos' as const,
          kerberosPrincipal: 'hbase-writer@CORP.NET',
          keytabSecret: 'my-sink-keytab-secret',
        },
      },
    };
    rerender(<HBaseIOSinkProperties node={kerberosNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('hbase-writer@REALM.COM')).toHaveValue('hbase-writer@CORP.NET');
    expect(screen.getByPlaceholderText('e.g. hbase-keytab-secret')).toHaveValue('my-sink-keytab-secret');

    // Rerender with secret_manager
    const secretManagerNode = {
      data: {
        label: 'HBase Sink',
        properties: {
          authMode: 'secret_manager' as const,
          secretName: 'hbase-sink-vault-secret',
        },
      },
    };
    rerender(<HBaseIOSinkProperties node={secretManagerNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. hbase-connection-credentials')).toHaveValue('hbase-sink-vault-secret');
  });

  it('populates datalist with secrets loaded from extension IPC', () => {
    const node = {
      data: {
        label: 'HBase Sink',
        properties: {
          authMode: 'secret_manager' as const,
        },
      },
    };

    render(<HBaseIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [
          'projects/my-gcp-proj/secrets/hbase-sink-secret',
          { id: 'hbase-sink-keytab', name: 'HBase Sink Keytab' },
        ],
      },
    }));

    const option1 = document.querySelector('datalist#hbase-sink-secret-options option[value="hbase-sink-secret"]');
    const option2 = document.querySelector('datalist#hbase-sink-secret-options option[value="hbase-sink-keytab"]');
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error alert when secrets loading fails from extension IPC', () => {
    const node = {
      data: {
        label: 'HBase Sink',
        properties: {},
      },
    };

    render(<HBaseIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        error: 'Failed to access Google Cloud Secret Manager API for sink',
      },
    }));

    expect(screen.getByText('Failed to access Google Cloud Secret Manager API for sink')).toBeInTheDocument();
  });

  it('toggles Advanced Sink Settings and dispatches edits', () => {
    const node = {
      data: {
        label: 'HBase Sink',
        properties: {
          batchSize: 250,
          rpcTimeout: 45000,
          retryCount: 3,
          extraConfig: 'hbase.client.retries.number=3',
        },
      },
    };

    render(<HBaseIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    expect(screen.queryByPlaceholderText('500')).not.toBeInTheDocument();

    // Open advanced settings
    fireEvent.click(advancedBtn);

    const batchInput = screen.getByPlaceholderText('500');
    expect(batchInput).toHaveValue(250);
    const rpcInput = screen.getByPlaceholderText('60000');
    expect(rpcInput).toHaveValue(45000);
    const retryInput = screen.getByPlaceholderText('5');
    expect(retryInput).toHaveValue(3);
    const extraConfigInput = screen.getByPlaceholderText(/hbase\.client\.retries\.number=5/i);
    expect(extraConfigInput).toHaveValue('hbase.client.retries.number=3');

    fireEvent.change(batchInput, { target: { name: 'batchSize', value: '1000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      batchSize: '1000',
    }));

    fireEvent.change(rpcInput, { target: { name: 'rpcTimeout', value: '90000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      rpcTimeout: '90000',
    }));

    fireEvent.change(retryInput, { target: { name: 'retryCount', value: '10' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      retryCount: '10',
    }));

    // Close advanced settings
    fireEvent.click(advancedBtn);
    expect(screen.queryByPlaceholderText('500')).not.toBeInTheDocument();
  });

  it('handles edge case where properties or node.data are completely missing', () => {
    const nodeWithoutProps = {
      data: {},
    } as any;

    expect(() => {
      render(<HBaseIOSinkProperties node={nodeWithoutProps} onChange={mockOnChange} />);
    }).not.toThrow();

    expect(screen.getByText(/ZooKeeper Quorum is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Table ID is required/i)).toBeInTheDocument();
  });

  it('respects numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'HBase Sink',
        properties: {
          writeBufferSize: 0,
          batchSize: 0,
          rpcTimeout: 0,
          retryCount: 0,
        },
      },
    };

    render(<HBaseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('2097152')).toHaveValue(0);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedBtn);

    expect(screen.getByPlaceholderText('500')).toHaveValue(0);
    expect(screen.getByPlaceholderText('60000')).toHaveValue(0);
    expect(screen.getByPlaceholderText('5')).toHaveValue(0);
  });

  it('resolves system instructions fallback chain and dispatches updates', () => {
    // 1. Fallback to special_instructions on node.data
    const nodeSpecial = {
      data: {
        special_instructions: 'Custom special prompt for HBase sink',
        properties: {},
      },
    };

    const { rerender } = render(<HBaseIOSinkProperties node={nodeSpecial} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/Write Mutation records to HBase table/i);
    expect(textarea).toHaveValue('Custom special prompt for HBase sink');

    // 2. Direct property edit
    fireEvent.change(textarea, { target: { value: 'Updated sink instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated sink instructions',
    }));

    // 3. Fallback when system_instructions is directly in properties
    const nodePropInstructions = {
      data: {
        properties: {
          system_instructions: 'Sink property instructions override',
        },
      },
    };
    rerender(<HBaseIOSinkProperties node={nodePropInstructions} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText(/Write Mutation records to HBase table/i)).toHaveValue('Sink property instructions override');
  });
});
