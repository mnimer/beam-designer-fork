/**
 * TikaIO Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating TikaIOSourceProperties component functionality,
 * change callbacks, validation states for required filePattern,
 * composition notice,
 * emitted ParseResult schema summary display (including isSuccess() and getError()),
 * code generation instructions, and regression guards against removed non-API fields.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Tests required field states for filePattern independently.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

