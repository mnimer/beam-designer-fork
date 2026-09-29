/**
 * KinesisIOSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating KinesisIOSourceProperties component functionality,
 * form input change handlers, gcloud Secret Manager IPC callbacks, auth mode switching,
 * stream positioning, watermark policies, and bounded read limits.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KinesisIOSourceProperties } from './KinesisIO';

describe('KinesisIOSourceProperties', () => {
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

    render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Stream Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/AWS Region/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Secret Manager$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Direct Keys$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^IAM \/ Default$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Initial Position/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Watermark Policy/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it('populates fields with provided properties and triggers onChange on streamName change', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          streamName: 'existing-stream',
          region: 'us-west-2',
          authMode: 'secretManager' as const,
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const streamInput = screen.getByLabelText(/Stream Name/i);
    expect(streamInput).toHaveValue('existing-stream');

    fireEvent.change(streamInput, { target: { name: 'streamName', value: 'updated-stream' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      streamName: 'updated-stream'
    }));
  });

  it('switches to custom region input when custom preset is selected', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          region: 'custom',
          customRegion: 'ap-south-1'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const customRegionInput = screen.getByLabelText(/Custom AWS Region/i);
    expect(customRegionInput).toBeInTheDocument();
    expect(customRegionInput).toHaveValue('ap-south-1');

    fireEvent.change(customRegionInput, { target: { name: 'customRegion', value: 'ca-central-1' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      region: 'custom',
      customRegion: 'ca-central-1'
    }));
  });

  it('handles selecting standard region preset from dropdown', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          region: 'us-east-1'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const regionSelect = screen.getByLabelText(/AWS Region/i);
    fireEvent.change(regionSelect, { target: { value: 'eu-west-1' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      region: 'eu-west-1',
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
          accessKeySecretName: 'projects/123/secrets/aws-key',
          secretKeySecretName: 'projects/123/secrets/aws-secret'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getSecrets' });

    // Simulate extension response with loaded secrets
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: ['aws-access-key', 'aws-secret-key', 'another-secret']
          }
        })
      );
    });

    const accessKeyInput = screen.getByLabelText(/AWS Access Key Secret Name/i);
    expect(accessKeyInput).toHaveValue('projects/123/secrets/aws-key');

    fireEvent.change(accessKeyInput, { target: { name: 'accessKeySecretName', value: 'aws-access-key' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      accessKeySecretName: 'aws-access-key'
    }));

    // Test clicking Refresh button
    const refreshBtn = screen.getByTitle(/Refresh secrets from gcloud/i);
    fireEvent.click(refreshBtn);
    expect(postMessageMock).toHaveBeenCalledTimes(2);
  });

  it('does not render direct cleartext AWS credential inputs and strips legacy keys on update', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          authMode: 'direct' as const,
          awsAccessKey: 'MY_KEY_ID',
          awsSecretKey: 'MY_SECRET'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('input[name="awsAccessKey"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="awsSecretKey"]')).not.toBeInTheDocument();

    const streamInput = screen.getByLabelText(/Stream Name/i);
    fireEvent.change(streamInput, { target: { name: 'streamName', value: 'clean-stream' } });

    expect(mockOnChange.mock.calls[0][0].awsAccessKey).toBeUndefined();
    expect(mockOnChange.mock.calls[0][0].awsSecretKey).toBeUndefined();
  });

  it('supports IAM / Default Provider mode with role ARN input', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          authMode: 'iam' as const,
          roleArn: 'arn:aws:iam::123456789012:role/DataflowWorker'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const roleInput = screen.getByLabelText(/Assume Role ARN/i);
    expect(roleInput).toHaveValue('arn:aws:iam::123456789012:role/DataflowWorker');

    fireEvent.change(roleInput, { target: { name: 'roleArn', value: 'arn:aws:iam::999999999999:role/UpdatedRole' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      roleArn: 'arn:aws:iam::999999999999:role/UpdatedRole'
    }));
  });

  it('renders initial timestamp input conditionally when AT_TIMESTAMP is selected', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          initialPositionInStream: 'AT_TIMESTAMP' as const,
          initialTimestampInStream: '2026-09-01T12:00:00Z'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const timestampInput = screen.getByLabelText(/Initial Timestamp/i);
    expect(timestampInput).toBeInTheDocument();
    expect(timestampInput).toHaveValue('2026-09-01T12:00:00Z');

    fireEvent.change(timestampInput, { target: { name: 'initialTimestampInStream', value: '2026-09-02T00:00:00Z' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      initialTimestampInStream: '2026-09-02T00:00:00Z'
    }));
  });

  it('updates watermark policy, idle threshold, and bounded read limits', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const watermarkSelect = screen.getByLabelText(/Watermark Policy/i);
    fireEvent.change(watermarkSelect, { target: { name: 'watermarkPolicy', value: 'ProcessingTime' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      watermarkPolicy: 'ProcessingTime'
    }));

    const maxRecordsInput = screen.getByLabelText(/Max Records \(Test\)/i);
    fireEvent.change(maxRecordsInput, { target: { name: 'maxNumRecords', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxNumRecords: '500'
    }));

    const maxReadTimeInput = screen.getByLabelText(/Max Read Time \(sec\)/i);
    fireEvent.change(maxReadTimeInput, { target: { name: 'maxReadTime', value: '30' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxReadTime: '30'
    }));

    const perRequestLimitInput = screen.getByLabelText(/Per-Request Limit/i);
    fireEvent.change(perRequestLimitInput, { target: { name: 'requestRecordsLimit', value: '2000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      requestRecordsLimit: '2000'
    }));
  });

  it('updates service endpoint, SSL certificate verification checkbox, and system instructions', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          verifyCertificate: true,
          serviceEndpoint: 'http://localhost:4566'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const endpointInput = screen.getByLabelText(/Custom Service Endpoint/i);
    expect(endpointInput).toHaveValue('http://localhost:4566');

    const certCheckbox = screen.getByLabelText(/Verify SSL Certificates/i);
    expect(certCheckbox).toBeChecked();
    fireEvent.click(certCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      verifyCertificate: false
    }));

    const instructionsTextarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(instructionsTextarea, { target: { value: 'Use localstack test credentials' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Use localstack test credentials'
    }));
  });

  it('handles empty properties object gracefully without errors', () => {
    const mockNode = {
      data: {
        label: 'Kinesis'
      }
    };
    const mockOnChange = vi.fn();

    expect(() => render(<KinesisIOSourceProperties node={mockNode as any} onChange={mockOnChange} />)).not.toThrow();
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

    const { container } = render(<KinesisIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Simulate extension response with object-shaped secrets payload (M1 shape)
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: [
              {
                name: 'kinesis-source-key',
                id: 'kinesis-source-key',
                fullName: 'projects/123456/secrets/kinesis-source-key',
                value: 'kinesis-source-key'
              },
              {
                name: 'kinesis-source-secret',
                id: 'kinesis-source-secret',
                fullName: 'projects/123456/secrets/kinesis-source-secret',
                value: 'kinesis-source-secret'
              }
            ]
          }
        })
      );
    });

    const datalist = container.querySelector('#gcloud-secrets-list');
    expect(datalist).toBeInTheDocument();
    const options = datalist?.querySelectorAll('option');
    expect(options).toBeDefined();
    expect(options?.length).toBe(2);

    const values = Array.from(options || []).map(opt => opt.getAttribute('value'));
    expect(values).toEqual(['kinesis-source-key', 'kinesis-source-secret']);
    expect(values).not.toContain('[object Object]');
    expect(values.some(v => v?.includes('[object'))).toBe(false);
  });

  it('displays error message when secretsLoaded contains error', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        properties: {
          authMode: 'secretManager' as const
        }
      }
    };
    render(<KinesisIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            error: 'Failed to authenticate with AWS credentials in GCP Secret Manager'
          }
        })
      );
    });

    const errorElements = screen.getAllByText('Failed to authenticate with AWS credentials in GCP Secret Manager');
    expect(errorElements.length).toBeGreaterThanOrEqual(1);
  });
});

