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

    const { container } = render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Split via')).toBeInTheDocument();
    expect(container.querySelector('#flatMapSplitVia')).toHaveValue('');
    expect(container.querySelector('#flatMapDelimiter')).not.toBeInTheDocument();
    expect(container.querySelector('#flatMapRegex')).not.toBeInTheDocument();
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

    const { container } = render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);

    const select = container.querySelector('#flatMapSplitVia') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'Token' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      splitVia: 'Token',
      delimiter: ',',
      regexPattern: '',
      system_instructions: ''
    }));
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

    const { container } = render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);

    const input = container.querySelector('#flatMapDelimiter') as HTMLInputElement;
    expect(input).toHaveAttribute('maxLength', '1');
    fireEvent.change(input, { target: { value: '|' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      splitVia: 'Token',
      delimiter: '|',
      regexPattern: '',
      system_instructions: ''
    }));
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

    const { container } = render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);

    const input = container.querySelector('#flatMapRegexPattern') as HTMLInputElement;
    expect(input).toHaveValue('[A-Za-z]+');
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

    const { container } = render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = container.querySelector('#flatMapSystemInstructions') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Custom split instruction' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      splitVia: 'Token',
      delimiter: ';',
      regexPattern: '',
      system_instructions: 'Custom split instruction'
    }));
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
