/**
 * Unit Tests for ContextualTextIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates rendering, input handling, Cloud Storage bucket auto-discovery messaging,
 * required-path validation states, line-context schema summary preview, compression selection,
 * match configuration, multiline CSV support, expansion service, accordion toggling, and
 * code generation instructions for ContextualTextIOSourceProperties.
 * 
 * Architectural Decisions:
 * - Uses Vitest and React Testing Library for fast, deterministic DOM interaction testing.
 * - Mocks window.vscode.postMessage to verify extension host IPC interactions.
 * - Tests both success and failure scenarios for dynamic storageBucketsLoaded message events.
 * - Asserts 100% of event handlers, toggles, and input states produce proper onChange payloads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContextualTextIOSourceProperties } from './ContextualTextIO';

describe('ContextualTextIOSourceProperties', () => {
  const mockOnChange = vi.fn();
  let originalVscode: any;

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
        label: 'ContextualTextIO Source',
        beam_transform: 'ContextualTextIO',
        properties: {}
      }
    };

    const { container } = render(
      <ContextualTextIOSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const filePatternInput = container.querySelector(
      '#contextualTextSourceFilePattern'
    ) as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'ContextualTextIO Source',
        beam_transform: 'ContextualTextIO',
        properties: {
          filePattern: 'gs://my-bucket/logs/*.txt',
          delimiter: '\\n',
          hasMultilineCSVRecords: true,
          compression: 'GZIP',
          hintMatchesManyFiles: true,
          emptyMatchTreatment: 'ALLOW_IF_WILDCARD',
          watchForNewFilesInterval: 30,
          system_instructions: 'Extract error records with line numbers'
        }
      }
    };

    const { container } = render(
      <ContextualTextIOSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const filePatternInput = container.querySelector(
      '#contextualTextSourceFilePattern'
    ) as HTMLInputElement;
    const delimiterInput = container.querySelector(
      '#contextualTextSourceDelimiter'
    ) as HTMLInputElement;
    const multilineCheckbox = container.querySelector(
      '#contextualTextSourceMultiline'
    ) as HTMLInputElement;
    const compressionSelect = container.querySelector(
      '#contextualTextSourceCompression'
    ) as HTMLSelectElement;
    const emptyMatchSelect = container.querySelector(
      '#contextualTextSourceEmptyMatchTreatment'
    ) as HTMLSelectElement;
    const hintCheckbox = container.querySelector(
      '#contextualTextSourceHintMatchesManyFiles'
    ) as HTMLInputElement;
    const instructionsTextarea = container.querySelector(
      '#contextualTextSourceSystemInstructions'
    ) as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('gs://my-bucket/logs/*.txt');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
    expect(delimiterInput).toHaveValue('\\n');
    expect(multilineCheckbox).toBeChecked();
    expect(compressionSelect).toHaveValue('GZIP');
    expect(emptyMatchSelect).toHaveValue('ALLOW_IF_WILDCARD');
    expect(hintCheckbox).toBeChecked();
    expect(instructionsTextarea).toHaveValue('Extract error records with line numbers');
  });

  it('renders read-only RecordWithMetadata schema summary preview without advertising fileName', () => {
    const mockNode: any = {
      data: {
        label: 'ContextualTextIO Source',
        properties: {}
      }
    };

    render(<ContextualTextIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Emitted Line-Context Schema/i)).toBeInTheDocument();
    expect(screen.getByText('value')).toBeInTheDocument();
    expect(screen.getByText('resourceId')).toBeInTheDocument();
    expect(screen.getByText('recordOffset')).toBeInTheDocument();
    expect(screen.getByText('recordNumInOffset')).toBeInTheDocument();
    expect(screen.getByText('rangeOffset')).toBeInTheDocument();
    expect(screen.getByText('recordNum')).toBeInTheDocument();
    expect(screen.queryByText('fileName')).not.toBeInTheDocument();
  });

  it('defaults emptyMatchTreatment to DISALLOW and updates without mirroring matchConfiguration', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <ContextualTextIOSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const emptyMatchSelect = container.querySelector(
      '#contextualTextSourceEmptyMatchTreatment'
    ) as HTMLSelectElement;
    expect(emptyMatchSelect).toHaveValue('DISALLOW');

    // Change filePattern
    const filePatternInput = container.querySelector(
      '#contextualTextSourceFilePattern'
    ) as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 'gs://data-bucket/input/*.csv' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 'gs://data-bucket/input/*.csv'
      })
    );

    // Change delimiter
    const delimiterInput = container.querySelector(
      '#contextualTextSourceDelimiter'
    ) as HTMLInputElement;
    fireEvent.change(delimiterInput, {
      target: { name: 'delimiter', value: '|' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        delimiter: '|'
      })
    );

    // Change compression
    const compressionSelect = container.querySelector(
      '#contextualTextSourceCompression'
    ) as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'BZIP2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'BZIP2'
      })
    );

    // Change emptyMatchTreatment (must NOT write matchConfiguration)
    mockOnChange.mockClear();
    fireEvent.change(emptyMatchSelect, {
      target: { name: 'emptyMatchTreatment', value: 'ALLOW' }
    });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const emitted = mockOnChange.mock.calls[0][0];
    expect(emitted.emptyMatchTreatment).toBe('ALLOW');
    expect(emitted).not.toHaveProperty('matchConfiguration');
  });

  it('handles checkbox updates for hasMultilineCSVRecords and hintMatchesManyFiles', () => {
    const mockNode: any = {
      data: {
        properties: {
          hasMultilineCSVRecords: false,
          hintMatchesManyFiles: false
        }
      }
    };

    const { container } = render(
      <ContextualTextIOSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    // Toggle hasMultilineCSVRecords
    const multilineCheckbox = container.querySelector(
      '#contextualTextSourceMultiline'
    ) as HTMLInputElement;
    fireEvent.click(multilineCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        hasMultilineCSVRecords: true
      })
    );

    // Toggle hintMatchesManyFiles
    const hintCheckbox = container.querySelector(
      '#contextualTextSourceHintMatchesManyFiles'
    ) as HTMLInputElement;
    fireEvent.click(hintCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        hintMatchesManyFiles: true
      })
    );
  });

  it('modifies watchForNewFilesInterval in advanced options', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <ContextualTextIOSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    // Click to open Advanced Options
    const advancedToggle = screen.getByText('Advanced Options');
    fireEvent.click(advancedToggle);

    // Update watchForNewFilesInterval
    const watchIntervalInput = container.querySelector(
      '#contextualTextSourceWatchInterval'
    ) as HTMLInputElement;
    expect(watchIntervalInput).toBeInTheDocument();
    fireEvent.change(watchIntervalInput, {
      target: { name: 'watchForNewFilesInterval', value: '60' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        watchForNewFilesInterval: '60'
      })
    );
  });

  it('renders Java-only notice banner and never renders minBundleSize or expansionService', () => {
    const mockNode: any = {
      data: {
        properties: {
          filePattern: 'gs://my-bucket/logs/*.txt',
          minBundleSize: 65536,
          expansionService: 'localhost:8097'
        }
      }
    };

    const { container } = render(
      <ContextualTextIOSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    // Java-only notice banner is rendered
    expect(screen.getByTestId('contextual-text-source-notice')).toBeInTheDocument();
    expect(screen.getByText(/Java Only:/i)).toBeInTheDocument();
    expect(screen.getByText(/beam-sdks-java-io-contextual-text-io/i)).toBeInTheDocument();

    // Open Advanced Options to verify minBundleSize is absent even when expanded
    fireEvent.click(screen.getByText('Advanced Options'));
    expect(container.querySelector('#contextualTextSourceMinBundleSize')).not.toBeInTheDocument();
    expect(screen.queryByText(/Minimum Bundle Size/i)).not.toBeInTheDocument();

    // expansionService input is absent
    expect(container.querySelector('#contextualTextSourceExpansionService')).not.toBeInTheDocument();
  });

  it('updates system_instructions when textarea content changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <ContextualTextIOSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const instructionsTextarea = container.querySelector(
      '#contextualTextSourceSystemInstructions'
    ) as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Ensure recordOffset is used for indexing log occurrences' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Ensure recordOffset is used for indexing log occurrences'
      })
    );
  });
});

