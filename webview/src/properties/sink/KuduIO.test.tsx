/**
 * Unit Tests for KuduIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates KuduIOSinkProperties form rendering, hydration, property change dispatching,
 * IPC callbacks for GCP Secret Manager, field validation, and system instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KuduIOSinkProperties } from './KuduIO';

describe('KuduIOSinkProperties', () => {
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

  it('renders required Master Addresses and Table fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'Kudu Sink',
        properties: {}
      }
    };

    render(<KuduIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('e.g. kudu-master-1:7051,kudu-master-2:7051')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. impala::default.sensor_aggregates')
    ).toBeInTheDocument();

    expect(screen.getByText('Kudu master addresses are required')).toBeInTheDocument();
    expect(screen.getByText('Table name is required')).toBeInTheDocument();

    const masterInput = screen.getByPlaceholderText('e.g. kudu-master-1:7051,kudu-master-2:7051');
    expect(masterInput).toHaveAttribute('aria-invalid', 'true');
    expect(masterInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('renders hydrated values from node.data.properties', () => {
    const node = {
      data: {
        label: 'Kudu Sink',
        properties: {
          masterAddresses: 'kudu1:7051,kudu2:7051',
          table: 'impala::default.sensor_aggregates',
          operation: 'insert' as const,
          flushMode: 'AUTO_FLUSH_SYNC' as const,
          mutationBufferSpace: 5000,
          ignoreDuplicateRows: true,
          authMode: 'none'
        }
      }
    };

    render(<KuduIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('kudu1:7051,kudu2:7051')).toBeInTheDocument();
    expect(screen.getByDisplayValue('impala::default.sensor_aggregates')).toBeInTheDocument();
    expect(screen.getByDisplayValue('INSERT — Insert New Rows')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('AUTO_FLUSH_SYNC (Synchronous Immediate)')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
    expect(screen.getByLabelText(/Ignore Duplicate Rows/i)).toBeChecked();
  });

  it('updates masterAddresses, table, operation, flushMode, and mutationBufferSpace', () => {
    const node = {
      data: {
        label: 'Kudu Sink',
        properties: {
          masterAddresses: 'kudu1:7051'
        }
      }
    };

    render(<KuduIOSinkProperties node={node} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('e.g. impala::default.sensor_aggregates');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'analytics.summaries' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      masterAddresses: 'kudu1:7051',
      table: 'analytics.summaries'
    });

    const opSelect = screen.getByLabelText(/Write Mode \/ Operation/i);
    fireEvent.change(opSelect, { target: { name: 'operation', value: 'update' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      masterAddresses: 'kudu1:7051',
      operation: 'update'
    });

    const flushModeSelect = screen.getByRole('combobox', { name: /Flush Mode/i });
    fireEvent.change(flushModeSelect, {
      target: { name: 'flushMode', value: 'MANUAL_FLUSH' }
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      masterAddresses: 'kudu1:7051',
      flushMode: 'MANUAL_FLUSH'
    });

    const bufferSpaceInput = screen.getByPlaceholderText('e.g. 10000');
    fireEvent.change(bufferSpaceInput, {
      target: { name: 'mutationBufferSpace', value: '20000' }
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      masterAddresses: 'kudu1:7051',
      mutationBufferSpace: '20000'
    });
  });

  it('toggles ignoreDuplicateRows checkbox and dispatches update', () => {
    const node = {
      data: {
        label: 'Kudu Sink',
        properties: {
          ignoreDuplicateRows: false
        }
      }
    };

    render(<KuduIOSinkProperties node={node} onChange={mockOnChange} />);

    const ignoreCheckbox = screen.getByLabelText(/Ignore Duplicate Rows/i);
    expect(ignoreCheckbox).not.toBeChecked();

    fireEvent.click(ignoreCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ignoreDuplicateRows: true
      })
    );
  });

  it('supports Kerberos authentication mode and updates principal and keytab secret', () => {
    const node = {
      data: {
        label: 'Kudu Sink',
        properties: {
          authMode: 'kerberos' as const,
          principal: 'kudu/sink@EXAMPLE.COM',
          keytabSecret: 'kudu-sink-keytab'
        }
      }
    };

    render(<KuduIOSinkProperties node={node} onChange={mockOnChange} />);

    const principalInput = screen.getByPlaceholderText('e.g. kudu/master@EXAMPLE.COM');
    const keytabInput = screen.getByPlaceholderText('e.g. kudu-keytab-secret');

    expect(principalInput).toHaveValue('kudu/sink@EXAMPLE.COM');
    expect(keytabInput).toHaveValue('kudu-sink-keytab');

    fireEvent.change(principalInput, { target: { name: 'principal', value: 'service@REALM' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: 'service@REALM'
      })
    );
  });

  it('supports Secret Manager authentication mode and receives IPC secrets in sink datalist', () => {
    const node = {
      data: {
        label: 'Kudu Sink',
        properties: {
          authMode: 'secret_manager' as const,
          credentialsSecret: 'my-sink-secret'
        }
      }
    };

    render(<KuduIOSinkProperties node={node} onChange={mockOnChange} />);

    const secretInput = screen.getByPlaceholderText('e.g. kudu-client-credentials');
    expect(secretInput).toHaveValue('my-sink-secret');

    // Simulate secretsLoaded event
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            'projects/my-project/secrets/kudu-sink-secret',
            { id: 'kudu-sink-token', name: 'kudu-sink-token' }
          ]
        }
      })
    );

    const option1 = document.querySelector(
      'datalist#kudu-sink-secret-options option[value="kudu-sink-secret"]'
    );
    const option2 = document.querySelector(
      'datalist#kudu-sink-secret-options option[value="kudu-sink-token"]'
    );
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error message when secretsLoaded contains error', () => {
    const node = {
      data: {
        label: 'Kudu Sink',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<KuduIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Failed to access Secret Manager'
        }
      })
    );

    expect(screen.getByText('Failed to access Secret Manager')).toBeInTheDocument();
  });

  it('toggles Advanced Sink Settings and handles numeric fields including 0', () => {
    const node = {
      data: {
        label: 'Kudu Sink',
        properties: {
          operationTimeoutMs: 0,
          maxPendingErrors: 50,
          batchSize: 500
        }
      }
    };

    render(<KuduIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    const timeoutInput = screen.getByPlaceholderText('e.g. 30000');
    expect(timeoutInput).toHaveValue(0);

    const maxErrorsInput = screen.getByPlaceholderText('e.g. 100');
    expect(maxErrorsInput).toHaveValue(50);

    const batchSizeInput = screen.getByPlaceholderText('e.g. 1000');
    expect(batchSizeInput).toHaveValue(500);

    fireEvent.change(batchSizeInput, { target: { name: 'batchSize', value: '2500' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        batchSize: '2500'
      })
    );
  });

  it('handles edge case of missing properties object cleanly', () => {
    const node = {
      data: {
        label: 'Kudu Sink'
      }
    };

    render(<KuduIOSinkProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByText('Kudu master addresses are required')).toBeInTheDocument();
    expect(screen.getByText('Table name is required')).toBeInTheDocument();
  });

  it('resolves system instructions across the fallback chain', () => {
    // 1. node.data.system_instructions
    const { unmount: unmount1 } = render(
      <KuduIOSinkProperties
        node={{
          data: {
            system_instructions: 'Node sink instructions',
            properties: {}
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Node sink instructions')).toBeInTheDocument();
    unmount1();

    // 2. node.data.special_instructions
    const { unmount: unmount2 } = render(
      <KuduIOSinkProperties
        node={{
          data: {
            special_instructions: 'Node special instructions',
            properties: {}
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Node special instructions')).toBeInTheDocument();
    unmount2();

    // 3. properties.system_instructions
    const { unmount: unmount3 } = render(
      <KuduIOSinkProperties
        node={{
          data: {
            properties: {
              system_instructions: 'Properties system instructions'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Properties system instructions')).toBeInTheDocument();
    unmount3();

    // 4. properties.special_instructions
    const { unmount: unmount4 } = render(
      <KuduIOSinkProperties
        node={{
          data: {
            properties: {
              special_instructions: 'Properties special instructions'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Properties special instructions')).toBeInTheDocument();
    unmount4();
  });

  it('updates system_instructions when textarea changes', () => {
    const node = {
      data: {
        label: 'Kudu Sink',
        properties: {}
      }
    };

    render(<KuduIOSinkProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(
      'Custom prompt instructions for generating the Apache Beam KuduIO sink step...'
    );
    fireEvent.change(textarea, {
      target: { value: 'Write mutations to Kudu table using upsert format function.' }
    });

    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Write mutations to Kudu table using upsert format function.'
    });
  });
});
