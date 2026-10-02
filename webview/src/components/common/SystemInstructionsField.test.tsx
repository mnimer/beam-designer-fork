/**
 * @fileoverview Unit tests for SystemInstructionsField component.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SystemInstructionsField } from './SystemInstructionsField';

describe('SystemInstructionsField component', () => {
  it('renders with default label, id, and placeholder', () => {
    const mockOnChange = vi.fn();
    render(
      <SystemInstructionsField
        id="testInstructionsField"
        value="Initial instruction content"
        onChange={mockOnChange}
        placeholder="Enter custom instructions..."
      />
    );

    // Label renders with default text
    expect(screen.getByText('Code Generation Instructions')).toBeInTheDocument();

    // Textarea has correct id, value, and placeholder
    const textarea = screen.getByPlaceholderText('Enter custom instructions...') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.id).toBe('testInstructionsField');
    expect(textarea.value).toBe('Initial instruction content');
    expect(textarea.getAttribute('rows')).toBe('3');
  });

  it('renders custom label, rows, and tooltip', () => {
    const mockOnChange = vi.fn();
    render(
      <SystemInstructionsField
        id="customInstructionsField"
        value=""
        onChange={mockOnChange}
        label="Custom Instructions Label"
        rows={5}
        tooltip="Helpful tooltip text"
        wrapperClassName="custom-wrapper-class"
      />
    );

    expect(screen.getByText('Custom Instructions Label')).toBeInTheDocument();
    const textarea = document.getElementById('customInstructionsField') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.getAttribute('rows')).toBe('5');

    // Wrapper class applied
    const wrapper = textarea.closest('.custom-wrapper-class');
    expect(wrapper).toBeInTheDocument();
  });

  it('typing in the textarea calls onChange with the string value', () => {
    const mockOnChange = vi.fn();
    render(
      <SystemInstructionsField
        id="inputTestField"
        value=""
        onChange={mockOnChange}
        placeholder="Type here..."
      />
    );

    const textarea = screen.getByPlaceholderText('Type here...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New typed instructions' } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('New typed instructions');
  });

  it('forwards helperText and textareaClassName to the underlying field', () => {
    render(
      <SystemInstructionsField
        id="helperTestField"
        value=""
        onChange={vi.fn()}
        placeholder="Helper..."
        helperText="Additional guidance appended to prompt."
        textareaClassName="h-24"
      />
    );

    expect(screen.getByText('Additional guidance appended to prompt.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Helper...')).toHaveClass('h-24');
  });
});
