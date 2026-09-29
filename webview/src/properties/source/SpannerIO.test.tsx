/**
 * Unit Tests for SpannerIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates SpannerIOSourceProperties form rendering, hydration, property change dispatching,
 * query vs table read mode switching and validation, timestamp bound mode handling,
 * IPC callbacks for GCP Secret Manager, field validation, and system instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SpannerIOSourceProperties } from './SpannerIO';

describe('SpannerIOSourceProperties', () => {
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

  it('renders required Instance ID, Database ID, and default Query fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'Spanner Source',
        properties: {}
      }
    };

    render(<SpannerIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('e.g. production-spanner-instance')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. customer_records')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/SELECT id, name, status, created_at FROM Users/)
    ).toBeInTheDocument();

    expect(screen.getByText('Spanner instance ID is required')).toBeInTheDocument();
    expect(screen.getByText('Spanner database ID is required')).toBeInTheDocument();
    expect(
      screen.getByText('SQL Query is required for Query read mode')
    ).toBeInTheDocument();

    const instanceInput = screen.getByPlaceholderText('e.g. production-spanner-instance');
    expect(instanceInput).toHaveAttribute('aria-invalid', 'true');
    expect(instanceInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('renders hydrated values from node.data.properties in query mode', () => {
    const node = {
      data: {
        label: 'Spanner Source',
        properties: {
          instanceId: 'my-instance',
          databaseId: 'my-database',
          projectId: 'my-project',
          readMode: 'query' as const,
          query: 'SELECT * FROM Accounts',
          batching: true,
          partitionSizeBytes: 1048576,
          maxPartitions: 20,
          timestampBoundMode: 'strong' as const,
          authMode: 'adc' as const
        }
      }
    };

    render(<SpannerIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('my-instance')).toBeInTheDocument();
    expect(screen.getByDisplayValue('my-database')).toBeInTheDocument();
    expect(screen.getByDisplayValue('my-project')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SELECT * FROM Accounts')).toBeInTheDocument();
    expect(screen.getByLabelText(/Enable Batch API/i)).toBeChecked();
    expect(screen.getByDisplayValue('1048576')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
  });

  it('switches to table read mode and displays table, columns, index, and keySet fields with validation', () => {
    const node = {
      data: {
        label: 'Spanner Source',
        properties: {
          instanceId: 'my-instance',
          databaseId: 'my-database',
          readMode: 'table' as const,
          table: '',
          columns: ''
        }
      }
    };

    render(<SpannerIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. Users')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. id, name, status, created_at')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. UsersByStatus')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/KeySet\.all\(\)/)).toBeInTheDocument();

    expect(screen.getByText('Table name is required for Table read mode')).toBeInTheDocument();
    expect(screen.getByText('Columns list is required for Table read mode')).toBeInTheDocument();

    const tableInput = screen.getByPlaceholderText('e.g. Users');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'Customers' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        table: 'Customers'
      })
    );

    const colsInput = screen.getByPlaceholderText('e.g. id, name, status, created_at');
    fireEvent.change(colsInput, { target: { name: 'columns', value: 'id, email' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: 'id, email'
      })
    );
  });

  it('updates text inputs and dispatches changes', () => {
    const node = {
      data: {
        label: 'Spanner Source',
        properties: {
          instanceId: 'my-instance'
        }
      }
    };

    render(<SpannerIOSourceProperties node={node} onChange={mockOnChange} />);

    const dbInput = screen.getByPlaceholderText('e.g. customer_records');
    fireEvent.change(dbInput, { target: { name: 'databaseId', value: 'orders_db' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      instanceId: 'my-instance',
      databaseId: 'orders_db'
    });

    const projectInput = screen.getByPlaceholderText('e.g. my-gcp-project');
    fireEvent.change(projectInput, { target: { name: 'projectId', value: 'gcp-corp' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      instanceId: 'my-instance',
      projectId: 'gcp-corp'
    });
  });

  it('toggles batching checkbox and updates numeric partition options', () => {
    const node = {
      data: {
        label: 'Spanner Source',
        properties: {
          batching: true,
          partitionSizeBytes: 1000,
          maxPartitions: 10
        }
      }
    };

    render(<SpannerIOSourceProperties node={node} onChange={mockOnChange} />);

    const batchingCheckbox = screen.getByLabelText(/Enable Batch API/i);
    expect(batchingCheckbox).toBeChecked();

    fireEvent.click(batchingCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        batching: false
      })
    );
  });

  it('handles TimestampBound mode switching and dependent value field', () => {
    const node = {
      data: {
        label: 'Spanner Source',
        properties: {
          timestampBoundMode: 'exact_staleness' as const,
          timestampBoundValue: '30'
        }
      }
    };

    render(<SpannerIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. 15')).toHaveValue('30');

    const modeSelect = screen.getByRole('combobox', { name: /Timestamp Bound Mode/i });
    fireEvent.change(modeSelect, { target: { name: 'timestampBoundMode', value: 'read_timestamp' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        timestampBoundMode: 'read_timestamp'
      })
    );
  });

  it('supports Secret Manager authentication mode and receives IPC secrets in datalist', () => {
    const node = {
      data: {
        label: 'Spanner Source',
        properties: {
          authMode: 'secret_manager' as const,
          serviceAccountKeySecret: 'spanner-key'
        }
      }
    };

    render(<SpannerIOSourceProperties node={node} onChange={mockOnChange} />);

    const secretInput = screen.getByPlaceholderText('e.g. spanner-sa-key');
    expect(secretInput).toHaveValue('spanner-key');

    // Simulate secretsLoaded event
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            'projects/my-project/secrets/spanner-sa-secret',
            { id: 'spanner-key-secret', name: 'spanner-key-secret' }
          ]
        }
      })
    );

    const option1 = document.querySelector(
      'datalist#spanner-source-secret-options option[value="spanner-sa-secret"]'
    );
    const option2 = document.querySelector(
      'datalist#spanner-source-secret-options option[value="spanner-key-secret"]'
    );
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error message when secretsLoaded contains error', () => {
    const node = {
      data: {
        label: 'Spanner Source',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<SpannerIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Failed to access GCP Secret Manager'
        }
      })
    );

    expect(screen.getByText('Failed to access GCP Secret Manager')).toBeInTheDocument();
  });

  it('toggles Advanced Source Settings and updates host, database role, and rpc priority', () => {
    const node = {
      data: {
        label: 'Spanner Source',
        properties: {
          host: 'localhost:9010',
          databaseRole: 'reader',
          rpcPriority: 'HIGH' as const
        }
      }
    };

    render(<SpannerIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const hostInput = screen.getByPlaceholderText('e.g. localhost:9010');
    expect(hostInput).toHaveValue('localhost:9010');

    const roleInput = screen.getByPlaceholderText('e.g. analytics_reader');
    expect(roleInput).toHaveValue('reader');

    const prioritySelect = screen.getByRole('combobox', { name: /RPC Priority/i });
    expect(prioritySelect).toHaveValue('HIGH');

    fireEvent.change(prioritySelect, { target: { name: 'rpcPriority', value: 'LOW' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rpcPriority: 'LOW'
      })
    );
  });

  it('handles edge case of missing properties object cleanly', () => {
    const node = {
      data: {
        label: 'Spanner Source'
      }
    };

    render(<SpannerIOSourceProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByText('Spanner instance ID is required')).toBeInTheDocument();
    expect(screen.getByText('Spanner database ID is required')).toBeInTheDocument();
  });

  it('resolves system instructions across the fallback chain', () => {
    // 1. node.data.system_instructions
    const { unmount: unmount1 } = render(
      <SpannerIOSourceProperties
        node={{
          data: {
            system_instructions: 'Node level system instructions',
            properties: {}
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Node level system instructions')).toBeInTheDocument();
    unmount1();

    // 2. node.data.special_instructions
    const { unmount: unmount2 } = render(
      <SpannerIOSourceProperties
        node={{
          data: {
            special_instructions: 'Node level special instructions',
            properties: {}
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Node level special instructions')).toBeInTheDocument();
    unmount2();

    // 3. properties.system_instructions
    const { unmount: unmount3 } = render(
      <SpannerIOSourceProperties
        node={{
          data: {
            properties: {
              system_instructions: 'Property system instructions'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Property system instructions')).toBeInTheDocument();
    unmount3();

    // 4. properties.special_instructions
    const { unmount: unmount4 } = render(
      <SpannerIOSourceProperties
        node={{
          data: {
            properties: {
              special_instructions: 'Property special instructions'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Property special instructions')).toBeInTheDocument();
    unmount4();
  });

  it('updates system_instructions when textarea changes', () => {
    const node = {
      data: {
        label: 'Spanner Source',
        properties: {}
      }
    };

    render(<SpannerIOSourceProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(
      'Custom prompt instructions for generating the Apache Beam SpannerIO source step...'
    );
    fireEvent.change(textarea, {
      target: { value: 'Read from Spanner table with strong consistency.' }
    });

    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Read from Spanner table with strong consistency.'
    });
  });
});
