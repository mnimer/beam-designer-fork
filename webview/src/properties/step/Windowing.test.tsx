import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WindowingProperties } from './Windowing';

describe('WindowingProperties', () => {
  it('renders dropdown with Fixed Window, Sliding Window, and Session Window options', () => {
    const mockNode = {
      id: 'window-node-id',
      data: {
        properties: {
          windowType: 'Fixed Window' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<WindowingProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Fixed Window')).toBeInTheDocument();
    expect(screen.getByText('Sliding Window')).toBeInTheDocument();
    expect(screen.getByText('Session Window')).toBeInTheDocument();
  });

  it('renders Fixed Window properties correctly and handles changes', () => {
    const mockNode = {
      id: 'window-node-id',
      data: {
        properties: {
          windowType: 'Fixed Window' as const,
          fixedDuration: '120',
          fixedDurationUnit: 'Minutes' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<WindowingProperties node={mockNode} onChange={mockOnChange} />);

    const durationInput = screen.getByDisplayValue('120');
    const unitSelect = screen.getByDisplayValue('Minutes');

    expect(durationInput).toBeInTheDocument();
    expect(unitSelect).toBeInTheDocument();

    fireEvent.change(durationInput, { target: { name: 'fixedDuration', value: '150' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      fixedDuration: '150'
    }));
  });

  it('renders Sliding Window properties correctly and handles changes', () => {
    const mockNode = {
      id: 'window-node-id',
      data: {
        properties: {
          windowType: 'Sliding Window' as const,
          slidingDuration: '600',
          slidingPeriod: '300',
          slidingOffset: '60'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<WindowingProperties node={mockNode} onChange={mockOnChange} />);

    const durationInput = screen.getByDisplayValue('600');
    const periodInput = screen.getByDisplayValue('300');
    const offsetInput = screen.getByDisplayValue('60');

    expect(durationInput).toBeInTheDocument();
    expect(periodInput).toBeInTheDocument();
    expect(offsetInput).toBeInTheDocument();
    expect(screen.getByText(/Example of a 10-minute window/i)).toBeInTheDocument();

    fireEvent.change(periodInput, { target: { name: 'slidingPeriod', value: '150' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      slidingPeriod: '150'
    }));
  });

  it('renders Session Window properties correctly and handles changes', () => {
    const mockNode = {
      id: 'window-node-id',
      data: {
        properties: {
          windowType: 'Session Window' as const,
          sessionGapDuration: '45',
          sessionGapDurationUnit: 'Minutes' as const
        }
      }
    };
    const mockOnChange = vi.fn();
    const mockOnAddKVMapper = vi.fn();

    render(<WindowingProperties node={mockNode} onChange={mockOnChange} onAddKVMapper={mockOnAddKVMapper} />);

    const gapInput = screen.getByDisplayValue('45');
    const unitSelect = screen.getByDisplayValue('Minutes');

    expect(gapInput).toBeInTheDocument();
    expect(unitSelect).toBeInTheDocument();
    expect(screen.getByText('This option requires a KV Input value.')).toBeInTheDocument();
    
    const addKVMapperBtn = screen.getByRole('button', { name: 'Add KV Mapper' });
    expect(addKVMapperBtn).toBeInTheDocument();
    
    fireEvent.click(addKVMapperBtn);
    expect(mockOnAddKVMapper).toHaveBeenCalled();

    fireEvent.change(gapInput, { target: { name: 'sessionGapDuration', value: '10' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      sessionGapDuration: '10'
    }));
  });
});
