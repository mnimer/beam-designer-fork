import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CreateProperties } from './CreateIO';

describe('CreateProperties', () => {
  it('renders inputs for multiple elements', () => {
    const mockNode = {
      data: {
        properties: {
          elements: ['first element', 'second element\nwith newline']
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<CreateProperties node={mockNode} onChange={mockOnChange} />);

    const textareas = screen.getAllByPlaceholderText(/Element \d/);
    expect(textareas).toHaveLength(2);
    expect(textareas[0]).toHaveValue('first element');
    expect(textareas[1]).toHaveValue('second element\nwith newline');
    expect(screen.getByText('In-Memory Elements')).toBeInTheDocument();
  });

  it('allows adding a new element', () => {
    const mockNode = {
      data: {
        properties: {
          elements: ['one']
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<CreateProperties node={mockNode} onChange={mockOnChange} />);

    const addButton = screen.getByRole('button', { name: /add item/i });
    fireEvent.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith({ elements: ['one', ''] });
  });

  it('allows removing an element', () => {
    const mockNode = {
      data: {
        properties: {
          elements: ['one', 'two']
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<CreateProperties node={mockNode} onChange={mockOnChange} />);

    const deleteButtons = screen.getAllByTitle('Remove Element');
    fireEvent.click(deleteButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith({ elements: ['two'] });
  });

  it('allows changing an element value', () => {
    const mockNode = {
      data: {
        properties: {
          elements: ['one']
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<CreateProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = screen.getByDisplayValue('one');
    fireEvent.change(textarea, { target: { value: 'updated one' } });

    expect(mockOnChange).toHaveBeenCalledWith({ elements: ['updated one'] });
  });
});
