/**
 * Unit Tests for ContextualTextIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates rendering, input handling, Cloud Storage bucket auto-discovery messaging,
 * required-destination validation states, header/footer configuration, sharding parameters,
 * compression selection, cross-language expansion service, and code generation instructions
 * for ContextualTextIOSinkProperties.
 * 
 * Architectural Decisions:
 * - Uses Vitest and React Testing Library for fast, realistic DOM interaction testing.
 * - Mocks window.vscode.postMessage to verify extension host IPC interactions.
 * - Tests both success and failure scenarios for dynamic storageBucketsLoaded message events.
 * - Verifies that 100% of event handlers, inputs, and selects produce proper onChange payloads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContextualTextIOSinkProperties } from './ContextualTextIO';

describe('ContextualTextIOSinkProperties', () => {
  const mockOnChange = vi.fn();
  let originalVscode: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing to prefix', () => {
    const mockNode: any = {
      data: {
        label: 'ContextualTextIO Sink',
        beam_transform: 'ContextualTextIO',
        properties: {}
      }
    };

    const { container } = render(
      <ContextualTextIOSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    const toInput = container.querySelector('#contextualTextSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination file prefix is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'ContextualTextIO Sink',
        beam_transform: 'ContextualTextIO',
        properties: {
          to: 'gs://my-bucket/output/results',
          suffix: '.txt',
          delimiter: '\\n',
          header: 'id,name,value',
          footer: 'EOF',
          compression: 'GZIP',
          numShards: 5,
          shardTemplate: '-SSSSS-of-NNNNN',
          system_instructions: 'Format records with tab spacing'
        }
      }
    };

    const { container } = render(
      <ContextualTextIOSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    const toInput = container.querySelector('#contextualTextSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#contextualTextSinkSuffix') as HTMLInputElement;
    const delimiterInput = container.querySelector('#contextualTextSinkDelimiter') as HTMLInputElement;
    const compressionSelect = container.querySelector(
      '#contextualTextSinkCompression'
    ) as HTMLSelectElement;
    const headerInput = container.querySelector('#contextualTextSinkHeader') as HTMLInputElement;
    const footerInput = container.querySelector('#contextualTextSinkFooter') as HTMLInputElement;
    const shardsInput = container.querySelector('#contextualTextSinkNumShards') as HTMLInputElement;
    const shardTemplateInput = container.querySelector(
      '#contextualTextSinkShardTemplate'
    ) as HTMLInputElement;
    const instructionsTextarea = container.querySelector(
      '#contextualTextSinkSystemInstructions'
    ) as HTMLTextAreaElement;

    expect(toInput).toHaveValue('gs://my-bucket/output/results');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('Destination file prefix is required.')).not.toBeInTheDocument();
    expect(suffixInput).toHaveValue('.txt');
    expect(delimiterInput).toHaveValue('\\n');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(headerInput).toHaveValue('id,name,value');
    expect(footerInput).toHaveValue('EOF');
    expect(shardsInput).toHaveValue(5);
    expect(shardTemplateInput).toHaveValue('-SSSSS-of-NNNNN');
    expect(instructionsTextarea).toHaveValue('Format records with tab spacing');
  });

  it('handles field changes for to, suffix, delimiter, and compression', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <ContextualTextIOSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    // Change to prefix
    const toInput = container.querySelector('#contextualTextSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 'gs://data-sink/reports/summary' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'gs://data-sink/reports/summary'
      })
    );

    // Change suffix
    const suffixInput = container.querySelector('#contextualTextSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.log' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.log'
      })
    );

    // Change delimiter
    const delimiterInput = container.querySelector('#contextualTextSinkDelimiter') as HTMLInputElement;
    fireEvent.change(delimiterInput, {
      target: { name: 'delimiter', value: '\t' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        delimiter: '\t'
      })
    );

    // Change compression
    const compressionSelect = container.querySelector(
      '#contextualTextSinkCompression'
    ) as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'ZSTD' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'ZSTD'
      })
    );
  });

  it('handles header and footer updates', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <ContextualTextIOSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    // Change header
    const headerInput = container.querySelector('#contextualTextSinkHeader') as HTMLInputElement;
    fireEvent.change(headerInput, {
      target: { name: 'header', value: 'col1,col2,col3' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        header: 'col1,col2,col3'
      })
    );

    // Change footer
    const footerInput = container.querySelector('#contextualTextSinkFooter') as HTMLInputElement;
    fireEvent.change(footerInput, {
      target: { name: 'footer', value: 'TOTAL_RECORDS: 100' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        footer: 'TOTAL_RECORDS: 100'
      })
    );
  });

  it('handles sharding group updates for numShards and shardTemplate', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <ContextualTextIOSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    // Change numShards
    const shardsInput = container.querySelector('#contextualTextSinkNumShards') as HTMLInputElement;
    fireEvent.change(shardsInput, {
      target: { name: 'numShards', value: '10' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '10'
      })
    );

    // Change shardTemplate
    const templateInput = container.querySelector(
      '#contextualTextSinkShardTemplate'
    ) as HTMLInputElement;
    fireEvent.change(templateInput, {
      target: { name: 'shardTemplate', value: '-W-of-N' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        shardTemplate: '-W-of-N'
      })
    );
  });

  it('renders read-only library notice (TextIO.write() / beam.io.WriteToText) and never offers expansionService or invalid write compressions (AUTO, ZIP, TAR, XZ)', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          to: 'gs://my-bucket/output/results',
          compression: 'AUTO',
          expansionService: 'localhost:8097'
        }
      }
    };

    const { container } = render(
      <ContextualTextIOSinkProperties node={mockLegacyNode} onChange={mockOnChange} />
    );

    // Notice banner states ContextualTextIO is Java-only
    const noticeBanner = screen.getByTestId('contextual-text-sink-notice');
    expect(noticeBanner).toBeInTheDocument();
    expect(noticeBanner).toHaveTextContent(/Java Only:/i);
    expect(noticeBanner).toHaveTextContent(/beam-sdks-java-io-contextual-text-io/i);

    // expansionService is never rendered
    expect(container.querySelector('#contextualTextSinkExpansionService')).not.toBeInTheDocument();
    expect(screen.queryByText(/Expansion Service/i)).not.toBeInTheDocument();

    // Compression select defaults to UNCOMPRESSED and only offers BEAM_WRITE_COMPRESSION_TYPES
    const compressionSelect = container.querySelector(
      '#contextualTextSinkCompression'
    ) as HTMLSelectElement;
    expect(compressionSelect).toHaveValue('UNCOMPRESSED');
    const compressionValues = Array.from(compressionSelect.options).map((o) => o.value);
    expect(compressionValues).toEqual(['UNCOMPRESSED', 'BZIP2', 'GZIP', 'DEFLATE', 'ZSTD']);
    expect(compressionValues).not.toContain('AUTO');
    expect(compressionValues).not.toContain('ZIP');
    expect(compressionValues).not.toContain('TAR');
    expect(compressionValues).not.toContain('XZ');
  });

  it('updates system_instructions when textarea content changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <ContextualTextIOSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    const instructionsTextarea = container.querySelector(
      '#contextualTextSinkSystemInstructions'
    ) as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Write sharded outputs using gzip compression codec' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Write sharded outputs using gzip compression codec'
      })
    );
  });

  it('posts getStorageBuckets command to vscode and populates datalist options on storageBucketsLoaded', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode = {
      data: {
        label: 'ContextualTextIO Sink',
        properties: {}
      }
    };

    const { container } = render(
      <ContextualTextIOSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    // Assert getStorageBuckets was posted on mount
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Dispatch storageBucketsLoaded event
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['output-bucket-primary', 'backup-bucket']
          }
        })
      );
    });

    // Check datalist options attached to to field
    const datalist = container.querySelector('datalist');
    expect(datalist).toBeInTheDocument();
    const options = datalist?.querySelectorAll('option');
    expect(options?.length).toBe(2);
    expect(options?.[0]).toHaveAttribute('value', 'gs://output-bucket-primary/');
    expect(options?.[1]).toHaveAttribute('value', 'gs://backup-bucket/');
  });

  it('surfaces bucket loading error inline with role="alert" when destination path is valid and non-empty (regression guard)', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode = {
      data: {
        label: 'ContextualTextIO Sink',
        properties: {
          to: 'gs://valid-output/path'
        }
      }
    };

    render(<ContextualTextIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Dispatch error response
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'GCS Sink API error: 500 Internal'
          }
        })
      );
    });

    // Verify error is rendered with role="alert" despite valid, non-empty destination
    const alertElement = screen.getByRole('alert');
    expect(alertElement).toBeInTheDocument();
    expect(alertElement).toHaveTextContent(
      'Failed to load Cloud Storage buckets: GCS Sink API error: 500 Internal'
    );
    expect(screen.queryByText('Destination file prefix is required.')).not.toBeInTheDocument();
  });

  it('surfaces discovery error alongside to validation error when destination path is empty', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode = {
      data: {
        label: 'ContextualTextIO Sink',
        properties: {
          to: ''
        }
      }
    };

    render(<ContextualTextIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Dispatch error response
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'Authentication failure'
          }
        })
      );
    });

    expect(
      screen.getByText(/Failed to load Cloud Storage buckets: Authentication failure/i)
    ).toBeInTheDocument();
  });
});
