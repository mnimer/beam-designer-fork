/**
 * SqsIOSinkProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating SqsIOSinkProperties component functionality,
 * batch size constraints (1-10), delivery delays, validation states,
 * dynamic extension callbacks, and code generation instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SqsIOSinkProperties } from './SqsIO';

describe('SqsIOSinkProperties', () => {
  let originalVscode: any;

  beforeEach(() => {
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('marks Queue URL as invalid when empty', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          queueUrl: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const queueInput = container.querySelector('input[name="queueUrl"]');
    expect(queueInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('populates fields and updates queueUrl on edit', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-sink-queue'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const queueInput = container.querySelector('input[name="queueUrl"]') as HTMLInputElement;
    expect(queueInput).toHaveAttribute('aria-invalid', 'false');
    expect(queueInput).toHaveValue('https://sqs.us-east-1.amazonaws.com/123456789012/my-sink-queue');

    fireEvent.change(queueInput, {
      target: { name: 'queueUrl', value: 'https://sqs.us-west-2.amazonaws.com/123456789012/updated-sink' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queueUrl: 'https://sqs.us-west-2.amazonaws.com/123456789012/updated-sink'
      })
    );
  });

  it('handles custom AWS region selection and text input', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          awsRegion: 'custom',
          customAwsRegion: 'ap-south-1'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const regionSelect = container.querySelector('select[name="awsRegion"]') as HTMLSelectElement;
    expect(regionSelect).toHaveValue('custom');

    const customRegionInput = container.querySelector('input[name="customAwsRegion"]') as HTMLInputElement;
    expect(customRegionInput).toHaveValue('ap-south-1');

    fireEvent.change(customRegionInput, {
      target: { name: 'customAwsRegion', value: 'il-central-1' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        customAwsRegion: 'il-central-1'
      })
    );
  });

  it('updates batchSize number and slider', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          batchSize: 5
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const batchInput = container.querySelector('input[id="sqsSinkBatchSize"]') as HTMLInputElement;
    expect(batchInput).toHaveValue(5);

    fireEvent.change(batchInput, { target: { name: 'batchSize', value: '8', type: 'number' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        batchSize: 8
      })
    );
  });

  it('handles empty batchSize input gracefully as empty value', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          batchSize: 10
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const batchInput = container.querySelector('input[id="sqsSinkBatchSize"]') as HTMLInputElement;
    fireEvent.change(batchInput, { target: { name: 'batchSize', value: '', type: 'number' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        batchSize: ''
      })
    );
  });

  it('updates delivery delaySeconds', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          delaySeconds: 15
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const delayInput = container.querySelector('input[name="delaySeconds"]') as HTMLInputElement;
    expect(delayInput).toHaveValue(15);

    fireEvent.change(delayInput, {
      target: { name: 'delaySeconds', value: '30', type: 'number' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        delaySeconds: 30
      })
    );
  });

  it('renders Secret Manager input when authMode is secretManager', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          authMode: 'secretManager' as const,
          secretName: 'projects/123/secrets/aws-sink-secret'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const secretInput = container.querySelector('input[name="secretName"]') as HTMLInputElement;
    expect(secretInput).toBeInTheDocument();
    expect(secretInput).toHaveValue('projects/123/secrets/aws-sink-secret');

    fireEvent.change(secretInput, {
      target: { name: 'secretName', value: 'my-sink-secret' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        secretName: 'my-sink-secret'
      })
    );
  });

  it('updates code generation instructions in system_instructions property', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        system_instructions: 'Map payload into SendMessageRequest'
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsArea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(instructionsArea).toHaveValue('Map payload into SendMessageRequest');

    fireEvent.change(instructionsArea, {
      target: { value: 'Serialize order as JSON and set message deduplication ID' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Serialize order as JSON and set message deduplication ID'
      })
    );
  });

  it('requests aws queues via vscode.postMessage and updates datalist options on message events', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          authMode: 'secretManager' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<SqsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getAwsQueues' });

    // Simulate extension response event
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'awsQueuesLoaded',
            queues: ['https://sqs.us-east-1.amazonaws.com/123/sink-queue']
          }
        })
      );
    });

    // Check datalist options
    const queueDatalist = document.getElementById('sqs-sink-queue-options');
    expect(queueDatalist?.children.length).toBe(1);
    expect(queueDatalist?.children[0]).toHaveAttribute('value', 'https://sqs.us-east-1.amazonaws.com/123/sink-queue');
  });
});
