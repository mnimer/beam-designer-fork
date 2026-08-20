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

    const { container } = render(<WindowingProperties node={mockNode} onChange={mockOnChange} />);

    const select = container.querySelector('#windowTypeSelect') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Fixed Window' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sliding Window' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Session Window' })).toBeInTheDocument();
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

    const { container } = render(<WindowingProperties node={mockNode} onChange={mockOnChange} />);

    const durationInput = container.querySelector('#fixedDurationInput') as HTMLInputElement;
    const unitSelect = container.querySelector('#fixedDurationUnitSelect') as HTMLSelectElement;

    expect(durationInput).toHaveValue(120);
    expect(unitSelect).toHaveValue('Minutes');

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

    const { container } = render(<WindowingProperties node={mockNode} onChange={mockOnChange} />);

    const durationInput = container.querySelector('#slidingDurationInput') as HTMLInputElement;
    const periodInput = container.querySelector('#slidingPeriodInput') as HTMLInputElement;
    const offsetInput = container.querySelector('#slidingOffsetInput') as HTMLInputElement;

    expect(durationInput).toHaveValue(600);
    expect(periodInput).toHaveValue(300);
    expect(offsetInput).toHaveValue(60);
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

    const { container } = render(<WindowingProperties node={mockNode} onChange={mockOnChange} onAddKVMapper={mockOnAddKVMapper} />);

    const gapInput = container.querySelector('#sessionGapDurationInput') as HTMLInputElement;
    const unitSelect = container.querySelector('#sessionGapDurationUnitSelect') as HTMLSelectElement;

    expect(gapInput).toHaveValue(45);
    expect(unitSelect).toHaveValue('Minutes');
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
