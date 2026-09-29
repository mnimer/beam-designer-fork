/**
 * FirestoreIOSinkProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the FirestoreIOSinkProperties panel component covering initial field rendering,
 * hydration from node properties, onChange event dispatch, IPC Secret Manager communication,
 * write operation switching (update, delete, transform), batch tuning, edge cases (missing properties, 0 values),
 * validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FirestoreIOSinkProperties } from './FirestoreIO';

describe('FirestoreIOSinkProperties', () => {
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

  it('renders required Project ID and Target Collection and shows validation errors when empty', () => {
    const node = {
      data: {
        label: 'Firestore Sink',
        properties: {}
      }
    };

    render(<FirestoreIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. processed_events')).toBeInTheDocument();

    expect(screen.getByText(/Project ID is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Target collection is required/i)).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates all populated properties correctly in update mode', () => {
    const node = {
      data: {
        label: 'Firestore Sink',
        properties: {
          projectId: 'my-gcp-project',
          databaseId: 'custom-db',
          targetCollection: 'sensor_readings',
          operation: 'update',
          documentIdField: 'sensor_id',
          mergeFields: 'temperature, status',
          withDeadLetterQueue: true,
          batchSize: 200,
          hintMaxNumWorkers: 16,
          failureHandling: 'dead_letter_queue',
          authMode: 'adc',
          emulatorHost: 'localhost:8085',
          initialBackoffMs: 3000,
          maxAttempts: 7,
          throttling: true,
          system_instructions: 'Custom instructions for sink'
        }
      }
    };

    render(<FirestoreIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toHaveValue('my-gcp-project');
    expect(screen.getByPlaceholderText('(default)')).toHaveValue('custom-db');
    expect(screen.getByPlaceholderText('e.g. processed_events')).toHaveValue('sensor_readings');

    expect(screen.getByLabelText(/Write Operation/i)).toHaveValue('update');
    expect(screen.getByPlaceholderText('e.g. id or document_id')).toHaveValue('sensor_id');
    expect(screen.getByPlaceholderText('e.g. status, updated_at')).toHaveValue('temperature, status');

    expect(screen.getByLabelText(/Enable Dead-Letter Queue/i)).toBeChecked();
    expect(screen.getByPlaceholderText('50')).toHaveValue(200);
    expect(screen.getByPlaceholderText('e.g. 10')).toHaveValue(16);
    expect(screen.getByLabelText(/Failure Handling Mode/i)).toHaveValue('dead_letter_queue');

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('localhost:8080')).toHaveValue('localhost:8085');
    expect(screen.getByPlaceholderText('5000')).toHaveValue(3000);
    expect(screen.getByPlaceholderText('5')).toHaveValue(7);
    expect(screen.getByLabelText(/Enable RPC Throttling/i)).toBeChecked();

    expect(
      screen.getByPlaceholderText(/Map upstream elements to com.google.firestore.v1.Write/i)
    ).toHaveValue('Custom instructions for sink');
  });

  it('dispatches updates when text, checkbox, and select fields change', () => {
    const node = {
      data: {
        label: 'Firestore Sink',
        properties: {}
      }
    };

    render(<FirestoreIOSinkProperties node={node} onChange={mockOnChange} />);

    // Change Project ID
    const projectInput = screen.getByPlaceholderText('my-gcp-project');
    fireEvent.change(projectInput, { target: { name: 'projectId', value: 'my-project-123' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'my-project-123' })
    );

    // Change Target Collection
    const collectionInput = screen.getByPlaceholderText('e.g. processed_events');
    fireEvent.change(collectionInput, { target: { name: 'targetCollection', value: 'events' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ targetCollection: 'events' })
    );

    // Toggle Dead Letter Queue
    const dlqCheckbox = screen.getByLabelText(/Enable Dead-Letter Queue/i);
    fireEvent.click(dlqCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        withDeadLetterQueue: true,
        failureHandling: 'dead_letter_queue'
      })
    );
  });

  it('switches write operations hiding merge fields when not in update mode', () => {
    const { rerender } = render(
      <FirestoreIOSinkProperties
        node={{
          data: {
            properties: {
              operation: 'update',
              mergeFields: 'fieldA, fieldB'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByPlaceholderText('e.g. status, updated_at')).toBeInTheDocument();

    // Switch to delete mode
    rerender(
      <FirestoreIOSinkProperties
        node={{
          data: {
            properties: {
              operation: 'delete'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.queryByPlaceholderText('e.g. status, updated_at')).not.toBeInTheDocument();

    // Switch to transform mode
    rerender(
      <FirestoreIOSinkProperties
        node={{
          data: {
            properties: {
              operation: 'transform'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.queryByPlaceholderText('e.g. status, updated_at')).not.toBeInTheDocument();
  });

  it('switches to Secret Manager auth mode and loads secrets into datalist', () => {
    const node = {
      data: {
        label: 'Firestore Sink',
        properties: {
          authMode: 'secret_manager',
          serviceAccountSecret: 'firestore-key'
        }
      }
    };

    render(<FirestoreIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. firestore-sa-key')).toHaveValue('firestore-key');

    // Simulate IPC secretsLoaded event
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            'projects/456/secrets/firestore-sink-secret-1',
            { id: 'firestore-sink-secret-2', name: 'firestore-sink-secret-2' }
          ]
        }
      })
    );

    const datalist = document.querySelector('datalist#firestore-sink-secret-options');
    expect(datalist).not.toBeNull();
    const options = datalist?.querySelectorAll('option');
    expect(options?.length).toBe(2);
    expect(options?.[0]).toHaveAttribute('value', 'firestore-sink-secret-1');
    expect(options?.[1]).toHaveAttribute('value', 'firestore-sink-secret-2');
  });

  it('displays error when Secret Manager loading fails', () => {
    const node = {
      data: {
        label: 'Firestore Sink',
        properties: {
          authMode: 'secret_manager'
        }
      }
    };

    render(<FirestoreIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Failed to fetch secrets'
        }
      })
    );

    expect(screen.getByText('Failed to fetch secrets')).toBeInTheDocument();
  });

  it('handles edge case: numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Firestore Sink',
        properties: {
          batchSize: 0,
          hintMaxNumWorkers: 0,
          initialBackoffMs: 0,
          maxAttempts: 0
        }
      }
    };

    render(<FirestoreIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('50')).toHaveValue(0);
    expect(screen.getByPlaceholderText('e.g. 10')).toHaveValue(0);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('5000')).toHaveValue(0);
    expect(screen.getByPlaceholderText('5')).toHaveValue(0);
  });

  it('handles missing node.data.properties gracefully without crashing', () => {
    const node = {
      data: {
        label: 'Firestore Sink'
      }
    };

    render(<FirestoreIOSinkProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toHaveValue('');
    expect(screen.getByPlaceholderText('e.g. processed_events')).toHaveValue('');
  });

  it('respects system_instructions fallback chain and handles edits', () => {
    const node = {
      data: {
        special_instructions: 'Sink fallback prompt',
        properties: {}
      }
    };

    render(<FirestoreIOSinkProperties node={node} onChange={mockOnChange} />);

    const instructionsTextarea = screen.getByPlaceholderText(
      /Map upstream elements to com.google.firestore.v1.Write/i
    );
    expect(instructionsTextarea).toHaveValue('Sink fallback prompt');

    fireEvent.change(instructionsTextarea, { target: { value: 'New sink prompt' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'New sink prompt'
      })
    );
  });
});
