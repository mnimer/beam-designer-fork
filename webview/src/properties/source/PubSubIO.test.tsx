import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PubSubProperties } from './PubSubIO';

describe('PubSubProperties', () => {
  it('renders topic and subscription inputs', () => {
    const mockNode = {
      data: {
        properties: {
          topic: 'test-topic',
          subscription: 'test-sub'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PubSubProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('projects/my-project/subscriptions/my-sub')).toBeInTheDocument();

    // Check hints
    expect(screen.getByText('Sample: projects/my-project/topics/my-topic')).toBeInTheDocument();
    expect(screen.getByText('Sample: projects/my-project/subscriptions/my-sub')).toBeInTheDocument();

    // Check values
    expect(screen.getByDisplayValue('test-topic')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-sub')).toBeInTheDocument();
  });

  it('calls onChange when inputs change', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PubSubProperties node={mockNode} onChange={mockOnChange} />);

    const topicInput = screen.getByPlaceholderText('projects/my-project/topics/my-topic');
    fireEvent.change(topicInput, { target: { value: 'new-topic' } });

    expect(mockOnChange).toHaveBeenCalledWith({ topic: 'new-topic' });
  });
  it('renders output format select and calls onChange', () => {
    const mockNode = {
      data: {
        properties: {
          outputFormat: 'JSON'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PubSubProperties node={mockNode} onChange={mockOnChange} />);

    const select = screen.getByLabelText('Output Format');
    expect(select).toBeInTheDocument();
    expect(screen.getByDisplayValue('JSON')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'String' } });
    expect(mockOnChange).toHaveBeenCalledWith({ outputFormat: 'String' });
  });
});
