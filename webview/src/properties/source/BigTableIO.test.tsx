/**
 * Unit Tests for BigTableIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates BigTableIOSourceProperties form rendering, controlled inputs, IPC callbacks
 * for Secret Manager secrets, validation states for required project/instance/table IDs,
 * row filter expressions, advanced timeout settings, and system instruction handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BigTableIOSourceProperties } from './BigTableIO';

describe('BigTableIOSourceProperties', () => {
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

  it('renders required Project ID, Instance ID, Table ID and alerts when empty', () => {
    const node = {
      data: {
        label: 'BigTable Source',
        properties: {}
      }
    };

    render(<BigTableIOSourceProperties node={node} onChange={mockOnChange} />);

    const projectInput = screen.getByPlaceholderText('e.g. my-gcp-project');
    const instanceInput = screen.getByPlaceholderText('e.g. prod-bigtable-instance');
    const tableInput = screen.getByPlaceholderText('e.g. user_sessions');

    expect(projectInput).toBeInTheDocument();
    expect(instanceInput).toBeInTheDocument();
    expect(tableInput).toBeInTheDocument();

    expect(projectInput).toHaveAttribute('aria-invalid', 'true');
    expect(instanceInput).toHaveAttribute('aria-invalid', 'true');
    expect(tableInput).toHaveAttribute('aria-invalid', 'true');

    expect(screen.getByText(/Project ID is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Instance ID is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Table ID is required/i)).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node.data.properties correctly', () => {
    const node = {
      data: {
        label: 'BigTable Source',
        properties: {
          projectId: 'my-dataflow-project',
          instanceId: 'cluster-a',
          tableId: 'sensor_telemetry',
          appProfileId: 'batch-profile',
          rowFilter: 'RowFilter.newBuilder().build()',
          keyRangeStart: 'dev#001',
          keyRangeEnd: 'dev#999',
          maxBufferElementCount: 500,
          authMode: 'adc' as const
        }
      }
    };

    render(<BigTableIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('my-dataflow-project')).toBeInTheDocument();
    expect(screen.getByDisplayValue('cluster-a')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sensor_telemetry')).toBeInTheDocument();
    expect(screen.getByDisplayValue('batch-profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('RowFilter.newBuilder().build()')).toBeInTheDocument();
    expect(screen.getByDisplayValue('dev#001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('dev#999')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
  });

  it('updates fields and dispatches onChange correctly', () => {
    const node = {
      data: {
        label: 'BigTable Source',
        properties: {
          projectId: 'my-project'
        }
      }
    };

    render(<BigTableIOSourceProperties node={node} onChange={mockOnChange} />);

    const instanceInput = screen.getByPlaceholderText('e.g. prod-bigtable-instance');
    fireEvent.change(instanceInput, { target: { name: 'instanceId', value: 'my-instance' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      instanceId: 'my-instance'
    });

    const rowFilterInput = screen.getByPlaceholderText(/RowFilter\.newBuilder/i);
    fireEvent.change(rowFilterInput, { target: { name: 'rowFilter', value: 'row_key_regex' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      rowFilter: 'row_key_regex'
    });
  });

  it('switches to Secret Manager auth mode and loads secrets', () => {
    const node = {
      data: {
        label: 'BigTable Source',
        properties: {
          projectId: 'my-project',
          instanceId: 'my-instance',
          tableId: 'my-table',
          authMode: 'secret_manager' as const,
          serviceAccountSecret: 'bt-sa-key'
        }
      }
    };

    render(<BigTableIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. gcp-bigtable-sa-key')).toBeInTheDocument();

    // Simulate IPC secretsLoaded message
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            { id: 'bt-sa-key', name: 'bt-sa-key' },
            'projects/p/secrets/my-bigtable-key'
          ]
        }
      })
    );

    const datalist = document.getElementById('bigtable-source-secret-options');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);

    // Switch back to ADC
    const adcRadio = screen.getByRole('radio', { name: /Application Default Credentials/i });
    fireEvent.click(adcRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      instanceId: 'my-instance',
      tableId: 'my-table',
      authMode: 'adc',
      serviceAccountSecret: 'bt-sa-key'
    });
  });

  it('renders error on secret manager load failure', () => {
    const node = {
      data: {
        label: 'BigTable Source',
        properties: {
          projectId: 'my-project',
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<BigTableIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Secret Manager unavailable'
        }
      })
    );

    expect(screen.getByText(/Secret Manager unavailable/i)).toBeInTheDocument();
  });

  it('toggles collapsible Advanced Source Settings and updates timeouts and validation', () => {
    const node = {
      data: {
        label: 'BigTable Source',
        properties: {
          projectId: 'my-project'
        }
      }
    };

    render(<BigTableIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('localhost:8086')).not.toBeInTheDocument();

    // Expand advanced settings
    const toggleButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(toggleButton);

    const emulatorInput = screen.getByPlaceholderText('localhost:8086');
    expect(emulatorInput).toBeInTheDocument();
    fireEvent.change(emulatorInput, { target: { name: 'emulatorHost', value: 'localhost:9000' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      emulatorHost: 'localhost:9000'
    });

    const withoutValidationCheckbox = screen.getByRole('checkbox', {
      name: /Disable Pipeline Graph Validation/i
    });
    fireEvent.click(withoutValidationCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      withoutValidation: true
    });
  });

  it('supports numeric fields set to 0 and edge cases with undefined properties', () => {
    const node = {
      data: {
        label: 'BigTable Source',
        properties: {
          attemptTimeoutMs: 0
        }
      }
    };

    render(<BigTableIOSourceProperties node={node as any} onChange={mockOnChange} />);

    // Expand advanced settings to verify attemptTimeoutMs
    const toggleButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(toggleButton);

    const attemptInput = screen.getByPlaceholderText('e.g. 20000');
    expect(attemptInput).toHaveValue(0);

    fireEvent.change(attemptInput, { target: { name: 'attemptTimeoutMs', value: '15000' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      attemptTimeoutMs: '15000'
    });

    // Missing properties object entirely
    const nodeWithoutProps = {
      data: {
        label: 'BigTable Source'
      }
    };
    render(<BigTableIOSourceProperties node={nodeWithoutProps as any} onChange={mockOnChange} />);
    expect(screen.getAllByPlaceholderText('e.g. my-gcp-project').length).toBeGreaterThan(0);
  });

  it('resolves system instructions fallback chain and handles edits', () => {
    const nodeWithSpecial = {
      data: {
        label: 'BigTable Source',
        special_instructions: 'Custom bigtable read special prompt'
      }
    };

    const { rerender } = render(
      <BigTableIOSourceProperties node={nodeWithSpecial} onChange={mockOnChange} />
    );

    const textarea = screen.getByPlaceholderText(/Apply BigtableIO\.read/i);
    expect(textarea).toHaveValue('Custom bigtable read special prompt');

    fireEvent.change(textarea, { target: { value: 'Updated BigtableIO read instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Updated BigtableIO read instructions'
    });

    const nodeWithSystem = {
      data: {
        label: 'BigTable Source',
        system_instructions: 'System instructions take priority',
        special_instructions: 'Fallback instructions'
      }
    };
    rerender(<BigTableIOSourceProperties node={nodeWithSystem} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText(/Apply BigtableIO\.read/i)).toHaveValue(
      'System instructions take priority'
    );
  });
});
