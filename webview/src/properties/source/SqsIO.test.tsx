/**
 * SqsIOSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating SqsIOSourceProperties component functionality,
 * form change callbacks, validation states, authentication modes,
 * and code generation instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SqsIOSourceProperties } from './SqsIO';

describe('SqsIOSourceProperties', () => {
  let originalVscode: any;

  beforeEach(() => {
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders default fields with documentation tooltips and placeholders', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('input[name="queueUrl"]')).toBeInTheDocument();
    expect(container.querySelector('select[name="awsRegion"]')).toBeInTheDocument();
    expect(container.querySelector('select[name="authMode"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="endpointUrl"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="maxNumRecords"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="maxReadTime"]')).toBeInTheDocument();
    expect(container.querySelector('textarea')).toBeInTheDocument();
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

    const { container } = render(<SqsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const queueInput = container.querySelector('input[name="queueUrl"]');
    expect(queueInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks Queue URL as valid when provided and triggers onChange on edits', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-test-queue'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const queueInput = container.querySelector('input[name="queueUrl"]') as HTMLInputElement;
    expect(queueInput).toHaveAttribute('aria-invalid', 'false');
    expect(queueInput).toHaveValue('https://sqs.us-east-1.amazonaws.com/123456789012/my-test-queue');

    fireEvent.change(queueInput, {
      target: { name: 'queueUrl', value: 'https://sqs.us-west-2.amazonaws.com/123456789012/updated-queue' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        queueUrl: 'https://sqs.us-west-2.amazonaws.com/123456789012/updated-queue'
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

    const { container } = render(<SqsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

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

  it('renders Secret Manager input when authMode is secretManager', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          authMode: 'secretManager' as const,
          secretName: 'projects/123/secrets/aws-creds'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const secretInput = container.querySelector('input[name="secretName"]') as HTMLInputElement;
    expect(secretInput).toBeInTheDocument();
    expect(secretInput).toHaveValue('projects/123/secrets/aws-creds');

    fireEvent.change(secretInput, {
      target: { name: 'secretName', value: 'my-sqs-secret' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        secretName: 'my-sqs-secret'
      })
    );
  });

  it('updates bounded read limits (maxNumRecords and maxReadTime)', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        properties: {
          maxNumRecords: 500,
          maxReadTime: 30
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const recordsInput = container.querySelector('input[name="maxNumRecords"]') as HTMLInputElement;
    const timeInput = container.querySelector('input[name="maxReadTime"]') as HTMLInputElement;

    expect(recordsInput).toHaveValue(500);
    expect(timeInput).toHaveValue(30);

    fireEvent.change(recordsInput, { target: { name: 'maxNumRecords', value: '2000' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxNumRecords: '2000' })
    );

    fireEvent.change(timeInput, { target: { name: 'maxReadTime', value: '120' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxReadTime: '120' })
    );
  });

  it('updates code generation instructions in system_instructions property', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        system_instructions: 'Extract body string and parse with Jackson'
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<SqsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsArea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(instructionsArea).toHaveValue('Extract body string and parse with Jackson');

    fireEvent.change(instructionsArea, {
      target: { value: 'Parse body as JSON and filter invalid records' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Parse body as JSON and filter invalid records'
      })
    );
  });

});
