import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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
          numShards: 5
        }
      }
    };

    const { container } = render(<FileIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const destInput = container.querySelector('#fileSinkTo') as HTMLInputElement;
    const prefixInput = container.querySelector('#fileSinkPrefix') as HTMLInputElement;
    const suffixInput = container.querySelector('#fileSinkSuffix') as HTMLInputElement;
    const shardsInput = container.querySelector('#fileSinkNumShards') as HTMLInputElement;

    expect(destInput).toHaveValue('gs://output-bucket/data/');
    expect(prefixInput).toHaveValue('part-');
    expect(suffixInput).toHaveValue('.parquet');
    expect(shardsInput).toHaveValue(5);

    fireEvent.change(destInput, {
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

    const { container } = render(<FileIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const compressionSelect = container.querySelector('#fileSinkCompression') as HTMLSelectElement;
    expect(compressionSelect).toHaveValue('GZIP');

    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'DEFLATE' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      compression: 'DEFLATE'
    }));
  });
});
