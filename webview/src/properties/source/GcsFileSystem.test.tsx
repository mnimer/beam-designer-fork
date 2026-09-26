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
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('toggles GCS metrics & telemetry accordion open and closed and displays real Beam GCS counters', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<GcsFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const metricsToggle = screen.getByText('GCS Metrics & Telemetry');
    expect(screen.queryByText('GCS_read_bytes_counter_<bucket>')).not.toBeInTheDocument();

    // Open accordion
    fireEvent.click(metricsToggle);
    expect(screen.getByText('GCS_read_bytes_counter_<bucket>')).toBeInTheDocument();
    expect(screen.getByText('GCS_write_bytes_counter_<bucket>')).toBeInTheDocument();
    expect(screen.queryByText(/gcs_requests_total/)).not.toBeInTheDocument();
    expect(screen.queryByText(/gcs_bytes_read/)).not.toBeInTheDocument();
    expect(screen.queryByText(/gcs_request_latency_ms/)).not.toBeInTheDocument();

    // Close accordion
    fireEvent.click(metricsToggle);
    expect(screen.queryByText('GCS_read_bytes_counter_<bucket>')).not.toBeInTheDocument();
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

    // Toggle accordion closed
    fireEvent.click(advancedToggle);
    expect(container.querySelector('#gcsSourceValidate')).not.toBeInTheDocument();
    expect(container.querySelector('#gcsSourceMinBundleSize')).not.toBeInTheDocument();
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

  it('falls back to special_instructions and property-level instructions when present', () => {
    const mockNodeSpecialData: any = {
      data: {
        special_instructions: 'Special instructions from data',
        properties: {}
      }
    };
    const { rerender } = render(<GcsFileSystemSourceProperties node={mockNodeSpecialData} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from data')).toBeInTheDocument();

    const mockNodePropertySys: any = {
      data: {
        properties: {
          system_instructions: 'System instructions from properties'
        }
      }
    };
    rerender(<GcsFileSystemSourceProperties node={mockNodePropertySys} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('System instructions from properties')).toBeInTheDocument();

    const mockNodePropertySpecial: any = {
      data: {
        properties: {
          special_instructions: 'Special instructions from properties'
        }
      }
    };
    rerender(<GcsFileSystemSourceProperties node={mockNodePropertySpecial} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from properties')).toBeInTheDocument();
  });

  it('requests storage buckets via vscode.postMessage and renders datalist suggestions upon message event', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<GcsFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Assert initial IPC request was dispatched to extension host
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Simulate extension response event with bucket array
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['analytics-bucket', 'gs://warehouse-bucket']
          }
        })
      );
    });

    const filePatternInput = container.querySelector('#gcsSourceFilePattern') as HTMLInputElement;
    const datalistId = filePatternInput.getAttribute('list');
    expect(datalistId).toBeTruthy();
    const datalist = container.querySelector(`datalist#${datalistId}`);
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);
    expect(datalist?.children[0]).toHaveAttribute('value', 'gs://analytics-bucket/');
    expect(datalist?.children[1]).toHaveAttribute('value', 'gs://warehouse-bucket');
  });

  it('surfaces bucket discovery error inline using muted/red text alert', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<GcsFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

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

    const errorAlert = screen.getByText(/Failed to load Cloud Storage buckets:/);
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveAttribute('role', 'alert');
    expect(errorAlert).toHaveTextContent('Failed to load Cloud Storage buckets: Google Cloud API error: 403 Forbidden');
    expect(errorAlert).toHaveClass('text-red-400');
  });

  it('REGRESSION: shows the bucket discovery error even when the path is valid', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          filePattern: 'gs://valid-bucket/data/*.json'
        }
      }
    };

    render(<GcsFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Ensure path has no validation error
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();

    // Dispatch bucket discovery error
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'Failed to authenticate with GCP storage API'
          }
        })
      );
    });

    // The bucket discovery error MUST render even though filePattern is valid
    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent('Failed to load Cloud Storage buckets: Failed to authenticate with GCP storage API');
    expect(errorAlert).toHaveClass('text-red-400');
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
