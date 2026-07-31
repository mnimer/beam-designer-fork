import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KVMapperProperties } from './KVMapper';

describe('KVMapperProperties', () => {
  it('renders input field for keyPropertyName and defaults to empty', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<KVMapperProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Key Property Name')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('e.g. id');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('renders keyPropertyName from properties', () => {
    const mockNode = {
      data: {
        properties: {
          keyPropertyName: 'userId'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KVMapperProperties node={mockNode} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('e.g. id');
    expect(input).toHaveValue('userId');
  });

  it('calls onChange callback when input changes', () => {
    const mockNode = {
      data: {
        properties: {
          keyPropertyName: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KVMapperProperties node={mockNode} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('e.g. id');
    fireEvent.change(input, { target: { name: 'keyPropertyName', value: 'productId' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      keyPropertyName: 'productId'
    });
  });
});
