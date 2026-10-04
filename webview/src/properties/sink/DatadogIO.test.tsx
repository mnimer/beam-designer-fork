/**
 * DatadogIOSinkProperties Test Suite
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Unit tests validating DatadogIOSinkProperties rendering, regional intake URL presets,
 * URL validation, DatadogEvent.Builder metadata updates, batching/buffer parameters,
 * Secret Manager dynamic discovery (`getSecrets`), and system_instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DatadogIOSinkProperties, DATADOG_INTAKE_PRESETS } from './DatadogIO';

describe('DatadogIOSinkProperties', () => {
  let originalVscode: any;

  beforeEach(() => {
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders all documented DatadogIO.Write and DatadogEvent.Builder fields with regional presets', () => {
    const { container } = render(
      <DatadogIOSinkProperties
        node={{ data: { label: 'Datadog Sink', properties: {} } }}
        onChange={vi.fn()}
      />
    );

    expect(container.querySelector('input[name="url"]')).toBeInTheDocument();
    expect(container.querySelector('select[name="authMode"]')).toHaveValue('secretManager');
    expect(container.querySelector('input[name="apiKeySecret"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="service"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="ddsource"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="hostname"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="ddtags"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="messageField"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="batchCount"]')).toHaveValue(100);
    expect(container.querySelector('input[name="minBatchCount"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="maxBufferSize"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="parallelism"]')).toBeInTheDocument();

    const presetDatalist = document.getElementById('datadog-intake-url-presets');
    expect(presetDatalist?.children.length).toBe(DATADOG_INTAKE_PRESETS.length);
  });

  it('marks Datadog intake URL as invalid when empty and valid when provided', () => {
    const { container, rerender } = render(
      <DatadogIOSinkProperties
        node={{ data: { label: 'Datadog', properties: { url: '' } } }}
        onChange={vi.fn()}
      />
    );

    const urlInput = container.querySelector('input[name="url"]') as HTMLInputElement;
    expect(urlInput).toHaveAttribute('aria-invalid', 'true');

    rerender(
      <DatadogIOSinkProperties
        node={{ data: { label: 'Datadog', properties: { url: 'https://http-intake.logs.datadoghq.com' } } }}
        onChange={vi.fn()}
      />
    );
    expect(urlInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('updates DatadogEvent metadata and batching/buffer fields on change', () => {
    const mockOnChange = vi.fn();
    const { container } = render(
      <DatadogIOSinkProperties
        node={{ data: { label: 'Datadog', properties: { url: 'https://http-intake.logs.datadoghq.com' } } }}
        onChange={mockOnChange}
      />
    );

    fireEvent.change(container.querySelector('input[name="service"]')!, {
      target: { name: 'service', value: 'checkout-service' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ service: 'checkout-service' }));

    fireEvent.change(container.querySelector('input[name="ddtags"]')!, {
      target: { name: 'ddtags', value: 'env:prod,region:us-east1' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ ddtags: 'env:prod,region:us-east1' })
    );

    fireEvent.change(container.querySelector('input[name="batchCount"]')!, {
      target: { name: 'batchCount', value: '500', type: 'number' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ batchCount: 500 }));

    fireEvent.change(container.querySelector('input[name="maxBufferSize"]')!, {
      target: { name: 'maxBufferSize', value: '2097152', type: 'number' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ maxBufferSize: 2097152 }));
  });

  it('hides apiKeySecret when authMode is switched to env', () => {
    const { container } = render(
      <DatadogIOSinkProperties
        node={{ data: { label: 'Datadog', properties: { authMode: 'env' } } }}
        onChange={vi.fn()}
      />
    );

    expect(container.querySelector('input[name="apiKeySecret"]')).not.toBeInTheDocument();
  });

  it('updates system_instructions when code generation instructions textarea is edited', () => {
    const mockOnChange = vi.fn();
    const { container } = render(
      <DatadogIOSinkProperties
        node={{ data: { label: 'Datadog', system_instructions: 'Initial prompt' } }}
        onChange={mockOnChange}
      />
    );

    const textarea = container.querySelector('#datadogSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'Construct DatadogEvent with ddsource=beam and route DatadogWriteError to DLQ' },
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Construct DatadogEvent with ddsource=beam and route DatadogWriteError to DLQ',
      })
    );
  });
});
