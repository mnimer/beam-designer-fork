/**
 * Unit Tests for MongoDbIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates MongoDbIOSinkProperties form rendering, hydration, dispatching,
 * IPC callbacks for GCP Secret Manager, writeMode switching (insert vs upsert),
 * write concern selection, field validation, and system instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MongoDbIOSinkProperties } from './MongoDbIO';

describe('MongoDbIOSinkProperties', () => {
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

  it('renders required Connection URI, Database, and Collection fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'MongoDB Sink',
        properties: {}
      }
    };

    render(<MongoDbIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('mongodb://localhost:27017 or mongodb+srv://cluster.example.com')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. analytics')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. aggregated_metrics')).toBeInTheDocument();

    expect(screen.getByText('Connection URI is required')).toBeInTheDocument();
    expect(screen.getByText('Database name is required')).toBeInTheDocument();
    expect(screen.getByText('Collection name is required')).toBeInTheDocument();

    const uriInput = screen.getByPlaceholderText('mongodb://localhost:27017 or mongodb+srv://cluster.example.com');
    expect(uriInput).toHaveAttribute('aria-invalid', 'true');
    expect(uriInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node.data.properties', () => {
    const node = {
      data: {
        label: 'MongoDB Sink',
        properties: {
          uri: 'mongodb://cluster0.example.com:27017',
          database: 'telemetry',
          collection: 'hourly_summary',
          batchSize: 500,
          ordered: false,
          writeConcern: 'MAJORITY'
        }
      }
    };

    render(<MongoDbIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('mongodb://cluster0.example.com:27017')).toBeInTheDocument();
    expect(screen.getByDisplayValue('telemetry')).toBeInTheDocument();
    expect(screen.getByDisplayValue('hourly_summary')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    expect(screen.getByLabelText(/Ordered Writes/i)).not.toBeChecked();

    const writeConcernSelect = screen.getByRole('combobox', { name: /Write Concern/i });
    expect(writeConcernSelect).toHaveValue('MAJORITY');
  });

  it('validates URI format and displays warning when not starting with mongodb', () => {
    const node = {
      data: {
        label: 'MongoDB Sink',
        properties: {
          uri: 'redis://localhost:6379'
        }
      }
    };

    render(<MongoDbIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByText(/Warning: MongoDB connection URI should start with "mongodb:\/\/" or "mongodb\+srv:\/\/"/i)
    ).toBeInTheDocument();
  });

  it('switches between Insert and Upsert write mode and validates keyFields', () => {
    const node = {
      data: {
        label: 'MongoDB Sink',
        properties: {
          writeMode: 'insert' as const
        }
      }
    };

    render(<MongoDbIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. _id or customerId, date')).not.toBeInTheDocument();

    const upsertRadio = screen.getByRole('radio', { name: /Upsert/i });
    fireEvent.click(upsertRadio);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        writeMode: 'upsert'
      })
    );
  });

  it('validates required keyFields in upsert mode when empty', () => {
    const node = {
      data: {
        label: 'MongoDB Sink',
        properties: {
          writeMode: 'upsert' as const,
          keyFields: ''
        }
      }
    };

    render(<MongoDbIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByText('Key field(s) are required for upsert mode')).toBeInTheDocument();
    const keyFieldsInput = screen.getByPlaceholderText('e.g. _id or customerId, date');
    expect(keyFieldsInput).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(keyFieldsInput, { target: { name: 'keyFields', value: 'userId, timestamp' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        keyFields: 'userId, timestamp'
      })
    );
  });

  it('updates batchSize, ordered writes, and writeConcern and dispatches changes', () => {
    const node = {
      data: {
        label: 'MongoDB Sink',
        properties: {
          batchSize: 100,
          ordered: true,
          writeConcern: 'W1'
        }
      }
    };

    render(<MongoDbIOSinkProperties node={node} onChange={mockOnChange} />);

    const batchSizeInput = screen.getByPlaceholderText('1024');
    fireEvent.change(batchSizeInput, { target: { name: 'batchSize', value: '2048' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        batchSize: '2048'
      })
    );

    const orderedCheckbox = screen.getByLabelText(/Ordered Writes/i);
    fireEvent.click(orderedCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ordered: false
      })
    );

    const writeConcernSelect = screen.getByRole('combobox', { name: /Write Concern/i });
    fireEvent.change(writeConcernSelect, { target: { name: 'writeConcern', value: 'UNACKNOWLEDGED' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        writeConcern: 'UNACKNOWLEDGED'
      })
    );
  });

  it('handles numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'MongoDB Sink',
        properties: {
          batchSize: 0,
          maxConnectionIdleTime: 0
        }
      }
    };

    render(<MongoDbIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
  });

  it('supports Secret Manager authentication mode and receives IPC secrets', () => {
    const node = {
      data: {
        label: 'MongoDB Sink',
        properties: {
          authMode: 'secret_manager' as const,
          usernameSecret: 'sink-user-secret',
          passwordSecret: 'sink-pass-secret'
        }
      }
    };

    render(<MongoDbIOSinkProperties node={node} onChange={mockOnChange} />);

    const userSecretInput = screen.getByPlaceholderText('e.g. mongodb-username');
    const passSecretInput = screen.getByPlaceholderText('e.g. mongodb-password');

    expect(userSecretInput).toHaveValue('sink-user-secret');
    expect(passSecretInput).toHaveValue('sink-pass-secret');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            'projects/my-project/secrets/sink-mongo-key',
            { id: 'sink-mongo-pwd', name: 'sink-mongo-pwd' }
          ]
        }
      })
    );

    const option1 = document.querySelector(
      'datalist#mongodb-sink-secret-options option[value="sink-mongo-key"]'
    );
    const option2 = document.querySelector(
      'datalist#mongodb-sink-secret-options option[value="sink-mongo-pwd"]'
    );
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('renders Secret Manager error when secretsLoaded contains error', () => {
    const node = {
      data: {
        label: 'MongoDB Sink',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<MongoDbIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Failed to access GCP Secret Manager for Sink'
        }
      })
    );

    expect(screen.getByText('Failed to access GCP Secret Manager for Sink')).toBeInTheDocument();
  });

  it('toggles Advanced Sink Settings and updates SSL, retryWrites, and idle time', () => {
    const node = {
      data: {
        label: 'MongoDB Sink',
        properties: {
          sslEnabled: false,
          sslInvalidHostNameAllowed: false,
          retryWrites: false,
          maxConnectionIdleTime: ''
        }
      }
    };

    render(<MongoDbIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    const sslCheckbox = screen.getByLabelText(/SSL \/ TLS Enabled/i);
    expect(sslCheckbox).not.toBeChecked();
    fireEvent.click(sslCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sslEnabled: true
      })
    );

    const allowInvalidHost = screen.getByLabelText(/Allow Invalid Hostname/i);
    fireEvent.click(allowInvalidHost);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sslInvalidHostNameAllowed: true
      })
    );

    const retryWritesCheckbox = screen.getByLabelText(/Retry Writes/i);
    fireEvent.click(retryWritesCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        retryWrites: true
      })
    );

    const idleTimeInput = screen.getByPlaceholderText('0 (Unlimited)');
    fireEvent.change(idleTimeInput, { target: { name: 'maxConnectionIdleTime', value: '45000' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        maxConnectionIdleTime: '45000'
      })
    );
  });

  it('resolves system instructions across the fallback chain', () => {
    // 1. node.data.system_instructions
    const { unmount: unmount1 } = render(
      <MongoDbIOSinkProperties
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
      <MongoDbIOSinkProperties
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
      <MongoDbIOSinkProperties
        node={{
          data: {
            properties: {
              system_instructions: 'Property level system instructions'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Property level system instructions')).toBeInTheDocument();
    unmount3();

    // 4. properties.special_instructions
    const { unmount: unmount4 } = render(
      <MongoDbIOSinkProperties
        node={{
          data: {
            properties: {
              special_instructions: 'Property level special instructions'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Property level special instructions')).toBeInTheDocument();
    unmount4();

    // 5. empty fallback
    render(
      <MongoDbIOSinkProperties
        node={{
          data: {}
        }}
        onChange={mockOnChange}
      />
    );
    const textarea = screen.getByPlaceholderText(/Convert elements to org.bson.Document/i);
    expect(textarea).toHaveValue('');

    fireEvent.change(textarea, { target: { value: 'Synthesize sink pipeline' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Synthesize sink pipeline'
      })
    );
  });

  it('gracefully handles missing properties object on node.data', () => {
    const node = {
      data: {}
    };

    render(<MongoDbIOSinkProperties node={node as any} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('mongodb://localhost:27017 or mongodb+srv://cluster.example.com')
    ).toHaveValue('');
  });
});
