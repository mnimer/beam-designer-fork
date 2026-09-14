/**
 * Unit Tests for SnsIOSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates SnsIOSourceProperties form rendering, SQS vs Pub/Sub ingestion pattern switching,
 * IPC callbacks for GCP Secret Manager and Pub/Sub topics, input validation, and system instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SnsIOSourceProperties } from './SnsIO';

describe('SnsIOSourceProperties', () => {
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

  it('renders required Topic ARN and SQS Queue fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'SNS Source',
        properties: {}
      }
    };

    render(<SnsIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('arn:aws:sns:us-east-1:123456789012:my-topic')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://sqs.us-east-1.amazonaws.com/123456789012/my-queue')).toBeInTheDocument();
    expect(screen.getByText(/Source Topic ARN is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Queue URL is required for SQS Fan-Out mode/i)).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getTopics' });
  });

  it('validates ARN format warning', () => {
    const node = {
      data: {
        label: 'SNS Source',
        properties: {
          topicArn: 'invalid-arn'
        }
      }
    };

    render(<SnsIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByText(/Warning: Standard SNS topic ARNs start with "arn:aws"/i)).toBeInTheDocument();
  });

  it('updates topicArn and queueUrl when inputs change', () => {
    const node = {
      data: {
        label: 'SNS Source',
        properties: {}
      }
    };

    render(<SnsIOSourceProperties node={node} onChange={mockOnChange} />);

    const topicInput = screen.getByPlaceholderText('arn:aws:sns:us-east-1:123456789012:my-topic');
    fireEvent.change(topicInput, { target: { name: 'topicArn', value: 'arn:aws:sns:us-east-1:123456789012:my-topic' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      topicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic'
    });

    const queueInput = screen.getByPlaceholderText('https://sqs.us-east-1.amazonaws.com/123456789012/my-queue');
    fireEvent.change(queueInput, { target: { name: 'queueUrl', value: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue'
    });
  });

  it('switches to Pub/Sub bridge mode and loads topics from extension host', () => {
    const node = {
      data: {
        label: 'SNS Source',
        properties: {
          ingestionMode: 'pubsub' as const
        }
      }
    };

    render(<SnsIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
    expect(screen.getByText(/Pub\/Sub topic is required for Pub\/Sub Bridge mode/i)).toBeInTheDocument();

    // Simulate topicsLoaded event from extension
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'topicsLoaded',
        topics: ['projects/my-project/topics/sns-bridge-topic']
      }
    }));

    const option = document.querySelector('datalist#source-pubsub-topics option[value="projects/my-project/topics/sns-bridge-topic"]');
    expect(option).not.toBeNull();
  });

  it('toggles unwrapEnvelope checkbox and updates properties', () => {
    const node = {
      data: {
        label: 'SNS Source',
        properties: {
          unwrapEnvelope: true
        }
      }
    };

    render(<SnsIOSourceProperties node={node} onChange={mockOnChange} />);

    const checkbox = screen.getByLabelText(/Unwrap SNS Envelope/i);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      unwrapEnvelope: false
    }));
  });

  it('supports Secret Manager authentication mode in SQS ingestion', () => {
    const node = {
      data: {
        label: 'SNS Source',
        properties: {
          ingestionMode: 'sqs' as const,
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<SnsIOSourceProperties node={node} onChange={mockOnChange} />);

    const accessKeyInput = screen.getByPlaceholderText(/Access Key Secret/i);
    const secretKeyInput = screen.getByPlaceholderText(/Secret Key Secret/i);
    expect(accessKeyInput).toBeInTheDocument();
    expect(secretKeyInput).toBeInTheDocument();

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [{ id: 'my-aws-key', name: 'my-aws-key' }]
      }
    }));

    const secretOption = document.querySelector('datalist#source-secret-options option[value="my-aws-key"]');
    expect(secretOption).not.toBeNull();
  });

  it('toggles Advanced Source Settings and updates parameters', () => {
    const node = {
      data: {
        label: 'SNS Source',
        properties: {
          endpointOverride: 'http://localhost:4566',
          visibilityTimeout: 60,
          waitTimeSeconds: 15,
          maxNumRecords: 100,
          maxReadTime: 30
        }
      }
    };

    render(<SnsIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const endpointInput = screen.getByPlaceholderText('http://localhost:4566');
    expect(endpointInput).toHaveValue('http://localhost:4566');

    fireEvent.change(endpointInput, { target: { name: 'endpointOverride', value: 'http://custom:4566' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      endpointOverride: 'http://custom:4566'
    }));
  });

  it('updates system_instructions when textarea changes', () => {
    const node = {
      data: {
        label: 'SNS Source',
        properties: {
          system_instructions: 'Consume messages and convert to Avro'
        }
      }
    };

    render(<SnsIOSourceProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Parse JSON message body/i);
    expect(textarea).toHaveValue('Consume messages and convert to Avro');

    fireEvent.change(textarea, { target: { value: 'Updated prompt' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated prompt'
    }));
  });

  it('displays error when secrets loading fails in secret manager mode', () => {
    const node = {
      data: {
        label: 'SNS Source',
        properties: {
          ingestionMode: 'sqs' as const,
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<SnsIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        error: 'Failed to authenticate with GCP Secret Manager'
      }
    }));

    expect(screen.getByText('Failed to authenticate with GCP Secret Manager')).toBeInTheDocument();
  });

  it('displays error when pubsub topics loading fails in pubsub mode', () => {
    const node = {
      data: {
        label: 'SNS Source',
        properties: {
          ingestionMode: 'pubsub' as const,
          pubsubTopic: 'projects/my-project/topics/valid-topic'
        }
      }
    };

    render(<SnsIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'topicsLoaded',
        error: 'Failed to fetch Pub/Sub topics'
      }
    }));

    expect(screen.getByText('Failed to fetch Pub/Sub topics')).toBeInTheDocument();
  });
});

