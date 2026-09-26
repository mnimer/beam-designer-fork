/**
 * TFRecordIO Sink Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating TFRecordIOSinkProperties component functionality,
 * form change callbacks, validation states, sharding accordion toggling,
 * dynamic extension GCS bucket discovery IPC, and code generation instructions.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Validates required field states, default fallbacks, and error boundaries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TFRecordIOSinkProperties } from './TFRecordIO';

describe('TFRecordIOSinkProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing destination (.to)', () => {
    const mockNode: any = {
      data: {
        label: 'TFRecordIO',
        beam_transform: 'TFRecordIO',
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#tfrecordSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'TFRecordIO',
        beam_transform: 'TFRecordIO',
        properties: {
          to: 'gs://my-bucket/output/records',
          suffix: '.gz.tfrecord',
          compressionType: 'GZIP',
          numShards: 8,
          shardTemplate: '-SSSSS-of-NNNNN',
          system_instructions: 'Sink LLM instructions'
        }
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#tfrecordSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#tfrecordSinkSuffix') as HTMLInputElement;
    const compressionSelect = container.querySelector('#tfrecordSinkCompressionType') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#tfrecordSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('gs://my-bucket/output/records');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.gz.tfrecord');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(container.querySelector('#tfrecordSinkCoder')).not.toBeInTheDocument();
    expect(instructionsTextarea).toHaveValue('Sink LLM instructions');
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for destination path, suffix, and compressionType', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#tfrecordSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 's3://output-lakehouse/daily/' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 's3://output-lakehouse/daily/'
      })
    );

    const suffixInput = container.querySelector('#tfrecordSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.tfrecords' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.tfrecords'
      })
    );

    const compressionSelect = container.querySelector('#tfrecordSinkCompressionType') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compressionType', value: 'DEFLATE' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compressionType: 'DEFLATE'
      })
    );
  });

  it('toggles sharding accordion and updates numShards and shardTemplate', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Open Sharding Accordion
    const accordionToggle = screen.getByText('Sharding & Shard Template Options');
    fireEvent.click(accordionToggle);

    const numShardsInput = container.querySelector('#tfrecordSinkNumShards') as HTMLInputElement;
    expect(numShardsInput).toBeInTheDocument();
    fireEvent.change(numShardsInput, {
      target: { name: 'numShards', value: '12' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '12'
      })
    );

    const shardTemplateInput = container.querySelector('#tfrecordSinkShardTemplate') as HTMLInputElement;
    expect(shardTemplateInput).toBeInTheDocument();
    fireEvent.change(shardTemplateInput, {
      target: { name: 'shardTemplate', value: '-SSS-of-NNN' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        shardTemplate: '-SSS-of-NNN'
      })
    );

    // Toggle accordion closed again
    fireEvent.click(accordionToggle);
    expect(container.querySelector('#tfrecordSinkNumShards')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#tfrecordSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Configure TFRecordIO sink to write 10 shards with DEFLATE compression' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Configure TFRecordIO sink to write 10 shards with DEFLATE compression'
      })
    );
  });

  it('falls back to special_instructions and property-level instructions when present', () => {
    const mockNodeSpecialData: any = {
      data: {
        special_instructions: 'Special sink instructions from data',
        properties: {}
      }
    };
    const { rerender } = render(<TFRecordIOSinkProperties node={mockNodeSpecialData} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special sink instructions from data')).toBeInTheDocument();

    const mockNodePropertySys: any = {
      data: {
        properties: {
          system_instructions: 'System sink instructions from properties'
        }
      }
    };
    rerender(<TFRecordIOSinkProperties node={mockNodePropertySys} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('System sink instructions from properties')).toBeInTheDocument();

    const mockNodePropertySpecial: any = {
      data: {
        properties: {
          special_instructions: 'Special sink instructions from properties'
        }
      }
    };
    rerender(<TFRecordIOSinkProperties node={mockNodePropertySpecial} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special sink instructions from properties')).toBeInTheDocument();
  });

  it('requests storage buckets via vscode.postMessage and renders datalist suggestions upon message event', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Assert initial IPC request was dispatched to extension host
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Simulate extension response event with bucket array
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['export-lakehouse', 'gs://sink-records']
          }
        })
      );
    });

    // NOTE: StoragePathField relies on PropertyField's generated datalist id (`<inputId>-datalist`)
    const toInput = container.querySelector('#tfrecordSinkTo') as HTMLInputElement;
    const datalist = document.getElementById(toInput.getAttribute('list')!);
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);
    expect(datalist?.children[0]).toHaveAttribute('value', 'gs://export-lakehouse/');
    expect(datalist?.children[1]).toHaveAttribute('value', 'gs://sink-records');
  });

  it('surfaces bucket discovery error inline using muted/red text alert', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          to: 'gs://bucket/output/'
        }
      }
    };

    render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Simulate extension response error
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'Storage API Error: 500 Internal Server Error'
          }
        })
      );
    });

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent('Failed to load Cloud Storage buckets: Storage API Error: 500 Internal Server Error');
    expect(errorAlert).toHaveClass('text-red-400');
  });

  it('never renders coder or offers AUTO or ZLIB compression on sink, and defaults AUTO to UNCOMPRESSED', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          to: 'gs://bucket/output/records',
          coder: 'ProtoCoder',
          compressionType: 'AUTO'
        }
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockLegacyNode} onChange={mockOnChange} />);

    expect(container.querySelector('#tfrecordSinkCoder')).not.toBeInTheDocument();
    expect(screen.queryByText(/Record Coder/i)).not.toBeInTheDocument();

    const compressionSelect = container.querySelector('#tfrecordSinkCompressionType') as HTMLSelectElement;
    expect(compressionSelect).toHaveValue('UNCOMPRESSED');
    const compressionValues = Array.from(compressionSelect.options).map((o) => o.value);
    expect(compressionValues).toEqual(['UNCOMPRESSED', 'GZIP', 'DEFLATE']);
    expect(compressionValues).not.toContain('AUTO');
    expect(compressionValues).not.toContain('ZLIB');
  });
});
