/**
 * SecretManagerSecretField Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import {
  SecretManagerSecretField,
  DEFAULT_SECRET_FIELD_PLACEHOLDER,
  DEFAULT_SECRET_FIELD_TOOLTIP
} from './SecretManagerSecretField';

describe('SecretManagerSecretField', () => {
  const mockPostMessage = vi.fn();
  const vscodeWindow = window as unknown as { vscode?: { postMessage: typeof mockPostMessage } };

  beforeEach(() => {
    mockPostMessage.mockClear();
    vscodeWindow.vscode = { postMessage: mockPostMessage };
  });

  afterEach(() => {
    delete vscodeWindow.vscode;
  });

  const dispatchSecrets = (data: Record<string, unknown>) => {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { command: 'secretsLoaded', ...data } }));
    });
  };

  const optionValues = (datalistId: string) =>
    Array.from(document.querySelectorAll(`#${datalistId} option`)).map((o) => o.getAttribute('value'));

  it('requests secrets via getSecrets and lists normalized, de-duplicated short IDs', () => {
    render(<SecretManagerSecretField id="db-pw" name="passwordSecret" label="Password Secret" onChange={vi.fn()} />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });

    dispatchSecrets({
      secrets: [
        { name: 'db-pw', id: 'db-pw', fullName: 'projects/1/secrets/db-pw', value: 'db-pw' },
        'projects/1/secrets/api-key',
        'db-pw',
        '   '
      ]
    });

    expect(optionValues('db-pw-secret-options')).toEqual(['db-pw', 'api-key']);
    expect(screen.getByLabelText(/Password Secret/)).toHaveAttribute('data-list', 'db-pw-secret-options');
  });

  it('uses a preloaded secrets list and does not send its own request', () => {
    render(
      <SecretManagerSecretField
        id="tok"
        name="tokenSecret"
        label="Token Secret"
        onChange={vi.fn()}
        secrets={['a', 'projects/p/secrets/b']}
      />
    );

    expect(mockPostMessage).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'getSecrets' }));
    expect(optionValues('tok-secret-options')).toEqual(['a', 'b']);
  });

  it('ignores discovery responses when a preloaded list is supplied', () => {
    render(
      <SecretManagerSecretField id="tok" name="tokenSecret" label="Token Secret" onChange={vi.fn()} secrets={['only-me']} />
    );

    dispatchSecrets({ secrets: ['other'] });

    expect(optionValues('tok-secret-options')).toEqual(['only-me']);
  });

  it('renders no datalist options and sends no request for an empty preloaded list', () => {
    render(<SecretManagerSecretField id="empty" name="apiKeySecret" label="API Key Secret" onChange={vi.fn()} secrets={[]} />);

    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(optionValues('empty-secret-options')).toEqual([]);
  });

  it('forwards change events with the configured property name', () => {
    const seen: Array<{ name: string; value: string }> = [];
    const onChange = vi.fn((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Read at event time: the controlled input is reset to the `value` prop afterwards.
      seen.push({ name: e.target.name, value: e.target.value });
    });
    render(<SecretManagerSecretField id="pw" name="passwordSecret" label="Password Secret" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/Password Secret/), { target: { value: 'new-secret' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([{ name: 'passwordSecret', value: 'new-secret' }]);
  });

  it('shows the discovery error inline and marks the input invalid', () => {
    render(<SecretManagerSecretField id="pw" name="passwordSecret" label="Password Secret" onChange={vi.fn()} />);

    dispatchSecrets({ secrets: [], error: 'Failed to list secrets via gcloud: PERMISSION_DENIED' });

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to list secrets via gcloud: PERMISSION_DENIED');
    expect(screen.getByLabelText(/Password Secret/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('gives a validation error precedence over the discovery error', () => {
    render(
      <SecretManagerSecretField id="pw" name="passwordSecret" label="Password Secret" onChange={vi.fn()} error="Required" />
    );

    dispatchSecrets({ secrets: [], error: 'Failed to list secrets via gcloud' });

    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(screen.queryByText('Failed to list secrets via gcloud')).toBeNull();
  });

  it('applies defaults for value, placeholder, tooltip, datalist id and helper text', () => {
    render(<SecretManagerSecretField id="pw" name="passwordSecret" label="Password Secret" onChange={vi.fn()} />);

    const input = screen.getByLabelText(/Password Secret/) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('placeholder', DEFAULT_SECRET_FIELD_PLACEHOLDER);
    expect(input).toHaveAttribute('data-list', 'pw-secret-options');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).toHaveAttribute('aria-required', 'false');
    expect(screen.getByText('gcloud secrets list')).toBeInTheDocument();
    expect(screen.getByText(/Values auto-populated from/)).toBeInTheDocument();
    expect(DEFAULT_SECRET_FIELD_TOOLTIP).toMatch(/Secret Manager/);
    expect(screen.queryByText('*')).toBeNull();
  });

  it('honours value, tooltip, placeholder, datalistId, required and invalid overrides', () => {
    render(
      <SecretManagerSecretField
        id="pw"
        name="passwordSecret"
        label="Password Secret"
        value="existing-secret"
        onChange={vi.fn()}
        tooltip="Custom tooltip"
        placeholder="custom-placeholder"
        datalistId="shared-secrets"
        required
        invalid
        secrets={[{ name: 'projects/p/secrets/s1' }]}
      />
    );

    const input = screen.getByLabelText(/Password Secret/) as HTMLInputElement;
    expect(input.value).toBe('existing-secret');
    expect(input).toHaveAttribute('placeholder', 'custom-placeholder');
    expect(input).toHaveAttribute('data-list', 'shared-secrets');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(optionValues('shared-secrets')).toEqual(['s1']);
  });

  it('never renders a password-type (plaintext credential) input', () => {
    render(<SecretManagerSecretField id="pw" name="passwordSecret" label="Password Secret" onChange={vi.fn()} />);
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByRole('combobox', { name: /mode/i })).toBeNull();
  });
});
