import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextIOSourceProperties } from './TextIO';

describe('TextIOSourceProperties', () => {
  const mockOnChange = vi.fn();

  it('renders all default fields and handles value updates', () => {
    const mockNode: any = {
      data: {
        label: 'TextIO',
        beam_transform: 'TextIO',
        properties: {
          filePattern: 'gs://bucket/data/*.txt',
          skipHeaderLines: 1,
          delimiter: '\\n',
          hintMatchesManyFiles: true
        }
      }
    };

    const { container } = render(<TextIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#textFilePattern') as HTMLInputElement;
    const skipHeaderInput = container.querySelector('#skipHeaderLines') as HTMLInputElement;
    const delimiterInput = container.querySelector('#textDelimiter') as HTMLInputElement;
    const hintCheckbox = container.querySelector('#hintMatchesManyFiles') as HTMLInputElement;

    expect(filePatternInput).toHaveValue('gs://bucket/data/*.txt');
    expect(skipHeaderInput).toHaveValue(1);
    expect(delimiterInput).toHaveValue('\\n');
    expect(hintCheckbox).toBeChecked();

    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 'gs://bucket/data/*.csv' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      filePattern: 'gs://bucket/data/*.csv'
    }));
  });

  it('toggles compression and handles selection', () => {
    const mockNode: any = {
      data: {
        label: 'TextIO',
        beam_transform: 'TextIO',
        properties: {
          withCompression: true,
          compression: 'GZIP'
        }
      }
    };

    const { container } = render(<TextIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const compressionSelect = container.querySelector('#textCompression') as HTMLSelectElement;
    expect(compressionSelect).toHaveValue('GZIP');

    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'ZSTD' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      compression: 'ZSTD'
    }));
  });

  it('shows required validation when filePattern is empty', () => {
    const mockNode: any = {
      data: {
        label: 'TextIO',
        beam_transform: 'TextIO',
        properties: {
          filePattern: ''
        }
      }
    };

    const { container, getByRole } = render(<TextIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#textFilePattern') as HTMLInputElement;
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(getByRole('alert')).toHaveTextContent('File Pattern is required.');
  });

  it('handles code generation instructions change', () => {
    const mockNode: any = {
      data: {
        label: 'TextIO',
        beam_transform: 'TextIO',
        properties: {
          filePattern: 'gs://bucket/*.txt',
          system_instructions: 'Initial prompt'
        }
      }
    };

    const { container } = render(<TextIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#textSourceSystemInstructions') as HTMLTextAreaElement;
    expect(instructionsTextarea).toHaveValue('Initial prompt');

    fireEvent.change(instructionsTextarea, {
      target: { value: 'Updated prompt' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated prompt'
    }));
  });
});
