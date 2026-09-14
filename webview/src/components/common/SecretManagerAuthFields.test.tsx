/**
 * SecretManagerAuthFields Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import {
  SecretManagerAuthFields,
  normalizeSecretItem
} from './SecretManagerAuthFields';

describe('normalizeSecretItem', () => {
  it('binds short secret ID when given a SecretManagerItem object from extension host', () => {
    const item = {
      name: 'aws-access-key',
      id: 'aws-access-key',
      fullName: 'projects/12345/secrets/aws-access-key',
      value: 'aws-access-key'
    };

    const normalized = normalizeSecretItem(item);
    expect(normalized.id).toBe('aws-access-key');
    expect(normalized.name).toBe('aws-access-key');
    expect(normalized.fullName).toBe('projects/12345/secrets/aws-access-key');
  });

  it('binds short ID when fullName is in name and id contains short ID', () => {
    const item = {
      name: 'projects/123/secrets/aws_sink_key',
      id: 'aws_sink_key'
    };

    const normalized = normalizeSecretItem(item);
    expect(normalized.id).toBe('aws_sink_key');
    expect(normalized.name).toBe('projects/123/secrets/aws_sink_key');
  });

  it('defensively normalizes a plain string with full resource path', () => {
    const raw = 'projects/prod-project/secrets/my-database-pw';
    const normalized = normalizeSecretItem(raw);

    expect(normalized.id).toBe('my-database-pw');
    expect(normalized.name).toBe('my-database-pw');
    expect(normalized.fullName).toBe(raw);
  });

  it('defensively normalizes a plain string that is already a short ID', () => {
    const raw = 'my-simple-secret';
    const normalized = normalizeSecretItem(raw);

    expect(normalized.id).toBe('my-simple-secret');
    expect(normalized.name).toBe('my-simple-secret');
  });
});

describe('SecretManagerAuthFields', () => {
  it('renders authMode select and hides secretName input by default', () => {
    const handleChange = vi.fn();

    render(
      <SecretManagerAuthFields
        authMode="default"
        onChange={handleChange}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('default');
    expect(screen.queryByPlaceholderText(/aws-sqs-credentials/)).not.toBeInTheDocument();
  });

  it('renders secretName input and populated datalist when authMode is secretManager', () => {
    const handleChange = vi.fn();
    const secrets = [
      { name: 'projects/123/secrets/sqs-credentials', id: 'sqs-credentials' },
      'projects/123/secrets/plain-sqs-key'
    ];

    render(
      <SecretManagerAuthFields
        authMode="secretManager"
        secretName="sqs-credentials"
        secrets={secrets}
        idPrefix="sqsSink"
        datalistId="sqs-sink-secrets-list"
        onChange={handleChange}
      />
    );

    const input = screen.getByPlaceholderText(/aws-sqs-credentials/) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('sqs-credentials');
    expect(input).toHaveAttribute('list', 'sqs-sink-secrets-list');

    const datalist = document.getElementById('sqs-sink-secrets-list');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);
    // Both options must have bound the short ID as their value
    expect(datalist?.children[0]).toHaveAttribute('value', 'sqs-credentials');
    expect(datalist?.children[1]).toHaveAttribute('value', 'plain-sqs-key');
  });

  it('propagates change events for both authMode and secretName', () => {
    const handleChange = vi.fn();

    const StatefulWrapper = () => {
      const [authMode, setAuthMode] = React.useState('default');
      const [secretName, setSecretName] = React.useState('');

      return (
        <SecretManagerAuthFields
          authMode={authMode}
          secretName={secretName}
          onChange={(e) => {
            handleChange(e);
            if (e.target.name === 'authMode') {
              setAuthMode(e.target.value);
            } else if (e.target.name === 'secretName') {
              setSecretName(e.target.value);
            }
          }}
        />
      );
    };

    render(<StatefulWrapper />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'secretManager' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.value).toBe('secretManager');
    expect(handleChange.mock.calls[0][0].target.name).toBe('authMode');

    // After authMode becomes secretManager, the secret input appears
    const input = screen.getByPlaceholderText(/aws-sqs-credentials/);
    fireEvent.change(input, { target: { value: 'updated-secret' } });

    expect(handleChange).toHaveBeenCalledTimes(2);
    expect(handleChange.mock.calls[1][0].target.value).toBe('updated-secret');
    expect(handleChange.mock.calls[1][0].target.name).toBe('secretName');
  });
});
