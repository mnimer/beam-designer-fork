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
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('populates fields with provided properties and triggers onChange on streamName change', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          streamName: 'analytics-output-stream',
          region: 'us-west-2',
          authMode: 'secretManager' as const,
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

  it('supports Secret Manager auth mode and updates secret fields', () => {
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

    const accessKeyInput = screen.getByLabelText(/AWS Access Key Secret Name/i);
    expect(accessKeyInput).toHaveValue('projects/123/secrets/aws-sink-key');

    fireEvent.change(accessKeyInput, { target: { name: 'accessKeySecretName', value: 'aws-sink-key' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      accessKeySecretName: 'aws-sink-key'
    }));
  });

  it('does not render direct cleartext AWS credential inputs and strips legacy keys on update', () => {
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

    const { container } = render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('input[name="awsAccessKey"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="awsSecretKey"]')).not.toBeInTheDocument();

    const streamInput = screen.getByLabelText(/Stream Name/i);
    fireEvent.change(streamInput, { target: { name: 'streamName', value: 'clean-sink-stream' } });

    expect(mockOnChange.mock.calls[0][0].awsAccessKey).toBeUndefined();
    expect(mockOnChange.mock.calls[0][0].awsSecretKey).toBeUndefined();
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

  it('handles data serialization modes without custom serializer option or customDataSerializer input', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          dataSerialization: 'stringUtf8' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<KinesisIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const serializationSelect = screen.getByLabelText(/Serialization Format/i) as HTMLSelectElement;
    expect(serializationSelect).toHaveValue('stringUtf8');

    const options = Array.from(serializationSelect.querySelectorAll('option')).map(o => o.value);
    expect(options).not.toContain('custom');
    expect(container.querySelector('#customDataSerializer')).not.toBeInTheDocument();

    fireEvent.change(serializationSelect, { target: { name: 'dataSerialization', value: 'json' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      dataSerialization: 'json'
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
});

