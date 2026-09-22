import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileIOSourceProperties, FileIOReadMatchesProperties } from './FileIO';

describe('FileIOSourceProperties', () => {
  const mockOnChange = vi.fn();

  it('renders default fields correctly and handles input changes', () => {
    const mockNode: any = {
      data: {
        label: 'FileIO Match',
        beam_transform: 'FileIO.match',
        properties: {
          filePattern: 'gs://my-bucket/files/*.parquet',
          emptyMatchTreatment: 'DISALLOW',
          continuously: true,
          continuousDuration: '5',
          continuousDurationUnit: 'MINUTES'
        }
      }
    };

    const { container } = render(<FileIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const patternInput = container.querySelector('#filePattern') as HTMLInputElement;
    const emptyMatchSelect = container.querySelector('#emptyMatchTreatment') as HTMLSelectElement;
    const contCheckbox = container.querySelector('#continuously') as HTMLInputElement;
    const durationInput = container.querySelector('#continuousDuration') as HTMLInputElement;
    const unitSelect = container.querySelector('#continuousDurationUnit') as HTMLSelectElement;

    expect(patternInput).toHaveValue('gs://my-bucket/files/*.parquet');
    expect(emptyMatchSelect).toHaveValue('DISALLOW');
    expect(contCheckbox).toBeChecked();
    expect(durationInput).toHaveValue(5);
    expect(unitSelect).toHaveValue('MINUTES');

    // Change file pattern
    fireEvent.change(patternInput, {
      target: { name: 'filePattern', value: 'gs://my-bucket/other/*.csv' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      filePattern: 'gs://my-bucket/other/*.csv'
    }));
  });
});

describe('FileIOReadMatchesProperties', () => {
  const mockOnChange = vi.fn();

  it('renders and handles directory treatment and compression', () => {
    const mockNode: any = {
      data: {
        label: 'FileIO Read Matches',
        beam_transform: 'FileIO.readMatches',
        properties: {
          directoryTreatment: 'PROHIBIT',
          withCompression: true,
          compression: 'ZIP'
        }
      }
    };

    const { container } = render(<FileIOReadMatchesProperties node={mockNode} onChange={mockOnChange} />);

    const dirSelect = container.querySelector('#directoryTreatment') as HTMLSelectElement;
    const compCheckbox = container.querySelector('#readMatchesWithCompression') as HTMLInputElement;
    const compSelect = container.querySelector('#readMatchesCompression') as HTMLSelectElement;

    expect(dirSelect).toHaveValue('PROHIBIT');
    expect(compCheckbox).toBeChecked();
    expect(compSelect).toHaveValue('ZIP');

    fireEvent.change(dirSelect, {
      target: { name: 'directoryTreatment', value: 'SKIP' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      directoryTreatment: 'SKIP'
    }));
  });

  it('displays required validation error when filePattern is empty in FileIOSourceProperties', () => {
    const mockNode: any = {
      data: {
        label: 'FileIO Match',
        beam_transform: 'FileIO.match',
        properties: {
          filePattern: ''
        }
      }
    };

    const { container, getByRole } = render(<FileIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const patternInput = container.querySelector('#filePattern') as HTMLInputElement;
    expect(patternInput).toHaveAttribute('aria-invalid', 'true');
    expect(getByRole('alert')).toHaveTextContent('File Pattern is required.');
  });

  it('handles system_instructions changes for both FileIO components', () => {
    const mockNodeSource: any = {
      data: {
        label: 'FileIO Match',
        beam_transform: 'FileIO.match',
        properties: {
          system_instructions: 'Match instruction'
        }
      }
    };
    const { container: container1 } = render(<FileIOSourceProperties node={mockNodeSource} onChange={mockOnChange} />);
    const textarea1 = container1.querySelector('#fileSourceSystemInstructions') as HTMLTextAreaElement;
    expect(textarea1).toHaveValue('Match instruction');
    fireEvent.change(textarea1, { target: { value: 'Updated match instruction' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated match instruction'
    }));

    const mockNodeRead: any = {
      data: {
        label: 'FileIO Read',
        beam_transform: 'FileIO.readMatches',
        properties: {
          system_instructions: 'Read instruction'
        }
      }
    };
    const { container: container2 } = render(<FileIOReadMatchesProperties node={mockNodeRead} onChange={mockOnChange} />);
    const textarea2 = container2.querySelector('#readMatchesSystemInstructions') as HTMLTextAreaElement;
    expect(textarea2).toHaveValue('Read instruction');
    fireEvent.change(textarea2, { target: { value: 'Updated read instruction' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated read instruction'
    }));
  });
});
