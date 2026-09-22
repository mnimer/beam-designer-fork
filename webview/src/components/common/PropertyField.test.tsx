/**
 * PropertyField Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PropertyField } from './PropertyField';

describe('PropertyField', () => {
  it('renders input with label, placeholder, and value', () => {
    render(
      <PropertyField
        id="dataset-id"
        name="dataset"
        label="Dataset"
        placeholder="my_dataset"
        value="orders_dataset"
      />
    );

    const label = screen.getByText('Dataset');
    expect(label).toBeInTheDocument();

    const input = screen.getByPlaceholderText('my_dataset') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('orders_dataset');
    expect(input.id).toBe('dataset-id');
  });

  it('triggers both onChange and onValueChange callbacks on user input', () => {
    const handleChange = vi.fn();
    const handleValueChange = vi.fn();

    render(
      <PropertyField
        name="tableName"
        placeholder="table_name"
        onChange={handleChange}
        onValueChange={handleValueChange}
      />
    );

    const input = screen.getByPlaceholderText('table_name');
    fireEvent.change(input, { target: { value: 'users_table' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledWith('users_table');
  });

  it('renders required indicator when required={true} or required string title', () => {
    const { rerender } = render(
      <PropertyField
        name="field1"
        label="Required Field"
        required={true}
      />
    );

    const asterisk = screen.getByText('*');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk).toHaveAttribute('title', 'Required');

    rerender(
      <PropertyField
        name="field1"
        label="Custom Required"
        required="Either Field 1 or Field 2 is required"
      />
    );

    const customAsterisk = screen.getByText('*');
    expect(customAsterisk).toHaveAttribute('title', 'Either Field 1 or Field 2 is required');
  });

  it('renders tooltip icon when tooltip prop is provided', () => {
    render(
      <PropertyField
        name="topic"
        label="Topic"
        tooltip="Cloud Pub/Sub topic specification"
      />
    );

    // InfoTooltip renders an SVG icon
    const tooltipIcon = document.querySelector('svg.lucide-info');
    expect(tooltipIcon).toBeInTheDocument();
  });

  it('applies error styling and displays error message with role="alert"', () => {
    render(
      <PropertyField
        id="err-input"
        name="errField"
        label="Error Field"
        error="Field cannot be blank"
      />
    );

    const input = document.getElementById('err-input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input?.className).toContain('border-red-500/80');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Field cannot be blank');
  });

  it('renders textarea when type is "textarea"', () => {
    render(
      <PropertyField
        id="instructions-id"
        name="system_instructions"
        label="System Instructions"
        type="textarea"
        rows={4}
        value="Generate streaming Beam pipeline"
      />
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
    expect(textarea).toHaveValue('Generate streaming Beam pipeline');
    expect(textarea.rows).toBe(4);
    expect(textarea.className).toContain('resize-y');
  });

  it('renders datalist element when datalist options are supplied', () => {
    render(
      <PropertyField
        id="fruit-field"
        name="fruit"
        label="Fruit"
        datalist={['Apple', 'Banana', { value: 'Cherry', label: 'Fresh Cherry' }]}
      />
    );

    const input = document.getElementById('fruit-field');
    const datalistId = input?.getAttribute('list');
    expect(datalistId).toBeTruthy();

    const datalist = document.getElementById(datalistId!);
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(3);
    expect(datalist?.children[0]).toHaveAttribute('value', 'Apple');
    expect(datalist?.children[1]).toHaveAttribute('value', 'Banana');
    expect(datalist?.children[2]).toHaveAttribute('value', 'Cherry');
  });

  it('renders helper text below the input', () => {
    render(
      <PropertyField
        name="queue"
        helperText="Sample: https://sqs.us-east-1.amazonaws.com/123/my-queue"
      />
    );

    expect(screen.getByText(/Sample: https:\/\/sqs/)).toBeInTheDocument();
  });

  it('disables input when disabled prop is true', () => {
    render(
      <PropertyField
        name="disabledField"
        disabled={true}
        placeholder="Disabled input"
      />
    );

    expect(screen.getByPlaceholderText('Disabled input')).toBeDisabled();
  });
});
