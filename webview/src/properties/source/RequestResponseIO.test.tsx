/**
 * RequestResponseIOSourceProperties Test Suite
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Unit tests validating RequestResponseIOSourceProperties rendering, endpointUrl validation,
 * HTTP method and coder selection, repeater/throttler toggles, conditional Redis cache fields,
 * Secret Manager dynamic discovery (`getSecrets`), and system_instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RequestResponseIOSourceProperties } from './RequestResponseIO';

describe('RequestResponseIOSourceProperties', () => {
  let originalVscode: any;

  beforeEach(() => {
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders default RequestResponseIO Source fields with GET default and 30s timeout', () => {
    const mockOnChange = vi.fn();
    const { container } = render(
      <RequestResponseIOSourceProperties
        node={{ data: { label: 'Web APIs Source', properties: {} } }}
        onChange={mockOnChange}
      />
    );

    expect(container.querySelector('input[name="endpointUrl"]')).toBeInTheDocument();
    expect(container.querySelector('select[name="httpMethod"]')).toHaveValue('GET');
    expect(container.querySelector('select[name="requestCoder"]')).toHaveValue('StringUtf8Coder');
    expect(container.querySelector('select[name="responseCoder"]')).toHaveValue('JsonUtf8Coder');
    expect(container.querySelector('select[name="authMode"]')).toHaveValue('secretManager');
    expect(container.querySelector('input[name="secretName"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="authHeaderName"]')).toHaveValue('Authorization');
    expect(container.querySelector('input[name="timeout"]')).toHaveValue(30);
    expect(container.querySelector('input[name="enableRepeater"]')).toBeChecked();
    expect(container.querySelector('input[name="enableThrottler"]')).toBeChecked();
    expect(container.querySelector('input[name="enableCache"]')).not.toBeChecked();
  });

  it('marks endpointUrl as invalid when empty and valid when provided', () => {
    const mockOnChange = vi.fn();
    const { container, rerender } = render(
      <RequestResponseIOSourceProperties
        node={{ data: { label: 'Web APIs', properties: { endpointUrl: '' } } }}
        onChange={mockOnChange}
      />
    );

    const urlInput = container.querySelector('input[name="endpointUrl"]') as HTMLInputElement;
    expect(urlInput).toHaveAttribute('aria-invalid', 'true');

    rerender(
      <RequestResponseIOSourceProperties
        node={{ data: { label: 'Web APIs', properties: { endpointUrl: 'https://api.example.com/v1/users' } } }}
        onChange={mockOnChange}
      />
    );
    expect(urlInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('updates endpointUrl, httpMethod, timeout, and toggles repeater/throttler/cache', () => {
    const mockOnChange = vi.fn();
    const { container, rerender } = render(
      <RequestResponseIOSourceProperties
        node={{ data: { label: 'Web APIs', properties: { endpointUrl: 'https://api.example.com/v1/users' } } }}
        onChange={mockOnChange}
      />
    );

    fireEvent.change(container.querySelector('select[name="httpMethod"]')!, {
      target: { name: 'httpMethod', value: 'POST' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ httpMethod: 'POST' }));

    fireEvent.change(container.querySelector('input[name="timeout"]')!, {
      target: { name: 'timeout', value: '60', type: 'number' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ timeout: 60 }));

    fireEvent.click(container.querySelector('input[name="enableRepeater"]')!);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ enableRepeater: false }));

    fireEvent.click(container.querySelector('input[name="enableCache"]')!);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ enableCache: true }));

    // Re-render with enableCache: true to test redisUri and cacheTtlSeconds inputs
    rerender(
      <RequestResponseIOSourceProperties
        node={{
          data: {
            label: 'Web APIs',
            properties: {
              endpointUrl: 'https://api.example.com/v1/users',
              enableCache: true,
            },
          },
        }}
        onChange={mockOnChange}
      />
    );

    const redisInput = container.querySelector('input[name="redisUri"]') as HTMLInputElement;
    expect(redisInput).toBeInTheDocument();
    fireEvent.change(redisInput, { target: { name: 'redisUri', value: 'redis://10.0.0.5:6379' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ redisUri: 'redis://10.0.0.5:6379' })
    );
  });

  it('hides secretName and authHeaderName when authMode is none', () => {
    const { container } = render(
      <RequestResponseIOSourceProperties
        node={{ data: { label: 'Web APIs', properties: { authMode: 'none' } } }}
        onChange={vi.fn()}
      />
    );

    expect(container.querySelector('input[name="secretName"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="authHeaderName"]')).not.toBeInTheDocument();
  });

  it('requests secrets via vscode.postMessage(getSecrets) and populates datalist', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    render(
      <RequestResponseIOSourceProperties
        node={{ data: { label: 'Web APIs', properties: { authMode: 'secretManager' } } }}
        onChange={vi.fn()}
      />
    );

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: [{ name: 'projects/123/secrets/webapi-token', id: 'webapi-token' }],
          },
        })
      );
    });

    const datalist = document.getElementById('rrio-source-secrets-list');
    expect(datalist?.children.length).toBe(1);
    expect(datalist?.children[0]).toHaveAttribute('value', 'webapi-token');
  });

  it('updates system_instructions when code generation instructions textarea is edited', () => {
    const mockOnChange = vi.fn();
    const { container } = render(
      <RequestResponseIOSourceProperties
        node={{ data: { label: 'Web APIs', system_instructions: 'Initial instructions' } }}
        onChange={mockOnChange}
      />
    );

    const textarea = container.querySelector('#rrioSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'Call GET /v1/items and parse JSON response' },
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Call GET /v1/items and parse JSON response',
      })
    );
  });
});
