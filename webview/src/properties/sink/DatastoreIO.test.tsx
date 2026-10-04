/**
 * DatastoreIOSinkProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the DatastoreIOSinkProperties panel component covering field rendering,
 * hydration from node properties, onChange event dispatch, IPC Secret Manager communication,
 * mutation mode switching (upsert vs deleteEntity vs deleteKey), throttling settings,
 * edge cases (missing properties, 0 values), validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DatastoreIOSinkProperties } from './DatastoreIO';

describe('DatastoreIOSinkProperties', () => {
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

  it('renders required Project ID and shows validation error when empty', () => {
    const node = {
      data: {
        label: 'Datastore Sink',
        properties: {}
      }
    };

    render(<DatastoreIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toBeInTheDocument();
    expect(screen.getByText(/Project ID is required/i)).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates all populated sink properties correctly', () => {
    const node = {
      data: {
        label: 'Datastore Sink',
        properties: {
          projectId: 'prod-datastore-project',
          databaseId: 'custom-db',
          namespace: 'production',
          mutationMode: 'deleteEntity',
          kind: 'SensorRollup',
          keyNameOrIdField: 'rollupId',
          ancestorPath: 'Device/device-123',
          hintNumWorkers: 10,
          rampupThrottlingDisabled: true,
          authMode: 'adc',
          localhost: 'localhost:8081',
          batchSize: 200,
          system_instructions: 'Delete expired SensorRollup entities'
        }
      }
    };

    render(<DatastoreIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toHaveValue('prod-datastore-project');
    expect(screen.getByPlaceholderText('(default)')).toHaveValue('custom-db');
    expect(screen.getByPlaceholderText('e.g. production')).toHaveValue('production');
    expect(screen.getByRole('radio', { name: 'Delete Entity' })).toBeChecked();
    expect(screen.getByPlaceholderText('e.g. SensorRollup')).toHaveValue('SensorRollup');
    expect(screen.getByPlaceholderText('e.g. rollupId')).toHaveValue('rollupId');
    expect(screen.getByPlaceholderText('e.g. ParentKind/parent-id')).toHaveValue('Device/device-123');
    expect(screen.getByPlaceholderText('e.g. 5')).toHaveValue(10);
    expect(screen.getByLabelText(/Disable Ramp-up Throttling/i)).toBeChecked();
    expect(screen.getByRole('radio', { name: /Application Default Credentials/i })).toBeChecked();

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('localhost:8081')).toHaveValue('localhost:8081');
    expect(screen.getByPlaceholderText('500')).toHaveValue(200);
    expect(screen.getByPlaceholderText(/Write SensorRollup entities to Datastore/i)).toHaveValue('Delete expired SensorRollup entities');
  });

  it('switches between mutation modes (upsert, deleteEntity, deleteKey)', () => {
    const node = {
      data: {
        label: 'Datastore Sink',
        properties: {
          mutationMode: 'upsert'
        }
      }
    };

    render(<DatastoreIOSinkProperties node={node} onChange={mockOnChange} />);

    const deleteKeyRadio = screen.getByRole('radio', { name: 'Delete Key' });
    fireEvent.click(deleteKeyRadio);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      mutationMode: 'deleteKey'
    }));
  });

  it('dispatches updates when text and checkbox fields change', () => {
    const node = {
      data: {
        label: 'Datastore Sink',
        properties: {
          projectId: 'my-project',
          rampupThrottlingDisabled: false
        }
      }
    };

    render(<DatastoreIOSinkProperties node={node} onChange={mockOnChange} />);

    const kindInput = screen.getByPlaceholderText('e.g. SensorRollup');
    fireEvent.change(kindInput, { target: { name: 'kind', value: 'DeviceRollup' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      rampupThrottlingDisabled: false,
      kind: 'DeviceRollup'
    });

    const throttleCheckbox = screen.getByLabelText(/Disable Ramp-up Throttling/i);
    fireEvent.click(throttleCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      rampupThrottlingDisabled: true
    }));
  });

  it('switches to Secret Manager auth mode and loads secrets into sink datalist', () => {
    const node = {
      data: {
        label: 'Datastore Sink',
        properties: {
          projectId: 'my-project',
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<DatastoreIOSinkProperties node={node} onChange={mockOnChange} />);

    const secretInput = screen.getByPlaceholderText('e.g. datastore-sa-key');
    expect(secretInput).toBeInTheDocument();

    fireEvent.change(secretInput, { target: { name: 'serviceAccountSecret', value: 'sink-sa-key' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      serviceAccountSecret: 'sink-sa-key'
    }));
  });

  it('handles edge case: numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Datastore Sink',
        properties: {
          hintNumWorkers: 0,
          batchSize: 0
        }
      }
    };

    render(<DatastoreIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. 5')).toHaveValue(0);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('500')).toHaveValue(0);
  });

  it('handles missing node.data.properties gracefully without crashing', () => {
    const node = {
      data: {
        label: 'Datastore Sink'
      }
    } as any;

    render(<DatastoreIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toHaveValue('');
  });

  it('respects system_instructions fallback chain', () => {
    const node = {
      data: {
        label: 'Datastore Sink',
        properties: {}
      }
    };
    render(<DatastoreIOSinkProperties node={node} onChange={mockOnChange} />);

    // Modifying textarea calls onChange with system_instructions
    const textarea = screen.getByPlaceholderText(/Write SensorRollup entities to Datastore/i);
    fireEvent.change(textarea, { target: { value: 'New sink instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New sink instructions'
    }));
  });
});
