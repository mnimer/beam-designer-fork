import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LogMessageProperties } from './LogMessage';

describe('LogMessageProperties (Sink)', () => {
  it('renders dropdown with Debug, Info, Warning, and Error options and shows Info helper text', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<LogMessageProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Log Level')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Info')).toBeInTheDocument();
    expect(screen.getByText(/Informational messages highlighting pipeline progress/i)).toBeInTheDocument();
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

    const { container } = render(<LogMessageProperties node={mockNode} onChange={mockOnChange} />);

    const select = container.querySelector('#logLevelSelect') as HTMLSelectElement;
    fireEvent.change(select, { target: { name: 'logLevel', value: 'Warning' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      logLevel: 'Warning'
    }));
  });

  it('handles log prefix input changes', () => {
    const mockNode = { data: { properties: { logPrefix: '' } } };
    const mockOnChange = vi.fn();

    const { container } = render(<LogMessageProperties node={mockNode} onChange={mockOnChange} />);
    const input = container.querySelector('#logPrefixInput') as HTMLInputElement;
    fireEvent.change(input, { target: { name: 'logPrefix', value: 'Out: ' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      logPrefix: 'Out: '
    }));
  });

  it('handles code generation system instructions change', () => {
    const mockNode = { data: { properties: {} } };
    const mockOnChange = vi.fn();

    render(<LogMessageProperties node={mockNode} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText('Enter custom instructions for logging code generation...');
    fireEvent.change(textarea, { target: { value: 'Custom log instructions' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Custom log instructions'
    }));
  });
});
