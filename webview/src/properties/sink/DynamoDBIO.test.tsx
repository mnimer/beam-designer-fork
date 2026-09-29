/**
 * Unit Tests for DynamoDBIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates DynamoDBIOSinkProperties form rendering, controlled inputs, IPC callbacks
 * for Secret Manager secrets, validation states, write mode selection, delivery batch limits,
 * advanced settings, and system instruction handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DynamoDBIOSinkProperties } from './DynamoDBIO';

describe('DynamoDBIOSinkProperties', () => {
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

  it('renders required Table Name and alerts when empty', () => {
    const node = {
      data: {
        label: 'DynamoDB Sink',
        properties: {}
      }
    };

    render(<DynamoDBIOSinkProperties node={node} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('e.g. ProcessedEvents');
    expect(tableInput).toBeInTheDocument();
    expect(tableInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Table Name is required/i)).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node.data.properties correctly', () => {
    const node = {
      data: {
        label: 'DynamoDB Sink',
        properties: {
          tableName: 'CustomerAnalytics',
          awsRegion: 'eu-west-1',
          writeMode: 'deleteItem' as const,
          deduplicateKeys: 'customerId, eventTimestamp',
          batchSize: 20,
          retryConfiguration: 'exponential_backoff',
          authMode: 'default' as const
        }
      }
    };

    render(<DynamoDBIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('CustomerAnalytics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('customerId, eventTimestamp')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    expect(screen.getByDisplayValue('exponential_backoff')).toBeInTheDocument();

    const deleteItemRadio = screen.getByRole('radio', { name: /DeleteItem/i });
    expect(deleteItemRadio).toBeChecked();
  });

  it('enforces batchSize max 25 and updates when inputs change', () => {
    const node = {
      data: {
        label: 'DynamoDB Sink',
        properties: {
          tableName: 'Orders'
        }
      }
    };

    render(<DynamoDBIOSinkProperties node={node} onChange={mockOnChange} />);

    const batchSizeInput = screen.getByPlaceholderText('25');
    expect(batchSizeInput).toHaveAttribute('max', '25');
    expect(batchSizeInput).toHaveAttribute('min', '1');

    fireEvent.change(batchSizeInput, { target: { name: 'batchSize', value: '15' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Orders',
      batchSize: '15'
    });

    const deduplicateInput = screen.getByPlaceholderText('e.g. id, sortKey');
    fireEvent.change(deduplicateInput, { target: { name: 'deduplicateKeys', value: 'orderId' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Orders',
      deduplicateKeys: 'orderId'
    });
  });

  it('switches writeMode between PutItem and DeleteItem', () => {
    const node = {
      data: {
        label: 'DynamoDB Sink',
        properties: {
          tableName: 'Orders',
          writeMode: 'putItem' as const
        }
      }
    };

    render(<DynamoDBIOSinkProperties node={node} onChange={mockOnChange} />);

    const deleteRadio = screen.getByRole('radio', { name: /DeleteItem/i });
    fireEvent.click(deleteRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Orders',
      writeMode: 'deleteItem'
    });
  });

  it('handles custom AWS region selection and text input', () => {
    const node = {
      data: {
        label: 'DynamoDB Sink',
        properties: {
          tableName: 'Orders',
          awsRegion: 'custom',
          customRegion: 'eu-south-1'
        }
      }
    };

    render(<DynamoDBIOSinkProperties node={node} onChange={mockOnChange} />);

    const customRegionInput = screen.getByPlaceholderText('e.g. me-central-1');
    expect(customRegionInput).toBeInTheDocument();
    expect(customRegionInput).toHaveValue('eu-south-1');

    fireEvent.change(customRegionInput, { target: { name: 'customRegion', value: 'ap-east-1' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Orders',
      awsRegion: 'custom',
      customRegion: 'ap-east-1'
    });
  });

  it('switches between default chain and Secret Manager auth mode and loads secrets', () => {
    const node = {
      data: {
        label: 'DynamoDB Sink',
        properties: {
          tableName: 'Orders',
          authMode: 'secret_manager' as const,
          accessKeySecret: 'prod-access-key',
          secretKeySecret: 'prod-secret-key'
        }
      }
    };

    render(<DynamoDBIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. aws-access-key-id')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. aws-secret-access-key')).toBeInTheDocument();

    // Simulate extension host IPC secretsLoaded message
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            { id: 'dynamo-access', name: 'dynamo-access' },
            'projects/my-project/secrets/dynamo-secret'
          ]
        }
      })
    );

    const datalist = document.getElementById('dynamodb-sink-secret-options');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);

    // Switch back to default
    const defaultRadio = screen.getByRole('radio', { name: /Default Chain/i });
    fireEvent.click(defaultRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Orders',
      authMode: 'default',
      accessKeySecret: 'prod-access-key',
      secretKeySecret: 'prod-secret-key'
    });
  });

  it('renders error on secret manager load failure', () => {
    const node = {
      data: {
        label: 'DynamoDB Sink',
        properties: {
          tableName: 'Orders',
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<DynamoDBIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Secret Manager unavailable'
        }
      })
    );

    expect(screen.getAllByText(/Secret Manager unavailable/i).length).toBeGreaterThan(0);
  });

  it('toggles collapsible Advanced Sink Settings and updates endpoint, retries, and throttling', () => {
    const node = {
      data: {
        label: 'DynamoDB Sink',
        properties: {
          tableName: 'Orders'
        }
      }
    };

    render(<DynamoDBIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('http://localhost:8000')).not.toBeInTheDocument();

    // Click toggle button to expand
    const toggleButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(toggleButton);

    const endpointInput = screen.getByPlaceholderText('http://localhost:8000');
    expect(endpointInput).toBeInTheDocument();
    fireEvent.change(endpointInput, { target: { name: 'endpointOverride', value: 'http://localhost:4566' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Orders',
      endpointOverride: 'http://localhost:4566'
    });

    const maxRetriesInput = screen.getByPlaceholderText('5');
    fireEvent.change(maxRetriesInput, { target: { name: 'maxRetries', value: '10' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Orders',
      maxRetries: '10'
    });

    const notesInput = screen.getByPlaceholderText(/Notes on provisioned WCU limits/i);
    fireEvent.change(notesInput, { target: { name: 'throttlingNotes', value: 'Allow 200 WCU' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Orders',
      throttlingNotes: 'Allow 200 WCU'
    });
  });

  it('supports numeric fields set to 0 and edge cases with undefined properties', () => {
    const node = {
      data: {
        label: 'DynamoDB Sink',
        properties: {
          maxRetries: 0
        }
      }
    };

    render(<DynamoDBIOSinkProperties node={node as any} onChange={mockOnChange} />);

    // Click advanced settings to see maxRetries
    const toggleButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(toggleButton);

    const maxRetriesInput = screen.getByPlaceholderText('5');
    expect(maxRetriesInput).toHaveValue(0);

    fireEvent.change(maxRetriesInput, { target: { name: 'maxRetries', value: '1' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      maxRetries: '1'
    });

    // Missing properties object entirely
    const nodeWithoutProps = {
      data: {
        label: 'DynamoDB Sink'
      }
    };
    render(<DynamoDBIOSinkProperties node={nodeWithoutProps as any} onChange={mockOnChange} />);
    expect(screen.getAllByPlaceholderText('e.g. ProcessedEvents').length).toBeGreaterThan(0);
  });

  it('resolves system instructions fallback chain and handles edits', () => {
    const nodeWithSpecial = {
      data: {
        label: 'DynamoDB Sink',
        special_instructions: 'Custom write special prompt instructions'
      }
    };

    const { rerender } = render(
      <DynamoDBIOSinkProperties node={nodeWithSpecial} onChange={mockOnChange} />
    );

    const textarea = screen.getByPlaceholderText(/Write elements using DynamoDBIO.write/i);
    expect(textarea).toHaveValue('Custom write special prompt instructions');

    fireEvent.change(textarea, { target: { value: 'Updated write instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Updated write instructions'
    });

    const nodeWithSystem = {
      data: {
        label: 'DynamoDB Sink',
        system_instructions: 'Sink system instructions take priority',
        special_instructions: 'Fallback special instructions'
      }
    };
    rerender(<DynamoDBIOSinkProperties node={nodeWithSystem} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText(/Write elements using DynamoDBIO.write/i)).toHaveValue(
      'Sink system instructions take priority'
    );
  });
});
