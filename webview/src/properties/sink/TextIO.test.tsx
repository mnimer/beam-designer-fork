import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextIOSinkProperties } from './TextIO';

describe('TextIOSinkProperties', () => {
  const mockOnChange = vi.fn();

  it('renders all default fields and handles field updates', () => {
    const mockNode: any = {
      data: {
        label: 'TextIO',
        beam_transform: 'TextIO',
        properties: {
          to: 'gs://my-bucket/output/data',
          suffix: '.txt',
          numShards: 3,
          header: 'header1,header2',
          footer: 'END'
        }
      }
    };

    render(<TextIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Destination File Prefix/i)).toHaveValue('gs://my-bucket/output/data');
    expect(screen.getByLabelText(/File Suffix/i)).toHaveValue('.txt');
    expect(screen.getByLabelText(/Number of Shards/i)).toHaveValue(3);
    expect(screen.getByLabelText(/Header Line/i)).toHaveValue('header1,header2');
    expect(screen.getByLabelText(/Footer Line/i)).toHaveValue('END');

    fireEvent.change(screen.getByLabelText(/Destination File Prefix/i), {
      target: { name: 'to', value: 'gs://my-bucket/output/logs' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      to: 'gs://my-bucket/output/logs'
    }));
  });

  it('handles without sharding toggle', () => {
    const mockNode: any = {
      data: {
        label: 'TextIO',
        beam_transform: 'TextIO',
        properties: {
          withoutSharding: false
        }
      }
    };

    render(<TextIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const checkbox = screen.getByLabelText(/Without Sharding/i);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      withoutSharding: true
    }));
  });
});
