import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    render(<TextIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/File Pattern \/ Path/i)).toHaveValue('gs://bucket/data/*.txt');
    expect(screen.getByLabelText(/Skip Header Lines/i)).toHaveValue(1);
    expect(screen.getByLabelText(/Custom Delimiter/i)).toHaveValue('\\n');
    expect(screen.getByLabelText(/Hint Matches Many Files/i)).toBeChecked();

    fireEvent.change(screen.getByLabelText(/File Pattern \/ Path/i), {
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

    render(<TextIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const compressionSelect = screen.getByLabelText(/Compression Algorithm/i);
    expect(compressionSelect).toHaveValue('GZIP');

    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'ZSTD' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      compression: 'ZSTD'
    }));
  });
});
