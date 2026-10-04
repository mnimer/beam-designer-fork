/**
 * SelectField Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates the shared dropdown primitive: label and option rendering, controlled value
 * reflection, change event propagation, optional tooltip and helper text, and the disabled state.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react, matching the existing common component suites.
 * - Tooltip presence is asserted via the lucide-info SVG, the same probe used by PropertyField.test.tsx.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SelectField } from './SelectField';
import type { SelectFieldOption } from './SelectField';

const CODECS: SelectFieldOption[] = [
  { value: 'SNAPPY', label: 'SNAPPY (Recommended)' },
  { value: 'GZIP', label: 'GZIP (Higher ratio)' },
  { value: 'ZSTD', label: 'ZSTD (Balanced)' }
];

describe('SelectField', () => {
  it('renders the label and every option', () => {
    render(
      <SelectField
        id="codec"
        name="codec"
        label="Compression Codec"
        value="SNAPPY"
        options={CODECS}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Compression Codec')).toBeInTheDocument();

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBe(3);
    expect(screen.getByRole('option', { name: 'SNAPPY (Recommended)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'GZIP (Higher ratio)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ZSTD (Balanced)' })).toBeInTheDocument();
  });

  it('reflects the currently selected value', () => {
    render(
      <SelectField
        id="codec"
        name="codec"
        label="Compression Codec"
        value="ZSTD"
        options={CODECS}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox')).toHaveValue('ZSTD');
  });

  it('fires onChange with the newly selected value', () => {
    // NOTE: the event target is read inside the handler; the select is controlled, so by the time
    // the assertion runs React has already re-rendered the DOM node back to the `value` prop.
    const seen: { name: string; value: string }[] = [];
    const handleChange = vi.fn((e: React.ChangeEvent<HTMLSelectElement>) => {
      seen.push({ name: e.target.name, value: e.target.value });
    });

    render(
      <SelectField
        id="codec"
        name="codec"
        label="Compression Codec"
        value="SNAPPY"
        options={CODECS}
        onChange={handleChange}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { name: 'codec', value: 'GZIP' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(seen[0]).toEqual({ name: 'codec', value: 'GZIP' });
  });

  it('associates the label with the select via htmlFor', () => {
    render(
      <SelectField
        id="parquetSinkCodec"
        name="codec"
        label="Compression Codec"
        value="SNAPPY"
        options={CODECS}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Compression Codec')).toHaveAttribute('id', 'parquetSinkCodec');
  });

  it('renders the tooltip icon only when a tooltip is provided', () => {
    const { rerender } = render(
      <SelectField
        id="codec"
        name="codec"
        label="Compression Codec"
        value="SNAPPY"
        options={CODECS}
        onChange={vi.fn()}
      />
    );

    expect(document.querySelector('svg.lucide-info')).not.toBeInTheDocument();

    rerender(
      <SelectField
        id="codec"
        name="codec"
        label="Compression Codec"
        tooltip="Parquet block-level compression algorithm."
        value="SNAPPY"
        options={CODECS}
        onChange={vi.fn()}
      />
    );

    expect(document.querySelector('svg.lucide-info')).toBeInTheDocument();
  });

  it('renders helper text below the select', () => {
    render(
      <SelectField
        id="codec"
        name="codec"
        label="Compression Codec"
        value="SNAPPY"
        options={CODECS}
        onChange={vi.fn()}
        helperText="SNAPPY offers the best read/write throughput."
      />
    );

    expect(screen.getByText('SNAPPY offers the best read/write throughput.')).toBeInTheDocument();
  });

  it('honours the disabled prop', () => {
    render(
      <SelectField
        id="codec"
        name="codec"
        label="Compression Codec"
        value="SNAPPY"
        options={CODECS}
        onChange={vi.fn()}
        disabled={true}
      />
    );

    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
