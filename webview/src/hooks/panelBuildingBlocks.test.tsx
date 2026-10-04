/**
 * @fileoverview Unit tests for the Phase 6 shared panel building blocks:
 * ExternalDocsLink, useSecretOptions, SecretPicker and useNodeProperties.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ExternalDocsLink, EXTERNAL_DOCS_LINK_CLASS } from '../components/common/ExternalDocsLink';
import {
  SecretPicker,
  SECRET_PICKER_HELP_DISCOVERED,
  SECRET_PICKER_HELP_EMPTY,
} from '../components/common/SecretPicker';
import { useSecretOptions } from './useSecretOptions';
import { useNodeProperties } from './useNodeProperties';

const mockPostMessage = vi.fn();

beforeEach(() => {
  mockPostMessage.mockClear();
  (window as unknown as { vscode?: unknown }).vscode = { postMessage: mockPostMessage };
});

afterEach(() => {
  delete (window as unknown as { vscode?: unknown }).vscode;
});

/**
 * Dispatches a host → webview message.
 *
 * @param data Message payload.
 */
function hostSends(data: Record<string, unknown>): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }));
  });
}

describe('ExternalDocsLink', () => {
  it('asks the host to open the URL externally', () => {
    render(<ExternalDocsLink url="https://beam.apache.org/x" ariaLabel="Open X docs" />);
    const btn = screen.getByRole('button', { name: 'Open X docs' });
    expect(btn).toHaveTextContent('Docs ↗');
    expect(btn.className).toBe(EXTERNAL_DOCS_LINK_CLASS);
    fireEvent.click(btn);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'openExternal', url: 'https://beam.apache.org/x' });
  });

  it('does not throw without a host bridge', () => {
    delete (window as unknown as { vscode?: unknown }).vscode;
    render(<ExternalDocsLink url="https://x" />);
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });
});

/** Test harness rendering a SecretPicker fed by useSecretOptions. */
const PickerHarness: React.FC<{ onChange?: () => void }> = ({ onChange = () => {} }) => {
  const secrets = useSecretOptions();
  return (
    <SecretPicker
      id="pick"
      name="secretName"
      value=""
      onChange={onChange}
      secrets={secrets}
      tooltip="Pick a secret"
      placeholder="my-secret"
    />
  );
};

describe('useSecretOptions + SecretPicker', () => {
  it('requests secrets on mount and normalizes string and object payloads', () => {
    const { container } = render(<PickerHarness />);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });
    expect(screen.getByText(SECRET_PICKER_HELP_EMPTY)).toBeInTheDocument();

    hostSends({
      command: 'secretsLoaded',
      secrets: ['projects/p/secrets/db-pass', { name: 'api-key', id: 'api-key', fullName: 'projects/p/secrets/api-key' }],
    });

    const values = Array.from(container.querySelectorAll('datalist option')).map((o) => o.getAttribute('value'));
    expect(values).toEqual(['db-pass', 'api-key']);
    expect(screen.getByText(SECRET_PICKER_HELP_DISCOVERED)).toBeInTheDocument();
  });

  it('surfaces the host error and re-requests on Refresh', () => {
    render(<PickerHarness />);
    hostSends({ command: 'secretsLoaded', secrets: [], error: 'gcloud not authenticated' });
    expect(screen.getByText('gcloud not authenticated')).toBeInTheDocument();

    mockPostMessage.mockClear();
    fireEvent.click(screen.getByTitle('Refresh secrets from Secret Manager'));
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('labels the input and forwards change events', () => {
    const onChange = vi.fn();
    render(<PickerHarness onChange={onChange} />);
    const input = screen.getByLabelText(/GCP Secret Manager Secret/i);
    fireEvent.change(input, { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe('useNodeProperties', () => {
  /** Harness exposing the hook's helpers through inputs. */
  const Harness: React.FC<{ node: { data: { properties?: Record<string, unknown> } }; onChange: (p: unknown) => void }> = ({ node, onChange }) => {
    const { properties, handleChange, setProperty } = useNodeProperties(node, onChange);
    return (
      <div>
        <input aria-label="host" name="host" value={String(properties.host ?? '')} onChange={handleChange} />
        <input aria-label="tls" name="useTls" type="checkbox" checked={properties.useTls === true} onChange={handleChange} />
        <button type="button" onClick={() => setProperty('port', 9000)}>set port</button>
      </div>
    );
  };

  it('merges text and checkbox changes into the existing properties', () => {
    const onChange = vi.fn();
    render(<Harness node={{ data: { properties: { host: 'a', keep: 1 } } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('host'), { target: { value: 'b' } });
    expect(onChange).toHaveBeenLastCalledWith({ host: 'b', keep: 1 });
    fireEvent.click(screen.getByLabelText('tls'));
    expect(onChange).toHaveBeenLastCalledWith({ host: 'a', keep: 1, useTls: true });
  });

  it('handles nodes without properties and typed setProperty', () => {
    const onChange = vi.fn();
    render(<Harness node={{ data: {} }} onChange={onChange} />);
    fireEvent.click(screen.getByText('set port'));
    expect(onChange).toHaveBeenLastCalledWith({ port: 9000 });
  });
});
