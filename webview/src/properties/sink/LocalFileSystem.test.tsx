/**
 * LocalFileSystem Sink Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating LocalFileSystemSinkProperties component functionality,
 * form change callbacks, validation states for required fields, sharding accordion toggling,
 * static datalist options, distributed-worker warning presence, and asserting that
 * Cloud Storage bucket discovery IPC is deliberately NOT dispatched.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode to verify no getStorageBuckets messages are dispatched.
 * - Validates required field states, default fallbacks, instruction fallbacks, and accordion toggling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  LocalFileSystemSinkProperties,
  LOCAL_SINK_PATH_SUGGESTIONS,
  LOCAL_SINK_FILE_FORMATS,
  LOCAL_SINK_COMPRESSION_TYPES
} from './LocalFileSystem';

describe('LocalFileSystemSinkProperties', () => {
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
        label: 'LocalFileSystem',
        beam_transform: 'LocalFileSystem',
        properties: {}
      }
    };

    const { container } = render(<LocalFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#localSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'LocalFileSystem',
        beam_transform: 'LocalFileSystem',
        properties: {
          to: '/data/output/results',
          suffix: '.csv',
          format: 'AvroIO',
          compression: 'GZIP',
          numShards: 4,
          shardTemplate: '-SSSSS-of-NNNNN',
          system_instructions: 'Sink local LLM instructions'
        }
      }
    };

    const { container } = render(<LocalFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#localSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#localSinkSuffix') as HTMLInputElement;
    const formatSelect = container.querySelector('#localSinkFormat') as HTMLSelectElement;
    const compressionSelect = container.querySelector('#localSinkCompression') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#localSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('/data/output/results');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.csv');
    expect(formatSelect).toHaveValue('AvroIO');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(container.querySelector('#localSinkCreateDirectories')).not.toBeInTheDocument();
    expect(container.querySelector('#localSinkFilePermissions')).not.toBeInTheDocument();
    expect(instructionsTextarea).toHaveValue('Sink local LLM instructions');

    // Assert format options match LOCAL_SINK_FILE_FORMATS
    expect(formatSelect.options.length).toBe(LOCAL_SINK_FILE_FORMATS.length);
    LOCAL_SINK_FILE_FORMATS.forEach((fmt, idx) => {
      expect(formatSelect.options[idx].value).toBe(fmt.value);
    });

    // Assert compression options match LOCAL_SINK_COMPRESSION_TYPES
    expect(compressionSelect.options.length).toBe(LOCAL_SINK_COMPRESSION_TYPES.length);
    LOCAL_SINK_COMPRESSION_TYPES.forEach((comp, idx) => {
      expect(compressionSelect.options[idx].value).toBe(comp.value);
    });

    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('toggles required validation on and off as to transitions between empty and populated', () => {
    const mockNodeEmpty: any = {
      data: {
        properties: {
          to: ''
        }
      }
    };

    const { rerender } = render(<LocalFileSystemSinkProperties node={mockNodeEmpty} onChange={mockOnChange} />);
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();

    const mockNodePopulated: any = {
      data: {
        properties: {
          to: '/tmp/beam/output'
        }
      }
    };

    rerender(<LocalFileSystemSinkProperties node={mockNodePopulated} onChange={mockOnChange} />);
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('displays the distributed-worker caveat warning helper text', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<LocalFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const caveatMatcher = (content: string) =>
      content.includes("Local paths resolve on each worker's own filesystem") &&
      content.includes('output shards land scattered across workers') &&
      content.includes('DirectRunner or a shared network mount');
    expect(screen.getByText(caveatMatcher)).toBeInTheDocument();
  });

  it('renders static datalist suggestions for local destination paths', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<LocalFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const datalist = container.querySelector('#local-sink-path-options');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(LOCAL_SINK_PATH_SUGGESTIONS.length);

    LOCAL_SINK_PATH_SUGGESTIONS.forEach((suggestion) => {
      const option = datalist?.querySelector(`option[value="${suggestion}"]`);
      expect(option).toBeInTheDocument();
    });
  });

  it('handles field changes for destination path, suffix, format, and compression', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<LocalFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    // to change
    const toInput = container.querySelector('#localSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 'file:///var/data/output/records' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'file:///var/data/output/records'
      })
    );

    // suffix change
    const suffixInput = container.querySelector('#localSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.json' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.json'
      })
    );

    // format change
    const formatSelect = container.querySelector('#localSinkFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'format', value: 'ParquetIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'ParquetIO'
      })
    );

    // compression change
    const compressionSelect = container.querySelector('#localSinkCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'BZIP2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'BZIP2'
      })
    );
  });

  it('toggles sharding accordion, renders automatic directory creation notice, and updates numShards and shardTemplate', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<LocalFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Accordion should start closed
    expect(container.querySelector('#localSinkNumShards')).not.toBeInTheDocument();
    expect(container.querySelector('#localSinkShardTemplate')).not.toBeInTheDocument();

    // Open Sharding Accordion
    const accordionToggle = screen.getByText('Sharding & Shard Template Options');
    fireEvent.click(accordionToggle);

    expect(screen.getByText(/created automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/Files\.createDirectories/)).toBeInTheDocument();

    const numShardsInput = container.querySelector('#localSinkNumShards') as HTMLInputElement;
    expect(numShardsInput).toBeInTheDocument();
    fireEvent.change(numShardsInput, {
      target: { name: 'numShards', value: '8' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '8'
      })
    );

    const shardTemplateInput = container.querySelector('#localSinkShardTemplate') as HTMLInputElement;
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
    expect(container.querySelector('#localSinkNumShards')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<LocalFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#localSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Configure LocalFileSystem sink with 1 shard and .csv suffix' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Configure LocalFileSystem sink with 1 shard and .csv suffix'
      })
    );
  });


  it('does NOT request storage buckets via vscode.postMessage (no bucket discovery for local filesystem)', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<LocalFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getStorageBuckets' })
    );
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  /**
   * Regression guard: Beam's LocalFileSystem creates parent directories unconditionally
   * (Files.createDirectories in Java / os.makedirs(..., exist_ok=True) in Python) and has no
   * file-permission (chmod) API in either SDK. Furthermore, XZ is not a valid Beam Compression
   * enum value. All three were removed rather than defaulted.
   */
  it('never renders createDirectories, filePermissions, or XZ compression, even for legacy persisted values', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          to: '/data/output/results',
          createDirectories: false,
          filePermissions: '755'
        }
      }
    };

    const { container } = render(<LocalFileSystemSinkProperties node={mockLegacyNode} onChange={mockOnChange} />);

    fireEvent.click(screen.getByText('Sharding & Shard Template Options'));

    expect(container.querySelector('#localSinkCreateDirectories')).not.toBeInTheDocument();
    expect(container.querySelector('#localSinkFilePermissions')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="checkbox"]')).not.toBeInTheDocument();
    expect(screen.queryByText(/Create parent directories automatically/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/File Permissions/i)).not.toBeInTheDocument();
    expect(screen.getByText(/created automatically/i)).toBeInTheDocument();

    const compressionSelect = container.querySelector('#localSinkCompression') as HTMLSelectElement;
    const compressionValues = Array.from(compressionSelect.options).map((opt) => opt.value);
    expect(compressionValues).not.toContain('XZ');
    expect(LOCAL_SINK_COMPRESSION_TYPES.map((c) => c.value)).not.toContain('XZ');
  });
});
