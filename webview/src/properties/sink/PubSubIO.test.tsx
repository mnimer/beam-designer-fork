import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PubSubSinkProperties } from './PubSubIO';

describe('PubSubSinkProperties', () => {
  it('renders only topic input and no subscription', () => {
    const mockNode = {
      data: {
        properties: {
          topic: 'test-topic-sink'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PubSubSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('projects/my-project/subscriptions/my-sub')).not.toBeInTheDocument();

    // Check hints
    expect(screen.getByText('Sample: projects/my-project/topics/my-topic')).toBeInTheDocument();

    // Check values
    expect(screen.getByDisplayValue('test-topic-sink')).toBeInTheDocument();
  });

  it('calls onChange when topic input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PubSubSinkProperties node={mockNode} onChange={mockOnChange} />);

    const topicInput = screen.getByPlaceholderText('projects/my-project/topics/my-topic');
    fireEvent.change(topicInput, { target: { value: 'new-topic-sink' } });

    expect(mockOnChange).toHaveBeenCalledWith({ topic: 'new-topic-sink' });
  });
});
