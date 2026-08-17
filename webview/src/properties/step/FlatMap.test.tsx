import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlatMapProperties } from './FlatMap';
import { PropertyForm } from '../../components/PropertyForm';

describe('FlatMapProperties', () => {
  it('renders default Blank option without Token or Regex inputs', () => {
    const mockNode = {
      data: {
        label: 'FlatMap',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Split via')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.queryByPlaceholderText(',')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. [A-Za-z]+')).not.toBeInTheDocument();
    expect(screen.getByText('Code Generation Instructions')).toBeInTheDocument();
  });

  it('shows Delimiter input with 1-character max length when Token option is selected', () => {
    const mockNode = {
      data: {
        label: 'FlatMap',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Token' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      splitVia: 'Token',
      delimiter: ',',
      regexPattern: '',
      system_instructions: ''
    });
  });

  it('updates delimiter value on text input', () => {
    const mockNode = {
      data: {
        label: 'FlatMap',
        properties: {
          splitVia: 'Token' as const,
          delimiter: ','
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(',');
    expect(input).toHaveAttribute('maxLength', '1');
    fireEvent.change(input, { target: { value: '|' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      splitVia: 'Token',
      delimiter: '|',
      regexPattern: '',
      system_instructions: ''
    });
  });

  it('shows Regex pattern input when Regex option is selected', () => {
    const mockNode = {
      data: {
        label: 'FlatMap',
        properties: {
          splitVia: 'Regex' as const,
          regexPattern: '[A-Za-z]+'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('[A-Za-z]+')).toBeInTheDocument();
  });

  it('updates Code Generation Instructions on textarea edit', () => {
    const mockNode = {
      data: {
        label: 'FlatMap',
        properties: {
          splitVia: 'Token' as const,
          delimiter: ';'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText('Enter code generation instructions...');
    fireEvent.change(textarea, { target: { value: 'Custom split instruction' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      splitVia: 'Token',
      delimiter: ';',
      regexPattern: '',
      system_instructions: 'Custom split instruction'
    });
  });

  it('renders FlatMapProperties via PropertyForm for FlatMap node', () => {
    const mockNode = {
      data: {
        label: 'FlatMap',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Split via')).toBeInTheDocument();
  });
});
