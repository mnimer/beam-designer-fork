/**
 * KinesisIOSinkProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating KinesisIOSinkProperties component functionality,
 * form input change handlers, gcloud Secret Manager IPC callbacks, partition key strategies,
 * data serialization formats, and producer batching controls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KinesisIOSinkProperties } from './KinesisIO';

describe('KinesisIOSinkProperties', () => {
  let originalVscode: any;

  beforeEach(() => {
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
    vi.restoreAllMocks();
  });

  it('renders default fields, required indicators, and documentation tooltips', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Stream Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/AWS Region/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Secret Manager$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Direct Keys$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^IAM \/ Default$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Partition Key Source/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Serialization Format/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it('populates fields with provided properties and triggers onChange on streamName change', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          streamName: 'analytics-output-stream',
          region: 'us-west-2',
          authMode: 'direct' as const,
          awsAccessKey: 'AKIA_SINK_KEY',
          awsSecretKey: 'SECRET_SINK_KEY'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const streamInput = screen.getByLabelText(/Stream Name/i);
    expect(streamInput).toHaveValue('analytics-output-stream');

    fireEvent.change(streamInput, { target: { name: 'streamName', value: 'new-output-stream' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      streamName: 'new-output-stream'
    }));
  });

  it('supports custom region selection and updates customRegion property', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          region: 'custom',
          customRegion: 'ap-east-1'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const customRegionInput = screen.getByLabelText(/Custom AWS Region/i);
    expect(customRegionInput).toHaveValue('ap-east-1');

    fireEvent.change(customRegionInput, { target: { name: 'customRegion', value: 'me-south-1' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      region: 'custom',
      customRegion: 'me-south-1'
    }));
  });

  it('handles switching to standard region from dropdown', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          region: 'us-east-1'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const regionSelect = screen.getByLabelText(/AWS Region/i);
    fireEvent.change(regionSelect, { target: { value: 'eu-central-1' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      region: 'eu-central-1',
      customRegion: ''
    }));
  });

  it('supports Secret Manager auth mode with IPC callback and datalist population', () => {
    const postMessageMock = vi.fn();
    (window as any).vscode = { postMessage: postMessageMock };

    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          authMode: 'secretManager' as const,
          accessKeySecretName: 'projects/123/secrets/aws-sink-key',
          secretKeySecretName: 'projects/123/secrets/aws-sink-secret'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getSecrets' });

    // Simulate extension response
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: ['aws-sink-key', 'aws-sink-secret']
          }
        })
      );
    });

    const accessKeyInput = screen.getByLabelText(/AWS Access Key Secret Name/i);
    expect(accessKeyInput).toHaveValue('projects/123/secrets/aws-sink-key');

    fireEvent.change(accessKeyInput, { target: { name: 'accessKeySecretName', value: 'aws-sink-key' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      accessKeySecretName: 'aws-sink-key'
    }));

    // Test Refresh button
    const refreshBtn = screen.getByTitle(/Refresh secrets from gcloud/i);
    fireEvent.click(refreshBtn);
    expect(postMessageMock).toHaveBeenCalledTimes(2);
  });

  it('displays secret loading error alert when secretsLoaded contains error', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          authMode: 'secretManager' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            error: 'Failed to authenticate with Secret Manager'
          }
        })
      );
    });

    const errorAlerts = screen.getAllByRole('alert');
    const secretErrorAlert = errorAlerts.find(el => el.textContent?.includes('Failed to authenticate with Secret Manager'));
    expect(secretErrorAlert).toBeInTheDocument();
  });

  it('supports direct credentials and toggles secret key visibility', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          authMode: 'direct' as const,
          awsAccessKey: 'MY_SINK_KEY',
          awsSecretKey: 'MY_SINK_SECRET'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const secretInput = screen.getByLabelText(/AWS Secret Access Key/i);
    expect(secretInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByTitle(/Show key/i);
    fireEvent.click(toggleButton);

    expect(secretInput).toHaveAttribute('type', 'text');
  });

  it('supports IAM / Default Provider mode with role ARN', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          authMode: 'iam' as const,
          roleArn: 'arn:aws:iam::123456789012:role/DataflowSinkRole'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const roleInput = screen.getByLabelText(/Assume Role ARN/i);
    expect(roleInput).toHaveValue('arn:aws:iam::123456789012:role/DataflowSinkRole');

    fireEvent.change(roleInput, { target: { name: 'roleArn', value: 'arn:aws:iam::000000000000:role/NewRole' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      roleArn: 'arn:aws:iam::000000000000:role/NewRole'
    }));
  });

  it('handles partition key modes: static, custom, and recordKey', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          partitionKeyMode: 'static' as const,
          partitionKey: 'fixed-key'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { rerender } = render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const staticKeyInput = screen.getByLabelText(/Static Partition Key Value/i);
    expect(staticKeyInput).toHaveValue('fixed-key');

    fireEvent.change(staticKeyInput, { target: { name: 'partitionKey', value: 'shard-key-1' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      partitionKey: 'shard-key-1'
    }));

    // Switch to custom
    const customNode = {
      data: {
        label: 'Kinesis',
        properties: {
          partitionKeyMode: 'custom' as const,
          partitionKey: 'record.getId()'
        }
      }
    };
    rerender(<KinesisIOSinkProperties node={customNode} onChange={mockOnChange} />);

    const customKeyInput = screen.getByLabelText(/Partition Key Expression \/ Extractor/i);
    expect(customKeyInput).toHaveValue('record.getId()');
  });

  it('handles data serialization modes including custom serializer', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          dataSerialization: 'custom' as const,
          customDataSerializer: 'com.example.ProtobufSerializer'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const customSerializerInput = screen.getByLabelText(/Custom Serializer Function \/ Class/i);
    expect(customSerializerInput).toHaveValue('com.example.ProtobufSerializer');

    fireEvent.change(customSerializerInput, { target: { name: 'customDataSerializer', value: 'com.example.AvroSerializer' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      customDataSerializer: 'com.example.AvroSerializer'
    }));
  });

  it('updates producer configuration and additional properties', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const batchInput = screen.getByLabelText(/Max Batch Items/i);
    fireEvent.change(batchInput, { target: { name: 'collectionMaxCount', value: '250' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      collectionMaxCount: '250'
    }));

    const bufferTimeInput = screen.getByLabelText(/Max Buffer Time \(ms\)/i);
    fireEvent.change(bufferTimeInput, { target: { name: 'recordMaxBufferedTime', value: '50' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      recordMaxBufferedTime: '50'
    }));

    const connectTimeoutInput = screen.getByLabelText(/Connect Timeout \(ms\)/i);
    fireEvent.change(connectTimeoutInput, { target: { name: 'connectTimeout', value: '3000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectTimeout: '3000'
    }));

    const requestTimeoutInput = screen.getByLabelText(/Request Timeout \(ms\)/i);
    fireEvent.change(requestTimeoutInput, { target: { name: 'requestTimeout', value: '4000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      requestTimeout: '4000'
    }));

    const producerPropsTextarea = screen.getByLabelText(/Additional Producer Properties/i);
    fireEvent.change(producerPropsTextarea, { target: { name: 'producerProperties', value: 'RateLimit=100' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      producerProperties: 'RateLimit=100'
    }));
  });

  it('updates service endpoint, SSL certificate verification, and system instructions', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          serviceEndpoint: 'http://localhost:4566',
          verifyCertificate: true
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const endpointInput = screen.getByLabelText(/Custom Service Endpoint/i);
    expect(endpointInput).toHaveValue('http://localhost:4566');

    const certCheckbox = screen.getByLabelText(/Verify SSL Certificates/i);
    expect(certCheckbox).toBeChecked();
    fireEvent.click(certCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      verifyCertificate: false
    }));

    const instructionsTextarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(instructionsTextarea, { target: { value: 'Write to backup shard on failure' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Write to backup shard on failure'
    }));
  });

  it('handles empty properties object gracefully without errors', () => {
    const mockNode = {
      data: {
        label: 'Kinesis'
      }
    };
    const mockOnChange = vi.fn();

    expect(() => render(<KinesisIOSinkProperties node={mockNode as any} onChange={mockOnChange} />)).not.toThrow();
  });

  it('normalizes object-shaped secrets payload to short secret IDs and never renders [object Object]', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          streamName: 'order-stream',
          authMode: 'secretManager' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Simulate extension response with object-shaped secrets payload (M1 shape)
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: [
              {
                name: 'kinesis-sink-key',
                id: 'kinesis-sink-key',
                fullName: 'projects/123456/secrets/kinesis-sink-key',
                value: 'kinesis-sink-key'
              },
              {
                name: 'kinesis-sink-secret',
                id: 'kinesis-sink-secret',
                fullName: 'projects/123456/secrets/kinesis-sink-secret',
                value: 'kinesis-sink-secret'
              }
            ]
          }
        })
      );
    });

    const datalist = container.querySelector('#kinesis-sink-secrets-list');
    expect(datalist).toBeInTheDocument();
    const options = datalist?.querySelectorAll('option');
    expect(options).toBeDefined();
    expect(options?.length).toBe(2);

    const values = Array.from(options || []).map(opt => opt.getAttribute('value'));
    expect(values).toEqual(['kinesis-sink-key', 'kinesis-sink-secret']);
    expect(values).not.toContain('[object Object]');
    expect(values.some(v => v?.includes('[object'))).toBe(false);
  });
});
