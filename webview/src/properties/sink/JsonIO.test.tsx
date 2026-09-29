/**
 * Unit Tests for JsonIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates rendering, input handling, Cloud Storage bucket auto-discovery messaging,
 * required-path validation states, JSON Lines mode, compression selection, sharding options,
 * and code generation instructions for JsonIOSinkProperties.
 * 
 * Architectural Decisions:
 * - Uses Vitest and React Testing Library for fast, realistic DOM interaction testing.
 * - Mocks window.vscode.postMessage to verify extension host IPC interactions.
 * - Tests both success and failure scenarios for dynamic storageBucketsLoaded message events.
 * - Verifies that 100% of event handlers, dropdowns, and checkboxes produce proper onChange payloads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { JsonIOSinkProperties, JSON_SINK_COMPRESSION_TYPES } from './JsonIO';

describe('JsonIOSinkProperties', () => {
  const mockOnChange = vi.fn();
  let originalVscode: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing to directory', () => {
    const mockNode: any = {
      data: {
        label: 'JsonIO Sink',
        beam_transform: 'JsonIO',
        properties: {}
      }
    };

    const { container } = render(<JsonIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#jsonSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'JsonIO Sink',
        beam_transform: 'JsonIO',
        properties: {
          to: 'gs://output-bucket/json/events',
          suffix: '.jsonl',
          lines: true,
          compression: 'GZIP',
          numShards: 10,
          shardTemplate: '-SSSSS-of-NNNNN',
          system_instructions: 'Format events as newline-delimited JSON with GZIP compression'
        }
      }
    };

    const { container } = render(<JsonIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#jsonSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#jsonSinkSuffix') as HTMLInputElement;
    const linesCheckbox = container.querySelector('#jsonSinkLines') as HTMLInputElement;
    const compressionSelect = container.querySelector('#jsonSinkCompression') as HTMLSelectElement;
    const shardsInput = container.querySelector('#jsonSinkNumShards') as HTMLInputElement;
    const shardTemplateInput = container.querySelector('#jsonSinkShardTemplate') as HTMLInputElement;
    const instructionsTextarea = container.querySelector('#jsonSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('gs://output-bucket/json/events');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
    expect(suffixInput).toHaveValue('.jsonl');
    expect(linesCheckbox).toBeChecked();
    expect(compressionSelect).toHaveValue('GZIP');
    expect(shardsInput).toHaveValue(10);
    expect(shardTemplateInput).toHaveValue('-SSSSS-of-NNNNN');
    expect(instructionsTextarea).toHaveValue('Format events as newline-delimited JSON with GZIP compression');
  });

  it('handles field changes for destination directory, suffix, lines, and compression', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<JsonIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Change destination directory (.to)
    const toInput = container.querySelector('#jsonSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 's3://analytics-export/json/records' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 's3://analytics-export/json/records'
      })
    );

    // Change suffix
    const suffixInput = container.querySelector('#jsonSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.jsonl' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.jsonl'
      })
    );

    // Toggle lines checkbox
    const linesCheckbox = container.querySelector('#jsonSinkLines') as HTMLInputElement;
    expect(linesCheckbox).toBeChecked(); // default true
    fireEvent.click(linesCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: false
      })
    );

    // Change compression
    const compressionSelect = container.querySelector('#jsonSinkCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'BZIP2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'BZIP2'
      })
    );
  });

  it('handles sharding configuration changes (numShards and shardTemplate)', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<JsonIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Change numShards
    const shardsInput = container.querySelector('#jsonSinkNumShards') as HTMLInputElement;
    fireEvent.change(shardsInput, {
      target: { name: 'numShards', value: '8' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '8'
      })
    );

    // Change shardTemplate
    const shardTemplateInput = container.querySelector('#jsonSinkShardTemplate') as HTMLInputElement;
    fireEvent.change(shardTemplateInput, {
      target: { name: 'shardTemplate', value: '-W-P-SS-of-NN' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        shardTemplate: '-W-P-SS-of-NN'
      })
    );
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<JsonIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#jsonSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Write output records partitioned into 10 shards as JSON Lines' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Write output records partitioned into 10 shards as JSON Lines'
      })
    );
  });

  it('posts getStorageBuckets command to vscode and populates datalist options on storageBucketsLoaded', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode = {
      data: {
        label: 'JsonIO Sink',
        properties: {}
      }
    };

    const { container } = render(<JsonIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Assert getStorageBuckets was posted on mount
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Dispatch storageBucketsLoaded event
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['export-destination-bucket', 'warehouse-sink-bucket']
          }
        })
      );
    });

    // Check datalist options attached to to field
    const datalist = container.querySelector('datalist');
    expect(datalist).toBeInTheDocument();
    const options = datalist?.querySelectorAll('option');
    expect(options?.length).toBe(2);
    expect(options?.[0]).toHaveAttribute('value', 'gs://export-destination-bucket/');
    expect(options?.[1]).toHaveAttribute('value', 'gs://warehouse-sink-bucket/');
  });

  it('surfaces bucket loading error inline when storageBucketsLoaded contains an error with empty destination to', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode = {
      data: {
        label: 'JsonIO Sink',
        properties: {}
      }
    };

    render(<JsonIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Dispatch error response
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'Failed to connect to Google Cloud Storage service'
          }
        })
      );
    });

    // Verify both required validation and bucket discovery error render
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();
    expect(screen.getByText('Failed to load Cloud Storage buckets: Failed to connect to Google Cloud Storage service')).toBeInTheDocument();
  });

  it('surfaces bucket loading error inline when destination to is valid and non-empty (regression test for suppressed discovery error)', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode = {
      data: {
        label: 'JsonIO Sink',
        properties: {
          to: 'gs://valid-sink-bucket/json/output'
        }
      }
    };

    render(<JsonIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Dispatch error response
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'Failed to connect to Google Cloud Storage service'
          }
        })
      );
    });

    // Verify discovery error message is rendered inline even when path is valid
    expect(screen.getByText('Failed to load Cloud Storage buckets: Failed to connect to Google Cloud Storage service')).toBeInTheDocument();
  });

  it('omits unsupported XZ compression codec and documents Java JsonIO.writeRows vs Python WriteToJson for lines and compression (regression test)', () => {
    const mockNode: any = {
      data: {
        properties: {
          to: 'gs://valid-sink-bucket/json/output'
        }
      }
    };

    const { container } = render(<JsonIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // XZ is not in Beam's Compression enum and must not be offered
    expect(JSON_SINK_COMPRESSION_TYPES.map((c) => c.value)).not.toContain('XZ');
    const compressionSelect = container.querySelector('#jsonSinkCompression') as HTMLSelectElement;
    const optionValues = Array.from(compressionSelect.querySelectorAll('option')).map((opt) => opt.value);
    expect(optionValues).not.toContain('XZ');
    expect(optionValues).toEqual(['UNCOMPRESSED', 'GZIP', 'BZIP2', 'DEFLATE', 'ZSTD']);

    // Helper texts clearly state Java JsonIO.writeRows(to) vs Python WriteToJson behavior
    expect(screen.getByText(/unconditionally newline-delimited JSON/i)).toBeInTheDocument();
    expect(screen.getByText(/supports/i)).toBeInTheDocument();
    expect(screen.getByText(/\.withCompression\(Compression\)/i)).toBeInTheDocument();
    expect(screen.getByText(/does not accept a/i)).toBeInTheDocument();
  });
});
