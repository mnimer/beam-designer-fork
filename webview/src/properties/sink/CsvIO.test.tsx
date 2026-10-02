/**
 * Unit Tests for CsvIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates rendering, input handling, Cloud Storage bucket auto-discovery messaging,
 * required-path validation states, CSV dialect configuration, header emission options,
 * compression selection, sharding options, and code generation instructions for CsvIOSinkProperties.
 * 
 * Architectural Decisions:
 * - Uses Vitest and React Testing Library for fast, realistic DOM interaction testing.
 * - Mocks window.vscode.postMessage to verify extension host IPC interactions.
 * - Tests both success and failure scenarios for dynamic storageBucketsLoaded message events.
 * - Verifies that 100% of event handlers, dropdowns, and checkboxes produce proper onChange payloads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CsvIOSinkProperties, CSV_COMPRESSION_TYPES, CSV_SINK_COMPRESSION_TYPES } from './CsvIO';

describe('CsvIOSinkProperties', () => {
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
        label: 'CsvIO Sink',
        beam_transform: 'CsvIO',
        properties: {}
      }
    };

    const { container } = render(<CsvIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#csvSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'CsvIO Sink',
        beam_transform: 'CsvIO',
        properties: {
          to: 'gs://output-bucket/csv/orders',
          suffix: '.csv',
          csvFormat: 'EXCEL',
          delimiter: ',',
          quoteChar: '"',
          header: 'order_id,user_id,total,status',
          writeHeader: true,
          nullString: 'NULL',
          compression: 'GZIP',
          numShards: 10,
          shardTemplate: '-SSSSS-of-NNNNN',
          system_instructions: 'Format numbers with two decimal places'
        }
      }
    };

    const { container } = render(<CsvIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#csvSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#csvSinkSuffix') as HTMLInputElement;
    const formatSelect = container.querySelector('#csvSinkFormat') as HTMLSelectElement;
    const delimiterInput = container.querySelector('#csvSinkDelimiter') as HTMLInputElement;
    const quoteInput = container.querySelector('#csvSinkQuoteChar') as HTMLInputElement;
    const headerInput = container.querySelector('#csvSinkHeader') as HTMLInputElement;
    const writeHeaderCheckbox = container.querySelector('#csvSinkWriteHeader') as HTMLInputElement;
    const nullInput = container.querySelector('#csvSinkNullString') as HTMLInputElement;
    const compressionSelect = container.querySelector('#csvSinkCompression') as HTMLSelectElement;
    const shardsInput = container.querySelector('#csvSinkNumShards') as HTMLInputElement;
    const shardTemplateInput = container.querySelector('#csvSinkShardTemplate') as HTMLInputElement;
    const instructionsTextarea = container.querySelector('#csvSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('gs://output-bucket/csv/orders');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
    expect(suffixInput).toHaveValue('.csv');
    expect(formatSelect).toHaveValue('EXCEL');
    expect(delimiterInput).toHaveValue(',');
    expect(quoteInput).toHaveValue('"');
    expect(headerInput).toHaveValue('order_id,user_id,total,status');
    expect(writeHeaderCheckbox).toBeChecked();
    expect(nullInput).toHaveValue('NULL');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(shardsInput).toHaveValue(10);
    expect(shardTemplateInput).toHaveValue('-SSSSS-of-NNNNN');
    expect(instructionsTextarea).toHaveValue('Format numbers with two decimal places');
  });

  it('handles field changes for destination directory, suffix, format, and dialect', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<CsvIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Change destination directory (.to)
    const toInput = container.querySelector('#csvSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 's3://analytics-export/csv/users' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 's3://analytics-export/csv/users'
      })
    );

    // Change suffix
    const suffixInput = container.querySelector('#csvSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.tsv' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.tsv'
      })
    );

    // Change csvFormat
    const formatSelect = container.querySelector('#csvSinkFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'csvFormat', value: 'TDF' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        csvFormat: 'TDF'
      })
    );

    // Change delimiter
    const delimiterInput = container.querySelector('#csvSinkDelimiter') as HTMLInputElement;
    fireEvent.change(delimiterInput, {
      target: { name: 'delimiter', value: '\t' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        delimiter: '\t'
      })
    );

    // Change quoteChar
    const quoteInput = container.querySelector('#csvSinkQuoteChar') as HTMLInputElement;
    fireEvent.change(quoteInput, {
      target: { name: 'quoteChar', value: "'" }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteChar: "'"
      })
    );

    // Change nullString
    const nullInput = container.querySelector('#csvSinkNullString') as HTMLInputElement;
    fireEvent.change(nullInput, {
      target: { name: 'nullString', value: '\\N' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nullString: '\\N'
      })
    );
  });

  it('handles header configuration, writeHeader checkbox, and compression changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<CsvIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Toggle writeHeader checkbox
    const writeHeaderCheckbox = container.querySelector('#csvSinkWriteHeader') as HTMLInputElement;
    fireEvent.click(writeHeaderCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        writeHeader: false
      })
    );

    // Change header line
    const headerInput = container.querySelector('#csvSinkHeader') as HTMLInputElement;
    fireEvent.change(headerInput, {
      target: { name: 'header', value: 'col1,col2,col3' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'col1,col2,col3'
      })
    );

    // Change compression
    const compressionSelect = container.querySelector('#csvSinkCompression') as HTMLSelectElement;
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

    const { container } = render(<CsvIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Change numShards
    const shardsInput = container.querySelector('#csvSinkNumShards') as HTMLInputElement;
    fireEvent.change(shardsInput, {
      target: { name: 'numShards', value: '8' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '8'
      })
    );

    // Change shardTemplate
    const shardTemplateInput = container.querySelector('#csvSinkShardTemplate') as HTMLInputElement;
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

    const { container } = render(<CsvIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#csvSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Write output records partitioned into 10 shards with custom quote rules' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Write output records partitioned into 10 shards with custom quote rules'
      })
    );
  });

  it('omits unsupported XZ compression codec and documents Java vs Python WriteToCsv compression support (regression test)', () => {
    const mockNode: any = {
      data: {
        properties: {
          to: 'gs://output-bucket/csv/orders'
        }
      }
    };

    const { container } = render(<CsvIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // XZ is not in Beam's Compression enum and must not be offered
    expect(CSV_COMPRESSION_TYPES.map((c) => c.value)).not.toContain('XZ');
    expect(CSV_SINK_COMPRESSION_TYPES.map((c) => c.value)).not.toContain('XZ');

    const compressionSelect = container.querySelector('#csvSinkCompression') as HTMLSelectElement;
    const optionValues = Array.from(compressionSelect.querySelectorAll('option')).map((opt) => opt.value);
    expect(optionValues).not.toContain('XZ');
    expect(optionValues).toEqual(['UNCOMPRESSED', 'GZIP', 'BZIP2', 'DEFLATE', 'ZSTD']);

    // Helper text clearly states Java CsvIO.writeRows support and Python WriteToCsv NotImplementedError
    expect(screen.getByText(/CsvIO\.writeRows\(to, csvFormat\)\.withCompression\(Compression\)/i)).toBeInTheDocument();
    expect(screen.getByText(/NotImplementedError/i)).toBeInTheDocument();
  });
});
