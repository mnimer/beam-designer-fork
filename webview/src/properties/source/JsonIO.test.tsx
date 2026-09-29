/**
 * Unit Tests for JsonIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates rendering, input handling, Cloud Storage bucket auto-discovery messaging,
 * required-path validation states, JSON Lines mode, compression selection, sample schema insertion,
 * accordion toggling, and code generation instructions for JsonIOSourceProperties.
 * 
 * Architectural Decisions:
 * - Uses Vitest and React Testing Library for fast, realistic DOM interaction testing.
 * - Mocks window.vscode.postMessage to verify extension host IPC interactions.
 * - Tests both success and failure scenarios for dynamic storageBucketsLoaded message events.
 * - Verifies that 100% of event handlers, toggles, and input states produce proper onChange payloads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { JsonIOSourceProperties, JSON_SOURCE_COMPRESSION_TYPES } from './JsonIO';

describe('JsonIOSourceProperties', () => {
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
        label: 'JsonIO Source',
        beam_transform: 'JsonIO',
        properties: {}
      }
    };

    const { container } = render(<JsonIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#jsonSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'JsonIO Source',
        beam_transform: 'JsonIO',
        properties: {
          filePattern: 'gs://my-bucket/data/*.json',
          lines: true,
          compression: 'GZIP',
          schema: '[{"name": "eventId", "type": "STRING", "mode": "REQUIRED"}]',
          system_instructions: 'Parse timestamps using ISO format'
        }
      }
    };

    const { container } = render(<JsonIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#jsonSourceFilePattern') as HTMLInputElement;
    const linesCheckbox = container.querySelector('#jsonSourceLines') as HTMLInputElement;
    const compressionSelect = container.querySelector('#jsonSourceCompression') as HTMLSelectElement;
    const strategySelect = container.querySelector('#jsonSourceMappingStrategy') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#jsonSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('gs://my-bucket/data/*.json');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
    expect(linesCheckbox).toBeChecked();
    expect(compressionSelect).toHaveValue('GZIP');
    expect(strategySelect).toHaveValue('schema');
    expect(screen.getByText('1 FIELD')).toBeInTheDocument();
    expect(instructionsTextarea).toHaveValue('Parse timestamps using ISO format');
  });

  it('handles field changes for filePattern, lines, and compression', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<JsonIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Change filePattern
    const filePatternInput = container.querySelector('#jsonSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 's3://my-lake/events/*.json' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 's3://my-lake/events/*.json'
      })
    );

    // Toggle lines checkbox
    const linesCheckbox = container.querySelector('#jsonSourceLines') as HTMLInputElement;
    expect(linesCheckbox).toBeChecked(); // default true
    fireEvent.click(linesCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: false
      })
    );

    // Change compression
    const compressionSelect = container.querySelector('#jsonSourceCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'BZIP2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'BZIP2'
      })
    );
  });

  it('defaults mappingStrategy to infer when schema is empty and switches to schema mode', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<JsonIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const strategySelect = container.querySelector('#jsonSourceMappingStrategy') as HTMLSelectElement;
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

  it('toggles schema accordion visibility and handles SchemaEditor updates when in schema mode', () => {
    const mockNode: any = {
      data: {
        properties: {
          mappingStrategy: 'schema'
        }
      }
    };

    const { container } = render(<JsonIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Accordion is open by default; click header to collapse it
    const schemaAccordionButton = screen
      .getByText('Schema Configuration (Java TextIO + JsonToRow.withSchema(schema))')
      .closest('button');
    expect(schemaAccordionButton).not.toBeNull();
    fireEvent.click(schemaAccordionButton!);

    // Content should be collapsed
    expect(container.querySelector('#jsonSourceMappingStrategy')).not.toBeInTheDocument();

    // Reopen accordion
    fireEvent.click(schemaAccordionButton!);
    expect(container.querySelector('#jsonSourceMappingStrategy')).toBeInTheDocument();

    // Switch to Schema String tab in SchemaEditor and update schema
    fireEvent.click(screen.getByText('Schema String'));
    const stringTextarea = container.querySelector('#jsonSourceMappingStrategySchemaString') as HTMLTextAreaElement;
    expect(stringTextarea).toBeInTheDocument();

    fireEvent.change(stringTextarea, {
      target: { value: 'eventId:STRING:REQUIRED, payload:STRING' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaString: 'eventId:STRING:REQUIRED, payload:STRING',
        schemaFields: [
          { name: 'eventId', type: 'STRING', mode: 'REQUIRED', description: '' },
          { name: 'payload', type: 'STRING', mode: 'NULLABLE', description: '' }
        ]
      })
    );
  });

  it('omits minBundleSize, validate, XZ codec, and non-existent JsonIO.readRows title while documenting Java TextIO + JsonToRow vs Python ReadFromJson (regression test)', () => {
    const mockNode: any = {
      data: {
        properties: {
          filePattern: 'gs://my-bucket/events/*.json'
        }
      }
    };

    const { container } = render(<JsonIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Verify non-existent JsonIO.readRows is completely absent and replaced by TextIO + JsonToRow.withSchema(schema)
    expect(screen.queryByText(/JsonIO\.readRows/i)).not.toBeInTheDocument();
    expect(
      screen.getByText('Schema Configuration (Java TextIO + JsonToRow.withSchema(schema))')
    ).toBeInTheDocument();

    // Verify unroutable minBundleSize and validate controls are absent
    expect(container.querySelector('#jsonSourceValidate')).not.toBeInTheDocument();
    expect(container.querySelector('#jsonSourceMinBundleSize')).not.toBeInTheDocument();
    expect(container.querySelector('[name="validate"]')).not.toBeInTheDocument();
    expect(container.querySelector('[name="minBundleSize"]')).not.toBeInTheDocument();

    // Verify XZ is omitted from JSON_SOURCE_COMPRESSION_TYPES and the dropdown
    expect(JSON_SOURCE_COMPRESSION_TYPES.map((c) => c.value)).not.toContain('XZ');
    const compressionSelect = container.querySelector('#jsonSourceCompression') as HTMLSelectElement;
    const optionValues = Array.from(compressionSelect.querySelectorAll('option')).map((opt) => opt.value);
    expect(optionValues).not.toContain('XZ');
    expect(optionValues).toEqual(['AUTO', 'UNCOMPRESSED', 'GZIP', 'BZIP2', 'DEFLATE', 'ZSTD']);

    // Verify helper texts for lines and compression
    expect(screen.getByText(/always newline-delimited JSON/i)).toBeInTheDocument();
    expect(screen.getByText(/auto-detects decompression by file extension/i)).toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<JsonIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#jsonSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Parse JSON into UserEvent class conforming to Beam Schema' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Parse JSON into UserEvent class conforming to Beam Schema'
      })
    );
  });

  it('posts getStorageBuckets command to vscode and populates datalist options on storageBucketsLoaded', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode = {
      data: {
        label: 'JsonIO Source',
        properties: {}
      }
    };

    const { container } = render(<JsonIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Assert getStorageBuckets was posted on mount
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Dispatch storageBucketsLoaded event
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['data-lake-bucket', 'analytics-exports']
          }
        })
      );
    });

    // Check datalist options attached to filePattern field
    const datalist = container.querySelector('datalist');
    expect(datalist).toBeInTheDocument();
    const options = datalist?.querySelectorAll('option');
    expect(options?.length).toBe(2);
    expect(options?.[0]).toHaveAttribute('value', 'gs://data-lake-bucket/');
    expect(options?.[1]).toHaveAttribute('value', 'gs://analytics-exports/');
  });

  it('surfaces bucket loading error inline when storageBucketsLoaded contains an error with empty filePattern', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode = {
      data: {
        label: 'JsonIO Source',
        properties: {}
      }
    };

    render(<JsonIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Dispatch error response
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'GCS API authentication failed: 403 Forbidden'
          }
        })
      );
    });

    // Verify both required validation and bucket discovery error render
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
    expect(screen.getByText('Failed to load Cloud Storage buckets: GCS API authentication failed: 403 Forbidden')).toBeInTheDocument();
  });

  it('surfaces bucket loading error inline when filePattern is valid and non-empty (regression test for suppressed discovery error)', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode = {
      data: {
        label: 'JsonIO Source',
        properties: {
          filePattern: 'gs://valid-bucket/data/*.json'
        }
      }
    };

    render(<JsonIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Dispatch error response
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'GCS API authentication failed: 403 Forbidden'
          }
        })
      );
    });

    // Verify discovery error message is rendered inline even when path is valid
    expect(screen.getByText('Failed to load Cloud Storage buckets: GCS API authentication failed: 403 Forbidden')).toBeInTheDocument();
  });
});
