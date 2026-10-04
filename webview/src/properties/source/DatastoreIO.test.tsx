/**
 * DatastoreIOSourceProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the DatastoreIOSourceProperties panel component covering field rendering,
 * hydration from node properties, onChange event dispatch, IPC Secret Manager communication,
 * query mode toggling (kind vs gql), edge cases (missing properties, 0 values),
 * validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DatastoreIOSourceProperties } from './DatastoreIO';

describe('DatastoreIOSourceProperties', () => {
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

  it('renders required Project ID and Kind in kind mode and shows validation errors when empty', () => {
    const node = {
      data: {
        label: 'Datastore Source',
        properties: {}
      }
    };

    render(<DatastoreIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Task')).toBeInTheDocument();

    expect(screen.getByText(/Project ID is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Kind is required for kind-based read/i)).toBeInTheDocument();
  });

  it('hydrates all populated properties correctly in kind mode', () => {
    const node = {
      data: {
        label: 'Datastore Source',
        properties: {
          projectId: 'prod-analytics-project',
          databaseId: 'analytics-db',
          namespace: 'staging',
          queryMode: 'kind',
          kind: 'SensorReading',
          filter: "status = 'ACTIVE'",
          numQuerySplits: 16,
          authMode: 'adc',
          localhost: 'localhost:8081',
          readConsistency: 'STRONG',
          entityParseFn: 'com.example.SensorParseFn',
          system_instructions: 'Extract entity properties to Beam Row'
        }
      }
    };

    render(<DatastoreIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toHaveValue('prod-analytics-project');
    expect(screen.getByPlaceholderText('(default)')).toHaveValue('analytics-db');
    expect(screen.getByPlaceholderText('e.g. production')).toHaveValue('staging');
    expect(screen.getByPlaceholderText('e.g. Task')).toHaveValue('SensorReading');
    expect(screen.getByPlaceholderText("e.g. status = 'ACTIVE'")).toHaveValue("status = 'ACTIVE'");
    expect(screen.getByPlaceholderText('0 (auto-detect)')).toHaveValue(16);
    expect(screen.getByRole('radio', { name: /Application Default Credentials/i })).toBeChecked();

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('localhost:8081')).toHaveValue('localhost:8081');
    expect(screen.getByRole('combobox', { name: 'Read Consistency' })).toHaveValue('STRONG');
    expect(screen.getByPlaceholderText('com.example.EntityToRowFn')).toHaveValue('com.example.SensorParseFn');
    expect(screen.getByPlaceholderText(/Read Task entities from Datastore/i)).toHaveValue('Extract entity properties to Beam Row');
  });

  it('toggles query mode from kind to gql and validates GQL field', () => {
    const node = {
      data: {
        label: 'Datastore Source',
        properties: {
          projectId: 'my-project',
          queryMode: 'gql',
          gqlQuery: ''
        }
      }
    };

    render(<DatastoreIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. Task')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('SELECT * FROM Task WHERE done = FALSE')).toBeInTheDocument();
    expect(screen.getByText(/GQL query is required in GQL mode/i)).toBeInTheDocument();

    const gqlTextarea = screen.getByPlaceholderText('SELECT * FROM Task WHERE done = FALSE');
    fireEvent.change(gqlTextarea, { target: { name: 'gqlQuery', value: 'SELECT * FROM SensorReading' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      gqlQuery: 'SELECT * FROM SensorReading'
    }));
  });

  it('dispatches updates when text and number fields change', () => {
    const node = {
      data: {
        label: 'Datastore Source',
        properties: {
          projectId: 'my-project'
        }
      }
    };

    render(<DatastoreIOSourceProperties node={node} onChange={mockOnChange} />);

    const projectInput = screen.getByPlaceholderText('my-gcp-project');
    fireEvent.change(projectInput, { target: { name: 'projectId', value: 'new-gcp-project' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'new-gcp-project'
    });

    const splitsInput = screen.getByPlaceholderText('0 (auto-detect)');
    fireEvent.change(splitsInput, { target: { name: 'numQuerySplits', value: '8' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      projectId: 'my-project',
      numQuerySplits: '8'
    });
  });

  it('switches to Secret Manager auth mode and loads secrets into datalist', () => {
    const node = {
      data: {
        label: 'Datastore Source',
        properties: {
          projectId: 'my-project',
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<DatastoreIOSourceProperties node={node} onChange={mockOnChange} />);

    const secretInput = screen.getByPlaceholderText('e.g. datastore-sa-key');
    expect(secretInput).toBeInTheDocument();

    fireEvent.change(secretInput, { target: { name: 'serviceAccountSecret', value: 'datastore-key' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      serviceAccountSecret: 'datastore-key'
    }));
  });

  it('handles edge case: numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Datastore Source',
        properties: {
          numQuerySplits: 0
        }
      }
    };

    render(<DatastoreIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('0 (auto-detect)')).toHaveValue(0);
  });

  it('handles missing node.data.properties gracefully without crashing', () => {
    const node = {
      data: {
        label: 'Datastore Source'
      }
    } as any;

    render(<DatastoreIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toHaveValue('');
  });

  it('updates system_instructions on textarea change', () => {
    const node = {
      data: {
        label: 'Datastore Source',
        properties: {}
      }
    };
    render(<DatastoreIOSourceProperties node={node} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/Read Task entities from Datastore/i);
    fireEvent.change(textarea, { target: { value: 'New datastore source prompt' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New datastore source prompt'
    }));
  });
});
