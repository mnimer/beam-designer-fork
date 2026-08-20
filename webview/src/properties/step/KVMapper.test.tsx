import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KVMapperProperties } from './KVMapper';

describe('KVMapperProperties', () => {
  it('renders input field for keyPropertyName and shows required validation when empty', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<KVMapperProperties node={mockNode} onChange={mockOnChange} />);

    const input = container.querySelector('#kvKeyPropertyName') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Key Property Name is required/i)).toBeInTheDocument();
  });

  it('renders keyPropertyName from properties without error message', () => {
    const mockNode = {
      data: {
        properties: {
          keyPropertyName: 'userId'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<KVMapperProperties node={mockNode} onChange={mockOnChange} />);

    const input = container.querySelector('#kvKeyPropertyName') as HTMLInputElement;
    expect(input).toHaveValue('userId');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText(/Key Property Name is required/i)).not.toBeInTheDocument();
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

    const { container } = render(<KVMapperProperties node={mockNode} onChange={mockOnChange} />);

    const input = container.querySelector('#kvKeyPropertyName') as HTMLInputElement;
    fireEvent.change(input, { target: { name: 'keyPropertyName', value: 'productId' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      keyPropertyName: 'productId'
    }));
  });
});
