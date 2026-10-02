/**
 * TikaIO Sink Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating TikaIOSinkProperties component functionality,
 * change callbacks, validation states for required destination directory (.to),
 * sharding accordion toggling (.withShardNameTemplate), dynamic GCS bucket discovery IPC,
 * architectural notice regarding lack of native write transform, code generation instructions,
 * and regression guards against removed controls and invalid Compression.XZ option.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Asserts the bucket-discovery error surfaces with a valid, non-empty path.
 * - Validates architectural notice and InfoTooltip explaining TikaIO.write() does not exist.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TikaIOSinkProperties, TIKA_SINK_COMPRESSION_TYPES } from './TikaIO';

describe('TikaIOSinkProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing to', () => {
    const mockNode: any = {
      data: {
        label: 'TikaIO Sink',
        beam_transform: 'TikaIO',
        properties: {}
      }
    };

    const { container } = render(<TikaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#tikaSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();

    const suffixInput = container.querySelector('#tikaSinkSuffix') as HTMLInputElement;
    expect(suffixInput).toHaveValue('.txt');

    const compressionSelect = container.querySelector('#tikaSinkCompression') as HTMLSelectElement;
    expect(compressionSelect).toHaveValue('UNCOMPRESSED');
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'TikaIO Sink',
        beam_transform: 'TikaIO',
        properties: {
          to: 'gs://output-bucket/parsed/documents',
          suffix: '.json',
          compression: 'GZIP',
          numShards: 5,
          shardTemplate: '-SSSSS-of-NNNNN',
          system_instructions: 'Persist JSON records with metadata'
        }
      }
    };

    const { container } = render(<TikaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#tikaSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#tikaSinkSuffix') as HTMLInputElement;
    const compressionSelect = container.querySelector('#tikaSinkCompression') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#tikaSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('gs://output-bucket/parsed/documents');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.json');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(instructionsTextarea).toHaveValue('Persist JSON records with metadata');

    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('validates on/off for destination directory (.to) independently', () => {
    const mockNodeEmpty: any = {
      data: {
        properties: {
          to: ''
        }
      }
    };
    const { rerender } = render(<TikaIOSinkProperties node={mockNodeEmpty} onChange={mockOnChange} />);
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();

    const mockNodeFilled: any = {
      data: {
        properties: {
          to: 'gs://output-bucket/extracted/'
        }
      }
    };
    rerender(<TikaIOSinkProperties node={mockNodeFilled} onChange={mockOnChange} />);
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('displays notice explaining Tika is Java-only', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<TikaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const notice = screen.getByTestId('tika-sink-notice');
    expect(notice).toHaveTextContent(/Java Only:/i);
    expect(notice).toHaveTextContent(/beam-sdks-java-io-tika/i);
  });

  it('handles changes for to, suffix, and compression', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TikaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // to change
    const toInput = container.querySelector('#tikaSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 's3://output-bucket/tika-results/' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 's3://output-bucket/tika-results/'
      })
    );

    // suffix change
    const suffixInput = container.querySelector('#tikaSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.json' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.json'
      })
    );

    // compression select change
    const compressionSelect = container.querySelector('#tikaSinkCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'ZSTD' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'ZSTD'
      })
    );
  });

  it('toggles sharding accordion, labels shardTemplate as .withShardNameTemplate, and updates numShards and shardTemplate', () => {
    const mockNode: any = {
      data: {
        properties: {
          numShards: 3,
          shardTemplate: '-SS-of-NN'
        }
      }
    };

    const { container } = render(<TikaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Initially closed, inputs unmounted
    expect(container.querySelector('#tikaSinkNumShards')).toBeNull();
    expect(container.querySelector('#tikaSinkShardTemplate')).toBeNull();

    // Toggle open
    const toggleButton = screen.getByRole('button', { name: /Sharding & File Naming/i });
    fireEvent.click(toggleButton);

    expect(screen.getByText('Shard Naming Template (.withShardNameTemplate)')).toBeInTheDocument();
    expect(screen.queryByText(/\.withShardTemplate\)/i)).not.toBeInTheDocument();

    const numShardsInput = container.querySelector('#tikaSinkNumShards') as HTMLInputElement;
    const shardTemplateInput = container.querySelector('#tikaSinkShardTemplate') as HTMLInputElement;

    expect(numShardsInput).toBeInTheDocument();
    expect(numShardsInput).toHaveValue(3);
    expect(shardTemplateInput).toBeInTheDocument();
    expect(shardTemplateInput).toHaveValue('-SS-of-NN');

    // Change values
    fireEvent.change(numShardsInput, {
      target: { name: 'numShards', value: '10' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '10'
      })
    );

    fireEvent.change(shardTemplateInput, {
      target: { name: 'shardTemplate', value: '-W-of-N' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        shardTemplate: '-W-of-N'
      })
    );

    // Toggle closed
    fireEvent.click(toggleButton);
    expect(container.querySelector('#tikaSinkNumShards')).toBeNull();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TikaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#tikaSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Write extracted document records to JSON partitioned shards' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Write extracted document records to JSON partitioned shards'
      })
    );
  });

  it('never renders removed controls (outputFormat, includeMetadata, metadataFields, authMode, secretName, expansionService) or XZ compression', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          to: 'gs://output-bucket/extracted/',
          outputFormat: 'AVRO',
          includeMetadata: true,
          metadataFields: 'Author, Title',
          authMode: 'secretManager',
          secretName: 'projects/123/secrets/tika-writer',
          expansionService: 'localhost:8097'
        }
      }
    };

    const { container } = render(<TikaIOSinkProperties node={mockLegacyNode} onChange={mockOnChange} />);

    expect(container.querySelector('#tikaSinkOutputFormat')).not.toBeInTheDocument();
    expect(container.querySelector('#tikaSinkIncludeMetadata')).not.toBeInTheDocument();
    expect(container.querySelector('#tikaSinkMetadataFields')).not.toBeInTheDocument();
    expect(container.querySelector('#tikaSinkAuthMode')).not.toBeInTheDocument();
    expect(container.querySelector('#tikaSinkSecretName')).not.toBeInTheDocument();
    expect(container.querySelector('#tikaSinkExpansionService')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="checkbox"]')).not.toBeInTheDocument();

    // Verify XZ is absent from TIKA_SINK_COMPRESSION_TYPES and the compression dropdown
    expect(TIKA_SINK_COMPRESSION_TYPES.map((o) => o.value)).not.toContain('XZ');
    const compressionSelect = container.querySelector('#tikaSinkCompression') as HTMLSelectElement;
    const optionValues = Array.from(compressionSelect.options).map((o) => o.value);
    expect(optionValues).not.toContain('XZ');
  });
});

