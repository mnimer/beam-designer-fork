import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

    const { container } = render(<TextIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#textSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#textSinkSuffix') as HTMLInputElement;
    const shardsInput = container.querySelector('#textSinkNumShards') as HTMLInputElement;
    const headerInput = container.querySelector('#textSinkHeader') as HTMLInputElement;
    const footerInput = container.querySelector('#textSinkFooter') as HTMLInputElement;

    expect(toInput).toHaveValue('gs://my-bucket/output/data');
    expect(suffixInput).toHaveValue('.txt');
    expect(shardsInput).toHaveValue(3);
    expect(headerInput).toHaveValue('header1,header2');
    expect(footerInput).toHaveValue('END');

    fireEvent.change(toInput, {
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

    const { container } = render(<TextIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const checkbox = container.querySelector('#textSinkWithoutSharding') as HTMLInputElement;
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      withoutSharding: true
    }));
  });
});
