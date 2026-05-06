
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WindowingProperties } from './Windowing';

describe('WindowingProperties', () => {
  it('renders window type select and duration input', () => {
    const mockNode = {
      data: {
        properties: {
          windowType: 'Sliding Window',
          duration: '120'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<WindowingProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('Sliding Window')).toBeInTheDocument();
    expect(screen.getByDisplayValue('120')).toBeInTheDocument();
  });

  it('calls onChange when duration input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<WindowingProperties node={mockNode} onChange={mockOnChange} />);

    // Default duration is '60'
    const durationInput = screen.getByDisplayValue('60');
    fireEvent.change(durationInput, { target: { value: '30' } });

    expect(mockOnChange).toHaveBeenCalledWith({ duration: '30' });
  });

  it('calls onChange when windowType changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<WindowingProperties node={mockNode} onChange={mockOnChange} />);

    // Default windowType is 'Fixed Window'
    const select = screen.getByDisplayValue('Fixed Window');
    fireEvent.change(select, { target: { value: 'Session Window' } });

    expect(mockOnChange).toHaveBeenCalledWith({ windowType: 'Session Window' });
  });
});
