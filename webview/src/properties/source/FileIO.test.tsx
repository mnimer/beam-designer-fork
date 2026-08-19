import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    render(<FileIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/File Pattern/i)).toHaveValue('gs://my-bucket/files/*.parquet');
    expect(screen.getByLabelText(/Empty Match Treatment/i)).toHaveValue('DISALLOW');
    expect(screen.getByLabelText(/Continuously/i)).toBeChecked();
    expect(screen.getByLabelText(/Check Interval/i)).toHaveValue(5);
    expect(screen.getByLabelText(/Unit/i)).toHaveValue('MINUTES');
    expect(screen.queryByLabelText(/With Compression/i)).not.toBeInTheDocument();

    // Change file pattern
    fireEvent.change(screen.getByLabelText(/File Pattern/i), {
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

    render(<FileIOReadMatchesProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Directory Treatment/i)).toHaveValue('PROHIBIT');
    expect(screen.getByLabelText(/With Compression/i)).toBeChecked();
    expect(screen.getByLabelText(/Compression Algorithm/i)).toHaveValue('ZIP');

    fireEvent.change(screen.getByLabelText(/Directory Treatment/i), {
      target: { name: 'directoryTreatment', value: 'SKIP' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      directoryTreatment: 'SKIP'
    }));
  });
});
