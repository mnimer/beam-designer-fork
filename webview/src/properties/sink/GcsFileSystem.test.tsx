/**
 * GcsFileSystem Sink Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating GcsFileSystemSinkProperties component functionality,
 * form change callbacks, validation states for required fields, accordion toggling,
 * dynamic extension GCS bucket discovery IPC, and code generation instructions.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Validates required field states (to destination directory), default fallbacks, and error boundaries.
 * - Tests GCS metrics and telemetry accordion as well as sharding and output options accordion.
 * - Includes critical regression test asserting that bucket discovery errors render
 *   even when the user has typed a valid, non-empty destination path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GcsFileSystemSinkProperties } from './GcsFileSystem';

describe('GcsFileSystemSinkProperties', () => {
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
        label: 'GcsFileSystem',
        beam_transform: 'GcsFileSystem',
        properties: {}
      }
    };

    const { container } = render(<GcsFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#gcsSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'GcsFileSystem',
        beam_transform: 'GcsFileSystem',
        properties: {
          to: 'gs://my-bucket/output/records',
          suffix: '.json',
          projectId: 'my-gcp-project',
          enablePerformanceMetrics: true,
          writeTimeoutMs: 25000,
          uploadBufferSizeBytes: 16777216,
          format: 'AvroIO',
          compression: 'GZIP',
          numShards: 8,
          shardTemplate: '-SSSSS-of-NNNNN',
          system_instructions: 'Sink GCS LLM instructions'
        }
      }
    };

    const { container } = render(<GcsFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#gcsSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#gcsSinkSuffix') as HTMLInputElement;
    const projectIdInput = container.querySelector('#gcsSinkProjectId') as HTMLInputElement;
    const metricsCheckbox = container.querySelector('#gcsSinkPerformanceMetrics') as HTMLInputElement;
    const writeTimeoutInput = container.querySelector('#gcsSinkWriteTimeoutMs') as HTMLInputElement;
    const uploadBufferInput = container.querySelector('#gcsSinkUploadBufferSizeBytes') as HTMLInputElement;
    const formatSelect = container.querySelector('#gcsSinkFormat') as HTMLSelectElement;
    const compressionSelect = container.querySelector('#gcsSinkCompression') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#gcsSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('gs://my-bucket/output/records');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.json');
    expect(projectIdInput).toHaveValue('my-gcp-project');
    expect(metricsCheckbox).toBeChecked();
    expect(writeTimeoutInput).toHaveValue(25000);
    expect(uploadBufferInput).toHaveValue(16777216);
    expect(container.querySelector('#gcsSinkStorageClass')).not.toBeInTheDocument();
    expect(formatSelect).toHaveValue('AvroIO');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(instructionsTextarea).toHaveValue('Sink GCS LLM instructions');

    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('validates on/off for destination directory (.to) correctly', () => {
    const mockNodeEmpty: any = {
      data: {
        properties: {
          to: ''
        }
      }
    };
    const { rerender } = render(<GcsFileSystemSinkProperties node={mockNodeEmpty} onChange={mockOnChange} />);
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();

    const mockNodePopulated: any = {
      data: {
        properties: {
          to: 'gs://valid-bucket/output/'
        }
      }
    };
    rerender(<GcsFileSystemSinkProperties node={mockNodePopulated} onChange={mockOnChange} />);
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('handles field changes for to, suffix, projectId, enablePerformanceMetrics, writeTimeoutMs, uploadBufferSizeBytes, format, and compression', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<GcsFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    // to change
    const toInput = container.querySelector('#gcsSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 'gs://output-bucket/analytics/' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'gs://output-bucket/analytics/'
      })
    );

    // suffix change
    const suffixInput = container.querySelector('#gcsSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.parquet' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.parquet'
      })
    );

    // projectId change
    const projectIdInput = container.querySelector('#gcsSinkProjectId') as HTMLInputElement;
    fireEvent.change(projectIdInput, {
      target: { name: 'projectId', value: 'gcp-billing-project' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'gcp-billing-project'
      })
    );

    // enablePerformanceMetrics toggle
    const metricsCheckbox = container.querySelector('#gcsSinkPerformanceMetrics') as HTMLInputElement;
    fireEvent.click(metricsCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        enablePerformanceMetrics: true
      })
    );

    // writeTimeoutMs change
    const writeTimeoutInput = container.querySelector('#gcsSinkWriteTimeoutMs') as HTMLInputElement;
    fireEvent.change(writeTimeoutInput, {
      target: { name: 'writeTimeoutMs', value: '35000' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        writeTimeoutMs: '35000'
      })
    );

    // uploadBufferSizeBytes change
    const uploadBufferInput = container.querySelector('#gcsSinkUploadBufferSizeBytes') as HTMLInputElement;
    fireEvent.change(uploadBufferInput, {
      target: { name: 'uploadBufferSizeBytes', value: '33554432' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadBufferSizeBytes: '33554432'
      })
    );

    // format change
    const formatSelect = container.querySelector('#gcsSinkFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'format', value: 'ParquetIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'ParquetIO'
      })
    );

    // compression change
    const compressionSelect = container.querySelector('#gcsSinkCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'BZIP2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'BZIP2'
      })
    );
  });

  it('toggles GCS metrics & telemetry accordion open and closed and displays real Beam GCS counters', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<GcsFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const metricsToggle = screen.getByText('GCS Metrics & Telemetry');
    expect(screen.queryByText('GCS_write_bytes_counter_<bucket>')).not.toBeInTheDocument();

    // Open accordion
    fireEvent.click(metricsToggle);
    expect(screen.getByText('GCS_read_bytes_counter_<bucket>')).toBeInTheDocument();
    expect(screen.getByText('GCS_write_bytes_counter_<bucket>')).toBeInTheDocument();
    expect(screen.queryByText(/gcs_upload_requests/)).not.toBeInTheDocument();
    expect(screen.queryByText(/gcs_bytes_written/)).not.toBeInTheDocument();
    expect(screen.queryByText(/gcs_write_latency_ms/)).not.toBeInTheDocument();

    // Close accordion
    fireEvent.click(metricsToggle);
    expect(screen.queryByText('GCS_write_bytes_counter_<bucket>')).not.toBeInTheDocument();
  });

  it('handles sharding & shard template accordion toggling and input changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<GcsFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Open Sharding Accordion
    const shardingToggle = screen.getByText('Sharding & Shard Template Options');
    fireEvent.click(shardingToggle);

    const numShardsInput = container.querySelector('#gcsSinkNumShards') as HTMLInputElement;
    expect(numShardsInput).toBeInTheDocument();
    fireEvent.change(numShardsInput, {
      target: { name: 'numShards', value: '16' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '16'
      })
    );

    const shardTemplateInput = container.querySelector('#gcsSinkShardTemplate') as HTMLInputElement;
    expect(shardTemplateInput).toBeInTheDocument();
    fireEvent.change(shardTemplateInput, {
      target: { name: 'shardTemplate', value: '-W-of-N' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        shardTemplate: '-W-of-N'
      })
    );

    // Toggle accordion closed
    fireEvent.click(shardingToggle);
    expect(container.querySelector('#gcsSinkNumShards')).not.toBeInTheDocument();
    expect(container.querySelector('#gcsSinkShardTemplate')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<GcsFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#gcsSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Write GCS sink elements with specific shard formatting' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Write GCS sink elements with specific shard formatting'
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
    const { rerender } = render(<GcsFileSystemSinkProperties node={mockNodeSpecialData} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from data')).toBeInTheDocument();

    const mockNodePropertySys: any = {
      data: {
        properties: {
          system_instructions: 'System instructions from properties'
        }
      }
    };
    rerender(<GcsFileSystemSinkProperties node={mockNodePropertySys} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('System instructions from properties')).toBeInTheDocument();

    const mockNodePropertySpecial: any = {
      data: {
        properties: {
          special_instructions: 'Special instructions from properties'
        }
      }
    };
    rerender(<GcsFileSystemSinkProperties node={mockNodePropertySpecial} onChange={mockOnChange} />);
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

    const { container } = render(<GcsFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Assert initial IPC request was dispatched to extension host
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Simulate extension response event with bucket array
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: ['data-lake-sink', 'gs://backup-sink']
          }
        })
      );
    });

    const toInput = container.querySelector('#gcsSinkTo') as HTMLInputElement;
    const datalistId = toInput.getAttribute('list');
    expect(datalistId).toBeTruthy();
    const datalist = container.querySelector(`datalist#${datalistId}`);
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);
    expect(datalist?.children[0]).toHaveAttribute('value', 'gs://data-lake-sink/');
    expect(datalist?.children[1]).toHaveAttribute('value', 'gs://backup-sink');
  });

  it('surfaces bucket discovery error inline using muted/red text alert', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<GcsFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

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
          to: 'gs://valid-bucket/output/data'
        }
      }
    };

    render(<GcsFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Ensure path has no validation error
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();

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

    // The bucket discovery error MUST render even though to is valid
    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent('Failed to load Cloud Storage buckets: Failed to authenticate with GCP storage API');
    expect(errorAlert).toHaveClass('text-red-400');
  });

  /**
   * Regression guard: Neither GcsOptions, GcsUtil, nor gcsio.py exposes any storageClass option,
   * so selecting ARCHIVE silently wrote at the bucket's default storage class. Additionally, XZ
   * is not a valid Beam Compression enum value. Both are removed and must never be rendered.
   */
  it('never renders storageClass or XZ compression, even for legacy persisted values, and uses verified flag/counter names', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          to: 'gs://my-bucket/output/events',
          storageClass: 'ARCHIVE',
          compression: 'GZIP'
        }
      }
    };

    const { container } = render(<GcsFileSystemSinkProperties node={mockLegacyNode} onChange={mockOnChange} />);

    expect(container.querySelector('#gcsSinkStorageClass')).not.toBeInTheDocument();
    expect(container.querySelector('select[name="storageClass"]')).not.toBeInTheDocument();
    expect(screen.queryByText(/GCS Storage Class/i)).not.toBeInTheDocument();

    const compressionSelect = container.querySelector('#gcsSinkCompression') as HTMLSelectElement;
    const compressionValues = Array.from(compressionSelect.options).map((opt) => opt.value);
    expect(compressionValues).not.toContain('XZ');

    expect(screen.getByText(/--gcsPerformanceMetrics/)).toBeInTheDocument();
    expect(screen.queryByText(/--gcs_performance_metrics/)).not.toBeInTheDocument();
    expect(screen.queryByText(/requester-pays/i)).not.toBeInTheDocument();
    expect(screen.getByText(/GcsOptions\.setProject\(String\)/)).toBeInTheDocument();
  });
});
