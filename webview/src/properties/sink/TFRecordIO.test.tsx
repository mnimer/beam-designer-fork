/**
 * TFRecordIO Sink Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating TFRecordIOSinkProperties component functionality,
 * form change callbacks, validation states, sharding accordion toggling,
 * dynamic extension GCS bucket discovery IPC, and code generation instructions.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Validates required field states, default fallbacks, and error boundaries.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TFRecordIOSinkProperties } from './TFRecordIO';

describe('TFRecordIOSinkProperties', () => {
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
        label: 'TFRecordIO',
        beam_transform: 'TFRecordIO',
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#tfrecordSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'TFRecordIO',
        beam_transform: 'TFRecordIO',
        properties: {
          to: 'gs://my-bucket/output/records',
          suffix: '.gz.tfrecord',
          compressionType: 'GZIP',
          numShards: 8,
          shardTemplate: '-SSSSS-of-NNNNN',
          system_instructions: 'Sink LLM instructions'
        }
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#tfrecordSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#tfrecordSinkSuffix') as HTMLInputElement;
    const compressionSelect = container.querySelector('#tfrecordSinkCompressionType') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#tfrecordSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('gs://my-bucket/output/records');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.gz.tfrecord');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(container.querySelector('#tfrecordSinkCoder')).not.toBeInTheDocument();
    expect(instructionsTextarea).toHaveValue('Sink LLM instructions');
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for destination path, suffix, and compressionType', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#tfrecordSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 's3://output-lakehouse/daily/' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 's3://output-lakehouse/daily/'
      })
    );

    const suffixInput = container.querySelector('#tfrecordSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.tfrecords' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.tfrecords'
      })
    );

    const compressionSelect = container.querySelector('#tfrecordSinkCompressionType') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compressionType', value: 'DEFLATE' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compressionType: 'DEFLATE'
      })
    );
  });

  it('toggles sharding accordion and updates numShards and shardTemplate', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Open Sharding Accordion
    const accordionToggle = screen.getByText('Sharding & Shard Template Options');
    fireEvent.click(accordionToggle);

    const numShardsInput = container.querySelector('#tfrecordSinkNumShards') as HTMLInputElement;
    expect(numShardsInput).toBeInTheDocument();
    fireEvent.change(numShardsInput, {
      target: { name: 'numShards', value: '12' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '12'
      })
    );

    const shardTemplateInput = container.querySelector('#tfrecordSinkShardTemplate') as HTMLInputElement;
    expect(shardTemplateInput).toBeInTheDocument();
    fireEvent.change(shardTemplateInput, {
      target: { name: 'shardTemplate', value: '-SSS-of-NNN' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        shardTemplate: '-SSS-of-NNN'
      })
    );

    // Toggle accordion closed again
    fireEvent.click(accordionToggle);
    expect(container.querySelector('#tfrecordSinkNumShards')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#tfrecordSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Configure TFRecordIO sink to write 10 shards with DEFLATE compression' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Configure TFRecordIO sink to write 10 shards with DEFLATE compression'
      })
    );
  });

  it('never renders coder or offers AUTO or ZLIB compression on sink, and defaults AUTO to UNCOMPRESSED', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          to: 'gs://bucket/output/records',
          coder: 'ProtoCoder',
          compressionType: 'AUTO'
        }
      }
    };

    const { container } = render(<TFRecordIOSinkProperties node={mockLegacyNode} onChange={mockOnChange} />);

    expect(container.querySelector('#tfrecordSinkCoder')).not.toBeInTheDocument();
    expect(screen.queryByText(/Record Coder/i)).not.toBeInTheDocument();

    const compressionSelect = container.querySelector('#tfrecordSinkCompressionType') as HTMLSelectElement;
    expect(compressionSelect).toHaveValue('UNCOMPRESSED');
    const compressionValues = Array.from(compressionSelect.options).map((o) => o.value);
    expect(compressionValues).toEqual(['UNCOMPRESSED', 'GZIP', 'DEFLATE']);
    expect(compressionValues).not.toContain('AUTO');
    expect(compressionValues).not.toContain('ZLIB');
  });
});
