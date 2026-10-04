/**
 * SplunkIOSinkProperties Test Suite
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Unit tests validating SplunkIOSinkProperties component rendering, validation states,
 * SplunkEvent.Builder metadata updates, batching/parallelism/compression flags,
 * TLS configuration, Secret Manager dynamic discovery (`getSecrets`), and
 * code generation instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SplunkIOSinkProperties } from './SplunkIO';

describe('SplunkIOSinkProperties', () => {
  let originalVscode: any;

  beforeEach(() => {
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders all documented SplunkIO.Write and SplunkEvent.Builder fields', () => {
    const mockNode = {
      data: {
        label: 'Splunk HEC Sink',
        properties: {},
      },
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SplunkIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('input[name="url"]')).toBeInTheDocument();
    expect(container.querySelector('select[name="authMode"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="tokenSecret"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="index"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="source"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="sourceType"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="host"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="eventField"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="timeField"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="batchCount"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="parallelism"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="enableGzipHttpCompression"]')).toBeChecked();
    expect(container.querySelector('input[name="enableBatchLogs"]')).not.toBeChecked();
    expect(container.querySelector('input[name="disableCertificateValidation"]')).not.toBeChecked();
    expect(container.querySelector('input[name="rootCaCertificatePath"]')).toBeInTheDocument();
    expect(container.querySelector('textarea')).toBeInTheDocument();
  });

  it('marks HEC URL as invalid when empty and valid when populated', () => {
    const mockOnChange = vi.fn();
    const { container, rerender } = render(
      <SplunkIOSinkProperties
        node={{ data: { label: 'Splunk', properties: { url: '' } } }}
        onChange={mockOnChange}
      />
    );

    const urlInput = container.querySelector('input[name="url"]') as HTMLInputElement;
    expect(urlInput).toHaveAttribute('aria-invalid', 'true');

    rerender(
      <SplunkIOSinkProperties
        node={{ data: { label: 'Splunk', properties: { url: 'https://splunk.example.com:8088' } } }}
        onChange={mockOnChange}
      />
    );
    expect(urlInput).toHaveAttribute('aria-invalid', 'false');
    expect(urlInput).toHaveValue('https://splunk.example.com:8088');
  });

  it('updates url, batchCount, parallelism, and SplunkEvent.Builder metadata fields', () => {
    const mockNode = {
      data: {
        label: 'Splunk',
        properties: {
          url: 'https://splunk.example.com:8088',
        },
      },
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SplunkIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    fireEvent.change(container.querySelector('input[name="index"]')!, {
      target: { name: 'index', value: 'sec_events' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ index: 'sec_events' }));

    fireEvent.change(container.querySelector('input[name="sourceType"]')!, {
      target: { name: 'sourceType', value: '_json' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ sourceType: '_json' }));

    fireEvent.change(container.querySelector('input[name="batchCount"]')!, {
      target: { name: 'batchCount', value: '100', type: 'number' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ batchCount: 100 }));

    fireEvent.change(container.querySelector('input[name="parallelism"]')!, {
      target: { name: 'parallelism', value: '16', type: 'number' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ parallelism: 16 }));
  });

  it('toggles boolean flags (enableGzipHttpCompression, enableBatchLogs, disableCertificateValidation)', () => {
    const mockNode = {
      data: {
        label: 'Splunk',
        properties: {
          url: 'https://splunk.example.com:8088',
        },
      },
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SplunkIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const gzipCheckbox = container.querySelector('input[name="enableGzipHttpCompression"]') as HTMLInputElement;
    fireEvent.click(gzipCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ enableGzipHttpCompression: false })
    );

    const batchLogsCheckbox = container.querySelector('input[name="enableBatchLogs"]') as HTMLInputElement;
    fireEvent.click(batchLogsCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ enableBatchLogs: true })
    );

    const certCheckbox = container.querySelector('input[name="disableCertificateValidation"]') as HTMLInputElement;
    fireEvent.click(certCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ disableCertificateValidation: true })
    );
  });

  it('hides tokenSecret input when authMode is switched to env', () => {
    const mockNode = {
      data: {
        label: 'Splunk',
        properties: {
          url: 'https://splunk.example.com:8088',
          authMode: 'env' as const,
        },
      },
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SplunkIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('input[name="tokenSecret"]')).not.toBeInTheDocument();
  });

  it('updates system_instructions when code generation instructions textarea is edited', () => {
    const mockNode = {
      data: {
        label: 'Splunk',
        system_instructions: 'Initial instructions',
      },
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SplunkIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toHaveValue('Initial instructions');

    fireEvent.change(textarea, {
      target: { value: 'Route failed events from PCollection<SplunkWriteError> to GCS dead-letter' },
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Route failed events from PCollection<SplunkWriteError> to GCS dead-letter',
      })
    );
  });
});
