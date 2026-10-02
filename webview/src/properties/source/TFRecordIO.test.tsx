/**
 * TFRecordIO Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating TFRecordIOSourceProperties component functionality,
 * form change callbacks, validation states, accordion toggling,
 * and code generation instructions.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Validates required field states, default fallbacks, and error boundaries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
          validate: false,
          system_instructions: 'Custom TFRecord reader instructions'
        }
      }
    };

    const { container } = render(<TFRecordIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#tfrecordSourceFilePattern') as HTMLInputElement;
    const compressionSelect = container.querySelector('#tfrecordSourceCompressionType') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#tfrecordSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('gs://my-bucket/training/*.tfrecord');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(container.querySelector('#tfrecordSourceCoder')).not.toBeInTheDocument();
    expect(instructionsTextarea).toHaveValue('Custom TFRecord reader instructions');
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for filePattern and compressionType', () => {
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


  it('never renders coder, minBundleSize, or ZLIB compression option', () => {
    const mockNode: any = {
      data: {
        properties: {
          filePattern: 'gs://bucket/data/*.tfrecord',
          coder: 'ProtoCoder',
          minBundleSize: 4096
        }
      }
    };

    const { container } = render(<TFRecordIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // coder and minBundleSize are never rendered
    expect(container.querySelector('#tfrecordSourceCoder')).not.toBeInTheDocument();
    expect(screen.queryByText(/Record Coder/i)).not.toBeInTheDocument();
    expect(container.querySelector('#tfrecordSourceMinBundleSize')).not.toBeInTheDocument();
    expect(screen.queryByText(/Minimum Bundle Size/i)).not.toBeInTheDocument();

    // Compression options expose DEFLATE and never ZLIB
    const compressionSelect = container.querySelector('#tfrecordSourceCompressionType') as HTMLSelectElement;
    const compressionValues = Array.from(compressionSelect.options).map((o) => o.value);
    expect(compressionValues).toContain('DEFLATE');
    expect(compressionValues).not.toContain('ZLIB');
  });
});
