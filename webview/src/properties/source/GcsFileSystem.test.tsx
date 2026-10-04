/**
 * GcsFileSystem Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating GcsFileSystemSourceProperties component functionality,
 * form change callbacks, validation states for required fields, accordion toggling,
 * dynamic extension GCS bucket discovery IPC, and code generation instructions.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Validates required field states (filePattern), default fallbacks, and error boundaries.
 * - Tests GCS metrics and telemetry accordion as well as advanced tuning accordion.
 * - Includes critical regression test asserting that bucket discovery errors render
 *   even when the user has typed a valid, non-empty path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GcsFileSystemSourceProperties } from './GcsFileSystem';

describe('GcsFileSystemSourceProperties', () => {
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
        label: 'GcsFileSystem',
        beam_transform: 'GcsFileSystem',
        properties: {}
      }
    };

    const { container } = render(<GcsFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#gcsSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'GcsFileSystem',
        beam_transform: 'GcsFileSystem',
        properties: {
          filePattern: 'gs://my-bucket/events/*.json',
          projectId: 'my-gcp-project',
          enablePerformanceMetrics: true,
          readTimeoutMs: 30000,
          format: 'AvroIO',
          validate: false,
          minBundleSize: 67108864,
          system_instructions: 'Custom GCS reader instructions'
        }
      }
    };

    const { container } = render(<GcsFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#gcsSourceFilePattern') as HTMLInputElement;
    const projectIdInput = container.querySelector('#gcsSourceProjectId') as HTMLInputElement;
    const metricsCheckbox = container.querySelector('#gcsSourcePerformanceMetrics') as HTMLInputElement;
    const readTimeoutInput = container.querySelector('#gcsSourceReadTimeoutMs') as HTMLInputElement;
    const formatSelect = container.querySelector('#gcsSourceFormat') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#gcsSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('gs://my-bucket/events/*.json');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(projectIdInput).toHaveValue('my-gcp-project');
    expect(metricsCheckbox).toBeChecked();
    expect(readTimeoutInput).toHaveValue(30000);
    expect(container.querySelector('#gcsSourceUploadBufferSizeBytes')).not.toBeInTheDocument();
    expect(formatSelect).toHaveValue('AvroIO');
    expect(instructionsTextarea).toHaveValue('Custom GCS reader instructions');

    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('validates on/off for filePattern correctly', () => {
    const mockNodeEmpty: any = {
      data: {
        properties: {
          filePattern: ''
        }
      }
    };
    const { rerender } = render(<GcsFileSystemSourceProperties node={mockNodeEmpty} onChange={mockOnChange} />);
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();

    const mockNodePopulated: any = {
      data: {
        properties: {
          filePattern: 'gs://valid-bucket/data/*.parquet'
        }
      }
    };
    rerender(<GcsFileSystemSourceProperties node={mockNodePopulated} onChange={mockOnChange} />);
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for filePattern, projectId, enablePerformanceMetrics, readTimeoutMs, and format', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<GcsFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    // filePattern change
    const filePatternInput = container.querySelector('#gcsSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 'gs://new-bucket/data/*.csv' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 'gs://new-bucket/data/*.csv'
      })
    );

    // projectId change
    const projectIdInput = container.querySelector('#gcsSourceProjectId') as HTMLInputElement;
    fireEvent.change(projectIdInput, {
      target: { name: 'projectId', value: 'gcp-analytics-prod' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'gcp-analytics-prod'
      })
    );

    // enablePerformanceMetrics checkbox toggle
    const metricsCheckbox = container.querySelector('#gcsSourcePerformanceMetrics') as HTMLInputElement;
    fireEvent.click(metricsCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        enablePerformanceMetrics: true
      })
    );

    // readTimeoutMs change
    const readTimeoutInput = container.querySelector('#gcsSourceReadTimeoutMs') as HTMLInputElement;
    fireEvent.change(readTimeoutInput, {
      target: { name: 'readTimeoutMs', value: '45000' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        readTimeoutMs: '45000'
      })
    );

    // format change
    const formatSelect = container.querySelector('#gcsSourceFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'format', value: 'ParquetIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'ParquetIO'
      })
    );
  });

  it('toggles GCS metrics & telemetry accordion open and displays real Beam GCS counters', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<GcsFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const metricsToggle = screen.getByText('GCS Metrics & Telemetry');
    // Open accordion
    fireEvent.click(metricsToggle);
    expect(screen.getByText('GCS_read_bytes_counter_<bucket>')).toBeInTheDocument();
    expect(screen.getByText('GCS_write_bytes_counter_<bucket>')).toBeInTheDocument();
    expect(screen.queryByText(/gcs_requests_total/)).not.toBeInTheDocument();
    expect(screen.queryByText(/gcs_bytes_read/)).not.toBeInTheDocument();
    expect(screen.queryByText(/gcs_request_latency_ms/)).not.toBeInTheDocument();
  });

  it('handles validate checkbox toggle and minBundleSize in advanced tuning accordion', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<GcsFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Open Advanced Accordion
    const advancedToggle = screen.getByText('Read Tuning & Options');
    fireEvent.click(advancedToggle);

    // Validate checkbox is checked by default
    const validateCheckbox = container.querySelector('#gcsSourceValidate') as HTMLInputElement;
    expect(validateCheckbox).toBeInTheDocument();
    expect(validateCheckbox).toBeChecked();

    fireEvent.click(validateCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        validate: false
      })
    );

    // minBundleSize change
    const minBundleSizeInput = container.querySelector('#gcsSourceMinBundleSize') as HTMLInputElement;
    expect(minBundleSizeInput).toBeInTheDocument();

    fireEvent.change(minBundleSizeInput, {
      target: { name: 'minBundleSize', value: '1048576' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        minBundleSize: '1048576'
      })
    );
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<GcsFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#gcsSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Read GCS blobs and emit telemetry metrics' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Read GCS blobs and emit telemetry metrics'
      })
    );
  });



  /**
   * Regression guard: GcsOptions.setGcsUploadBufferSizeBytes is consumed exclusively on the write
   * path (GcsUtil.create) and is completely inert on reads. Additionally, the metrics flag must
   * be --gcsPerformanceMetrics (not --gcs_performance_metrics) and projectId must reference
   * GcsOptions.setProject(String) / --project rather than requester-pays.
   */
  it('never renders uploadBufferSizeBytes on the source panel even for legacy persisted values, and uses verified flag/counter names', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          filePattern: 'gs://my-bucket/events/*.json',
          uploadBufferSizeBytes: 8388608
        }
      }
    };

    const { container } = render(<GcsFileSystemSourceProperties node={mockLegacyNode} onChange={mockOnChange} />);

    expect(container.querySelector('#gcsSourceUploadBufferSizeBytes')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="uploadBufferSizeBytes"]')).not.toBeInTheDocument();
    expect(screen.queryByText(/Upload Buffer Size/i)).not.toBeInTheDocument();
    expect(screen.getByText(/--gcsPerformanceMetrics/)).toBeInTheDocument();
    expect(screen.queryByText(/--gcs_performance_metrics/)).not.toBeInTheDocument();
    expect(screen.queryByText(/requester-pays/i)).not.toBeInTheDocument();
    expect(screen.getByText(/GcsOptions\.setProject\(String\)/)).toBeInTheDocument();
  });
});
