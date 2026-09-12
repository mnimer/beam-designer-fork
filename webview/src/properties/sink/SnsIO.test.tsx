/**
 * Unit Tests for SnsIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates form rendering, ARN validation warnings, AWS region selection,
 * Secret Manager integration callback, advanced client configuration accordion,
 * and system_instructions propagation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SnsIOSinkProperties } from './SnsIO';

describe('SnsIOSinkProperties', () => {
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

  it('renders required Topic ARN field and displays validation alert when empty', () => {
    const node = {
      data: {
        label: 'SNS Sink',
        properties: {}
      }
    };

    render(<SnsIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByRole('textbox', { name: /^Topic ARN/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Topic ARN is required for SnsIO.write\(\)/i);
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('validates ARN prefix and shows warning if it does not start with arn:aws', () => {
    const node = {
      data: {
        label: 'SNS Sink',
        properties: {
          topicArn: 'invalid-arn-format'
        }
      }
    };

    render(<SnsIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Warning: Standard SNS topic ARNs start with "arn:aws"/i);
  });

  it('triggers onChange when updating Topic ARN', () => {
    const node = {
      data: {
        label: 'SNS Sink',
        properties: {}
      }
    };

    render(<SnsIOSinkProperties node={node} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('arn:aws:sns:us-east-1:123456789012:my-topic');
    fireEvent.change(input, { target: { name: 'topicArn', value: 'arn:aws:sns:us-east-1:123456789012:my-topic' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      topicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic'
    });
  });

  it('handles AWS region selection and custom region input', () => {
    const node = {
      data: {
        label: 'SNS Sink',
        properties: {
          awsRegion: 'custom',
          customRegion: 'me-central-1'
        }
      }
    };

    render(<SnsIOSinkProperties node={node} onChange={mockOnChange} />);

    const select = screen.getByRole('combobox', { name: /^AWS Region/i });
    expect(select).toHaveValue('custom');

    const customInput = screen.getByPlaceholderText('e.g. me-central-1');
    expect(customInput).toHaveValue('me-central-1');

    fireEvent.change(customInput, { target: { name: 'customRegion', value: 'af-south-1' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      customRegion: 'af-south-1'
    }));
  });

  it('renders Secret Manager credential selectors when authMode is secret_manager', () => {
    const node = {
      data: {
        label: 'SNS Sink',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<SnsIOSinkProperties node={node} onChange={mockOnChange} />);

    const accessKeyInput = screen.getByPlaceholderText('e.g. aws-access-key-id');
    const secretKeyInput = screen.getByPlaceholderText('e.g. aws-secret-access-key');
    expect(accessKeyInput).toBeInTheDocument();
    expect(secretKeyInput).toBeInTheDocument();

    // Simulate extension response
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [
          { id: 'aws-access-key-id', name: 'aws-access-key-id' },
          { id: 'aws-secret-access-key', name: 'aws-secret-access-key' }
        ]
      }
    }));

    const datalist = document.querySelector('datalist#secret-options');
    expect(datalist).not.toBeNull();
    const option = datalist?.querySelector('option[value="aws-access-key-id"]');
    expect(option).not.toBeNull();
  });

  it('updates subject and messageStructure options', () => {
    const node = {
      data: {
        label: 'SNS Sink',
        properties: {
          subject: 'Batch Event',
          messageStructure: 'json' as const
        }
      }
    };

    render(<SnsIOSinkProperties node={node} onChange={mockOnChange} />);

    const subjectInput = screen.getByPlaceholderText('e.g. Pipeline Notification');
    expect(subjectInput).toHaveValue('Batch Event');

    fireEvent.change(subjectInput, { target: { name: 'subject', value: 'Updated Subject' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Updated Subject'
    }));

    const jsonRadio = screen.getByLabelText(/JSON \(Protocol Payloads\)/i);
    fireEvent.click(jsonRadio);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      messageStructure: 'json'
    }));
  });

  it('expands Advanced Client Configuration accordion and updates retry and endpoint parameters', () => {
    const node = {
      data: {
        label: 'SNS Sink',
        properties: {
          endpointOverride: 'http://localhost:4566',
          maxRetries: 5,
          requestTimeoutMs: 10000
        }
      }
    };

    render(<SnsIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Client Configuration/i });
    fireEvent.click(advancedButton);

    const endpointInput = screen.getByPlaceholderText('http://localhost:4566');
    expect(endpointInput).toHaveValue('http://localhost:4566');

    fireEvent.change(endpointInput, { target: { name: 'endpointOverride', value: 'http://localstack:4566' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      endpointOverride: 'http://localstack:4566'
    }));
  });

  it('updates system_instructions when editing instructions textarea', () => {
    const node = {
      data: {
        label: 'SNS Sink',
        properties: {
          system_instructions: 'Publish JSON payload with custom attributes'
        }
      }
    };

    render(<SnsIOSinkProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Map incoming PCollection elements/i);
    expect(textarea).toHaveValue('Publish JSON payload with custom attributes');

    fireEvent.change(textarea, { target: { value: 'New prompt instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New prompt instructions'
    }));
  });
});
