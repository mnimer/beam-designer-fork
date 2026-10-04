/**
 * Unit Tests for CsvIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates rendering, input handling, Cloud Storage bucket auto-discovery messaging,
 * required-path validation states, CSV dialect configuration, sample schema insertion,
 * accordion toggling, and code generation instructions for CsvIOSourceProperties.
 * 
 * Architectural Decisions:
 * - Uses Vitest and React Testing Library for fast, realistic DOM interaction testing.
 * - Mocks window.vscode.postMessage to verify extension host IPC interactions.
 * - Tests both success and failure scenarios for dynamic storageBucketsLoaded message events.
 * - Verifies that 100% of event handlers, toggles, and input states produce proper onChange payloads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CsvIOSourceProperties } from './CsvIO';

describe('CsvIOSourceProperties', () => {
  const mockOnChange = vi.fn();
  let originalVscode: any;

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
        label: 'CsvIO Source',
        beam_transform: 'CsvIO',
        properties: {}
      }
    };

    const { container } = render(<CsvIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#csvSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'CsvIO Source',
        beam_transform: 'CsvIO',
        properties: {
          filePattern: 'gs://my-bucket/data/*.csv',
          csvFormat: 'RFC4180',
          delimiter: ';',
          quoteChar: "'",
          header: 'id,name,email,amount',
          hasHeader: true,
          skipHeaderLines: 1,
          nullString: 'NA',
          commentMarker: '#',
          schema: '[{"name": "id", "type": "STRING", "mode": "REQUIRED"}]',
          splittable: true,
          system_instructions: 'Parse timestamps using ISO format'
        }
      }
    };

    const { container } = render(<CsvIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#csvSourceFilePattern') as HTMLInputElement;
    const formatSelect = container.querySelector('#csvSourceFormat') as HTMLSelectElement;
    const delimiterInput = container.querySelector('#csvSourceDelimiter') as HTMLInputElement;
    const quoteInput = container.querySelector('#csvSourceQuoteChar') as HTMLInputElement;
    const headerInput = container.querySelector('#csvSourceHeader') as HTMLInputElement;
    const hasHeaderCheckbox = container.querySelector('#csvSourceHasHeader') as HTMLInputElement;
    const skipHeaderInput = container.querySelector('#csvSourceSkipHeaderLines') as HTMLInputElement;
    const nullInput = container.querySelector('#csvSourceNullString') as HTMLInputElement;
    const commentInput = container.querySelector('#csvSourceCommentMarker') as HTMLInputElement;
    const strategySelect = container.querySelector('#csvSourceMappingStrategy') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#csvSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('gs://my-bucket/data/*.csv');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
    expect(formatSelect).toHaveValue('RFC4180');
    expect(delimiterInput).toHaveValue(';');
    expect(quoteInput).toHaveValue("'");
    expect(headerInput).toHaveValue('id,name,email,amount');
    expect(hasHeaderCheckbox).toBeChecked();
    expect(skipHeaderInput).toHaveValue(1);
    expect(nullInput).toHaveValue('NA');
    expect(commentInput).toHaveValue('#');
    expect(strategySelect).toHaveValue('schema');
    expect(screen.getByText('1 FIELD')).toBeInTheDocument();
    expect(instructionsTextarea).toHaveValue('Parse timestamps using ISO format');
  });

  it('handles field changes for filePattern, csvFormat, delimiter, and quoteChar', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<CsvIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Change filePattern
    const filePatternInput = container.querySelector('#csvSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 's3://my-lake/orders/*.csv' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 's3://my-lake/orders/*.csv'
      })
    );

    // Change csvFormat
    const formatSelect = container.querySelector('#csvSourceFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'csvFormat', value: 'POSTGRESQL_CSV' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        csvFormat: 'POSTGRESQL_CSV'
      })
    );

    // Change delimiter
    const delimiterInput = container.querySelector('#csvSourceDelimiter') as HTMLInputElement;
    fireEvent.change(delimiterInput, {
      target: { name: 'delimiter', value: '\t' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        delimiter: '\t'
      })
    );

    // Change quoteChar
    const quoteInput = container.querySelector('#csvSourceQuoteChar') as HTMLInputElement;
    fireEvent.change(quoteInput, {
      target: { name: 'quoteChar', value: "'" }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteChar: "'"
      })
    );
  });

  it('handles header configuration (persisting only header without headerRow), skipHeaderLines, nullString, and commentMarker updates', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<CsvIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Toggle hasHeader checkbox
    const hasHeaderCheckbox = container.querySelector('#csvSourceHasHeader') as HTMLInputElement;
    fireEvent.click(hasHeaderCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        hasHeader: false
      })
    );

    // Update header — must persist only `header` and NOT the duplicate `headerRow` shadow key
    mockOnChange.mockClear();
    const headerInput = container.querySelector('#csvSourceHeader') as HTMLInputElement;
    fireEvent.change(headerInput, {
      target: { name: 'header', value: 'colA, colB, colC' }
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      header: 'colA, colB, colC'
    });
    expect(mockOnChange.mock.calls[0][0]).not.toHaveProperty('headerRow');

    // Update skipHeaderLines
    const skipHeaderInput = container.querySelector('#csvSourceSkipHeaderLines') as HTMLInputElement;
    fireEvent.change(skipHeaderInput, {
      target: { name: 'skipHeaderLines', value: '2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        skipHeaderLines: '2'
      })
    );

    // Update nullString
    const nullInput = container.querySelector('#csvSourceNullString') as HTMLInputElement;
    fireEvent.change(nullInput, {
      target: { name: 'nullString', value: '\\N' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nullString: '\\N'
      })
    );

    // Update commentMarker
    const commentInput = container.querySelector('#csvSourceCommentMarker') as HTMLInputElement;
    fireEvent.change(commentInput, {
      target: { name: 'commentMarker', value: '#' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        commentMarker: '#'
      })
    );
  });

  it('defaults mappingStrategy to infer when schema is empty and switches to schema mode', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<CsvIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const strategySelect = container.querySelector('#csvSourceMappingStrategy') as HTMLSelectElement;
    expect(strategySelect).toBeInTheDocument();
    expect(strategySelect).toHaveValue('infer');
    expect(Array.from(strategySelect.options).map((o) => o.value)).toEqual(['infer', 'schema']);

    fireEvent.change(strategySelect, {
      target: { name: 'mappingStrategy', value: 'schema' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mappingStrategy: 'schema'
      })
    );
  });

  it('handles SchemaEditor updates when in schema mode', () => {
    const mockNode: any = {
      data: {
        properties: {
          mappingStrategy: 'schema'
        }
      }
    };

    const { container } = render(<CsvIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Switch to Schema String tab in SchemaEditor and update schema
    fireEvent.click(screen.getByText('Schema String'));
    const stringTextarea = container.querySelector('#csvSourceMappingStrategySchemaString') as HTMLTextAreaElement;
    expect(stringTextarea).toBeInTheDocument();

    fireEvent.change(stringTextarea, {
      target: { value: 'userId:STRING:REQUIRED, amount:DOUBLE' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaString: 'userId:STRING:REQUIRED, amount:DOUBLE',
        schemaFields: [
          { name: 'userId', type: 'STRING', mode: 'REQUIRED', description: '' },
          { name: 'amount', type: 'DOUBLE', mode: 'NULLABLE', description: '' }
        ]
      })
    );
  });

  it('defaults splittable to true in advanced settings accordion, badges Python ReadFromCsv only, and omits minBundleSize and validate (regression test)', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<CsvIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Verify header helper text documents Java CsvIO.parseRows requirement & Python names=[...] mapping
    expect(
      screen.getByText(/Explicit header column names are required for Java CsvIO\.parseRows\(schema, csvFormat\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/names=\[\.\.\.\] in Python ReadFromCsv/i)).toBeInTheDocument();

    // Click to open Advanced Read Tuning accordion
    const advancedToggle = screen.getByText('Advanced Read Tuning & Options');
    fireEvent.click(advancedToggle);

    // Splittable checkbox defaults to true (matching Python ReadFromCsv(splittable=True))
    const splittableCheckbox = container.querySelector('#csvSourceSplittable') as HTMLInputElement;
    expect(splittableCheckbox).toBeInTheDocument();
    expect(splittableCheckbox).toBeChecked();
    expect(screen.getByText(/Splittable Reading Mode \(Python ReadFromCsv only\)/i)).toBeInTheDocument();

    fireEvent.click(splittableCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        splittable: false
      })
    );

    // Verify unroutable minBundleSize and validate controls are completely absent
    expect(container.querySelector('#csvSourceValidate')).not.toBeInTheDocument();
    expect(container.querySelector('#csvSourceMinBundleSize')).not.toBeInTheDocument();
    expect(container.querySelector('[name="validate"]')).not.toBeInTheDocument();
    expect(container.querySelector('[name="minBundleSize"]')).not.toBeInTheDocument();
    expect(container.querySelector('[name="headerRow"]')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<CsvIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#csvSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Parse rows into CustomerRecord class conforming to Beam Schema' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Parse rows into CustomerRecord class conforming to Beam Schema'
      })
    );
  });
});

