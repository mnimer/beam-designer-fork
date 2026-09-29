/**
 * Unit Tests for MongoDbIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates MongoDbIOSourceProperties form rendering, hydration, dispatching,
 * IPC callbacks for GCP Secret Manager, field validation, and system instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MongoDbIOSourceProperties } from './MongoDbIO';

describe('MongoDbIOSourceProperties', () => {
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
        label: 'MongoDB Source',
        properties: {}
      }
    };

    render(<MongoDbIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('mongodb://localhost:27017 or mongodb+srv://cluster.example.com')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. analytics')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. events')).toBeInTheDocument();

    expect(screen.getByText('Connection URI is required')).toBeInTheDocument();
    expect(screen.getByText('Database name is required')).toBeInTheDocument();
    expect(screen.getByText('Collection name is required')).toBeInTheDocument();

    const uriInput = screen.getByPlaceholderText('mongodb://localhost:27017 or mongodb+srv://cluster.example.com');
    expect(uriInput).toHaveAttribute('aria-invalid', 'true');
    expect(uriInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('renders hydrated values from node.data.properties', () => {
    const node = {
      data: {
        label: 'MongoDB Source',
        properties: {
          uri: 'mongodb://mongouser:pass@localhost:27017',
          database: 'production',
          collection: 'orders',
          filter: '{"status": "shipped"}',
          projection: '_id, customerId, amount',
          bucketAuto: true,
          numSplits: 8
        }
      }
    };

    render(<MongoDbIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('mongodb://mongouser:pass@localhost:27017')).toBeInTheDocument();
    expect(screen.getByDisplayValue('production')).toBeInTheDocument();
    expect(screen.getByDisplayValue('orders')).toBeInTheDocument();
    expect(screen.getByDisplayValue('{"status": "shipped"}')).toBeInTheDocument();
    expect(screen.getByDisplayValue('_id, customerId, amount')).toBeInTheDocument();
    expect(screen.getByLabelText(/Bucket-Auto Splitting/i)).toBeChecked();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
  });

  it('validates URI format and displays warning when not starting with mongodb', () => {
    const node = {
      data: {
        label: 'MongoDB Source',
        properties: {
          uri: 'http://localhost:27017'
        }
      }
    };

    render(<MongoDbIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByText(/Warning: MongoDB connection URI should start with "mongodb:\/\/" or "mongodb\+srv:\/\/"/i)
    ).toBeInTheDocument();
  });

  it('does not display URI warning when starting with mongodb:// or mongodb+srv://', () => {
    const node = {
      data: {
        label: 'MongoDB Source',
        properties: {
          uri: 'mongodb+srv://cluster.example.com'
        }
      }
    };

    render(<MongoDbIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.queryByText(/Warning: MongoDB connection URI should start with/i)
    ).not.toBeInTheDocument();
  });

  it('updates text inputs and dispatches changes', () => {
    const node = {
      data: {
        label: 'MongoDB Source',
        properties: {
          uri: 'mongodb://localhost:27017'
        }
      }
    };

    render(<MongoDbIOSourceProperties node={node} onChange={mockOnChange} />);

    const dbInput = screen.getByPlaceholderText('e.g. analytics');
    fireEvent.change(dbInput, { target: { name: 'database', value: 'sales' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      uri: 'mongodb://localhost:27017',
      database: 'sales'
    });

    const collInput = screen.getByPlaceholderText('e.g. events');
    fireEvent.change(collInput, { target: { name: 'collection', value: 'transactions' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      uri: 'mongodb://localhost:27017',
      collection: 'transactions'
    });

    const filterInput = screen.getByPlaceholderText('{"status": "active"}');
    fireEvent.change(filterInput, { target: { name: 'filter', value: '{"type": "invoice"}' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      uri: 'mongodb://localhost:27017',
      filter: '{"type": "invoice"}'
    });

    const projectionInput = screen.getByPlaceholderText('e.g. _id, timestamp, userId, status');
    fireEvent.change(projectionInput, { target: { name: 'projection', value: 'total, date' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      uri: 'mongodb://localhost:27017',
      projection: 'total, date'
    });
  });

  it('toggles bucketAuto checkbox and handles numSplits numeric changes', () => {
    const node = {
      data: {
        label: 'MongoDB Source',
        properties: {
          bucketAuto: false,
          numSplits: ''
        }
      }
    };

    render(<MongoDbIOSourceProperties node={node} onChange={mockOnChange} />);

    const bucketAutoCheckbox = screen.getByLabelText(/Bucket-Auto Splitting/i);
    expect(bucketAutoCheckbox).not.toBeChecked();

    fireEvent.click(bucketAutoCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        bucketAuto: true
      })
    );

    const numSplitsInput = screen.getByPlaceholderText('0 (Automatic)');
    fireEvent.change(numSplitsInput, { target: { name: 'numSplits', value: '10' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numSplits: '10'
      })
    );
  });

  it('handles numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'MongoDB Source',
        properties: {
          numSplits: 0,
          maxConnectionIdleTime: 0
        }
      }
    };

    render(<MongoDbIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
  });

  it('supports switching to Secret Manager authentication mode and receives IPC secrets', () => {
    const node = {
      data: {
        label: 'MongoDB Source',
        properties: {
          authMode: 'secret_manager' as const,
          usernameSecret: 'mongo-user',
          passwordSecret: 'mongo-pass'
        }
      }
    };

    render(<MongoDbIOSourceProperties node={node} onChange={mockOnChange} />);

    const userSecretInput = screen.getByPlaceholderText('e.g. mongodb-username');
    const passSecretInput = screen.getByPlaceholderText('e.g. mongodb-password');

    expect(userSecretInput).toHaveValue('mongo-user');
    expect(passSecretInput).toHaveValue('mongo-pass');

    // Simulate secretsLoaded event with string and object formats
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            'projects/my-project/secrets/mongo-user-secret',
            { id: 'mongo-pass-secret', name: 'mongo-pass-secret' }
          ]
        }
      })
    );

    const option1 = document.querySelector(
      'datalist#mongodb-source-secret-options option[value="mongo-user-secret"]'
    );
    const option2 = document.querySelector(
      'datalist#mongodb-source-secret-options option[value="mongo-pass-secret"]'
    );
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('renders Secret Manager error when secretsLoaded contains error', () => {
    const node = {
      data: {
        label: 'MongoDB Source',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<MongoDbIOSourceProperties node={node} onChange={mockOnChange} />);

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

  it('toggles Advanced Source Settings and updates SSL, idle time, and read preference', () => {
    const node = {
      data: {
        label: 'MongoDB Source',
        properties: {
          sslEnabled: true,
          sslInvalidHostNameAllowed: false,
          ignoreSSLCertificate: false,
          maxConnectionIdleTime: 60000,
          readPreference: 'secondaryPreferred'
        }
      }
    };

    render(<MongoDbIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const sslCheckbox = screen.getByLabelText(/SSL \/ TLS Enabled/i);
    expect(sslCheckbox).toBeChecked();

    const allowInvalidHost = screen.getByLabelText(/Allow Invalid Hostname/i);
    expect(allowInvalidHost).not.toBeChecked();
    fireEvent.click(allowInvalidHost);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sslInvalidHostNameAllowed: true
      })
    );

    const ignoreSslCert = screen.getByLabelText(/Ignore SSL Certificate/i);
    expect(ignoreSslCert).not.toBeChecked();
    fireEvent.click(ignoreSslCert);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ignoreSSLCertificate: true
      })
    );

    const idleTimeInput = screen.getByPlaceholderText('0 (Unlimited)');
    expect(idleTimeInput).toHaveValue(60000);
    fireEvent.change(idleTimeInput, { target: { name: 'maxConnectionIdleTime', value: '30000' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        maxConnectionIdleTime: '30000'
      })
    );

    const readPrefSelect = screen.getByLabelText(/Read Preference/i);
    expect(readPrefSelect).toHaveValue('secondaryPreferred');
    fireEvent.change(readPrefSelect, { target: { name: 'readPreference', value: 'nearest' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        readPreference: 'nearest'
      })
    );
  });

  it('resolves system instructions across the fallback chain', () => {
    // 1. node.data.system_instructions
    const { unmount: unmount1 } = render(
      <MongoDbIOSourceProperties
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
      <MongoDbIOSourceProperties
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
      <MongoDbIOSourceProperties
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
      <MongoDbIOSourceProperties
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
      <MongoDbIOSourceProperties
        node={{
          data: {}
        }}
        onChange={mockOnChange}
      />
    );
    const textarea = screen.getByPlaceholderText(/Read MongoDB BSON documents/i);
    expect(textarea).toHaveValue('');

    fireEvent.change(textarea, { target: { value: 'Synthesize custom pipeline' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Synthesize custom pipeline'
      })
    );
  });

  it('gracefully handles missing properties object on node.data', () => {
    const node = {
      data: {}
    };

    render(<MongoDbIOSourceProperties node={node as any} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('mongodb://localhost:27017 or mongodb+srv://cluster.example.com')
    ).toHaveValue('');
  });
});
