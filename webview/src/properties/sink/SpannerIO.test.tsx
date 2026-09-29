/**
 * Unit Tests for SpannerIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates SpannerIOSinkProperties form rendering, hydration, property change dispatching,
 * mutation mode selection, throughput/batching controls, failure mode switching,
 * IPC callbacks for GCP Secret Manager, field validation, and system instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SpannerIOSinkProperties } from './SpannerIO';

describe('SpannerIOSinkProperties', () => {
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

  it('renders required Instance ID and Database ID fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'Spanner Sink',
        properties: {}
      }
    };

    render(<SpannerIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('e.g. production-spanner-instance')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. customer_records')
    ).toBeInTheDocument();

    expect(screen.getByText('Spanner instance ID is required')).toBeInTheDocument();
    expect(screen.getByText('Spanner database ID is required')).toBeInTheDocument();

    const instanceInput = screen.getByPlaceholderText('e.g. production-spanner-instance');
    expect(instanceInput).toHaveAttribute('aria-invalid', 'true');
    expect(instanceInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('renders hydrated values from node.data.properties', () => {
    const node = {
      data: {
        label: 'Spanner Sink',
        properties: {
          instanceId: 'target-instance',
          databaseId: 'target-db',
          projectId: 'target-project',
          mutationMode: 'insert' as const,
          batchSizeBytes: 2097152,
          maxNumMutations: 8000,
          maxNumRows: 1000,
          groupingFactor: 500,
          failureMode: 'REPORT_FAILURES' as const,
          highPriority: true,
          authMode: 'adc' as const
        }
      }
    };

    render(<SpannerIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('target-instance')).toBeInTheDocument();
    expect(screen.getByDisplayValue('target-db')).toBeInTheDocument();
    expect(screen.getByDisplayValue('target-project')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('insert (INSERT — Insert New Rows Only)')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('2097152')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('REPORT_FAILURES (Dead-Letter Tagged Output)')
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/High Priority RPC/i)).toBeChecked();
  });

  it('updates instanceId, databaseId, projectId, and mutationMode when changed', () => {
    const node = {
      data: {
        label: 'Spanner Sink',
        properties: {
          instanceId: 'dev-instance'
        }
      }
    };

    render(<SpannerIOSinkProperties node={node} onChange={mockOnChange} />);

    const dbInput = screen.getByPlaceholderText('e.g. customer_records');
    fireEvent.change(dbInput, { target: { name: 'databaseId', value: 'analytics' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      instanceId: 'dev-instance',
      databaseId: 'analytics'
    });

    const modeSelect = screen.getByRole('combobox', { name: /^Mutation Mode/i });
    fireEvent.change(modeSelect, { target: { name: 'mutationMode', value: 'replace' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      instanceId: 'dev-instance',
      mutationMode: 'replace'
    });
  });

  it('updates throughput controls and toggles highPriority', () => {
    const node = {
      data: {
        label: 'Spanner Sink',
        properties: {
          instanceId: 'dev-instance',
          batchSizeBytes: '',
          highPriority: false
        }
      }
    };

    render(<SpannerIOSinkProperties node={node} onChange={mockOnChange} />);

    const batchSizeInput = screen.getByPlaceholderText('e.g. 1048576 (1MB)');
    fireEvent.change(batchSizeInput, { target: { name: 'batchSizeBytes', value: '4194304' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      instanceId: 'dev-instance',
      batchSizeBytes: '4194304',
      highPriority: false
    });

    const highPriorityCheckbox = screen.getByLabelText(/High Priority RPC/i);
    expect(highPriorityCheckbox).not.toBeChecked();
    fireEvent.click(highPriorityCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        highPriority: true
      })
    );
  });

  it('updates failureMode select dropdown', () => {
    const node = {
      data: {
        label: 'Spanner Sink',
        properties: {
          instanceId: 'dev-instance',
          failureMode: 'FAIL_FAST' as const
        }
      }
    };

    render(<SpannerIOSinkProperties node={node} onChange={mockOnChange} />);

    const failureModeSelect = screen.getByRole('combobox', { name: /^Failure Mode/i });
    fireEvent.change(failureModeSelect, { target: { name: 'failureMode', value: 'REPORT_FAILURES' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      instanceId: 'dev-instance',
      failureMode: 'REPORT_FAILURES'
    });
  });

  it('supports Secret Manager authentication mode and receives IPC secrets in sink datalist', () => {
    const node = {
      data: {
        label: 'Spanner Sink',
        properties: {
          authMode: 'secret_manager' as const,
          serviceAccountKeySecret: 'spanner-writer-key'
        }
      }
    };

    render(<SpannerIOSinkProperties node={node} onChange={mockOnChange} />);

    const secretInput = screen.getByPlaceholderText('e.g. spanner-sa-key');
    expect(secretInput).toHaveValue('spanner-writer-key');

    // Simulate secretsLoaded event
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            'projects/my-project/secrets/spanner-sink-secret',
            { id: 'spanner-sink-sa', name: 'spanner-sink-sa' }
          ]
        }
      })
    );

    const option1 = document.querySelector(
      'datalist#spanner-sink-secret-options option[value="spanner-sink-secret"]'
    );
    const option2 = document.querySelector(
      'datalist#spanner-sink-secret-options option[value="spanner-sink-sa"]'
    );
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error message when secretsLoaded contains error', () => {
    const node = {
      data: {
        label: 'Spanner Sink',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<SpannerIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Access denied to Secret Manager'
        }
      })
    );

    expect(screen.getByText('Access denied to Secret Manager')).toBeInTheDocument();
  });

  it('toggles Advanced Sink Settings and updates host, commit deadline, backoff, and database role', () => {
    const node = {
      data: {
        label: 'Spanner Sink',
        properties: {
          host: 'localhost:9010',
          commitDeadlineSeconds: 45,
          maxCumulativeBackoffSeconds: 600,
          databaseRole: 'writer_role'
        }
      }
    };

    render(<SpannerIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    const hostInput = screen.getByPlaceholderText('e.g. localhost:9010');
    expect(hostInput).toHaveValue('localhost:9010');

    const deadlineInput = screen.getByPlaceholderText('e.g. 60');
    expect(deadlineInput).toHaveValue(45);

    const backoffInput = screen.getByPlaceholderText('e.g. 900');
    expect(backoffInput).toHaveValue(600);

    const roleInput = screen.getByPlaceholderText('e.g. analytics_writer');
    expect(roleInput).toHaveValue('writer_role');

    fireEvent.change(deadlineInput, { target: { name: 'commitDeadlineSeconds', value: '90' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        commitDeadlineSeconds: '90'
      })
    );
  });

  it('handles edge case of missing properties object cleanly', () => {
    const node = {
      data: {
        label: 'Spanner Sink'
      }
    };

    render(<SpannerIOSinkProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByText('Spanner instance ID is required')).toBeInTheDocument();
    expect(screen.getByText('Spanner database ID is required')).toBeInTheDocument();
  });

  it('resolves system instructions across the fallback chain', () => {
    // 1. node.data.system_instructions
    const { unmount: unmount1 } = render(
      <SpannerIOSinkProperties
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
      <SpannerIOSinkProperties
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
      <SpannerIOSinkProperties
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
      <SpannerIOSinkProperties
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
        label: 'Spanner Sink',
        properties: {}
      }
    };

    render(<SpannerIOSinkProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(
      'Custom prompt instructions for generating the Apache Beam SpannerIO sink step...'
    );
    fireEvent.change(textarea, {
      target: { value: 'Write mutations to Cloud Spanner table with retry deadlines.' }
    });

    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Write mutations to Cloud Spanner table with retry deadlines.'
    });
  });
});
