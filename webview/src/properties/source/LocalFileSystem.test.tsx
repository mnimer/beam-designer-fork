/**
 * LocalFileSystem Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating LocalFileSystemSourceProperties component functionality,
 * form change callbacks, validation states for required fields, accordion toggling,
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
  LocalFileSystemSourceProperties,
  LOCAL_SOURCE_PATH_SUGGESTIONS,
  LOCAL_FILE_FORMATS,
  LOCAL_SOURCE_COMPRESSION_TYPES,
  EMPTY_MATCH_TREATMENT_OPTIONS
} from './LocalFileSystem';

describe('LocalFileSystemSourceProperties', () => {
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
        label: 'LocalFileSystem',
        beam_transform: 'LocalFileSystem',
        properties: {}
      }
    };

    const { container } = render(<LocalFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#localSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'LocalFileSystem',
        beam_transform: 'LocalFileSystem',
        properties: {
          filePattern: '/data/input/*.csv',
          format: 'AvroIO',
          compression: 'GZIP',
          emptyMatchTreatment: 'DISALLOW',
          validate: false,
          minBundleSize: 8192,
          watchForNewFilesInterval: 30,
          system_instructions: 'Custom local reader instructions'
        }
      }
    };

    const { container } = render(<LocalFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#localSourceFilePattern') as HTMLInputElement;
    const formatSelect = container.querySelector('#localSourceFormat') as HTMLSelectElement;
    const compressionSelect = container.querySelector('#localSourceCompression') as HTMLSelectElement;
    const emptyMatchSelect = container.querySelector('#localSourceEmptyMatchTreatment') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#localSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('/data/input/*.csv');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(formatSelect).toHaveValue('AvroIO');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(emptyMatchSelect).toHaveValue('DISALLOW');
    expect(instructionsTextarea).toHaveValue('Custom local reader instructions');

    // Assert format options match LOCAL_FILE_FORMATS
    expect(formatSelect.options.length).toBe(LOCAL_FILE_FORMATS.length);
    LOCAL_FILE_FORMATS.forEach((fmt, idx) => {
      expect(formatSelect.options[idx].value).toBe(fmt.value);
    });

    // Assert compression options match LOCAL_SOURCE_COMPRESSION_TYPES
    expect(compressionSelect.options.length).toBe(LOCAL_SOURCE_COMPRESSION_TYPES.length);
    LOCAL_SOURCE_COMPRESSION_TYPES.forEach((comp, idx) => {
      expect(compressionSelect.options[idx].value).toBe(comp.value);
    });

    // Assert emptyMatchTreatment options match EMPTY_MATCH_TREATMENT_OPTIONS
    expect(emptyMatchSelect.options.length).toBe(EMPTY_MATCH_TREATMENT_OPTIONS.length);
    EMPTY_MATCH_TREATMENT_OPTIONS.forEach((emt, idx) => {
      expect(emptyMatchSelect.options[idx].value).toBe(emt.value);
    });

    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('toggles required validation on and off as filePattern transitions between empty and populated', () => {
    const mockNodeEmpty: any = {
      data: {
        properties: {
          filePattern: ''
        }
      }
    };

    const { rerender } = render(<LocalFileSystemSourceProperties node={mockNodeEmpty} onChange={mockOnChange} />);
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();

    const mockNodePopulated: any = {
      data: {
        properties: {
          filePattern: '/tmp/data/*.txt'
        }
      }
    };

    rerender(<LocalFileSystemSourceProperties node={mockNodePopulated} onChange={mockOnChange} />);
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('displays the distributed-worker caveat warning helper text', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<LocalFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const caveatMatcher = (content: string) =>
      content.includes("Local paths resolve on each worker's own filesystem") &&
      content.includes('DirectRunner or a shared network mount');
    expect(screen.getByText(caveatMatcher)).toBeInTheDocument();
  });

  it('renders static datalist suggestions for local path patterns', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<LocalFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const datalist = container.querySelector('#local-source-path-options');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(LOCAL_SOURCE_PATH_SUGGESTIONS.length);

    LOCAL_SOURCE_PATH_SUGGESTIONS.forEach((suggestion) => {
      const option = datalist?.querySelector(`option[value="${suggestion}"]`);
      expect(option).toBeInTheDocument();
    });
  });

  it('handles field changes for filePattern, format, compression, and emptyMatchTreatment', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<LocalFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    // filePattern change
    const filePatternInput = container.querySelector('#localSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 'file:///var/data/*.json' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 'file:///var/data/*.json'
      })
    );

    // format change
    const formatSelect = container.querySelector('#localSourceFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'format', value: 'ParquetIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'ParquetIO'
      })
    );

    // compression change
    const compressionSelect = container.querySelector('#localSourceCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'ZSTD' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'ZSTD'
      })
    );

    // emptyMatchTreatment change
    const emptyMatchSelect = container.querySelector('#localSourceEmptyMatchTreatment') as HTMLSelectElement;
    fireEvent.change(emptyMatchSelect, {
      target: { name: 'emptyMatchTreatment', value: 'ALLOW' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        emptyMatchTreatment: 'ALLOW'
      })
    );
  });

  it('handles accordion toggling and change events for validate checkbox, minBundleSize, and watchForNewFilesInterval', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<LocalFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Accordion should start closed
    expect(container.querySelector('#localSourceValidate')).not.toBeInTheDocument();
    expect(container.querySelector('#localSourceMinBundleSize')).not.toBeInTheDocument();
    expect(container.querySelector('#localSourceWatchInterval')).not.toBeInTheDocument();

    // Toggle open
    const toggleButton = screen.getByText('Read Tuning & Options');
    fireEvent.click(toggleButton);

    const validateCheckbox = container.querySelector('#localSourceValidate') as HTMLInputElement;
    const minBundleSizeInput = container.querySelector('#localSourceMinBundleSize') as HTMLInputElement;
    const watchIntervalInput = container.querySelector('#localSourceWatchInterval') as HTMLInputElement;

    expect(validateCheckbox).toBeInTheDocument();
    expect(validateCheckbox).toBeChecked(); // defaults to true
    expect(minBundleSizeInput).toBeInTheDocument();
    expect(watchIntervalInput).toBeInTheDocument();

    // Toggle validate checkbox
    fireEvent.click(validateCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        validate: false
      })
    );

    // Change minBundleSize
    fireEvent.change(minBundleSizeInput, {
      target: { name: 'minBundleSize', value: '16384' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        minBundleSize: '16384'
      })
    );

    // Change watchForNewFilesInterval
    fireEvent.change(watchIntervalInput, {
      target: { name: 'watchForNewFilesInterval', value: '60' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        watchForNewFilesInterval: '60'
      })
    );

    // Toggle closed
    fireEvent.click(toggleButton);
    expect(container.querySelector('#localSourceValidate')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<LocalFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#localSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Read local JSON lines from /tmp/beam/input/' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Read local JSON lines from /tmp/beam/input/'
      })
    );
  });

  it('falls back to special_instructions and property-level instructions when present', () => {
    const mockNodeSpecialData: any = {
      data: {
        special_instructions: 'Special instructions from node data',
        properties: {}
      }
    };
    const { rerender } = render(<LocalFileSystemSourceProperties node={mockNodeSpecialData} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from node data')).toBeInTheDocument();

    const mockNodePropertySys: any = {
      data: {
        properties: {
          system_instructions: 'System instructions from properties'
        }
      }
    };
    rerender(<LocalFileSystemSourceProperties node={mockNodePropertySys} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('System instructions from properties')).toBeInTheDocument();

    const mockNodePropertySpecial: any = {
      data: {
        properties: {
          special_instructions: 'Special instructions from properties'
        }
      }
    };
    rerender(<LocalFileSystemSourceProperties node={mockNodePropertySpecial} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from properties')).toBeInTheDocument();
  });

  it('does NOT request storage buckets via vscode.postMessage (no bucket discovery for local filesystem)', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<LocalFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getStorageBuckets' })
    );
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  /**
   * Regression guard: XZ is not a valid Beam Compression enum value and must not be rendered.
   * Additionally, watchForNewFilesInterval must clarify Java's TerminationCondition requirement
   * (unbounded PCollection) and Python's MatchContinuously(file_pattern, interval=n) mapping.
   */
  it('never renders XZ compression and clarifies watchForNewFilesInterval Java/Python semantics', () => {
    const mockNode: any = {
      data: {
        properties: {
          filePattern: '/data/input/*.csv'
        }
      }
    };

    const { container } = render(<LocalFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const compressionSelect = container.querySelector('#localSourceCompression') as HTMLSelectElement;
    const compressionValues = Array.from(compressionSelect.options).map((opt) => opt.value);
    expect(compressionValues).not.toContain('XZ');
    expect(LOCAL_SOURCE_COMPRESSION_TYPES.map((c) => c.value)).not.toContain('XZ');

    fireEvent.click(screen.getByText('Read Tuning & Options'));
    expect(screen.getByText(/TerminationCondition/)).toBeInTheDocument();
    expect(screen.getByText(/MatchContinuously\(file_pattern, interval=n\)/)).toBeInTheDocument();
  });
});
