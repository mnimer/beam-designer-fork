import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FilterProperties, generateFilterSystemInstruction } from './Filter';
import { PropertyForm } from '../../components/PropertyForm';

describe('FilterProperties', () => {
  it('renders Compare dropdown, Property, Op, Value fields, and system instructions', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<FilterProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Compare Target')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Message Property')).toBeInTheDocument();

    expect(container.querySelector('#filterPropertyInput')).toBeInTheDocument();
    expect(screen.getByDisplayValue('==')).toBeInTheDocument();
    expect(container.querySelector('#filterValueInput')).toBeInTheDocument();

    expect(container.querySelector('#filterSystemInstructions')).toBeInTheDocument();
  });

  it('updates system_instructions when property, operator, and value change', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<FilterProperties node={mockNode} onChange={mockOnChange} />);

    const propInput = container.querySelector('#filterPropertyInput') as HTMLInputElement;
    fireEvent.change(propInput, { target: { value: 'status' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      compareTarget: 'Message Property',
      property: 'status',
      operator: '==',
      value: '',
      system_instructions: "Filter elements where message property 'status' == value."
    }));
  });

  it('updates system_instructions for Header Property comparison', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        properties: {
          compareTarget: 'Header Property' as const,
          property: 'header_id',
          operator: '!=' as const,
          value: '100'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<FilterProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('Header Property')).toBeInTheDocument();
    expect(container.querySelector('#filterPropertyInput')).toHaveValue('header_id');
    expect(screen.getByDisplayValue('!=')).toBeInTheDocument();
    expect(container.querySelector('#filterValueInput')).toHaveValue('100');
  });

  it('renders FilterProperties via PropertyForm for Filter node', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        beam_transform: 'Filter',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Compare Target')).toBeInTheDocument();
  });
});

describe('generateFilterSystemInstruction', () => {
  it('generates correct filter system instruction formats', () => {
    expect(generateFilterSystemInstruction('Message Property', '', '==', '')).toBe(
      'Create a custom function with a todo comment and return true.'
    );
    expect(generateFilterSystemInstruction('Message Property', 'age', '>', '18')).toBe(
      "Filter elements where message property 'age' > '18'."
    );
    expect(generateFilterSystemInstruction('Header Property', 'token', '!=', 'secret')).toBe(
      "Filter elements where message header 'token' != 'secret'."
    );
  });
});
