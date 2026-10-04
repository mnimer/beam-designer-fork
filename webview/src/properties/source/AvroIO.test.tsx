/**
 * AvroIO Source Properties Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Comprehensive unit tests for AvroIOSourceProperties covering all rendering,
 * validation, state transitions, interactive controls, and callback invocations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AvroIOSourceProperties } from './AvroIO';

describe('AvroIOSourceProperties', () => {
  const mockOnChange = vi.fn();
  let originalVscode: any;

  beforeEach(() => {
    mockOnChange.mockClear();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders required validation error when filePattern is empty', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        beam_transform: 'AvroIO',
        properties: {
          filePattern: ''
        }
      }
    };

    const { container } = render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const patternInput = container.querySelector('#avroFilePattern') as HTMLInputElement;
    expect(patternInput).toHaveValue('');
    expect(patternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('updates filePattern and calls onChange', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        beam_transform: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/data/*.avro'
        }
      }
    };

    const { container } = render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const patternInput = container.querySelector('#avroFilePattern') as HTMLInputElement;
    expect(patternInput).toHaveValue('gs://bucket/data/*.avro');
    expect(patternInput).toHaveAttribute('aria-invalid', 'false');

    fireEvent.change(patternInput, {
      target: { name: 'filePattern', value: 'gs://new-bucket/*.avro' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 'gs://new-bucket/*.avro'
      })
    );
  });

  it('handles switching record types (GenericRecord, SpecificRecord, ParseGeneric) without rendering Java recordClass input', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        beam_transform: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          recordType: 'GENERIC_RECORD'
        }
      }
    };

    const { container, rerender } = render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const recordTypeSelect = container.querySelector('#avroRecordType') as HTMLSelectElement;
    expect(recordTypeSelect).toHaveValue('GENERIC_RECORD');

    // Switch to SpecificRecord
    fireEvent.change(recordTypeSelect, {
      target: { name: 'recordType', value: 'SPECIFIC_RECORD' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ recordType: 'SPECIFIC_RECORD' }));

    // Rerender with SpecificRecord — should NOT render #avroRecordClass input, and should render SchemaEditor
    const specificNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          recordType: 'SPECIFIC_RECORD'
        }
      }
    };
    rerender(<AvroIOSourceProperties node={specificNode} onChange={mockOnChange} />);

    expect(container.querySelector('#avroRecordClass')).not.toBeInTheDocument();
    expect(screen.queryByText(/Generated Java Record Class/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Field Builder Tab/i })).toBeInTheDocument();

    // Rerender with PARSE_GENERIC
    const parseNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          recordType: 'PARSE_GENERIC'
        }
      }
    };
    rerender(<AvroIOSourceProperties node={parseNode} onChange={mockOnChange} />);
    expect(screen.getByText(/AvroIO\.parseGenericRecords\(\)/i)).toBeInTheDocument();
  });

  it('renders 3-tab SchemaEditor when schemaMode is INLINE and updates schemaFields, schema, and schemaString', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          recordType: 'GENERIC_RECORD',
          schemaMode: 'INLINE',
          schemaFields: [
            { name: 'id', type: 'STRING', mode: 'REQUIRED' }
          ]
        }
      }
    };

    render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByRole('button', { name: /Field Builder Tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /JSON Schema Tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schema String Tab/i })).toBeInTheDocument();

    // Add a new field via SchemaEditor
    const addFieldBtn = screen.getByRole('button', { name: /Add Schema Field/i });
    fireEvent.click(addFieldBtn);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFields: expect.arrayContaining([
          expect.objectContaining({ name: 'id', type: 'STRING', mode: 'REQUIRED' }),
          expect.objectContaining({ name: '', type: 'STRING', mode: 'NULLABLE' })
        ]),
        schema: expect.any(String),
        schemaString: expect.any(String)
      })
    );
  });

  it('supports external schema file mode (.avsc)', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          recordType: 'GENERIC_RECORD',
          schemaMode: 'FILE',
          schemaPath: 'gs://bucket/schema.avsc'
        }
      }
    };

    const { container } = render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const schemaPathInput = container.querySelector('#avroSchemaPath') as HTMLInputElement;
    expect(schemaPathInput).toBeInTheDocument();
    expect(schemaPathInput).toHaveValue('gs://bucket/schema.avsc');

    fireEvent.change(schemaPathInput, {
      target: { name: 'schemaPath', value: 'gs://bucket/new_schema.avsc' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ schemaPath: 'gs://bucket/new_schema.avsc' }));
  });

  it('handles empty match treatment selection and validate file existence toggle', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          emptyMatchTreatment: 'ALLOW_IF_WILDCARD',
          validate: true
        }
      }
    };

    const { container } = render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const emptyMatchSelect = container.querySelector('#avroEmptyMatchTreatment') as HTMLSelectElement;
    expect(emptyMatchSelect).toHaveValue('ALLOW_IF_WILDCARD');

    fireEvent.change(emptyMatchSelect, {
      target: { name: 'emptyMatchTreatment', value: 'DISALLOW' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ emptyMatchTreatment: 'DISALLOW' }));

    const validateCheckbox = container.querySelector('#avroValidate') as HTMLInputElement;
    expect(validateCheckbox).toBeChecked();

    fireEvent.click(validateCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ validate: false }));
  });

  it('toggles continuous streaming watch and configures interval', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          watchForNewFiles: true,
          watchInterval: 5,
          watchIntervalUnit: 'MINUTES'
        }
      }
    };

    const { container } = render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const watchCheckbox = container.querySelector('#avroWatchForNewFiles') as HTMLInputElement;
    expect(watchCheckbox).toBeChecked();

    const intervalInput = container.querySelector('#avroWatchInterval') as HTMLInputElement;
    const unitSelect = container.querySelector('#avroWatchIntervalUnit') as HTMLSelectElement;

    expect(intervalInput).toHaveValue(5);
    expect(unitSelect).toHaveValue('MINUTES');

    fireEvent.change(intervalInput, {
      target: { name: 'watchInterval', value: '10' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ watchInterval: '10' }));

    fireEvent.change(unitSelect, {
      target: { name: 'watchIntervalUnit', value: 'HOURS' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ watchIntervalUnit: 'HOURS' }));
  });

  it('configures performance optimizations (fastavro, hintMatchesManyFiles, minBundleSize)', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          useFastavro: true,
          hintMatchesManyFiles: false,
          minBundleSize: 1048576
        }
      }
    };

    const { container } = render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const fastavroCheckbox = container.querySelector('#avroUseFastavro') as HTMLInputElement;
    const hintCheckbox = container.querySelector('#avroHintMatchesManyFiles') as HTMLInputElement;
    const minBundleInput = container.querySelector('#avroMinBundleSize') as HTMLInputElement;

    expect(fastavroCheckbox).toBeChecked();
    expect(hintCheckbox).not.toBeChecked();
    expect(minBundleInput).toHaveValue(1048576);

    fireEvent.click(hintCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ hintMatchesManyFiles: true }));

    fireEvent.change(minBundleInput, {
      target: { name: 'minBundleSize', value: '2097152' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ minBundleSize: '2097152' }));
  });

  it('updates code generation instructions', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        system_instructions: 'Initial instructions',
        properties: {
          filePattern: 'gs://bucket/*.avro'
        }
      }
    };

    const { container } = render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#avroSourceSystemInstructions') as HTMLTextAreaElement;
    expect(instructionsTextarea).toHaveValue('Initial instructions');

    fireEvent.change(instructionsTextarea, {
      target: { value: 'Custom AvroIO prompt override' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Custom AvroIO prompt override'
      })
    );
  });

  it('displays required validation error when filePattern is empty', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: ''
        }
      }
    };

    const { container, getByRole } = render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const patternInput = container.querySelector('#avroFilePattern') as HTMLInputElement;
    expect(patternInput).toHaveAttribute('aria-invalid', 'true');
    expect(getByRole('alert')).toHaveTextContent('File Pattern is required.');
  });
});

