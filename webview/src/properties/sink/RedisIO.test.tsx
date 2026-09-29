/**
 * Unit Tests for RedisIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates RedisIOSinkProperties form rendering, hydration from properties,
 * input change dispatches (host, port, database, SSL, writeMethod, expireTime, keyPrefix),
 * IPC callbacks for GCP Secret Manager secrets, advanced settings collapse,
 * error and edge cases, and code generation instructions fallback resolution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RedisIOSinkProperties, REDIS_WRITE_METHODS } from './RedisIO';

describe('RedisIOSinkProperties', () => {
  const mockOnChange = vi.fn();
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    postMessageSpy = vi.fn();
    (window as any).vscode = { postMessage: postMessageSpy };
  });

  afterEach(() => {
    delete (window as any).vscode;
  });

  it('renders required Host field and alerts when empty', () => {
    const node = {
      data: {
        label: 'Redis Sink',
        properties: {}
      }
    };

    render(<RedisIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('Host is required')).toBeInTheDocument();
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node properties', () => {
    const node = {
      data: {
        label: 'Redis Sink',
        properties: {
          host: 'redis.cache.local',
          port: 6380,
          database: 1,
          ssl: true,
          writeMethod: 'SADD',
          expireTime: 86400000,
          keyPrefix: 'tag:',
          authMode: 'secret_manager' as const,
          authPasswordSecret: 'sink-redis-auth',
          connectionTimeout: 1500,
          socketTimeout: 2500,
          clusterMode: true,
          batchSize: 200,
          system_instructions: 'Insert active user set members'
        }
      }
    };

    render(<RedisIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1')).toHaveValue('redis.cache.local');
    expect(screen.getByPlaceholderText('6379')).toHaveValue(6380);
    expect(screen.getByPlaceholderText('0')).toHaveValue(1);
    expect(screen.getByLabelText(/Enable SSL \/ TLS/i)).toBeChecked();
    expect(screen.getByLabelText(/Write Method/i)).toHaveValue('SADD');
    expect(screen.getByPlaceholderText('e.g. 86400000')).toHaveValue(86400000);
    expect(screen.getByPlaceholderText('e.g. app:session:')).toHaveValue('tag:');
    expect(screen.getByPlaceholderText(/redis-auth-password/i)).toHaveValue('sink-redis-auth');

    // Advanced settings
    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    const timeoutInputs = screen.getAllByPlaceholderText('2000');
    expect(timeoutInputs[0]).toHaveValue(1500);
    expect(timeoutInputs[1]).toHaveValue(2500);
    expect(screen.getByPlaceholderText('1000')).toHaveValue(200);
    expect(screen.getByLabelText(/Redis Cluster Mode/i)).toBeChecked();

    expect(screen.getByPlaceholderText(/Write elements to Redis/i)).toHaveValue('Insert active user set members');
  });

  it('updates host, port, database and SSL toggle on change', () => {
    const node = {
      data: {
        label: 'Redis Sink',
        properties: {}
      }
    };

    render(<RedisIOSinkProperties node={node} onChange={mockOnChange} />);

    const hostInput = screen.getByPlaceholderText('127.0.0.1');
    fireEvent.change(hostInput, { target: { name: 'host', value: '192.168.1.100' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      host: '192.168.1.100'
    }));

    const portInput = screen.getByPlaceholderText('6379');
    fireEvent.change(portInput, { target: { name: 'port', value: '6379' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      port: '6379'
    }));

    const dbInput = screen.getByPlaceholderText('0');
    fireEvent.change(dbInput, { target: { name: 'database', value: '3' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      database: '3'
    }));

    const sslCheckbox = screen.getByLabelText(/Enable SSL \/ TLS/i);
    fireEvent.click(sslCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      ssl: true
    }));
  });

  it('dispatches writeMethod, expireTime, and keyPrefix changes', () => {
    const node = {
      data: {
        label: 'Redis Sink',
        properties: {}
      }
    };

    render(<RedisIOSinkProperties node={node} onChange={mockOnChange} />);

    const select = screen.getByLabelText(/Write Method/i);
    fireEvent.change(select, { target: { name: 'writeMethod', value: 'LPUSH' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      writeMethod: 'LPUSH'
    }));

    const expireInput = screen.getByPlaceholderText('e.g. 86400000');
    fireEvent.change(expireInput, { target: { name: 'expireTime', value: '7200000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      expireTime: '7200000'
    }));

    const prefixInput = screen.getByPlaceholderText('e.g. app:session:');
    fireEvent.change(prefixInput, { target: { name: 'keyPrefix', value: 'user:cache:' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      keyPrefix: 'user:cache:'
    }));
  });

  it('supports Secret Manager authentication mode with IPC secretsLoaded', () => {
    const node = {
      data: {
        label: 'Redis Sink',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<RedisIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText(/redis-auth-password/i)).toBeInTheDocument();

    // Simulate IPC secretsLoaded event
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [
          'projects/my-proj/secrets/redis-sink-password',
          { id: 'redis-token', name: 'redis-token' }
        ]
      }
    }));

    const option1 = document.querySelector('datalist#redis-sink-secret-options option[value="redis-sink-password"]');
    const option2 = document.querySelector('datalist#redis-sink-secret-options option[value="redis-token"]');
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error message when secret discovery fails', () => {
    const node = {
      data: {
        label: 'Redis Sink',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<RedisIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        error: 'Unable to reach Secret Manager service'
      }
    }));

    expect(screen.getByText('Unable to reach Secret Manager service')).toBeInTheDocument();
  });

  it('toggles Advanced Sink Settings and updates parameters', () => {
    const node = {
      data: {
        label: 'Redis Sink',
        properties: {}
      }
    };

    render(<RedisIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    const socketTimeoutInput = screen.getAllByPlaceholderText('2000')[1];
    fireEvent.change(socketTimeoutInput, { target: { name: 'socketTimeout', value: '3000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      socketTimeout: '3000'
    }));

    const batchSizeInput = screen.getByPlaceholderText('1000');
    fireEvent.change(batchSizeInput, { target: { name: 'batchSize', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      batchSize: '500'
    }));

    const clusterCheckbox = screen.getByLabelText(/Redis Cluster Mode/i);
    fireEvent.click(clusterCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      clusterMode: true
    }));
  });

  it('handles edge cases: missing properties, numeric 0 values, write methods coverage', () => {
    const nodeWithoutProps = {
      data: {
        label: 'Redis Sink'
      }
    };

    const { rerender } = render(<RedisIOSinkProperties node={nodeWithoutProps as any} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('127.0.0.1')).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'Redis Sink',
        properties: {
          host: '127.0.0.1',
          port: 0,
          database: 0,
          expireTime: 0,
          connectionTimeout: 0,
          socketTimeout: 0,
          batchSize: 0
        }
      }
    };

    rerender(<RedisIOSinkProperties node={nodeWithZeros} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('6379')).toHaveValue(0);
    expect(screen.getByPlaceholderText('0')).toHaveValue(0);
    expect(screen.getByPlaceholderText('e.g. 86400000')).toHaveValue(0);

    // Verify all REDIS_WRITE_METHODS are rendered in the select
    const select = screen.getByLabelText(/Write Method/i);
    REDIS_WRITE_METHODS.forEach(m => {
      const option = select.querySelector(`option[value="${m.value}"]`);
      expect(option).not.toBeNull();
    });
  });

  it('resolves system instructions via fallback chain and handles edits', () => {
    const node = {
      data: {
        label: 'Redis Sink',
        properties: {
          special_instructions: 'Fallback instructions from properties'
        }
      }
    };

    render(<RedisIOSinkProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Write elements to Redis/i);
    expect(textarea).toHaveValue('Fallback instructions from properties');

    fireEvent.change(textarea, { target: { value: 'Updated write prompt' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated write prompt'
    }));
  });
});
