import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PubSubSinkProperties } from './PubSubIO';

describe('PubSubSinkProperties', () => {
  it('renders topic input and required error state when empty', () => {
    const mockNode = {
      data: {
        properties: {
          topic: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<PubSubSinkProperties node={mockNode} onChange={mockOnChange} />);

    const topicInput = container.querySelector('#pubsubSinkTopic') as HTMLInputElement;
    expect(topicInput).toBeInTheDocument();
    expect(topicInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Topic is required/i)).toBeInTheDocument();
  });

  it('renders provided topic value without error message', () => {
    const mockNode = {
      data: {
        properties: {
          topic: 'projects/my-project/topics/my-sink-topic'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<PubSubSinkProperties node={mockNode} onChange={mockOnChange} />);

    const topicInput = container.querySelector('#pubsubSinkTopic') as HTMLInputElement;
    expect(topicInput).toHaveValue('projects/my-project/topics/my-sink-topic');
    expect(topicInput).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText(/Topic is required/i)).not.toBeInTheDocument();
  });

  it('calls onChange when topic input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<PubSubSinkProperties node={mockNode} onChange={mockOnChange} />);

    const topicInput = container.querySelector('#pubsubSinkTopic') as HTMLInputElement;
    fireEvent.change(topicInput, { target: { value: 'new-topic-sink' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ topic: 'new-topic-sink' }));
  });
});
