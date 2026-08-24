import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PeriodicImpulseProperties } from './PeriodicImpulse';

describe('PeriodicImpulseProperties', () => {
  it('renders default periodic impulse fields', () => {
    const mockNode = {
      data: {
        label: 'Periodic Impulse',
        properties: {
          intervalSeconds: 5,
          startMode: 'now' as const,
          stopMode: 'never' as const,
          catchUpToNow: false
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PeriodicImpulseProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/emission interval/i, { selector: 'input' })).toHaveValue(5);
    expect(screen.getByLabelText(/start time/i, { selector: 'select' })).toHaveValue('now');
    expect(screen.getByLabelText(/stop condition/i, { selector: 'select' })).toHaveValue('never');
    expect(screen.getByLabelText(/catch up to now/i, { selector: 'input' })).not.toBeChecked();
  });

  it('updates emission interval on change', () => {
    const mockNode = {
      data: {
        label: 'Periodic Impulse',
        properties: {
          intervalSeconds: 1
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PeriodicImpulseProperties node={mockNode} onChange={mockOnChange} />);

    const intervalInput = screen.getByLabelText(/emission interval/i, { selector: 'input' });
    fireEvent.change(intervalInput, { target: { name: 'intervalSeconds', value: '10' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        intervalSeconds: '10'
      })
    );
  });

  it('allows selecting custom start timestamp', () => {
    const mockNode = {
      data: {
        label: 'Periodic Impulse',
        properties: {
          startMode: 'custom_timestamp' as const,
          startTimestamp: 1700000000
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PeriodicImpulseProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/start epoch timestamp/i, { selector: 'input' })).toHaveValue(1700000000);

    const startInput = screen.getByLabelText(/start epoch timestamp/i, { selector: 'input' });
    fireEvent.change(startInput, { target: { name: 'startTimestamp', value: '1700001000' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startTimestamp: '1700001000'
      })
    );
  });

  it('allows selecting stop duration and custom stop timestamp', () => {
    const mockNode = {
      data: {
        label: 'Periodic Impulse',
        properties: {
          stopMode: 'duration' as const,
          durationSeconds: 1800
        }
      }
    };
    const mockOnChange = vi.fn();

    const { rerender } = render(<PeriodicImpulseProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/run duration/i, { selector: 'input' })).toHaveValue(1800);

    const durationInput = screen.getByLabelText(/run duration/i, { selector: 'input' });
    fireEvent.change(durationInput, { target: { name: 'durationSeconds', value: '7200' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        durationSeconds: '7200'
      })
    );

    // Rerender with custom_timestamp stop mode
    const customStopNode = {
      data: {
        label: 'Periodic Impulse',
        properties: {
          stopMode: 'custom_timestamp' as const,
          stopTimestamp: 1700010000
        }
      }
    };

    rerender(<PeriodicImpulseProperties node={customStopNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/stop epoch timestamp/i, { selector: 'input' })).toHaveValue(1700010000);

    const stopInput = screen.getByLabelText(/stop epoch timestamp/i, { selector: 'input' });
    fireEvent.change(stopInput, { target: { name: 'stopTimestamp', value: '1700020000' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        stopTimestamp: '1700020000'
      })
    );
  });

  it('toggles catchUpToNow and updates system_instructions', () => {
    const mockNode = {
      data: {
        label: 'Periodic Impulse',
        properties: {
          catchUpToNow: false,
          system_instructions: 'Run every 5s'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PeriodicImpulseProperties node={mockNode} onChange={mockOnChange} />);

    const catchUpCheckbox = screen.getByLabelText(/catch up to now/i, { selector: 'input' });
    fireEvent.click(catchUpCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        catchUpToNow: true
      })
    );

    const instructionsTextarea = screen.getByLabelText(/code generation instructions/i, { selector: 'textarea' });
    fireEvent.change(instructionsTextarea, { target: { name: 'system_instructions', value: 'Updated impulse prompt' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Updated impulse prompt'
      })
    );
  });
});
