/**
 * TikaIO Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating TikaIOSourceProperties component functionality,
 * change callbacks, validation states for required filePattern,
 * dynamic GCS bucket discovery IPC and regression guard, composition notice,
 * emitted ParseResult schema summary display (including isSuccess() and getError()),
 * code generation instructions, and regression guards against removed non-API fields.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Tests required field states for filePattern independently.
 * - Asserts the bucket-discovery error surfaces with a valid, non-empty path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TikaIOSourceProperties } from './TikaIO';

describe('TikaIOSourceProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

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
        label: 'TikaIO',
        beam_transform: 'TikaIO',
        properties: {}
      }
    };

    const { container } = render(<TikaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#tikaSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();

    const contentTypeHintInput = container.querySelector('#tikaSourceContentTypeHint') as HTMLInputElement;
    expect(contentTypeHintInput).toHaveValue('');

    const tikaConfigPathInput = container.querySelector('#tikaSourceTikaConfigPath') as HTMLInputElement;
    expect(tikaConfigPathInput).toHaveValue('');

    const inputMetadataTextarea = container.querySelector('#tikaSourceInputMetadata') as HTMLTextAreaElement;
    expect(inputMetadataTextarea).toHaveValue('');
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'TikaIO',
        beam_transform: 'TikaIO',
        properties: {
          filePattern: 'gs://documents-bucket/reports/**/*.pdf',
          contentTypeHint: 'application/pdf',
          tikaConfigPath: 'gs://documents-bucket/config/tika-config.xml',
          inputMetadata: 'Content-Type=application/pdf\nAuthor=Research Team',
          system_instructions: 'Extract key clauses from PDF contracts'
        }
      }
    };

    const { container } = render(<TikaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#tikaSourceFilePattern') as HTMLInputElement;
    const contentTypeHintInput = container.querySelector('#tikaSourceContentTypeHint') as HTMLInputElement;
    const tikaConfigPathInput = container.querySelector('#tikaSourceTikaConfigPath') as HTMLInputElement;
    const inputMetadataTextarea = container.querySelector('#tikaSourceInputMetadata') as HTMLTextAreaElement;
    const instructionsTextarea = container.querySelector('#tikaSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('gs://documents-bucket/reports/**/*.pdf');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(contentTypeHintInput).toHaveValue('application/pdf');
    expect(tikaConfigPathInput).toHaveValue('gs://documents-bucket/config/tika-config.xml');
    expect(inputMetadataTextarea).toHaveValue('Content-Type=application/pdf\nAuthor=Research Team');
    expect(instructionsTextarea).toHaveValue('Extract key clauses from PDF contracts');

    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('validates on/off for filePattern independently', () => {
    const mockNodeEmpty: any = {
      data: {
        properties: {
          filePattern: ''
        }
      }
    };
    const { rerender } = render(<TikaIOSourceProperties node={mockNodeEmpty} onChange={mockOnChange} />);
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();

    const mockNodeFilled: any = {
      data: {
        properties: {
          filePattern: 'gs://documents-bucket/docs/*.docx'
        }
      }
    };
    rerender(<TikaIOSourceProperties node={mockNodeFilled} onChange={mockOnChange} />);
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for filePattern, contentTypeHint, tikaConfigPath, and inputMetadata', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TikaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // filePattern change
    const filePatternInput = container.querySelector('#tikaSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 'gs://documents-bucket/invoices/*.pdf' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 'gs://documents-bucket/invoices/*.pdf'
      })
    );

    // contentTypeHint change
    const contentTypeHintInput = container.querySelector('#tikaSourceContentTypeHint') as HTMLInputElement;
    fireEvent.change(contentTypeHintInput, {
      target: { name: 'contentTypeHint', value: 'application/pdf' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        contentTypeHint: 'application/pdf'
      })
    );

    // tikaConfigPath change
    const tikaConfigPathInput = container.querySelector('#tikaSourceTikaConfigPath') as HTMLInputElement;
    fireEvent.change(tikaConfigPathInput, {
      target: { name: 'tikaConfigPath', value: '/etc/tika/custom-config.xml' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tikaConfigPath: '/etc/tika/custom-config.xml'
      })
    );

    // inputMetadata textarea change
    const inputMetadataTextarea = container.querySelector('#tikaSourceInputMetadata') as HTMLTextAreaElement;
    fireEvent.change(inputMetadataTextarea, {
      target: { name: 'inputMetadata', value: 'source=sftp\nclassification=restricted' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        inputMetadata: 'source=sftp\nclassification=restricted'
      })
    );
  });

  it('renders Java-only notice', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<TikaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const notice = screen.getByTestId('tika-source-composition-notice');
    expect(notice).toHaveTextContent(/Java Only:/i);
    expect(notice).toHaveTextContent(/beam-sdks-java-io-tika/i);
  });

  it('renders read-only summary of emitted ParseResult shape including isSuccess() and getError()', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<TikaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Emitted Record Schema \(ParseResult\)/i)).toBeInTheDocument();
    expect(screen.getByText('getFileLocation()')).toBeInTheDocument();
    expect(screen.getByText('fileLocation')).toBeInTheDocument();
    expect(screen.getByText('getContent()')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getByText('getMetadata()')).toBeInTheDocument();
    expect(screen.getByText('metadata')).toBeInTheDocument();
    expect(screen.getByText('isSuccess() — boolean')).toBeInTheDocument();
    expect(screen.getByText('getError() — Throwable')).toBeInTheDocument();
  });

  it('requests storage buckets via vscode.postMessage and renders datalist suggestions upon message event', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TikaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Assert initial IPC request was dispatched to extension host
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Simulate extension response event with bucket array
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['doc-archive', 'gs://pdf-lakehouse']
          }
        })
      );
    });

    const filePatternInput = container.querySelector('#tikaSourceFilePattern') as HTMLInputElement;
    const datalistId = filePatternInput.getAttribute('data-list') || filePatternInput.getAttribute('list');
    expect(datalistId).toBeTruthy();
    const datalist = document.getElementById(datalistId!) || container.querySelector(`datalist#${datalistId}`);
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);
    expect(datalist?.children[0]).toHaveAttribute('value', 'gs://doc-archive/');
    expect(datalist?.children[1]).toHaveAttribute('value', 'gs://pdf-lakehouse');
  });

  it('surfaces bucket discovery error inline using muted/red text alert with valid non-empty path', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    // Regression guard: valid non-empty path must still surface discovery error
    const mockNode: any = {
      data: {
        properties: {
          filePattern: 'gs://documents-bucket/archive/**/*.pdf'
        }
      }
    };

    render(<TikaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

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

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<TikaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#tikaSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Parse incoming contracts and extract metadata for downstream NLP pipeline' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Parse incoming contracts and extract metadata for downstream NLP pipeline'
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
    const { rerender } = render(<TikaIOSourceProperties node={mockNodeSpecialData} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from data')).toBeInTheDocument();

    const mockNodePropertySys: any = {
      data: {
        properties: {
          system_instructions: 'System instructions from properties'
        }
      }
    };
    rerender(<TikaIOSourceProperties node={mockNodePropertySys} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('System instructions from properties')).toBeInTheDocument();

    const mockNodePropertySpecial: any = {
      data: {
        properties: {
          special_instructions: 'Special instructions from properties'
        }
      }
    };
    rerender(<TikaIOSourceProperties node={mockNodePropertySpecial} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from properties')).toBeInTheDocument();
  });

  it('never renders removed non-API controls (parseSynchronously, minBundleSize, authMode, secretName, expansionService)', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          filePattern: 'gs://documents-bucket/reports/**/*.pdf',
          parseSynchronously: true,
          minBundleSize: 2048,
          authMode: 'secretManager',
          secretName: 'projects/123/secrets/tika-key',
          expansionService: 'localhost:8097'
        }
      }
    };

    const { container } = render(<TikaIOSourceProperties node={mockLegacyNode} onChange={mockOnChange} />);

    expect(container.querySelector('#tikaSourceParseSynchronously')).not.toBeInTheDocument();
    expect(container.querySelector('#tikaSourceMinBundleSize')).not.toBeInTheDocument();
    expect(container.querySelector('#tikaSourceAuthMode')).not.toBeInTheDocument();
    expect(container.querySelector('#tikaSourceSecretName')).not.toBeInTheDocument();
    expect(container.querySelector('#tikaSourceExpansionService')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="checkbox"]')).not.toBeInTheDocument();
    expect(screen.queryByText(/Parse Synchronously/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Expansion Service/i)).not.toBeInTheDocument();
  });
});

