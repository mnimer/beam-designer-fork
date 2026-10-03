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

  it('updates system_instructions when selecting contains with a property and value', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        properties: {
          compareTarget: 'Message Property' as const,
          property: 'recordValue',
          operator: '==' as const,
          value: 'ERROR'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<FilterProperties node={mockNode} onChange={mockOnChange} />);

    const opSelect = container.querySelector('#filterOperatorSelect') as HTMLSelectElement;
    fireEvent.change(opSelect, { target: { value: 'contains' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      compareTarget: 'Message Property',
      property: 'recordValue',
      operator: 'contains',
      value: 'ERROR',
      system_instructions: "Filter elements where message property 'recordValue' contains 'ERROR'."
    }));
  });

  it('updates system_instructions when selecting Compare Target Element and operator is not null', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        properties: {
          compareTarget: 'Element' as const,
          operator: '==' as const,
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<FilterProperties node={mockNode} onChange={mockOnChange} />);

    const opSelect = container.querySelector('#filterOperatorSelect') as HTMLSelectElement;
    fireEvent.change(opSelect, { target: { value: 'is not null' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      compareTarget: 'Element',
      operator: 'is not null',
      system_instructions: 'Filter out elements that are null.'
    }));
  });

  it('updates system_instructions when selecting operator is not empty for Element target', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        properties: {
          compareTarget: 'Element' as const,
          operator: '==' as const,
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<FilterProperties node={mockNode} onChange={mockOnChange} />);

    const opSelect = container.querySelector('#filterOperatorSelect') as HTMLSelectElement;
    fireEvent.change(opSelect, { target: { value: 'is not empty' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      compareTarget: 'Element',
      operator: 'is not empty',
      system_instructions: 'Filter out elements that are null or empty.'
    }));
  });

  it('does not render Property / Field Name input and shows no error when Compare Target is Element', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        properties: {
          compareTarget: 'Element' as const,
          property: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<FilterProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('#filterPropertyInput')).toBeNull();
    expect(screen.queryByText('Property / Field Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Property name is required.')).not.toBeInTheDocument();
  });

  it('does not render Target Value input when operator is is not null or is not empty', () => {
    const mockNodeNotNull = {
      data: {
        label: 'Filter',
        properties: {
          operator: 'is not null' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container, rerender } = render(<FilterProperties node={mockNodeNotNull} onChange={mockOnChange} />);

    expect(container.querySelector('#filterValueInput')).toBeNull();
    expect(screen.queryByText('Target Value')).not.toBeInTheDocument();

    const mockNodeNotEmpty = {
      data: {
        label: 'Filter',
        properties: {
          operator: 'is not empty' as const
        }
      }
    };
    rerender(<FilterProperties node={mockNodeNotEmpty} onChange={mockOnChange} />);

    expect(container.querySelector('#filterValueInput')).toBeNull();
    expect(screen.queryByText('Target Value')).not.toBeInTheDocument();
  });

  it('renders FilterProperties via PropertyForm for Filter node', async () => {
    const mockNode = {
      data: {
        label: 'Filter',
        beam_transform: 'Filter',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(await screen.findByText('Compare Target')).toBeInTheDocument();
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

  it('handles Element comparisons for unary and binary operators', () => {
    expect(generateFilterSystemInstruction('Element', '', 'is not null', '')).toBe(
      'Filter out elements that are null.'
    );
    expect(generateFilterSystemInstruction('Element', '', 'is not empty', '')).toBe(
      'Filter out elements that are null or empty.'
    );
    expect(generateFilterSystemInstruction('Element', '', '==', 'active')).toBe(
      "Filter elements where the element == 'active'."
    );
    expect(generateFilterSystemInstruction('Element', '', 'contains', 'ERROR')).toBe(
      "Filter elements where the element contains 'ERROR'."
    );
    expect(generateFilterSystemInstruction('Element', '', '!=', '')).toBe(
      'Filter elements where the element != value.'
    );
  });

  it('handles contains, is not null, and is not empty for Message Property and Header Property', () => {
    expect(generateFilterSystemInstruction('Message Property', 'status', 'contains', 'ERR')).toBe(
      "Filter elements where message property 'status' contains 'ERR'."
    );
    expect(generateFilterSystemInstruction('Header Property', 'env', 'contains', 'prod')).toBe(
      "Filter elements where message header 'env' contains 'prod'."
    );
    expect(generateFilterSystemInstruction('Message Property', 'record', 'is not null', '')).toBe(
      "Filter elements where message property 'record' is not null."
    );
    expect(generateFilterSystemInstruction('Header Property', 'token', 'is not null', '')).toBe(
      "Filter elements where message header 'token' is not null."
    );
    expect(generateFilterSystemInstruction('Message Property', 'event', 'is not empty', '')).toBe(
      "Filter elements where message property 'event' is not null or empty."
    );
    expect(generateFilterSystemInstruction('Header Property', 'tags', 'is not empty', '')).toBe(
      "Filter elements where message header 'tags' is not null or empty."
    );
  });

  it('regression: original operators generate byte-identical instruction strings', () => {
    expect(generateFilterSystemInstruction('Message Property', '', '==', '')).toBe(
      'Create a custom function with a todo comment and return true.'
    );
    expect(generateFilterSystemInstruction('Message Property', 'field', '==', 'foo')).toBe(
      "Filter elements where message property 'field' == 'foo'."
    );
    expect(generateFilterSystemInstruction('Message Property', 'field', '!=', 'foo')).toBe(
      "Filter elements where message property 'field' != 'foo'."
    );
    expect(generateFilterSystemInstruction('Message Property', 'field', '>', '10')).toBe(
      "Filter elements where message property 'field' > '10'."
    );
    expect(generateFilterSystemInstruction('Message Property', 'field', '<', '10')).toBe(
      "Filter elements where message property 'field' < '10'."
    );
    expect(generateFilterSystemInstruction('Message Property', 'field', '==', '')).toBe(
      "Filter elements where message property 'field' == value."
    );
    expect(generateFilterSystemInstruction('Header Property', 'field', '!=', '')).toBe(
      "Filter elements where message header 'field' != value."
    );
    expect(generateFilterSystemInstruction('Header Property', 'field', '>', '5')).toBe(
      "Filter elements where message header 'field' > '5'."
    );
    expect(generateFilterSystemInstruction('Header Property', 'field', '<', '5')).toBe(
      "Filter elements where message header 'field' < '5'."
    );
  });
});
