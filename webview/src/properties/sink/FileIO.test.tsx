import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileIOSinkProperties } from './FileIO';

describe('FileIOSinkProperties', () => {
  const mockOnChange = vi.fn();

  it('renders all default fields and handles value changes', () => {
    const mockNode: any = {
      data: {
        label: 'FileIO',
        beam_transform: 'FileIO',
        properties: {
          to: 'gs://output-bucket/data/',
          prefix: 'part-',
          suffix: '.parquet',
          numShards: 5,
          ignoreEmptyFiles: true
        }
      }
    };

    render(<FileIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Destination Directory/i)).toHaveValue('gs://output-bucket/data/');
    expect(screen.getByLabelText(/Filename Prefix/i)).toHaveValue('part-');
    expect(screen.getByLabelText(/Filename Suffix/i)).toHaveValue('.parquet');
    expect(screen.getByLabelText(/Number of Shards/i)).toHaveValue(5);
    expect(screen.getByLabelText(/Ignore Empty Files/i)).toBeChecked();

    fireEvent.change(screen.getByLabelText(/Destination Directory/i), {
      target: { name: 'to', value: 'gs://output-bucket/new-dir/' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      to: 'gs://output-bucket/new-dir/'
    }));
  });

  it('handles compression configuration toggle and selection', () => {
    const mockNode: any = {
      data: {
        label: 'FileIO',
        beam_transform: 'FileIO',
        properties: {
          withCompression: true,
          compression: 'GZIP'
        }
      }
    };

    render(<FileIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const compressionSelect = screen.getByLabelText(/Compression Algorithm/i);
    expect(compressionSelect).toHaveValue('GZIP');

    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'DEFLATE' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      compression: 'DEFLATE'
    }));
  });
});
