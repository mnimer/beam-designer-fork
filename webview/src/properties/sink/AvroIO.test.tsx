/**
 * AvroIO Sink Properties Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Comprehensive unit tests for AvroIOSinkProperties covering destination prefix validation,
 * schema definition modes (inline JSON, sample insertion, external .avsc, specific class),
 * compression codec options, sharding modes, metadata, and instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AvroIOSinkProperties } from './AvroIO';

describe('AvroIOSinkProperties', () => {
  const mockOnChange = vi.fn();
  let originalVscode: any;

  beforeEach(() => {
    mockOnChange.mockClear();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders required validation error when destination prefix is empty', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        beam_transform: 'AvroIO',
        properties: {
          to: ''
        }
      }
    };

    const { container } = render(<AvroIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#avroSinkTo') as HTMLInputElement;
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination file prefix is required.')).toBeInTheDocument();
  });

  it('updates destination prefix, suffix, and shardNameTemplate', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          to: 'gs://bucket/output/data',
          suffix: '.avro',
          shardNameTemplate: '-SS-of-NN'
        }
      }
    };

    const { container } = render(<AvroIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#avroSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#avroSinkSuffix') as HTMLInputElement;
    const shardInput = container.querySelector('#avroSinkShardTemplate') as HTMLInputElement;

    expect(toInput).toHaveValue('gs://bucket/output/data');
    expect(suffixInput).toHaveValue('.avro');
    expect(shardInput).toHaveValue('-SS-of-NN');

    fireEvent.change(toInput, {
      target: { name: 'to', value: 'gs://new-bucket/output/files' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ to: 'gs://new-bucket/output/files' }));

    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.av' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ suffix: '.av' }));

    fireEvent.change(shardInput, {
      target: { name: 'shardNameTemplate', value: '-W-P-SS-of-NN' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ shardNameTemplate: '-W-P-SS-of-NN' }));
  });

  it('renders 3-tab SchemaEditor for GenericRecord inline mode and updates schemaFields, schema, and schemaString', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          to: 'gs://bucket/output',
          schemaType: 'GENERIC_RECORD',
          schemaMode: 'INLINE',
          schemaFields: []
        }
      }
    };

    render(<AvroIOSinkProperties node={mockNode} onChange={mockOnChange} />);

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

  it('supports external schema file (.avsc) mode for GenericRecord', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          to: 'gs://bucket/output',
          schemaType: 'GENERIC_RECORD',
          schemaMode: 'FILE',
          schemaPath: ''
        }
      }
    };

    const { container } = render(<AvroIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Schema file path is required.')).toBeInTheDocument();

    const pathInput = container.querySelector('#avroSinkSchemaPath') as HTMLInputElement;
    fireEvent.change(pathInput, {
      target: { name: 'schemaPath', value: 'gs://bucket/schemas/record.avsc' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ schemaPath: 'gs://bucket/schemas/record.avsc' }));
  });

  it('supports SpecificRecord mode using SchemaEditor without rendering Java recordClass input', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          to: 'gs://bucket/output',
          schemaType: 'SPECIFIC_RECORD'
        }
      }
    };

    const { container } = render(<AvroIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('#avroSinkRecordClass')).not.toBeInTheDocument();
    expect(screen.queryByText(/Generated Java Record Class/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Field Builder Tab/i })).toBeInTheDocument();
  });

  it('handles compression codec selection and deflate level configuration', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          to: 'gs://bucket/output',
          codec: 'DEFLATE',
          deflateLevel: 6
        }
      }
    };

    const { container, rerender } = render(<AvroIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const codecSelect = container.querySelector('#avroSinkCodec') as HTMLSelectElement;
    expect(codecSelect).toHaveValue('DEFLATE');

    const levelInput = container.querySelector('#avroDeflateLevel') as HTMLInputElement;
    expect(levelInput).toBeInTheDocument();
    expect(levelInput).toHaveValue(6);

    fireEvent.change(levelInput, {
      target: { name: 'deflateLevel', value: '9' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ deflateLevel: '9' }));

    // Switch codec to SNAPPY (level input should hide)
    fireEvent.change(codecSelect, {
      target: { name: 'codec', value: 'SNAPPY' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ codec: 'SNAPPY' }));

    const snappyNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          to: 'gs://bucket/output',
          codec: 'SNAPPY'
        }
      }
    };
    rerender(<AvroIOSinkProperties node={snappyNode} onChange={mockOnChange} />);
    expect(container.querySelector('#avroDeflateLevel')).toBeNull();
  });

  it('toggles sharding mode (single file vs numShards)', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          to: 'gs://bucket/output',
          withoutSharding: false,
          numShards: 10
        }
      }
    };

    const { container, rerender } = render(<AvroIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const numShardsInput = container.querySelector('#avroSinkNumShards') as HTMLInputElement;
    expect(numShardsInput).toBeInTheDocument();
    expect(numShardsInput).toHaveValue(10);

    const withoutShardingCheckbox = container.querySelector('#avroSinkWithoutSharding') as HTMLInputElement;
    expect(withoutShardingCheckbox).not.toBeChecked();

    fireEvent.click(withoutShardingCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ withoutSharding: true }));

    // Rerender with withoutSharding = true (numShards input should be hidden)
    const singleFileNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          to: 'gs://bucket/output',
          withoutSharding: true
        }
      }
    };
    rerender(<AvroIOSinkProperties node={singleFileNode} onChange={mockOnChange} />);
    expect(container.querySelector('#avroSinkNumShards')).toBeNull();
  });

  it('configures fastavro toggle, custom metadata, and code generation instructions', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          to: 'gs://bucket/output',
          useFastavro: true,
          metadata: '{"schema_version": "1.0"}'
        },
        system_instructions: 'Sink prompt notes'
      }
    };

    const { container } = render(<AvroIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const fastavroCheckbox = container.querySelector('#avroSinkUseFastavro') as HTMLInputElement;
    expect(fastavroCheckbox).toBeChecked();

    const metadataInput = container.querySelector('#avroSinkMetadata') as HTMLInputElement;
    expect(metadataInput).toHaveValue('{"schema_version": "1.0"}');

    fireEvent.change(metadataInput, {
      target: { name: 'metadata', value: '{"author": "test"}' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ metadata: '{"author": "test"}' }));

    const instructions = container.querySelector('#avroSinkSystemInstructions') as HTMLTextAreaElement;
    expect(instructions).toHaveValue('Sink prompt notes');

    fireEvent.change(instructions, {
      target: { value: 'Updated prompt instructions' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ system_instructions: 'Updated prompt instructions' }));
  });
});
