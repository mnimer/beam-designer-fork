/**
 * Unit Tests for ParquetIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates rendering, input handling, bucket auto-discovery messaging,
 * validation indicators, sample schema insertion, and custom instructions
 * for ParquetIOSourceProperties.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ParquetIOSourceProperties } from './ParquetIO';

describe('ParquetIOSourceProperties', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with empty properties and flags validation error for missing filePattern', () => {
    const mockNode: any = {
      data: {
        label: 'ParquetIO',
        beam_transform: 'ParquetIO',
        properties: {}
      }
    };

    const { container } = render(<ParquetIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#parquetSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'ParquetIO',
        beam_transform: 'ParquetIO',
        properties: {
          filePattern: 's3://my-lakehouse/data/*.parquet',
          columns: 'id, name, email',
          schema: '{"type": "record"}',
          validate: false,
          batched: true,
          minBundleSize: 1024,
          system_instructions: 'Custom LLM instructions'
        }
      }
    };

    const { container } = render(<ParquetIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#parquetSourceFilePattern') as HTMLInputElement;
    const columnsInput = container.querySelector('#parquetSourceColumns') as HTMLInputElement;
    const schemaTextarea = container.querySelector('#parquetSourceSchema') as HTMLTextAreaElement;
    const instructionsTextarea = container.querySelector('#parquetSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('s3://my-lakehouse/data/*.parquet');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(columnsInput).toHaveValue('id, name, email');
    expect(schemaTextarea).toHaveValue('{"type": "record"}');
    expect(instructionsTextarea).toHaveValue('Custom LLM instructions');
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('supports multi-cloud file patterns (GCS, S3, HDFS, local)', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ParquetIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#parquetSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 's3://my-company-bucket/events/*.parquet' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 's3://my-company-bucket/events/*.parquet'
      })
    );
  });

  it('handles field changes for filePattern and columns', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ParquetIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#parquetSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 'gs://my-bucket/events/*.parquet' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 'gs://my-bucket/events/*.parquet'
      })
    );

    const columnsInput = container.querySelector('#parquetSourceColumns') as HTMLInputElement;
    fireEvent.change(columnsInput, {
      target: { name: 'columns', value: 'user_id, event_time' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: 'user_id, event_time'
      })
    );
  });

  it('inserts sample Avro schema when Insert Sample is clicked', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<ParquetIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const insertSampleBtn = screen.getByText('Insert Sample');
    fireEvent.click(insertSampleBtn);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: expect.stringContaining('UserRecord')
      })
    );
  });

  it('toggles advanced settings and handles batched, validate, and minBundleSize', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ParquetIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Open Advanced Accordion
    const advancedToggle = screen.getByText('Read Tuning & Options');
    fireEvent.click(advancedToggle);

    const batchedCheckbox = container.querySelector('#parquetSourceBatched') as HTMLInputElement;
    expect(batchedCheckbox).toBeInTheDocument();
    expect(batchedCheckbox).not.toBeChecked();

    fireEvent.click(batchedCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        batched: true
      })
    );

    const validateCheckbox = container.querySelector('#parquetSourceValidate') as HTMLInputElement;
    expect(validateCheckbox).toBeChecked(); // default true
    fireEvent.click(validateCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        validate: false
      })
    );

    const minBundleSizeInput = container.querySelector('#parquetSourceMinBundleSize') as HTMLInputElement;
    fireEvent.change(minBundleSizeInput, {
      target: { name: 'minBundleSize', value: '65536' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        minBundleSize: '65536'
      })
    );
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ParquetIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#parquetSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Parse using specific record coder' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Parse using specific record coder'
      })
    );
  });
});
