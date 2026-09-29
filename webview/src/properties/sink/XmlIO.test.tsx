/**
 * Unit Tests for XmlIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates rendering, input handling, Cloud Storage bucket auto-discovery messaging,
 * validation indicators, charset select changes, sharding controls, accordion toggling,
 * error state rendering, and code generation instructions for XmlIOSinkProperties.
 * 
 * Architectural Decisions:
 * - Mocks window.vscode IPC message dispatch to verify getStorageBuckets request.
 * - Dispatches storageBucketsLoaded message events to verify dynamic datalist option population.
 * - Tests both success and failure branches for asset loader discovery.
 * - Verifies required-field validation states for to and rootElement.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { XmlIOSinkProperties } from './XmlIO';

describe('XmlIOSinkProperties', () => {
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

    const { container } = render(<XmlIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Destination Prefix (.to)
    const toInput = container.querySelector('#xmlSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Prefix is required.')).toBeInTheDocument();

    // Suffix default
    const suffixInput = container.querySelector('#xmlSinkSuffix') as HTMLInputElement;
    expect(suffixInput).toHaveValue('.xml');

    // Root Element
    const rootElementInput = container.querySelector('#xmlSinkRootElement') as HTMLInputElement;
    expect(rootElementInput).toBeInTheDocument();
    expect(rootElementInput).toHaveValue('');
    expect(rootElementInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Root Element is required.')).toBeInTheDocument();

    // Charset select and mappingStrategy
    expect(container.querySelector('#xmlSinkRecordClass')).not.toBeInTheDocument();
    const strategySelect = container.querySelector('#xmlSinkMappingStrategy') as HTMLSelectElement;
    expect(strategySelect).toBeInTheDocument();
    expect(strategySelect).toHaveValue('infer');
    expect(Array.from(strategySelect.options).map((o) => o.value)).toEqual(['infer', 'schema']);
    expect(container.querySelector('#xmlSinkCharset')).toHaveValue('UTF-8');
    expect(container.querySelector('#xmlSinkInstructions')).toBeInTheDocument();
  });

  it('renders with populated properties and flags no validation errors', () => {
    const mockNode: any = {
      data: {
        label: 'XmlIO',
        beam_transform: 'XmlIO',
        properties: {
          to: 'gs://my-bucket/output/items',
          suffix: '.xml.gz',
          rootElement: 'inventory',
          mappingStrategy: 'schema',
          schemaString: 'sku:STRING:REQUIRED, price:DOUBLE',
          charset: 'ISO-8859-1',
          numShards: 5,
          shardTemplate: '-SSSSS-of-NNNNN',
          expansionService: 'localhost:8097',
          system_instructions: 'Custom XML writer instructions'
        }
      }
    };

    const { container } = render(<XmlIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#xmlSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#xmlSinkSuffix') as HTMLInputElement;
    const rootElementInput = container.querySelector('#xmlSinkRootElement') as HTMLInputElement;
    const strategySelect = container.querySelector('#xmlSinkMappingStrategy') as HTMLSelectElement;
    const charsetSelect = container.querySelector('#xmlSinkCharset') as HTMLSelectElement;
    const numShardsInput = container.querySelector('#xmlSinkNumShards') as HTMLInputElement;
    const shardTemplateInput = container.querySelector('#xmlSinkShardTemplate') as HTMLInputElement;
    const expansionServiceInput = container.querySelector('#xmlSinkExpansionService') as HTMLInputElement;
    const instructionsArea = container.querySelector('#xmlSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('gs://my-bucket/output/items');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.xml.gz');
    expect(rootElementInput).toHaveValue('inventory');
    expect(rootElementInput).toHaveAttribute('aria-invalid', 'false');
    expect(strategySelect).toHaveValue('schema');
    expect(screen.getByText('2 FIELDS')).toBeInTheDocument();
    expect(charsetSelect).toHaveValue('ISO-8859-1');
    expect(numShardsInput).toHaveValue(5);
    expect(shardTemplateInput).toHaveValue('-SSSSS-of-NNNNN');
    expect(expansionServiceInput).toHaveValue('localhost:8097');
    expect(instructionsArea).toHaveValue('Custom XML writer instructions');

    expect(screen.queryByText('Destination Prefix is required.')).not.toBeInTheDocument();
    expect(screen.queryByText('Root Element is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for to, suffix, rootElement, mappingStrategy, schemaFields, numShards, shardTemplate, and expansionService', () => {
    const mockNode: any = {
      data: {
        properties: {
          mappingStrategy: 'schema'
        }
      }
    };

    const { container } = render(<XmlIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // To edit
    const toInput = container.querySelector('#xmlSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 's3://out-bucket/orders' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ to: 's3://out-bucket/orders' })
    );

    // Suffix edit
    const suffixInput = container.querySelector('#xmlSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.xml.gz' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ suffix: '.xml.gz' })
    );

    // Root Element edit
    const rootElementInput = container.querySelector('#xmlSinkRootElement') as HTMLInputElement;
    fireEvent.change(rootElementInput, {
      target: { name: 'rootElement', value: 'orderBatch' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ rootElement: 'orderBatch' })
    );

    // Mapping Strategy edit
    const strategySelect = container.querySelector('#xmlSinkMappingStrategy') as HTMLSelectElement;
    fireEvent.change(strategySelect, {
      target: { name: 'mappingStrategy', value: 'infer' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ mappingStrategy: 'infer' })
    );

    // SchemaEditor string tab edit
    fireEvent.click(screen.getByText('Schema String'));
    const stringTextarea = container.querySelector('#xmlSinkMappingStrategySchemaString') as HTMLTextAreaElement;
    fireEvent.change(stringTextarea, {
      target: { value: 'order_id:STRING:REQUIRED, total:DOUBLE' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaString: 'order_id:STRING:REQUIRED, total:DOUBLE',
        schemaFields: [
          { name: 'order_id', type: 'STRING', mode: 'REQUIRED', description: '' },
          { name: 'total', type: 'DOUBLE', mode: 'NULLABLE', description: '' }
        ]
      })
    );

    // NumShards edit
    const numShardsInput = container.querySelector('#xmlSinkNumShards') as HTMLInputElement;
    fireEvent.change(numShardsInput, {
      target: { name: 'numShards', value: '10' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ numShards: '10' })
    );

    // ShardTemplate edit
    const shardTemplateInput = container.querySelector('#xmlSinkShardTemplate') as HTMLInputElement;
    fireEvent.change(shardTemplateInput, {
      target: { name: 'shardTemplate', value: '-W-P-SS-of-NN' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ shardTemplate: '-W-P-SS-of-NN' })
    );

    // ExpansionService edit
    const expansionServiceInput = container.querySelector('#xmlSinkExpansionService') as HTMLInputElement;
    fireEvent.change(expansionServiceInput, {
      target: { name: 'expansionService', value: '10.0.0.1:8097' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ expansionService: '10.0.0.1:8097' })
    );
  });

  it('handles select changes for charset', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<XmlIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const charsetSelect = container.querySelector('#xmlSinkCharset') as HTMLSelectElement;
    fireEvent.change(charsetSelect, {
      target: { name: 'charset', value: 'UTF-16' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ charset: 'UTF-16' })
    );
  });

  it('toggles sharding configuration accordion', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<XmlIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Accordion is open initially
    expect(container.querySelector('#xmlSinkNumShards')).toBeInTheDocument();

    // Toggle close
    const accordionBtn = screen.getByText('Sharding Configuration');
    fireEvent.click(accordionBtn);
    expect(container.querySelector('#xmlSinkNumShards')).not.toBeInTheDocument();

    // Toggle open
    fireEvent.click(accordionBtn);
    expect(container.querySelector('#xmlSinkNumShards')).toBeInTheDocument();
  });

  it('requests storage buckets via vscode.postMessage and populates datalist on storageBucketsLoaded event', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<XmlIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Assert getStorageBuckets command was requested
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Dispatch extension host response
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['xml-output-bucket', 'export-bucket']
          }
        })
      );
    });

    // Check datalist options
    const datalist = container.querySelector('datalist');
    expect(datalist).toBeInTheDocument();
    const options = datalist?.querySelectorAll('option');
    expect(options?.length).toBe(2);
    expect(options?.[0]).toHaveAttribute('value', 'gs://xml-output-bucket/');
    expect(options?.[1]).toHaveAttribute('value', 'gs://export-bucket/');
  });

  it('renders inline error message when storage bucket discovery fails', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          to: 'gs://output-bucket/items'
        }
      }
    };

    render(<XmlIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Dispatch failure message event
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'GCS access denied: insufficient permissions'
          }
        })
      );
    });

    // Assert inline error message renders
    expect(
      screen.getByText('Failed to load Cloud Storage buckets: GCS access denied: insufficient permissions')
    ).toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<XmlIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsArea = container.querySelector('#xmlSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsArea, {
      target: { value: 'Configure JAXB Marshaller with formatted XML output' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Configure JAXB Marshaller with formatted XML output'
      })
    );
  });
});
