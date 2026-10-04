/**
 * RequestResponseIOSinkProperties Test Suite
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Unit tests validating RequestResponseIOSinkProperties rendering, POST default method,
 * endpointUrl validation, timeout/repeater/throttler/cache updates, and system_instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RequestResponseIOSinkProperties } from './RequestResponseIO';

describe('RequestResponseIOSinkProperties', () => {
  let originalVscode: any;

  beforeEach(() => {
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders default RequestResponseIO Sink fields with POST default and 30s timeout', () => {
    const { container } = render(
      <RequestResponseIOSinkProperties
        node={{ data: { label: 'Web APIs Sink', properties: {} } }}
        onChange={vi.fn()}
      />
    );

    expect(container.querySelector('input[name="endpointUrl"]')).toBeInTheDocument();
    expect(container.querySelector('select[name="httpMethod"]')).toHaveValue('POST');
    expect(container.querySelector('select[name="requestCoder"]')).toHaveValue('JsonUtf8Coder');
    expect(container.querySelector('select[name="responseCoder"]')).toHaveValue('JsonUtf8Coder');
    expect(container.querySelector('select[name="authMode"]')).toHaveValue('secretManager');
    expect(container.querySelector('input[name="secretName"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="authHeaderName"]')).toHaveValue('Authorization');
    expect(container.querySelector('input[name="timeout"]')).toHaveValue(30);
    expect(container.querySelector('input[name="enableRepeater"]')).toBeChecked();
    expect(container.querySelector('input[name="enableThrottler"]')).toBeChecked();
  });

  it('marks endpointUrl as invalid when empty and valid when populated', () => {
    const { container, rerender } = render(
      <RequestResponseIOSinkProperties
        node={{ data: { label: 'Web APIs Sink', properties: { endpointUrl: '' } } }}
        onChange={vi.fn()}
      />
    );

    const urlInput = container.querySelector('input[name="endpointUrl"]') as HTMLInputElement;
    expect(urlInput).toHaveAttribute('aria-invalid', 'true');

    rerender(
      <RequestResponseIOSinkProperties
        node={{ data: { label: 'Web APIs Sink', properties: { endpointUrl: 'https://api.example.com/v1/webhooks' } } }}
        onChange={vi.fn()}
      />
    );
    expect(urlInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('updates httpMethod, overloadRatio, enableRepeater, and Redis cache settings', () => {
    const mockOnChange = vi.fn();
    const { container, rerender } = render(
      <RequestResponseIOSinkProperties
        node={{ data: { label: 'Web APIs Sink', properties: { endpointUrl: 'https://api.example.com/v1/webhooks' } } }}
        onChange={mockOnChange}
      />
    );

    fireEvent.change(container.querySelector('select[name="httpMethod"]')!, {
      target: { name: 'httpMethod', value: 'PUT' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ httpMethod: 'PUT' }));

    fireEvent.change(container.querySelector('input[name="overloadRatio"]')!, {
      target: { name: 'overloadRatio', value: '3.5', type: 'number' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ overloadRatio: 3.5 }));

    fireEvent.click(container.querySelector('input[name="enableRepeater"]')!);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ enableRepeater: false }));

    rerender(
      <RequestResponseIOSinkProperties
        node={{
          data: {
            label: 'Web APIs Sink',
            properties: {
              endpointUrl: 'https://api.example.com/v1/webhooks',
              enableCache: true,
            },
          },
        }}
        onChange={mockOnChange}
      />
    );

    fireEvent.change(container.querySelector('input[name="cacheTtlSeconds"]')!, {
      target: { name: 'cacheTtlSeconds', value: '3600', type: 'number' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ cacheTtlSeconds: 3600 }));
  });


  it('updates system_instructions when code generation instructions textarea is edited', () => {
    const mockOnChange = vi.fn();
    const { container } = render(
      <RequestResponseIOSinkProperties
        node={{ data: { label: 'Web APIs Sink', system_instructions: 'Initial instructions' } }}
        onChange={mockOnChange}
      />
    );

    const textarea = container.querySelector('#rrioSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'POST enriched events to webhook endpoint and route ApiIOError failures' },
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'POST enriched events to webhook endpoint and route ApiIOError failures',
      })
    );
  });
});
