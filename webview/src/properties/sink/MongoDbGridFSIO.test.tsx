/**
 * Unit Tests for MongoDbGridFSIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates MongoDbGridFSIOSinkProperties form rendering, hydration, dispatching,
 * IPC callbacks for GCP Secret Manager, field validation, and system instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MongoDbGridFSIOSinkProperties } from './MongoDbGridFSIO';

describe('MongoDbGridFSIOSinkProperties', () => {
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
        label: 'GridFS Sink',
        properties: {}
      }
    };

    render(<MongoDbGridFSIOSinkProperties node={node} onChange={mockOnChange} />);

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
        label: 'GridFS Sink',
        properties: {
          uri: 'mongodb://mongouser:pass@localhost:27017',
          database: 'blobstore',
          bucket: 'uploads',
          filename: 'processed_%d.dat',
          chunkSize: 524288,
          writeFn: 'com.example.UploadWriteFn'
        }
      }
    };

    render(<MongoDbGridFSIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('mongodb://mongouser:pass@localhost:27017')).toBeInTheDocument();
    expect(screen.getByDisplayValue('blobstore')).toBeInTheDocument();
    expect(screen.getByDisplayValue('uploads')).toBeInTheDocument();
    expect(screen.getByDisplayValue('processed_%d.dat')).toBeInTheDocument();
    expect(screen.getByDisplayValue('524288')).toBeInTheDocument();
    expect(screen.getByDisplayValue('com.example.UploadWriteFn')).toBeInTheDocument();
  });

  it('validates URI format and displays warning when not starting with mongodb', () => {
    const node = {
      data: {
        label: 'GridFS Sink',
        properties: {
          uri: 'http://localhost:27017'
        }
      }
    };

    render(<MongoDbGridFSIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByText(/Warning: MongoDB connection URI should start with "mongodb:\/\/" or "mongodb\+srv:\/\/"/i)
    ).toBeInTheDocument();
  });

  it('fires onChange when editing URI, database, bucket, filename, chunkSize, writeFn', () => {
    const node = {
      data: {
        label: 'GridFS Sink',
        properties: {
          uri: 'mongodb://localhost:27017',
          database: 'appdb',
          bucket: 'fs'
        }
      }
    };

    render(<MongoDbGridFSIOSinkProperties node={node} onChange={mockOnChange} />);

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
    fireEvent.change(bucketInput, { target: { name: 'bucket', value: 'archives' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'archives' })
    );

    const filenameInput = screen.getByPlaceholderText('e.g. output_%d.bin or payload.dat');
    fireEvent.change(filenameInput, { target: { name: 'filename', value: 'archive_%s.tar.gz' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'archive_%s.tar.gz' })
    );

    const chunkSizeInput = screen.getByPlaceholderText('e.g. 261120');
    fireEvent.change(chunkSizeInput, { target: { name: 'chunkSize', value: '1048576' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ chunkSize: '1048576' })
    );

    const writeFnInput = screen.getByPlaceholderText('e.g. com.example.DocumentGridFSWriteFn');
    fireEvent.change(writeFnInput, { target: { name: 'writeFn', value: 'com.example.StreamWriter' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ writeFn: 'com.example.StreamWriter' })
    );
  });

  it('handles Secret Manager fields and radio selection', () => {
    const node = {
      data: {
        label: 'GridFS Sink',
        properties: {
          authMode: 'secret_manager',
          usernameSecret: 'mongo-sink-user-secret',
          passwordSecret: 'mongo-sink-pass-secret'
        }
      }
    };

    render(<MongoDbGridFSIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('mongo-sink-user-secret')).toBeInTheDocument();
    expect(screen.getByDisplayValue('mongo-sink-pass-secret')).toBeInTheDocument();

    const userInput = screen.getByDisplayValue('mongo-sink-user-secret');
    fireEvent.change(userInput, { target: { name: 'usernameSecret', value: 'new-sink-user-secret' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ usernameSecret: 'new-sink-user-secret' })
    );
  });

  it('toggles authMode radio button between URI embedded and Secret Manager', () => {
    const node = {
      data: {
        label: 'GridFS Sink',
        properties: {
          authMode: 'uri_embedded'
        }
      }
    };

    render(<MongoDbGridFSIOSinkProperties node={node} onChange={mockOnChange} />);

    const secretRadio = screen.getByLabelText('GCP Secret Manager');
    fireEvent.click(secretRadio);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ authMode: 'secret_manager' })
    );
  });

  it('expands Advanced Sink Settings accordion and edits SSL and timeout options', () => {
    const node = {
      data: {
        label: 'GridFS Sink',
        properties: {
          sslEnabled: false,
          sslInvalidHostNameAllowed: false,
          ignoreSSLCertificate: false,
          maxConnectionIdleTime: ''
        }
      }
    };

    render(<MongoDbGridFSIOSinkProperties node={node} onChange={mockOnChange} />);

    const accordionBtn = screen.getByText('Advanced Sink Settings');
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
    fireEvent.change(idleInput, { target: { name: 'maxConnectionIdleTime', value: '45000' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxConnectionIdleTime: '45000' })
    );

    // Toggle accordion closed
    fireEvent.click(accordionBtn);
    expect(screen.queryByLabelText('SSL / TLS Enabled')).not.toBeInTheDocument();
  });

  it('edits system_instructions', () => {
    render(
      <MongoDbGridFSIOSinkProperties
        node={{ data: { properties: { uri: 'mongodb://localhost:27017' } } }}
        onChange={mockOnChange}
      />
    );
    const textarea = screen.getByPlaceholderText(
      'Custom prompt instructions for generating the Apache Beam MongoDbGridFSIO sink step...'
    );
    fireEvent.change(textarea, { target: { value: 'Ensure chunk size does not exceed 16MB' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'mongodb://localhost:27017',
        system_instructions: 'Ensure chunk size does not exceed 16MB'
      })
    );
  });
});
