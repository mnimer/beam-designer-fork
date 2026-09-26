/**
 * ThriftIO Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating ThriftIOSourceProperties component functionality,
 * form change callbacks, validation states for required fields, accordion toggling,
 * dynamic extension GCS bucket discovery IPC, code generation instructions,
 * and regression guards against removed controls (minBundleSize, expansionService)
 * and invalid enum values (TSimpleJSONProtocol on read, XZ compression).
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Validates required field states (filePattern and recordClass independently),
 *   default fallbacks, and error boundaries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ThriftIOSourceProperties,
  THRIFT_PROTOCOL_OPTIONS,
  THRIFT_SOURCE_COMPRESSION_TYPES
} from './ThriftIO';

describe('ThriftIOSourceProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing filePattern and recordClass', () => {
    const mockNode: any = {
      data: {
        label: 'ThriftIO',
        beam_transform: 'ThriftIO',
        properties: {}
      }
    };

    const { container } = render(<ThriftIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#thriftSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();

    const recordClassInput = container.querySelector('#thriftSourceRecordClass') as HTMLInputElement;
    expect(recordClassInput).toBeInTheDocument();
    expect(recordClassInput).toHaveValue('');
    expect(recordClassInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Record Class is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'ThriftIO',
        beam_transform: 'ThriftIO',
        properties: {
          filePattern: 'gs://thrift-bucket/orders/*.thrift',
          recordClass: 'com.example.thrift.OrderRecord',
          protocolFactory: 'TCompactProtocol',
          compression: 'GZIP',
          validate: false,
          system_instructions: 'Custom Thrift reader instructions'
        }
      }
    };

    const { container } = render(<ThriftIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#thriftSourceFilePattern') as HTMLInputElement;
    const recordClassInput = container.querySelector('#thriftSourceRecordClass') as HTMLInputElement;
    const protocolSelect = container.querySelector('#thriftSourceProtocolFactory') as HTMLSelectElement;
    const compressionSelect = container.querySelector('#thriftSourceCompression') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#thriftSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('gs://thrift-bucket/orders/*.thrift');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(recordClassInput).toHaveValue('com.example.thrift.OrderRecord');
    expect(recordClassInput).toHaveAttribute('aria-invalid', 'false');
    expect(protocolSelect).toHaveValue('TCompactProtocol');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(instructionsTextarea).toHaveValue('Custom Thrift reader instructions');

    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
    expect(screen.queryByText('Record Class is required.')).not.toBeInTheDocument();
  });

  it('validates on/off for filePattern and recordClass independently', () => {
    // Only filePattern provided
    const mockNodeWithPattern: any = {
      data: {
        properties: {
          filePattern: 'gs://thrift-bucket/data/*.thrift'
        }
      }
    };
    const { rerender } = render(<ThriftIOSourceProperties node={mockNodeWithPattern} onChange={mockOnChange} />);
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
    expect(screen.getByText('Record Class is required.')).toBeInTheDocument();

    // Only recordClass provided
    const mockNodeWithRecordClass: any = {
      data: {
        properties: {
          recordClass: 'com.example.thrift.InvoiceRecord'
        }
      }
    };
    rerender(<ThriftIOSourceProperties node={mockNodeWithRecordClass} onChange={mockOnChange} />);
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
    expect(screen.queryByText('Record Class is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for filePattern, recordClass, protocolFactory, and compression', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ThriftIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // filePattern change
    const filePatternInput = container.querySelector('#thriftSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 's3://thrift-bucket/data.thrift' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 's3://thrift-bucket/data.thrift'
      })
    );

    // recordClass change
    const recordClassInput = container.querySelector('#thriftSourceRecordClass') as HTMLInputElement;
    fireEvent.change(recordClassInput, {
      target: { name: 'recordClass', value: 'com.example.thrift.OrderRecord' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        recordClass: 'com.example.thrift.OrderRecord'
      })
    );

    // protocolFactory change
    const protocolSelect = container.querySelector('#thriftSourceProtocolFactory') as HTMLSelectElement;
    fireEvent.change(protocolSelect, {
      target: { name: 'protocolFactory', value: 'TJSONProtocol' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolFactory: 'TJSONProtocol'
      })
    );

    // compression change
    const compressionSelect = container.querySelector('#thriftSourceCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'ZSTD' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'ZSTD'
      })
    );
  });

  it('handles validate checkbox toggle in advanced tuning', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ThriftIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Open Advanced Accordion
    const advancedToggle = screen.getByText('Read Tuning & Options');
    fireEvent.click(advancedToggle);

    // Validate checkbox is checked by default
    const validateCheckbox = container.querySelector('#thriftSourceValidate') as HTMLInputElement;
    expect(validateCheckbox).toBeInTheDocument();
    expect(validateCheckbox).toBeChecked();

    fireEvent.click(validateCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        validate: false
      })
    );

    // Toggle accordion closed again
    fireEvent.click(advancedToggle);
    expect(container.querySelector('#thriftSourceValidate')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ThriftIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#thriftSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Read Thrift records and map to internal domain model' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Read Thrift records and map to internal domain model'
      })
    );
  });

  it('falls back to special_instructions and property-level instructions when present', () => {
    const mockNodeSpecialData: any = {
      data: {
        special_instructions: 'Special instructions from data',
        properties: {}
      }
    };
    const { rerender } = render(<ThriftIOSourceProperties node={mockNodeSpecialData} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from data')).toBeInTheDocument();

    const mockNodePropertySys: any = {
      data: {
        properties: {
          system_instructions: 'System instructions from properties'
        }
      }
    };
    rerender(<ThriftIOSourceProperties node={mockNodePropertySys} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('System instructions from properties')).toBeInTheDocument();

    const mockNodePropertySpecial: any = {
      data: {
        properties: {
          special_instructions: 'Special instructions from properties'
        }
      }
    };
    rerender(<ThriftIOSourceProperties node={mockNodePropertySpecial} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from properties')).toBeInTheDocument();
  });

  it('requests storage buckets via vscode.postMessage and renders datalist suggestions upon message event', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ThriftIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Assert initial IPC request was dispatched to extension host
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Simulate extension response event with bucket array
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['lakehouse-thrift', 'gs://archive-thrift']
          }
        })
      );
    });

    // NOTE: StoragePathField relies on PropertyField's generated datalist id (`<inputId>-datalist`)
    const filePatternInput = container.querySelector('#thriftSourceFilePattern') as HTMLInputElement;
    const datalistId = filePatternInput.getAttribute('data-list') || filePatternInput.getAttribute('list');
    expect(datalistId).toBeTruthy();
    const datalist = document.getElementById(datalistId!) || container.querySelector(`datalist#${datalistId}`);
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);
    expect(datalist?.children[0]).toHaveAttribute('value', 'gs://lakehouse-thrift/');
    expect(datalist?.children[1]).toHaveAttribute('value', 'gs://archive-thrift');
  });

  it('surfaces bucket discovery error inline using muted/red text alert', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          filePattern: 'gs://bucket/data.thrift',
          recordClass: 'com.example.thrift.Order'
        }
      }
    };

    render(<ThriftIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Simulate extension response error
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'Google Cloud API error: 403 Forbidden'
          }
        })
      );
    });

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent('Failed to load Cloud Storage buckets: Google Cloud API error: 403 Forbidden');
    expect(errorAlert).toHaveClass('text-red-400');
  });

  it('never renders minBundleSize, expansionService, TSimpleJSONProtocol on read, or XZ compression', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          filePattern: 'gs://bucket/data.thrift',
          recordClass: 'com.example.thrift.Order',
          minBundleSize: 4096,
          expansionService: 'localhost:8097'
        }
      }
    };

    const { container } = render(<ThriftIOSourceProperties node={mockLegacyNode} onChange={mockOnChange} />);

    // Open accordion to ensure minBundleSize is not inside it
    fireEvent.click(screen.getByText('Read Tuning & Options'));

    expect(container.querySelector('#thriftSourceMinBundleSize')).not.toBeInTheDocument();
    expect(container.querySelector('#thriftSourceExpansionService')).not.toBeInTheDocument();
    expect(screen.queryByText(/Expansion Service/i)).not.toBeInTheDocument();
    expect(screen.getByText('File Pattern / Path (FileIO.match().filepattern)')).toBeInTheDocument();

    // Verify TSimpleJSONProtocol is absent from THRIFT_PROTOCOL_OPTIONS and protocol select
    expect(THRIFT_PROTOCOL_OPTIONS.map((o) => o.value)).toEqual([
      'TBinaryProtocol',
      'TCompactProtocol',
      'TJSONProtocol'
    ]);
    expect(THRIFT_PROTOCOL_OPTIONS.map((o) => o.value)).not.toContain('TSimpleJSONProtocol');
    const protocolSelect = container.querySelector('#thriftSourceProtocolFactory') as HTMLSelectElement;
    expect(Array.from(protocolSelect.options).map((o) => o.value)).not.toContain('TSimpleJSONProtocol');

    // Verify XZ is absent from THRIFT_SOURCE_COMPRESSION_TYPES and compression select
    expect(THRIFT_SOURCE_COMPRESSION_TYPES.map((o) => o.value)).not.toContain('XZ');
    const compressionSelect = container.querySelector('#thriftSourceCompression') as HTMLSelectElement;
    expect(Array.from(compressionSelect.options).map((o) => o.value)).not.toContain('XZ');
  });
});

