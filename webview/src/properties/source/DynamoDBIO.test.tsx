/**
 * Unit Tests for DynamoDBIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates DynamoDBIOSourceProperties form rendering, controlled inputs, IPC callbacks
 * for Secret Manager secrets, validation states, scan parameters, advanced settings,
 * and system instruction handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DynamoDBIOSourceProperties } from './DynamoDBIO';

describe('DynamoDBIOSourceProperties', () => {
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
        label: 'DynamoDB Source',
        properties: {}
      }
    };

    render(<DynamoDBIOSourceProperties node={node} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('e.g. UserEvents');
    expect(tableInput).toBeInTheDocument();
    expect(tableInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Table Name is required/i)).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node.data.properties correctly', () => {
    const node = {
      data: {
        label: 'DynamoDB Source',
        properties: {
          tableName: 'AuditLogs',
          awsRegion: 'us-west-2',
          totalSegments: 8,
          segment: 2,
          projectionExpression: 'id, timestamp, action',
          filterExpression: 'action = :act',
          expressionAttributeNames: '{"#act": "action"}',
          expressionAttributeValues: '{":act": {"S": "LOGIN"}}',
          consistentRead: true,
          numberOfSplits: 16,
          authMode: 'default' as const
        }
      }
    };

    render(<DynamoDBIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('AuditLogs')).toBeInTheDocument();
    expect(screen.getByDisplayValue('id, timestamp, action')).toBeInTheDocument();
    expect(screen.getByDisplayValue('action = :act')).toBeInTheDocument();
    expect(screen.getByDisplayValue('{"#act": "action"}')).toBeInTheDocument();
    expect(screen.getByDisplayValue('{":act": {"S": "LOGIN"}}')).toBeInTheDocument();

    const consistentReadCheckbox = screen.getByRole('checkbox', { name: /Consistent Read/i });
    expect(consistentReadCheckbox).toBeChecked();
  });

  it('updates tableName and scan configuration when inputs change', () => {
    const node = {
      data: {
        label: 'DynamoDB Source',
        properties: {
          tableName: 'OldTable'
        }
      }
    };

    render(<DynamoDBIOSourceProperties node={node} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('e.g. UserEvents');
    fireEvent.change(tableInput, { target: { name: 'tableName', value: 'NewTable' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'NewTable'
    });

    const projectionInput = screen.getByPlaceholderText('e.g. userId, eventTime, payload');
    fireEvent.change(projectionInput, { target: { name: 'projectionExpression', value: 'userId, eventTime' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'OldTable',
      projectionExpression: 'userId, eventTime'
    });

    const consistentCheckbox = screen.getByRole('checkbox', { name: /Consistent Read/i });
    fireEvent.click(consistentCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'OldTable',
      consistentRead: true
    });
  });

  it('handles custom AWS region selection and text input', () => {
    const node = {
      data: {
        label: 'DynamoDB Source',
        properties: {
          tableName: 'Events',
          awsRegion: 'custom',
          customRegion: 'ap-south-1'
        }
      }
    };

    render(<DynamoDBIOSourceProperties node={node} onChange={mockOnChange} />);

    const customRegionInput = screen.getByPlaceholderText('e.g. me-central-1');
    expect(customRegionInput).toBeInTheDocument();
    expect(customRegionInput).toHaveValue('ap-south-1');

    fireEvent.change(customRegionInput, { target: { name: 'customRegion', value: 'af-south-1' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Events',
      awsRegion: 'custom',
      customRegion: 'af-south-1'
    });
  });

  it('switches between default chain and Secret Manager auth mode and loads secrets', () => {
    const node = {
      data: {
        label: 'DynamoDB Source',
        properties: {
          tableName: 'Events',
          authMode: 'secret_manager' as const,
          accessKeySecret: 'my-access-secret',
          secretKeySecret: 'my-secret-key-secret'
        }
      }
    };

    render(<DynamoDBIOSourceProperties node={node} onChange={mockOnChange} />);

    // Secret fields rendered
    expect(screen.getByPlaceholderText('e.g. aws-access-key-id')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. aws-secret-access-key')).toBeInTheDocument();

    // Simulate extension host IPC secretsLoaded message
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            { id: 'aws-access-key', name: 'aws-access-key' },
            'projects/my-project/secrets/aws-secret-key'
          ]
        }
      })
    );

    const datalist = document.getElementById('dynamodb-source-secret-options');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);

    // Simulate switching back to default
    const defaultRadio = screen.getByRole('radio', { name: /Default Chain/i });
    fireEvent.click(defaultRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Events',
      authMode: 'default',
      accessKeySecret: 'my-access-secret',
      secretKeySecret: 'my-secret-key-secret'
    });
  });

  it('renders error on secret manager load failure', () => {
    const node = {
      data: {
        label: 'DynamoDB Source',
        properties: {
          tableName: 'Events',
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<DynamoDBIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Failed to access GCP Secret Manager'
        }
      })
    );

    expect(screen.getAllByText(/Failed to access GCP Secret Manager/i).length).toBeGreaterThan(0);
  });

  it('toggles collapsible Advanced Source Settings and updates endpoint and retry count', () => {
    const node = {
      data: {
        label: 'DynamoDB Source',
        properties: {
          tableName: 'Events'
        }
      }
    };

    render(<DynamoDBIOSourceProperties node={node} onChange={mockOnChange} />);

    // Initially collapsed
    expect(screen.queryByPlaceholderText('http://localhost:8000')).not.toBeInTheDocument();

    // Click to expand
    const toggleButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(toggleButton);

    const endpointInput = screen.getByPlaceholderText('http://localhost:8000');
    expect(endpointInput).toBeInTheDocument();

    fireEvent.change(endpointInput, { target: { name: 'endpointOverride', value: 'http://localhost:4566' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Events',
      endpointOverride: 'http://localhost:4566'
    });

    const retriesInput = screen.getByPlaceholderText('3');
    fireEvent.change(retriesInput, { target: { name: 'maxRetries', value: '5' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      tableName: 'Events',
      maxRetries: '5'
    });
  });

  it('supports numeric fields set to 0 and edge cases with undefined properties', () => {
    const node = {
      data: {
        label: 'DynamoDB Source',
        properties: {
          segment: 0,
          totalSegments: 1
        }
      }
    };

    render(<DynamoDBIOSourceProperties node={node as any} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('e.g. 0')).toHaveValue(0);

    const segmentInput = screen.getByPlaceholderText('e.g. 0');
    fireEvent.change(segmentInput, { target: { name: 'segment', value: '1' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      segment: '1',
      totalSegments: 1
    });

    // Missing properties object entirely
    const nodeWithoutProps = {
      data: {
        label: 'DynamoDB Source'
      }
    };
    render(<DynamoDBIOSourceProperties node={nodeWithoutProps as any} onChange={mockOnChange} />);
    expect(screen.getAllByPlaceholderText('e.g. UserEvents').length).toBeGreaterThan(0);
  });

  it('resolves system instructions fallback chain and handles edits', () => {
    const nodeWithSpecial = {
      data: {
        label: 'DynamoDB Source',
        special_instructions: 'Custom DynamoDB scan prompt instructions'
      }
    };

    const { rerender } = render(
      <DynamoDBIOSourceProperties node={nodeWithSpecial} onChange={mockOnChange} />
    );

    const textarea = screen.getByPlaceholderText(/Read items using DynamoDBIO.read/i);
    expect(textarea).toHaveValue('Custom DynamoDB scan prompt instructions');

    fireEvent.change(textarea, { target: { value: 'Updated prompt instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Updated prompt instructions'
    });

    // Verify system_instructions takes precedence over special_instructions
    const nodeWithSystem = {
      data: {
        label: 'DynamoDB Source',
        system_instructions: 'System instructions take priority',
        special_instructions: 'Special instructions fallback'
      }
    };
    rerender(<DynamoDBIOSourceProperties node={nodeWithSystem} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText(/Read items using DynamoDBIO.read/i)).toHaveValue(
      'System instructions take priority'
    );
  });
});
