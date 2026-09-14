import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GenerateSequenceProperties } from './GenerateSequence';

describe('GenerateSequenceProperties', () => {
  it('renders default unbounded sequence fields', () => {
    const mockNode = {
      data: {
        label: 'Generate Sequence',
        properties: {
          sequenceMode: 'unbounded' as const,
          start: 0
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<GenerateSequenceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/sequence mode/i, { selector: 'select' })).toHaveValue('unbounded');
    expect(screen.getByLabelText(/start index/i, { selector: 'input' })).toHaveValue(0);
    expect(screen.queryByLabelText(/stop index/i, { selector: 'input' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/rate limiting/i, { selector: 'input' })).not.toBeChecked();
  });

  it('renders bounded sequence fields with stop index', () => {
    const mockNode = {
      data: {
        label: 'Generate Sequence',
        properties: {
          sequenceMode: 'bounded' as const,
          start: 0,
          stop: 100
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<GenerateSequenceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/sequence mode/i, { selector: 'select' })).toHaveValue('bounded');
    expect(screen.getByLabelText(/start index/i, { selector: 'input' })).toHaveValue(0);
    expect(screen.getByLabelText(/stop index/i, { selector: 'input' })).toHaveValue(100);
  });

  it('switches sequence mode to bounded and initializes default stop value', () => {
    const mockNode = {
      data: {
        label: 'Generate Sequence',
        properties: {
          sequenceMode: 'unbounded' as const,
          start: 5
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<GenerateSequenceProperties node={mockNode} onChange={mockOnChange} />);

    const modeSelect = screen.getByLabelText(/sequence mode/i, { selector: 'select' });
    fireEvent.change(modeSelect, { target: { name: 'sequenceMode', value: 'bounded' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sequenceMode: 'bounded',
        start: 5,
        stop: 10
      })
    );
  });

  it('updates start and stop values on change', () => {
    const mockNode = {
      data: {
        label: 'Generate Sequence',
        properties: {
          sequenceMode: 'bounded' as const,
          start: 0,
          stop: 50
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<GenerateSequenceProperties node={mockNode} onChange={mockOnChange} />);

    const startInput = screen.getByLabelText(/start index/i, { selector: 'input' });
    fireEvent.change(startInput, { target: { name: 'start', value: '10' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        start: '10'
      })
    );

    const stopInput = screen.getByLabelText(/stop index/i, { selector: 'input' });
    fireEvent.change(stopInput, { target: { name: 'stop', value: '200' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        stop: '200'
      })
    );
  });

  it('toggles rate limiting and updates rate parameters', () => {
    const mockNode = {
      data: {
        label: 'Generate Sequence',
        properties: {
          sequenceMode: 'unbounded' as const,
          withRateLimit: true,
          elementsPerPeriod: 10,
          periodSeconds: 2
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<GenerateSequenceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/rate limiting/i, { selector: 'input' })).toBeChecked();
    expect(screen.getByLabelText(/elements \/ period/i, { selector: 'input' })).toHaveValue(10);
    expect(screen.getByLabelText(/period \(seconds/i, { selector: 'input' })).toHaveValue(2);

    const elementsInput = screen.getByLabelText(/elements \/ period/i, { selector: 'input' });
    fireEvent.change(elementsInput, { target: { name: 'elementsPerPeriod', value: '50' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        elementsPerPeriod: '50'
      })
    );

    const periodInput = screen.getByLabelText(/period \(seconds/i, { selector: 'input' });
    fireEvent.change(periodInput, { target: { name: 'periodSeconds', value: '5' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        periodSeconds: '5'
      })
    );
  });

  it('updates maxReadTimeSeconds and system_instructions', () => {
    const mockNode = {
      data: {
        label: 'Generate Sequence',
        properties: {
          maxReadTimeSeconds: 60,
          system_instructions: 'Custom rate instruction'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<GenerateSequenceProperties node={mockNode} onChange={mockOnChange} />);

    const maxReadInput = screen.getByLabelText(/max read time/i, { selector: 'input' });
    fireEvent.change(maxReadInput, { target: { name: 'maxReadTimeSeconds', value: '120' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        maxReadTimeSeconds: '120'
      })
    );

    const instructionsInput = screen.getByLabelText(/code generation instructions/i, { selector: 'textarea' });
    fireEvent.change(instructionsInput, { target: { name: 'system_instructions', value: 'Updated prompt instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Updated prompt instructions'
      })
    );
  });

  it('handles negative or boundary start and stop indices', () => {
    const mockNode = {
      data: {
        label: 'Generate Sequence',
        properties: {
          sequenceMode: 'bounded' as const,
          start: -10,
          stop: 100
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<GenerateSequenceProperties node={mockNode} onChange={mockOnChange} />);

    const startInput = screen.getByLabelText(/start index/i, { selector: 'input' });
    const stopInput = screen.getByLabelText(/stop index/i, { selector: 'input' });

    expect(startInput).toHaveValue(-10);
    expect(stopInput).toHaveValue(100);

    fireEvent.change(startInput, { target: { name: 'start', value: '0' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        start: '0'
      })
    );
  });
});
