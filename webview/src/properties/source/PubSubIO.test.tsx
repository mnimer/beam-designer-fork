import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PubSubProperties } from './PubSubIO';

describe('PubSubProperties', () => {
  it('renders topic and subscription inputs', () => {
    const mockNode = {
      data: {
        properties: {
          topic: 'projects/my-project/topics/test-topic',
          subscription: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PubSubProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('projects/my-project/subscriptions/my-sub')).toBeInTheDocument();

    // Check values
    expect(screen.getByDisplayValue('projects/my-project/topics/test-topic')).toBeInTheDocument();

    // Verify warning banner is NOT shown when topic is provided
    expect(screen.queryByText(/Either a Topic or a Subscription is required/i)).not.toBeInTheDocument();
  });

  it('shows warning banner and invalid inputs when both topic and subscription are empty', () => {
    const mockNode = {
      data: {
        properties: {
          topic: '',
          subscription: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PubSubProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Either a Topic or a Subscription is required/i)).toBeInTheDocument();
    const topicInput = screen.getByPlaceholderText('projects/my-project/topics/my-topic');
    expect(topicInput).toHaveAttribute('aria-invalid', 'true');
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
    fireEvent.change(topicInput, { target: { value: 'projects/p/topics/t' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ topic: 'projects/p/topics/t' }));
  });

  it('surfaces topicsLoaded and subscriptionsLoaded errors inline in picker (M6)', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PubSubProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'topicsLoaded',
            topics: [],
            error: 'Failed to list topics: PERMISSION_DENIED'
          }
        })
      );
    });

    expect(screen.getByText('Failed to list topics: PERMISSION_DENIED')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'subscriptionsLoaded',
            subscriptions: [],
            error: 'Failed to list subscriptions: API not enabled'
          }
        })
      );
    });

    expect(screen.getByText('Failed to list subscriptions: API not enabled')).toBeInTheDocument();
  });
});
