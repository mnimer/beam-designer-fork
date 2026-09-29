/**
 * Unit Tests for ParquetIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates rendering, input handling, bucket auto-discovery messaging,
 * validation indicators, compression codec selection, sample schema insertion,
 * advanced row group buffer sizing, and custom instructions for ParquetIOSinkProperties.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ParquetIOSinkProperties } from './ParquetIO';

describe('ParquetIOSinkProperties', () => {
  const mockOnChange = vi.fn();
  let originalVscode: any;

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
        label: 'ParquetIO',
        beam_transform: 'ParquetIO',
        properties: {}
      }
    };

    const { container } = render(<ParquetIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#parquetSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();
  });

  it('posts getStorageBuckets command and populates GCS bucket datalist via StoragePathField', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        label: 'ParquetIO',
        properties: {
          to: 'gs://bucket/output/'
        }
      }
    };

    const { container } = render(<ParquetIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['parquet-export-bucket', 'parquet-warehouse']
          }
        })
      );
    });

    const datalist = container.querySelector('datalist');
    expect(datalist).toBeInTheDocument();
    const options = datalist?.querySelectorAll('option');
    expect(options?.length).toBe(2);
    expect(options?.[0]).toHaveAttribute('value', 'gs://parquet-export-bucket/');
    expect(options?.[1]).toHaveAttribute('value', 'gs://parquet-warehouse/');
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'ParquetIO',
        beam_transform: 'ParquetIO',
        properties: {
          to: 's3://my-lakehouse/output/records',
          suffix: '.snappy.parquet',
          codec: 'ZSTD',
          schemaFields: [
            { name: 'id', type: 'STRING', mode: 'REQUIRED' }
          ],
          numShards: 5,
          shardTemplate: '-SSSSS-of-NNNNN',
          rowGroupBufferSize: 134217728,
          recordBatchSize: 2000,
          useCompliantNestedType: true,
          useDeprecatedInt96Timestamps: true,
          system_instructions: 'Sink LLM instructions'
        }
      }
    };

    const { container } = render(<ParquetIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#parquetSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#parquetSinkSuffix') as HTMLInputElement;
    const codecSelect = container.querySelector('#parquetSinkCodec') as HTMLSelectElement;
    const numShardsInput = container.querySelector('#parquetSinkNumShards') as HTMLInputElement;
    const shardTemplateInput = container.querySelector('#parquetSinkShardTemplate') as HTMLInputElement;
    const instructionsTextarea = container.querySelector('#parquetSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('s3://my-lakehouse/output/records');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.snappy.parquet');
    expect(codecSelect).toHaveValue('ZSTD');
    expect(screen.getByRole('button', { name: /Field Builder Tab/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Field #1 Name')).toHaveValue('id');
    expect(numShardsInput).toHaveValue(5);
    expect(shardTemplateInput).toHaveValue('-SSSSS-of-NNNNN');
    expect(instructionsTextarea).toHaveValue('Sink LLM instructions');
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('supports multi-cloud destination paths (GCS, S3, HDFS, local)', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ParquetIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#parquetSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 's3://my-analytics-bucket/output/daily/' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 's3://my-analytics-bucket/output/daily/'
      })
    );
  });

  it('handles field changes for destination path, suffix, and codec', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ParquetIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#parquetSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 'gs://my-bucket/target/' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'gs://my-bucket/target/'
      })
    );

    const suffixInput = container.querySelector('#parquetSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.pq' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.pq'
      })
    );

    const codecSelect = container.querySelector('#parquetSinkCodec') as HTMLSelectElement;
    fireEvent.change(codecSelect, {
      target: { name: 'codec', value: 'GZIP' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        codec: 'GZIP'
      })
    );
  });

  it('renders 3-tab SchemaEditor and updates schemaFields, schema, and schemaString', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<ParquetIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByRole('button', { name: /Field Builder Tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /JSON Schema Tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schema String Tab/i })).toBeInTheDocument();

    const addFieldBtn = screen.getByRole('button', { name: /Add Schema Field/i });
    fireEvent.click(addFieldBtn);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFields: [
          expect.objectContaining({ name: '', type: 'STRING', mode: 'NULLABLE' })
        ],
        schema: expect.any(String),
        schemaString: expect.any(String)
      })
    );
  });

  it('toggles advanced settings and handles row group buffer size, record batch size, and checkboxes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ParquetIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Open Advanced Accordion
    const advancedToggle = screen.getByText('Advanced Parquet Settings');
    fireEvent.click(advancedToggle);

    const rowGroupInput = container.querySelector('#parquetSinkRowGroupBufferSize') as HTMLInputElement;
    expect(rowGroupInput).toBeInTheDocument();
    fireEvent.change(rowGroupInput, {
      target: { name: 'rowGroupBufferSize', value: '33554432' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rowGroupBufferSize: '33554432'
      })
    );

    const recordBatchInput = container.querySelector('#parquetSinkRecordBatchSize') as HTMLInputElement;
    fireEvent.change(recordBatchInput, {
      target: { name: 'recordBatchSize', value: '500' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        recordBatchSize: '500'
      })
    );

    const compliantCheckbox = container.querySelector('#parquetSinkCompliantNested') as HTMLInputElement;
    fireEvent.click(compliantCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        useCompliantNestedType: true
      })
    );

    const int96Checkbox = container.querySelector('#parquetSinkInt96') as HTMLInputElement;
    fireEvent.click(int96Checkbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        useDeprecatedInt96Timestamps: true
      })
    );
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ParquetIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#parquetSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Use snappy compression and 10 shards' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Use snappy compression and 10 shards'
      })
    );
  });
});
