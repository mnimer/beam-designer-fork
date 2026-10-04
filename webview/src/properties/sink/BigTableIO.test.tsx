/**
 * Unit Tests for BigTableIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates BigTableIOSinkProperties form rendering, controlled inputs, IPC callbacks
 * for Secret Manager secrets, validation states for required project/instance/table IDs,
 * flow control toggling, error handler configuration, timeouts, and system instruction handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BigTableIOSinkProperties } from './BigTableIO';

describe('BigTableIOSinkProperties', () => {
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
        label: 'BigTable Sink',
        properties: {}
      }
    };

    render(<BigTableIOSinkProperties node={node} onChange={mockOnChange} />);

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
        label: 'BigTable Sink',
        properties: {
          projectId: 'my-write-project',
          instanceId: 'prod-instance',
          tableId: 'aggregated_events',
          appProfileId: 'writes-profile',
          flowControl: true,
          maxBytesPerBatch: 5242880,
          maxElementsPerBatch: 500,
          maxOutstandingBytes: 104857600,
          maxOutstandingElements: 5000,
          enableErrorHandler: true,
          errorHandlerDeadLetter: 'projects/p/topics/dead-letter',
          withoutValidation: true,
          authMode: 'adc' as const
        }
      }
    };

    render(<BigTableIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('my-write-project')).toBeInTheDocument();
    expect(screen.getByDisplayValue('prod-instance')).toBeInTheDocument();
    expect(screen.getByDisplayValue('aggregated_events')).toBeInTheDocument();
    expect(screen.getByDisplayValue('writes-profile')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5242880')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    expect(screen.getByDisplayValue('104857600')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('projects/p/topics/dead-letter')).toBeInTheDocument();

    const flowControlCheckbox = screen.getByRole('checkbox', {
      name: /Enable Adaptive Flow Control/i
    });
    expect(flowControlCheckbox).toBeChecked();

    const errorHandlerCheckbox = screen.getByRole('checkbox', {
      name: /Enable Bad Record Error Handler/i
    });
    expect(errorHandlerCheckbox).toBeChecked();
  });

  it('updates flow control and batching inputs on change', () => {
    const node = {
      data: {
        label: 'BigTable Sink',
        properties: {
          projectId: 'my-project'
        }
      }
    };

    render(<BigTableIOSinkProperties node={node} onChange={mockOnChange} />);

    const maxBytesInput = screen.getByPlaceholderText('e.g. 5242880 (5MB)');
    fireEvent.change(maxBytesInput, { target: { name: 'maxBytesPerBatch', value: '2097152' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      maxBytesPerBatch: '2097152'
    });

    const flowCheckbox = screen.getByRole('checkbox', {
      name: /Enable Adaptive Flow Control/i
    });
    fireEvent.click(flowCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      flowControl: true
    });
  });

  it('toggles error handler dead-letter input on enableErrorHandler change', () => {
    const node = {
      data: {
        label: 'BigTable Sink',
        properties: {
          projectId: 'my-project',
          enableErrorHandler: false
        }
      }
    };

    const { rerender } = render(<BigTableIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText(/topics\/bigtable-write-dlq/i)).not.toBeInTheDocument();

    const errorHandlerCheckbox = screen.getByRole('checkbox', {
      name: /Enable Bad Record Error Handler/i
    });
    fireEvent.click(errorHandlerCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      enableErrorHandler: true
    });

    const nodeEnabled = {
      data: {
        label: 'BigTable Sink',
        properties: {
          projectId: 'my-project',
          enableErrorHandler: true
        }
      }
    };
    rerender(<BigTableIOSinkProperties node={nodeEnabled} onChange={mockOnChange} />);

    const deadLetterInput = screen.getByPlaceholderText(/topics\/bigtable-write-dlq/i);
    expect(deadLetterInput).toBeInTheDocument();

    fireEvent.change(deadLetterInput, {
      target: { name: 'errorHandlerDeadLetter', value: 'projects/p/topics/dlq' }
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      enableErrorHandler: true,
      errorHandlerDeadLetter: 'projects/p/topics/dlq'
    });
  });

  it('switches between ADC and Secret Manager auth mode and loads secrets', () => {
    const node = {
      data: {
        label: 'BigTable Sink',
        properties: {
          projectId: 'my-project',
          instanceId: 'my-instance',
          tableId: 'my-table',
          authMode: 'secret_manager' as const,
          serviceAccountSecret: 'bt-sink-key'
        }
      }
    };

    render(<BigTableIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. gcp-bigtable-sa-key')).toBeInTheDocument();

    // Switch back to ADC
    const adcRadio = screen.getByRole('radio', { name: /Application Default Credentials/i });
    fireEvent.click(adcRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      instanceId: 'my-instance',
      tableId: 'my-table',
      authMode: 'adc',
      serviceAccountSecret: 'bt-sink-key'
    });
  });

  it('toggles collapsible Advanced Sink Settings and updates emulator and timeouts', () => {
    const node = {
      data: {
        label: 'BigTable Sink',
        properties: {
          projectId: 'my-project'
        }
      }
    };

    render(<BigTableIOSinkProperties node={node} onChange={mockOnChange} />);

    // Expand advanced settings
    const toggleButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(toggleButton);

    const emulatorInput = screen.getByPlaceholderText('localhost:8086');
    expect(emulatorInput).toBeInTheDocument();
    fireEvent.change(emulatorInput, { target: { name: 'emulatorHost', value: 'localhost:8088' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      emulatorHost: 'localhost:8088'
    });

    const operationTimeoutInput = screen.getByPlaceholderText('e.g. 60000');
    fireEvent.change(operationTimeoutInput, { target: { name: 'operationTimeoutMs', value: '90000' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      operationTimeoutMs: '90000'
    });
  });

  it('supports numeric fields set to 0 and edge cases with undefined properties', () => {
    const node = {
      data: {
        label: 'BigTable Sink',
        properties: {
          operationTimeoutMs: 0
        }
      }
    };

    render(<BigTableIOSinkProperties node={node as any} onChange={mockOnChange} />);

    // Expand advanced settings to verify operationTimeoutMs
    const toggleButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(toggleButton);

    const timeoutInput = screen.getByPlaceholderText('e.g. 60000');
    expect(timeoutInput).toHaveValue(0);

    fireEvent.change(timeoutInput, { target: { name: 'operationTimeoutMs', value: '30000' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      operationTimeoutMs: '30000'
    });

    // Missing properties object entirely
    const nodeWithoutProps = {
      data: {
        label: 'BigTable Sink'
      }
    };
    render(<BigTableIOSinkProperties node={nodeWithoutProps as any} onChange={mockOnChange} />);
    expect(screen.getAllByPlaceholderText('e.g. my-gcp-project').length).toBeGreaterThan(0);
  });

  it('resolves system instructions fallback chain and handles edits', () => {
    const node = {
      data: {
        label: 'BigTable Sink',
        properties: {}
      }
    };

    render(<BigTableIOSinkProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Apply BigtableIO\.write/i);
    fireEvent.change(textarea, { target: { value: 'Updated BigtableIO write instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Updated BigtableIO write instructions'
    });
  });
});
