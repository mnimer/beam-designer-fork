/**
 * AvroIO Source Properties Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Comprehensive unit tests for AvroIOSourceProperties covering all rendering,
 * validation, state transitions, interactive controls, and callback invocations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AvroIOSourceProperties, SAMPLE_AVRO_SCHEMA } from './AvroIO';

describe('AvroIOSourceProperties', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
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

  it('handles switching record types (GenericRecord, SpecificRecord, ParseGeneric)', () => {
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

    // Rerender with SpecificRecord
    const specificNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          recordType: 'SPECIFIC_RECORD',
          recordClass: 'com.example.UserRecord'
        }
      }
    };
    rerender(<AvroIOSourceProperties node={specificNode} onChange={mockOnChange} />);

    const classInput = container.querySelector('#avroRecordClass') as HTMLInputElement;
    expect(classInput).toBeInTheDocument();
    expect(classInput).toHaveValue('com.example.UserRecord');

    fireEvent.change(classInput, {
      target: { name: 'recordClass', value: 'com.example.OrderRecord' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ recordClass: 'com.example.OrderRecord' }));

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

  it('supports inline JSON schema, sample schema insertion, and JSON error reporting', () => {
    const mockNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          recordType: 'GENERIC_RECORD',
          schemaMode: 'INLINE',
          schema: '{"type": "record", "name": "User", "fields": []}'
        }
      }
    };

    const { container, rerender } = render(<AvroIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const schemaTextarea = container.querySelector('#avroInlineSchema') as HTMLTextAreaElement;
    expect(schemaTextarea).toBeInTheDocument();
    expect(schemaTextarea.value).toContain('User');

    // Click "Insert Sample Schema" button
    const insertBtn = screen.getByText('Insert Sample Schema');
    fireEvent.click(insertBtn);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: SAMPLE_AVRO_SCHEMA
      })
    );

    // Test malformed JSON displays syntax error
    const invalidSchemaNode: any = {
      data: {
        label: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/*.avro',
          recordType: 'GENERIC_RECORD',
          schemaMode: 'INLINE',
          schema: '{ invalid: json '
        }
      }
    };
    rerender(<AvroIOSourceProperties node={invalidSchemaNode} onChange={mockOnChange} />);
    expect(screen.getByText(/JSON Error:/i)).toBeInTheDocument();
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

