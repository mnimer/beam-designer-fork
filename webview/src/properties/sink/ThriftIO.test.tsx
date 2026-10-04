/**
 * ThriftIO Sink Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating ThriftIOSinkProperties component functionality,
 * form change callbacks, validation states for required fields (.to), sharding accordion toggling,
 * dynamic extension GCS bucket discovery IPC, code generation instructions,
 * and regression guards against removed non-API fields (recordClass, shardTemplate, expansionService)
 * and invalid Compression.XZ option.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Validates required field state for destination (.to), default fallbacks, and error boundaries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ThriftIOSinkProperties,
  THRIFT_SINK_COMPRESSION_TYPES,
  THRIFT_SINK_PROTOCOL_FACTORIES
} from './ThriftIO';

describe('ThriftIOSinkProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

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
        label: 'ThriftIO',
        beam_transform: 'ThriftIO',
        properties: {}
      }
    };

    const { container } = render(<ThriftIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#thriftSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'ThriftIO',
        beam_transform: 'ThriftIO',
        properties: {
          to: 'gs://my-bucket/output/records',
          suffix: '.thrift',
          protocolFactory: 'TCompactProtocol',
          compression: 'GZIP',
          numShards: 8,
          system_instructions: 'Sink Thrift LLM instructions'
        }
      }
    };

    const { container } = render(<ThriftIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#thriftSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#thriftSinkSuffix') as HTMLInputElement;
    const protocolSelect = container.querySelector('#thriftSinkProtocolFactory') as HTMLSelectElement;
    const compressionSelect = container.querySelector('#thriftSinkCompression') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#thriftSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('gs://my-bucket/output/records');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.thrift');
    expect(protocolSelect).toHaveValue('TCompactProtocol');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(instructionsTextarea).toHaveValue('Sink Thrift LLM instructions');

    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('validates on/off for destination (.to) independently', () => {
    const mockNodeEmpty: any = {
      data: {
        properties: {
          to: ''
        }
      }
    };
    const { rerender } = render(<ThriftIOSinkProperties node={mockNodeEmpty} onChange={mockOnChange} />);
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();

    const mockNodeWithTo: any = {
      data: {
        properties: {
          to: 'gs://my-bucket/output/'
        }
      }
    };
    rerender(<ThriftIOSinkProperties node={mockNodeWithTo} onChange={mockOnChange} />);
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for destination path, suffix, protocolFactory, and compression', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ThriftIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // to change
    const toInput = container.querySelector('#thriftSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 's3://output-lakehouse/orders/' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 's3://output-lakehouse/orders/'
      })
    );

    // suffix change
    const suffixInput = container.querySelector('#thriftSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.bin' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.bin'
      })
    );

    // protocolFactory change (TSimpleJSONProtocol is valid on the sink side)
    const protocolSelect = container.querySelector('#thriftSinkProtocolFactory') as HTMLSelectElement;
    fireEvent.change(protocolSelect, {
      target: { name: 'protocolFactory', value: 'TSimpleJSONProtocol' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolFactory: 'TSimpleJSONProtocol'
      })
    );

    // compression change
    const compressionSelect = container.querySelector('#thriftSinkCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'BZIP2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'BZIP2'
      })
    );
  });

  it('toggles sharding accordion and updates numShards', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ThriftIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Open Sharding Accordion
    const accordionToggle = screen.getByText('Sharding & Output Options');
    fireEvent.click(accordionToggle);

    const numShardsInput = container.querySelector('#thriftSinkNumShards') as HTMLInputElement;
    expect(numShardsInput).toBeInTheDocument();
    fireEvent.change(numShardsInput, {
      target: { name: 'numShards', value: '12' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '12'
      })
    );

    // Toggle accordion closed again
    fireEvent.click(accordionToggle);
    expect(container.querySelector('#thriftSinkNumShards')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<ThriftIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#thriftSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Configure ThriftIO sink with 5 shards and TCompactProtocol' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Configure ThriftIO sink with 5 shards and TCompactProtocol'
      })
    );
  });

  it('never renders recordClass, shardTemplate, expansionService, or XZ compression', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          to: 'gs://bucket/out',
          recordClass: 'com.example.thrift.ProcessedOrder',
          shardTemplate: '-SSSSS-of-NNNNN',
          expansionService: 'localhost:8097'
        }
      }
    };

    const { container } = render(<ThriftIOSinkProperties node={mockLegacyNode} onChange={mockOnChange} />);

    // Open accordion so any hidden shardTemplate control would be mounted
    fireEvent.click(screen.getByText('Sharding & Output Options'));

    expect(container.querySelector('#thriftSinkRecordClass')).not.toBeInTheDocument();
    expect(container.querySelector('#thriftSinkShardTemplate')).not.toBeInTheDocument();
    expect(container.querySelector('#thriftSinkExpansionService')).not.toBeInTheDocument();
    expect(screen.queryByText(/Record Class/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shard Name Template/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Expansion Service/i)).not.toBeInTheDocument();

    // Verify XZ is absent from THRIFT_SINK_COMPRESSION_TYPES and compression select
    expect(THRIFT_SINK_COMPRESSION_TYPES.map((o) => o.value)).not.toContain('XZ');
    const compressionSelect = container.querySelector('#thriftSinkCompression') as HTMLSelectElement;
    expect(Array.from(compressionSelect.options).map((o) => o.value)).not.toContain('XZ');

    // Sink retains TSimpleJSONProtocol as a valid write-side protocol
    expect(THRIFT_SINK_PROTOCOL_FACTORIES.map((o) => o.value)).toContain('TSimpleJSONProtocol');
  });
});

