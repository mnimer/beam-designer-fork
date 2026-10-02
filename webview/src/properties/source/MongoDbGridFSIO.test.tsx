/**
 * Unit Tests for MongoDbGridFSIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates MongoDbGridFSIOSourceProperties form rendering, hydration, dispatching,
 * field validation, and system instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MongoDbGridFSIOSourceProperties } from './MongoDbGridFSIO';

describe('MongoDbGridFSIOSourceProperties', () => {
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

  it('renders required Connection URI, Database fields and alerts when empty, defaulting bucket to "fs"', () => {
    const node = {
      data: {
        label: 'GridFS Source',
        properties: {}
      }
    };

    render(<MongoDbGridFSIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('mongodb://localhost:27017 or mongodb+srv://cluster.example.com')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. analytics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('fs')).toBeInTheDocument();

    expect(screen.getByText('Connection URI is required')).toBeInTheDocument();
    expect(screen.getByText('Database name is required')).toBeInTheDocument();

    const uriInput = screen.getByPlaceholderText('mongodb://localhost:27017 or mongodb+srv://cluster.example.com');
    expect(uriInput).toHaveAttribute('aria-invalid', 'true');
    expect(uriInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('renders hydrated values from node.data.properties', () => {
    const node = {
      data: {
        label: 'GridFS Source',
        properties: {
          uri: 'mongodb://mongouser:pass@localhost:27017',
          database: 'blobstore',
          bucket: 'documents',
          filter: '{"filename": {"$regex": "^report.*"}}',
          skew: 30000,
          parser: 'com.example.PdfToDocumentParser',
          coder: 'org.apache.beam.sdk.coders.AvroCoder'
        }
      }
    };

    render(<MongoDbGridFSIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('mongodb://mongouser:pass@localhost:27017')).toBeInTheDocument();
    expect(screen.getByDisplayValue('blobstore')).toBeInTheDocument();
    expect(screen.getByDisplayValue('documents')).toBeInTheDocument();
    expect(screen.getByDisplayValue('{"filename": {"$regex": "^report.*"}}')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30000')).toBeInTheDocument();
  });

  it('validates URI format and displays warning when not starting with mongodb', () => {
    const node = {
      data: {
        label: 'GridFS Source',
        properties: {
          uri: 'http://localhost:27017'
        }
      }
    };

    render(<MongoDbGridFSIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByText(/Warning: MongoDB connection URI should start with "mongodb:\/\/" or "mongodb\+srv:\/\/"/i)
    ).toBeInTheDocument();
  });

  it('fires onChange when editing URI, database, bucket, filter, skew', () => {
    const node = {
      data: {
        label: 'GridFS Source',
        properties: {
          uri: 'mongodb://localhost:27017',
          database: 'appdb',
          bucket: 'fs'
        }
      }
    };

    render(<MongoDbGridFSIOSourceProperties node={node} onChange={mockOnChange} />);

    const uriInput = screen.getByDisplayValue('mongodb://localhost:27017');
    fireEvent.change(uriInput, { target: { name: 'uri', value: 'mongodb+srv://cluster.example.com' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'mongodb+srv://cluster.example.com' })
    );

    const dbInput = screen.getByDisplayValue('appdb');
    fireEvent.change(dbInput, { target: { name: 'database', value: 'production' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ database: 'production' })
    );

    const bucketInput = screen.getByDisplayValue('fs');
    fireEvent.change(bucketInput, { target: { name: 'bucket', value: 'reports' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'reports' })
    );

    const filterInput = screen.getByLabelText(/File Filter/i);
    fireEvent.change(filterInput, { target: { name: 'filter', value: '{"metadata.type": "invoice"}' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ filter: '{"metadata.type": "invoice"}' })
    );

    const skewInput = screen.getByPlaceholderText('e.g. 60000');
    fireEvent.change(skewInput, { target: { name: 'skew', value: '120000' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ skew: '120000' })
    );
  });

  it('handles Secret Manager selection and edits usernameSecret', () => {
    const node = {
      data: {
        label: 'GridFS Source',
        properties: {
          authMode: 'secret_manager',
          usernameSecret: 'mongo-user-secret',
          passwordSecret: 'mongo-pass-secret'
        }
      }
    };

    render(<MongoDbGridFSIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('mongo-user-secret')).toBeInTheDocument();
    expect(screen.getByDisplayValue('mongo-pass-secret')).toBeInTheDocument();

    const userInput = screen.getByDisplayValue('mongo-user-secret');
    fireEvent.change(userInput, { target: { name: 'usernameSecret', value: 'new-user-secret' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ usernameSecret: 'new-user-secret' })
    );
  });

  it('toggles authMode radio button between URI embedded and Secret Manager', () => {
    const node = {
      data: {
        label: 'GridFS Source',
        properties: {
          authMode: 'uri_embedded'
        }
      }
    };

    render(<MongoDbGridFSIOSourceProperties node={node} onChange={mockOnChange} />);

    const secretRadio = screen.getByLabelText('GCP Secret Manager');
    fireEvent.click(secretRadio);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ authMode: 'secret_manager' })
    );
  });

  it('expands Advanced Source Settings accordion and edits SSL and timeout options', () => {
    const node = {
      data: {
        label: 'GridFS Source',
        properties: {
          sslEnabled: false,
          sslInvalidHostNameAllowed: false,
          ignoreSSLCertificate: false,
          maxConnectionIdleTime: ''
        }
      }
    };

    render(<MongoDbGridFSIOSourceProperties node={node} onChange={mockOnChange} />);

    const accordionBtn = screen.getByText('Advanced Source Settings');
    fireEvent.click(accordionBtn);

    const sslCheckbox = screen.getByLabelText('SSL / TLS Enabled');
    expect(sslCheckbox).not.toBeChecked();
    fireEvent.click(sslCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ sslEnabled: true })
    );

    const invalidHostCheckbox = screen.getByLabelText('Allow Invalid Hostname');
    fireEvent.click(invalidHostCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ sslInvalidHostNameAllowed: true })
    );

    const ignoreCertCheckbox = screen.getByLabelText('Ignore SSL Certificate');
    fireEvent.click(ignoreCertCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ ignoreSSLCertificate: true })
    );

    const idleInput = screen.getByPlaceholderText('0 (Unlimited)');
    fireEvent.change(idleInput, { target: { name: 'maxConnectionIdleTime', value: '30000' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxConnectionIdleTime: '30000' })
    );
  });

  it('updates system_instructions when instructions textarea is edited', () => {
    render(
      <MongoDbGridFSIOSourceProperties
        node={{ data: { properties: { uri: 'mongodb://localhost:27017' } } }}
        onChange={mockOnChange}
      />
    );
    const textarea = screen.getByPlaceholderText(
      'Custom prompt instructions for generating the Apache Beam MongoDbGridFSIO source step...'
    );
    fireEvent.change(textarea, { target: { value: 'Ensure parser stream is closed after reading' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'mongodb://localhost:27017',
        system_instructions: 'Ensure parser stream is closed after reading'
      })
    );
  });

  it('handles missing window.vscode gracefully on mount without crashing', () => {
    delete (window as any).vscode;
    const node = {
      data: {
        properties: {}
      }
    };

    expect(() => render(<MongoDbGridFSIOSourceProperties node={node} onChange={mockOnChange} />)).not.toThrow();
  });
});
