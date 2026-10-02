/**
 * Unit Tests for RedisIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates RedisIOSourceProperties form rendering, hydration from properties,
 * input change dispatches, Secret Manager authentication mode,
 * readMode toggle (static pattern vs dynamic key patterns), advanced settings collapse,
 * error and edge cases, and code generation instructions fallback resolution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RedisIOSourceProperties } from './RedisIO';

describe('RedisIOSourceProperties', () => {
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
        label: 'Redis Source',
        properties: {}
      }
    };

    render(<RedisIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('Host is required')).toBeInTheDocument();
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node properties', () => {
    const node = {
      data: {
        label: 'Redis Source',
        properties: {
          host: 'redis.internal.net',
          port: 6380,
          database: 2,
          ssl: true,
          readMode: 'keyPattern' as const,
          keyPattern: 'session:*',
          batchSize: 500,
          outputParallelization: true,
          authMode: 'secret_manager' as const,
          authPasswordSecret: 'my-redis-secret',
          connectionTimeout: 3000,
          socketTimeout: 4000,
          maxAttempts: 3,
          clusterMode: true,
          system_instructions: 'Extract session tokens'
        }
      }
    };

    render(<RedisIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1')).toHaveValue('redis.internal.net');
    expect(screen.getByPlaceholderText('6379')).toHaveValue(6380);
    expect(screen.getByPlaceholderText('0')).toHaveValue(2);
    expect(screen.getByLabelText(/Enable SSL \/ TLS/i)).toBeChecked();
    expect(screen.getByPlaceholderText('e.g. user:*')).toHaveValue('session:*');
    expect(screen.getByPlaceholderText('1000')).toHaveValue(500);
    expect(screen.getByLabelText(/Parallelize Output/i)).toBeChecked();
    expect(screen.getByPlaceholderText(/redis-auth-password/i)).toHaveValue('my-redis-secret');

    // Expand advanced settings and check values
    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const timeoutInputs = screen.getAllByPlaceholderText('2000');
    expect(timeoutInputs[0]).toHaveValue(3000);
    expect(timeoutInputs[1]).toHaveValue(4000);
    expect(screen.getByPlaceholderText('5')).toHaveValue(3);
    expect(screen.getByLabelText(/Redis Cluster Mode/i)).toBeChecked();

    expect(screen.getByPlaceholderText(/Ingest cache keys/i)).toHaveValue('Extract session tokens');
  });

  it('updates host and port when inputs change', () => {
    const node = {
      data: {
        label: 'Redis Source',
        properties: { host: 'old-host' }
      }
    };

    render(<RedisIOSourceProperties node={node} onChange={mockOnChange} />);

    const hostInput = screen.getByPlaceholderText('127.0.0.1');
    fireEvent.change(hostInput, { target: { name: 'host', value: '10.0.0.1' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      host: '10.0.0.1'
    }));

    const portInput = screen.getByPlaceholderText('6379');
    fireEvent.change(portInput, { target: { name: 'port', value: '6380' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      port: '6380'
    }));
  });

  it('toggles SSL and Output Parallelization checkboxes', () => {
    const node = {
      data: {
        label: 'Redis Source',
        properties: { ssl: false, outputParallelization: false }
      }
    };

    render(<RedisIOSourceProperties node={node} onChange={mockOnChange} />);

    const sslCheckbox = screen.getByLabelText(/Enable SSL \/ TLS/i);
    fireEvent.click(sslCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      ssl: true
    }));

    const parallelCheckbox = screen.getByLabelText(/Parallelize Output/i);
    fireEvent.click(parallelCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      outputParallelization: true
    }));
  });

  it('switches between keyPattern and readKeyPatterns read modes', () => {
    const node = {
      data: {
        label: 'Redis Source',
        properties: {
          readMode: 'keyPattern' as const,
          keyPattern: ''
        }
      }
    };

    const { rerender } = render(<RedisIOSourceProperties node={node} onChange={mockOnChange} />);

    // In keyPattern mode with empty pattern, error should be rendered
    expect(screen.getByText('Key pattern is required in Key Pattern mode')).toBeInTheDocument();

    const readKeyPatternsRadio = screen.getByLabelText(/Dynamic Key Patterns/i);
    fireEvent.click(readKeyPatternsRadio);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      readMode: 'readKeyPatterns'
    }));

    // Re-render in readKeyPatterns mode
    const updatedNode = {
      data: {
        label: 'Redis Source',
        properties: {
          readMode: 'readKeyPatterns' as const
        }
      }
    };
    rerender(<RedisIOSourceProperties node={updatedNode} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. user:*')).not.toBeInTheDocument();
    expect(screen.getByText(/Keys will be read dynamically from pattern strings/i)).toBeInTheDocument();
  });

  it('supports Secret Manager authentication mode', () => {
    const node = {
      data: {
        label: 'Redis Source',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<RedisIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText(/redis-auth-password/i)).toBeInTheDocument();
  });

  it('expands Advanced Source Settings and updates parameters', () => {
    const node = {
      data: {
        label: 'Redis Source',
        properties: {}
      }
    };

    render(<RedisIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const connTimeoutInput = screen.getAllByPlaceholderText('2000')[0];
    fireEvent.change(connTimeoutInput, { target: { name: 'connectionTimeout', value: '5000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectionTimeout: '5000'
    }));

    const maxAttemptsInput = screen.getByPlaceholderText('5');
    fireEvent.change(maxAttemptsInput, { target: { name: 'maxAttempts', value: '10' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxAttempts: '10'
    }));

    const clusterCheckbox = screen.getByLabelText(/Redis Cluster Mode/i);
    fireEvent.click(clusterCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      clusterMode: true
    }));
  });

  it('handles edge cases: missing properties, numeric 0 values', () => {
    const nodeWithoutProps = {
      data: {
        label: 'Redis Source'
      }
    };

    const { rerender } = render(<RedisIOSourceProperties node={nodeWithoutProps as any} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('127.0.0.1')).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'Redis Source',
        properties: {
          host: '127.0.0.1',
          port: 0,
          database: 0,
          batchSize: 0,
          connectionTimeout: 0,
          socketTimeout: 0,
          maxAttempts: 0
        }
      }
    };

    rerender(<RedisIOSourceProperties node={nodeWithZeros} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('6379')).toHaveValue(0);
    expect(screen.getByPlaceholderText('0')).toHaveValue(0);
    expect(screen.getByPlaceholderText('1000')).toHaveValue(0);
  });

  it('resolves system instructions via fallback chain and handles edits', () => {
    // Test node.data.special_instructions fallback
    const node = {
      data: {
        label: 'Redis Source',
        special_instructions: 'Custom special instructions'
      }
    };

    render(<RedisIOSourceProperties node={node as any} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Ingest cache keys/i);
    expect(textarea).toHaveValue('Custom special instructions');

    fireEvent.change(textarea, { target: { value: 'New prompt value' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New prompt value'
    }));
  });
});
