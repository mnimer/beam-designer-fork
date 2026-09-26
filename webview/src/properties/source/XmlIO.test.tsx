/**
 * Unit Tests for XmlIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates rendering, input handling, Cloud Storage bucket auto-discovery messaging,
 * validation indicators, select dropdown handling, collapsible accordion toggling,
 * error state rendering, and code generation instructions for XmlIOSourceProperties.
 * 
 * Architectural Decisions:
 * - Mocks window.vscode IPC message dispatch to verify getStorageBuckets request.
 * - Dispatches storageBucketsLoaded message events to verify dynamic datalist option population.
 * - Tests both success and failure branches for asset loader discovery.
 * - Verifies required-field validation states for filePattern, rootElement, and recordElement.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { XmlIOSourceProperties } from './XmlIO';

describe('XmlIOSourceProperties', () => {
  const mockOnChange = vi.fn();
  let originalVscode: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation errors for missing required fields', () => {
    const mockNode: any = {
      data: {
        label: 'XmlIO',
        beam_transform: 'XmlIO',
        properties: {}
      }
    };

    const { container } = render(<XmlIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // File Pattern
    const filePatternInput = container.querySelector('#xmlSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();

    // Root Element
    const rootElementInput = container.querySelector('#xmlSourceRootElement') as HTMLInputElement;
    expect(rootElementInput).toBeInTheDocument();
    expect(rootElementInput).toHaveValue('');
    expect(rootElementInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Root Element is required.')).toBeInTheDocument();

    // Record Element
    const recordElementInput = container.querySelector('#xmlSourceRecordElement') as HTMLInputElement;
    expect(recordElementInput).toBeInTheDocument();
    expect(recordElementInput).toHaveValue('');
    expect(recordElementInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Record Element is required.')).toBeInTheDocument();

    // Selects and textareas
    expect(container.querySelector('#xmlSourceRecordClass')).not.toBeInTheDocument();
    const strategySelect = container.querySelector('#xmlSourceMappingStrategy') as HTMLSelectElement;
    expect(strategySelect).toBeInTheDocument();
    expect(strategySelect).toHaveValue('infer');
    expect(Array.from(strategySelect.options).map((o) => o.value)).toEqual(['infer', 'schema']);
    expect(container.querySelector('#xmlSourceCharset')).toHaveValue('UTF-8');
    expect(container.querySelector('#xmlSourceCompression')).toHaveValue('AUTO');
    expect(container.querySelector('#xmlSourceInstructions')).toBeInTheDocument();
  });

  it('renders with populated properties and flags no validation errors', () => {
    const mockNode: any = {
      data: {
        label: 'XmlIO',
        beam_transform: 'XmlIO',
        properties: {
          filePattern: 'gs://my-bucket/inventory/*.xml',
          rootElement: 'inventory',
          recordElement: 'item',
          mappingStrategy: 'schema',
          schemaString: 'sku:STRING:REQUIRED, price:DOUBLE',
          charset: 'ISO-8859-1',
          compression: 'GZIP',
          validate: false,
          minBundleSize: 2048,
          expansionService: 'localhost:8097',
          system_instructions: 'Custom XML processing instructions'
        }
      }
    };

    const { container } = render(<XmlIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#xmlSourceFilePattern') as HTMLInputElement;
    const rootElementInput = container.querySelector('#xmlSourceRootElement') as HTMLInputElement;
    const recordElementInput = container.querySelector('#xmlSourceRecordElement') as HTMLInputElement;
    const strategySelect = container.querySelector('#xmlSourceMappingStrategy') as HTMLSelectElement;
    const charsetSelect = container.querySelector('#xmlSourceCharset') as HTMLSelectElement;
    const compressionSelect = container.querySelector('#xmlSourceCompression') as HTMLSelectElement;
    const expansionServiceInput = container.querySelector('#xmlSourceExpansionService') as HTMLInputElement;
    const instructionsArea = container.querySelector('#xmlSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('gs://my-bucket/inventory/*.xml');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(rootElementInput).toHaveValue('inventory');
    expect(rootElementInput).toHaveAttribute('aria-invalid', 'false');
    expect(recordElementInput).toHaveValue('item');
    expect(recordElementInput).toHaveAttribute('aria-invalid', 'false');
    expect(strategySelect).toHaveValue('schema');
    expect(screen.getByText('2 FIELDS')).toBeInTheDocument();
    expect(charsetSelect).toHaveValue('ISO-8859-1');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(expansionServiceInput).toHaveValue('localhost:8097');
    expect(instructionsArea).toHaveValue('Custom XML processing instructions');

    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
    expect(screen.queryByText('Root Element is required.')).not.toBeInTheDocument();
    expect(screen.queryByText('Record Element is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for filePattern, rootElement, recordElement, mappingStrategy, schemaFields, and expansionService', () => {
    const mockNode: any = {
      data: {
        properties: {
          mappingStrategy: 'schema'
        }
      }
    };

    const { container } = render(<XmlIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // File Pattern edit
    const filePatternInput = container.querySelector('#xmlSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 'gs://data-bucket/catalog/*.xml' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ filePattern: 'gs://data-bucket/catalog/*.xml' })
    );

    // Root Element edit
    const rootElementInput = container.querySelector('#xmlSourceRootElement') as HTMLInputElement;
    fireEvent.change(rootElementInput, {
      target: { name: 'rootElement', value: 'catalog' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ rootElement: 'catalog' })
    );

    // Record Element edit
    const recordElementInput = container.querySelector('#xmlSourceRecordElement') as HTMLInputElement;
    fireEvent.change(recordElementInput, {
      target: { name: 'recordElement', value: 'product' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ recordElement: 'product' })
    );

    // Mapping Strategy edit
    const strategySelect = container.querySelector('#xmlSourceMappingStrategy') as HTMLSelectElement;
    fireEvent.change(strategySelect, {
      target: { name: 'mappingStrategy', value: 'infer' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ mappingStrategy: 'infer' })
    );

    // SchemaEditor string tab edit
    fireEvent.click(screen.getByText('Schema String'));
    const stringTextarea = container.querySelector('#xmlSourceMappingStrategySchemaString') as HTMLTextAreaElement;
    fireEvent.change(stringTextarea, {
      target: { value: 'product_id:STRING:REQUIRED, price:DOUBLE' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaString: 'product_id:STRING:REQUIRED, price:DOUBLE',
        schemaFields: [
          { name: 'product_id', type: 'STRING', mode: 'REQUIRED', description: '' },
          { name: 'price', type: 'DOUBLE', mode: 'NULLABLE', description: '' }
        ]
      })
    );

    // Expansion Service edit
    const expansionServiceInput = container.querySelector('#xmlSourceExpansionService') as HTMLInputElement;
    fireEvent.change(expansionServiceInput, {
      target: { name: 'expansionService', value: '127.0.0.1:8099' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ expansionService: '127.0.0.1:8099' })
    );
  });

  it('handles select changes for charset and compression', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<XmlIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Charset select
    const charsetSelect = container.querySelector('#xmlSourceCharset') as HTMLSelectElement;
    fireEvent.change(charsetSelect, {
      target: { name: 'charset', value: 'UTF-16' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ charset: 'UTF-16' })
    );

    // Compression select
    const compressionSelect = container.querySelector('#xmlSourceCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'BZIP2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ compression: 'BZIP2' })
    );
  });

  it('toggles advanced settings accordion and updates minBundleSize and validate checkbox', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<XmlIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Accordion is closed initially
    expect(container.querySelector('#xmlSourceValidate')).not.toBeInTheDocument();

    // Open Accordion
    const accordionBtn = screen.getByText('Read Tuning & Options');
    fireEvent.click(accordionBtn);

    // Validate Checkbox
    const validateCheckbox = container.querySelector('#xmlSourceValidate') as HTMLInputElement;
    expect(validateCheckbox).toBeInTheDocument();
    expect(validateCheckbox).toBeChecked(); // default true

    fireEvent.click(validateCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ validate: false })
    );

    // Min Bundle Size input
    const minBundleSizeInput = container.querySelector('#xmlSourceMinBundleSize') as HTMLInputElement;
    expect(minBundleSizeInput).toBeInTheDocument();

    fireEvent.change(minBundleSizeInput, {
      target: { name: 'minBundleSize', value: '4096' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ minBundleSize: '4096' })
    );

    // Close Accordion
    fireEvent.click(accordionBtn);
    expect(container.querySelector('#xmlSourceValidate')).not.toBeInTheDocument();
  });

  it('requests storage buckets via vscode.postMessage and populates datalist on storageBucketsLoaded event', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<XmlIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Assert getStorageBuckets command was requested
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Dispatch extension host response
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['xml-input-bucket', 'archive-bucket']
          }
        })
      );
    });

    // Check datalist options
    const datalist = container.querySelector('datalist');
    expect(datalist).toBeInTheDocument();
    const options = datalist?.querySelectorAll('option');
    expect(options?.length).toBe(2);
    expect(options?.[0]).toHaveAttribute('value', 'gs://xml-input-bucket/');
    expect(options?.[1]).toHaveAttribute('value', 'gs://archive-bucket/');
  });

  it('renders inline error message when storage bucket discovery fails', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          filePattern: 'gs://my-bucket/*.xml'
        }
      }
    };

    render(<XmlIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Dispatch failure message event
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'Failed to authenticate with Cloud Storage'
          }
        })
      );
    });

    // Assert inline error message renders
    expect(
      screen.getByText('Failed to load Cloud Storage buckets: Failed to authenticate with Cloud Storage')
    ).toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<XmlIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsArea = container.querySelector('#xmlSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsArea, {
      target: { value: 'Parse XML with Woodstox parser for high performance' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Parse XML with Woodstox parser for high performance'
      })
    );
  });
});
