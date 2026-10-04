/**
 * Unit Tests for MongoDbIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates MongoDbIOSourceProperties form rendering, hydration, dispatching,
 * field validation, and system instructions.
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

  it('updates system_instructions when instructions textarea is edited', () => {
    render(
      <MongoDbIOSourceProperties
        node={{
          data: {}
        }}
        onChange={mockOnChange}
      />
    );
    const textarea = screen.getByPlaceholderText(/Read MongoDB BSON documents/i);

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
