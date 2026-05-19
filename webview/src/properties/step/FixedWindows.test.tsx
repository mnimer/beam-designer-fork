import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FixedWindowsProperties } from './FixedWindows';

describe('FixedWindowsProperties', () => {
  it('renders duration input with default value if not specified', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<FixedWindowsProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
  });

  it('renders duration input with provided value', () => {
    const mockNode = {
      data: {
        properties: {
          duration: '120'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<FixedWindowsProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('120')).toBeInTheDocument();
  });

  it('calls onChange when duration input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<FixedWindowsProperties node={mockNode} onChange={mockOnChange} />);

    const durationInput = screen.getByDisplayValue('60');
    fireEvent.change(durationInput, { target: { value: '30' } });

    expect(mockOnChange).toHaveBeenCalledWith({ duration: '30' });
  });
});
