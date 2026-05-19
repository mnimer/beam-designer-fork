import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserWindowsProperties } from './UserWindows';

describe('UserWindowsProperties', () => {
  it('renders windowFn input with default value if not specified', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<UserWindowsProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('beam.window.GlobalWindows()')).toBeInTheDocument();
  });

  it('renders windowFn input with provided value', () => {
    const mockNode = {
      data: {
        properties: {
          windowFn: 'beam.window.Sessions(10)'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<UserWindowsProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('beam.window.Sessions(10)')).toBeInTheDocument();
  });

  it('calls onChange when windowFn input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<UserWindowsProperties node={mockNode} onChange={mockOnChange} />);

    const windowFnInput = screen.getByDisplayValue('beam.window.GlobalWindows()');
    fireEvent.change(windowFnInput, { target: { value: 'beam.window.FixedWindows(5)' } });

    expect(mockOnChange).toHaveBeenCalledWith({ windowFn: 'beam.window.FixedWindows(5)' });
  });
});
