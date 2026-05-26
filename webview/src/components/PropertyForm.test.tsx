
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PropertyForm } from './PropertyForm';

describe('PropertyForm', () => {
  it('renders PubSubProperties when label contains PubSub', () => {
    const mockNode = {
      data: {
        label: 'PubSub Source',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
  });

  it('renders BigQueryProperties when label contains BigQuery', () => {
    const mockNode = {
      data: {
        label: 'BigQuery Sink',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my_table')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label contains Windowing', () => {
    const mockNode = {
      data: {
        label: 'Windowing Step',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
  });

  it('renders generic message for unknown label', () => {
    const mockNode = {
      data: {
        label: 'Unknown Node',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Generic properties for Unknown Node')).toBeInTheDocument();
  });
  it('renders ParseMessageProperties when label is Parse Message', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Message Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('JSON')).toBeInTheDocument();
    expect(screen.getByText('Parse PubSub JSON message and convert it to a dictionary (Dict) format.')).toBeInTheDocument();
  });

  it('renders appropriate helper text based on messageType property', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {
          messageType: 'Base64' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('Base64')).toBeInTheDocument();
    expect(screen.getByText('Decode PubSub Message and decode Base64 bytes.')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label is Fixed Windows', () => {
    const mockNode = {
      data: {
        label: 'Fixed Windows',
        properties: {
          windowType: 'Fixed Window' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Window Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fixed Window')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label is Sliding Windows', () => {
    const mockNode = {
      data: {
        label: 'Sliding Windows',
        properties: {
          windowType: 'Sliding Window' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Window Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sliding Window')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label is User Windows', () => {
    const mockNode = {
      data: {
        label: 'User Windows',
        properties: {
          windowType: 'User Window' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Window Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('User Window')).toBeInTheDocument();
  });
});
