/**
 * TFRecordIO Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating TFRecordIOSourceProperties component functionality,
 * form change callbacks, validation states, accordion toggling, dynamic extension
 * GCS bucket discovery IPC, and code generation instructions.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Validates required field states, default fallbacks, and error boundaries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TFRecordIOSourceProperties } from './TFRecordIO';

describe('TFRecordIOSourceProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing filePattern', () => {
    const mockNode: any = {
      data: {
        label: 'TFRecordIO',
        beam_transform: 'TFRecordIO',
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#tfrecordSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'TFRecordIO',
        beam_transform: 'TFRecordIO',
        properties: {
          filePattern: 'gs://my-bucket/training/*.tfrecord',
          compressionType: 'GZIP',
          coder: 'ProtoCoder',
          validate: false,
          system_instructions: 'Custom TFRecord reader instructions'
        }
      }
    };

    const { container } = render(<TFRecordIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#tfrecordSourceFilePattern') as HTMLInputElement;
    const compressionSelect = container.querySelector('#tfrecordSourceCompressionType') as HTMLSelectElement;
    const coderInput = container.querySelector('#tfrecordSourceCoder') as HTMLInputElement;
    const instructionsTextarea = container.querySelector('#tfrecordSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('gs://my-bucket/training/*.tfrecord');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(coderInput).toHaveValue('ProtoCoder');
    expect(instructionsTextarea).toHaveValue('Custom TFRecord reader instructions');
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for filePattern, compressionType, and coder', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#tfrecordSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 's3://ml-bucket/train.tfrecord' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 's3://ml-bucket/train.tfrecord'
      })
    );

    const compressionSelect = container.querySelector('#tfrecordSourceCompressionType') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compressionType', value: 'DEFLATE' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compressionType: 'DEFLATE'
      })
    );

    const coderInput = container.querySelector('#tfrecordSourceCoder') as HTMLInputElement;
    fireEvent.change(coderInput, {
      target: { name: 'coder', value: 'ProtoCoder' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        coder: 'ProtoCoder'
      })
    );
  });

  it('handles validate checkbox toggle', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Validate checkbox is checked by default
    const validateCheckbox = container.querySelector('#tfrecordSourceValidate') as HTMLInputElement;
    expect(validateCheckbox).toBeChecked();

    fireEvent.click(validateCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        validate: false
      })
    );
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#tfrecordSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Parse binary byte payload into custom image tensors' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Parse binary byte payload into custom image tensors'
      })
    );
  });

  it('falls back to special_instructions and property-level instructions when present', () => {
    const mockNodeSpecialData: any = {
      data: {
        special_instructions: 'Special instructions from data',
        properties: {}
      }
    };
    const { rerender } = render(<TFRecordIOSourceProperties node={mockNodeSpecialData} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from data')).toBeInTheDocument();

    const mockNodePropertySys: any = {
      data: {
        properties: {
          system_instructions: 'System instructions from properties'
        }
      }
    };
    rerender(<TFRecordIOSourceProperties node={mockNodePropertySys} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('System instructions from properties')).toBeInTheDocument();

    const mockNodePropertySpecial: any = {
      data: {
        properties: {
          special_instructions: 'Special instructions from properties'
        }
      }
    };
    rerender(<TFRecordIOSourceProperties node={mockNodePropertySpecial} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from properties')).toBeInTheDocument();
  });

  it('requests storage buckets via vscode.postMessage and renders datalist suggestions upon message event', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Assert initial IPC request was dispatched to extension host
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Simulate extension response event with bucket array
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['lakehouse-data', 'gs://archive-records']
          }
        })
      );
    });

    // NOTE: StoragePathField relies on PropertyField's generated datalist id (`<inputId>-datalist`)
    const filePatternInput = container.querySelector('#tfrecordSourceFilePattern') as HTMLInputElement;
    const datalist = document.getElementById(filePatternInput.getAttribute('list')!);
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);
    expect(datalist?.children[0]).toHaveAttribute('value', 'gs://lakehouse-data/');
    expect(datalist?.children[1]).toHaveAttribute('value', 'gs://archive-records');
  });

  it('surfaces bucket discovery error inline using muted/red text alert', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          filePattern: 'gs://bucket/data.tfrecord'
        }
      }
    };

    render(<TFRecordIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Simulate extension response error
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'Google Cloud API error: 403 Forbidden'
          }
        })
      );
    });

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent('Failed to load Cloud Storage buckets: Google Cloud API error: 403 Forbidden');
    expect(errorAlert).toHaveClass('text-red-400');
  });

  /**
   * Regression guard: TFRecord sources are hardcoded non-splittable in both Java and Python,
   * `ExampleProtoCoder` is a tensorflow_transform symbol rather than a Beam coder (replaced by `ProtoCoder`),
   * and `ZLIB` is replaced by `DEFLATE` (`Compression.DEFLATE` / `CompressionTypes.DEFLATE`).
   */
  it('never renders minBundleSize or invalid options (ExampleProtoCoder, ZLIB)', () => {
    const mockNode: any = {
      data: {
        properties: {
          filePattern: 'gs://bucket/data/*.tfrecord',
          minBundleSize: 4096
        }
      }
    };

    const { container } = render(<TFRecordIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // minBundleSize is never rendered
    expect(container.querySelector('#tfrecordSourceMinBundleSize')).not.toBeInTheDocument();
    expect(screen.queryByText(/Minimum Bundle Size/i)).not.toBeInTheDocument();

    // Compression options expose DEFLATE and never ZLIB
    const compressionSelect = container.querySelector('#tfrecordSourceCompressionType') as HTMLSelectElement;
    const compressionValues = Array.from(compressionSelect.options).map((o) => o.value);
    expect(compressionValues).toContain('DEFLATE');
    expect(compressionValues).not.toContain('ZLIB');

    // Coder datalist exposes ProtoCoder and never ExampleProtoCoder
    const coderDatalist = container.querySelector('#tfrecord-source-coder-options') as HTMLDataListElement;
    expect(coderDatalist).toBeInTheDocument();
    const coderValues = Array.from(coderDatalist.querySelectorAll('option')).map((o) => o.getAttribute('value'));
    expect(coderValues).toContain('ProtoCoder');
    expect(coderValues).not.toContain('ExampleProtoCoder');
  });
});
