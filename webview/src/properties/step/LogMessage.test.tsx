import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LogMessageProperties } from './LogMessage';

describe('LogMessageProperties', () => {
  it('renders dropdown with Debug, Info, Warning, and Error options and defaults to Info', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<LogMessageProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Log Level')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Info')).toBeInTheDocument();
    expect(screen.getByText('Standard operational message logs highlighting progress or status changes.')).toBeInTheDocument();
  });

  it('renders appropriate helper text based on logLevel property', () => {
    const mockOnChange = vi.fn();

    // Debug
    const debugNode = { data: { properties: { logLevel: 'Debug' as const } } };
    const { rerender } = render(<LogMessageProperties node={debugNode} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Debug')).toBeInTheDocument();
    expect(screen.getByText('Output detailed debugging information, typically only useful in non-production environments.')).toBeInTheDocument();

    // Warning
    const warningNode = { data: { properties: { logLevel: 'Warning' as const } } };
    rerender(<LogMessageProperties node={warningNode} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Warning')).toBeInTheDocument();
    expect(screen.getByText('Indicate potential issues or unusual events that do not stop pipeline execution.')).toBeInTheDocument();

    // Error
    const errorNode = { data: { properties: { logLevel: 'Error' as const } } };
    rerender(<LogMessageProperties node={errorNode} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Error')).toBeInTheDocument();
    expect(screen.getByText('Log critical errors indicating a failure or significant issue during processing.')).toBeInTheDocument();
  });

  it('calls onChange callback when log level is changed', () => {
    const mockNode = {
      data: {
        properties: {
          logLevel: 'Info' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<LogMessageProperties node={mockNode} onChange={mockOnChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { name: 'logLevel', value: 'Warning' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      logLevel: 'Warning'
    });
  });
});
