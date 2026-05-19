import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SlidingWindowsProperties } from './SlidingWindows';

describe('SlidingWindowsProperties', () => {
  it('renders size and period inputs with default values if not specified', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<SlidingWindowsProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  });

  it('renders size and period inputs with provided values', () => {
    const mockNode = {
      data: {
        properties: {
          size: '120',
          period: '45'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<SlidingWindowsProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('120')).toBeInTheDocument();
    expect(screen.getByDisplayValue('45')).toBeInTheDocument();
  });

  it('calls onChange when size input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<SlidingWindowsProperties node={mockNode} onChange={mockOnChange} />);

    const sizeInput = screen.getByDisplayValue('60');
    fireEvent.change(sizeInput, { target: { value: '90' } });

    expect(mockOnChange).toHaveBeenCalledWith({ size: '90' });
  });

  it('calls onChange when period input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<SlidingWindowsProperties node={mockNode} onChange={mockOnChange} />);

    const periodInput = screen.getByDisplayValue('30');
    fireEvent.change(periodInput, { target: { value: '15' } });

    expect(mockOnChange).toHaveBeenCalledWith({ period: '15' });
  });
});
