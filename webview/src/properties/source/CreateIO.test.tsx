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

  it('displays required validation error when all elements are empty', () => {
    const mockNode = {
      data: {
        properties: {
          elements: ['   ']
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<CreateProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('At least one non-empty element is required.')).toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode = {
      data: {
        properties: {
          elements: ['item 1'],
          system_instructions: 'Initial instructions'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<CreateProperties node={mockNode} onChange={mockOnChange} />);

    const instructions = container.querySelector('#createSystemInstructions') as HTMLTextAreaElement;
    expect(instructions).toHaveValue('Initial instructions');

    fireEvent.change(instructions, { target: { value: 'Updated prompt instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated prompt instructions'
    }));
  });

  it('handles JSON string in properties.elements without crashing (e.g. avro-sink.beam)', () => {
    const mockNode = {
      id: 'source-1',
      data: {
        label: 'Create',
        type: 'SOURCE',
        iconName: 'Box',
        beam_transform: 'Create',
        properties: {
          elements: '["{\\"id\\": 1, \\\"name\\\": \\\"alpha\\\", \\\"score\\\": 99.5}", "{\\"id\\": 2, \\\"name\\\": \\\"beta\\\", \\\"score\\\": 88.0}"]'
        },
        system_instructions: 'In-memory test batch records.'
      }
    };
    const mockOnChange = vi.fn();

    render(<CreateProperties node={mockNode} onChange={mockOnChange} />);

    const textareas = screen.getAllByPlaceholderText(/Element \d/);
    expect(textareas).toHaveLength(2);
    expect(textareas[0]).toHaveValue('{"id": 1, "name": "alpha", "score": 99.5}');
    expect(textareas[1]).toHaveValue('{"id": 2, "name": "beta", "score": 88.0}');
    expect(screen.queryByText('At least one non-empty element is required.')).not.toBeInTheDocument();
  });

  it('handles array of objects or numbers without crashing', () => {
    const mockNode = {
      data: {
        properties: {
          elements: [{ id: 1, name: 'Alice' }, 42]
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<CreateProperties node={mockNode} onChange={mockOnChange} />);

    const textareas = screen.getAllByPlaceholderText(/Element \d/);
    expect(textareas).toHaveLength(2);
    expect(textareas[0]).toHaveValue('{"id":1,"name":"Alice"}');
    expect(textareas[1]).toHaveValue('42');
  });

  it('handles single string element or undefined elements gracefully', () => {
    const mockNode = {
      data: {
        properties: {
          elements: 'single record string'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<CreateProperties node={mockNode} onChange={mockOnChange} />);

    const textareas = screen.getAllByPlaceholderText(/Element \d/);
    expect(textareas).toHaveLength(1);
    expect(textareas[0]).toHaveValue('single record string');
  });
});
