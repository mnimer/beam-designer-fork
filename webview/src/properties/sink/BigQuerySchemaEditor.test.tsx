/**
 * BigQuery Schema Editor Component Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  BigQuerySchemaEditor,
  fieldsToJson,
  fieldsToString,
  jsonToFields,
  stringToFields,
  type BigQueryField
} from './BigQuerySchemaEditor';

describe('BigQuerySchemaEditor utility functions', () => {
  const sampleFields: BigQueryField[] = [
    { name: 'age', type: 'INTEGER', mode: 'NULLABLE', description: 'User age' },
    { name: 'name', type: 'STRING', mode: 'REQUIRED', description: 'User full name' }
  ];

  it('converts fields to JSON string correctly', () => {
    const json = fieldsToJson(sampleFields);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ name: 'age', type: 'INTEGER', mode: 'NULLABLE', description: 'User age' });
    expect(parsed[1]).toEqual({ name: 'name', type: 'STRING', mode: 'REQUIRED', description: 'User full name' });
  });

  it('converts fields to comma-separated string correctly', () => {
    const str = fieldsToString(sampleFields);
    expect(str).toBe('age:INTEGER, name:STRING:REQUIRED');
  });

  it('parses valid JSON array to fields', () => {
    const json = JSON.stringify([
      { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'score', type: 'FLOAT', mode: 'NULLABLE' }
    ]);
    const fields = jsonToFields(json);
    expect(fields).toHaveLength(2);
    expect(fields![0].name).toBe('id');
    expect(fields![0].mode).toBe('REQUIRED');
    expect(fields![1].name).toBe('score');
    expect(fields![1].mode).toBe('NULLABLE');
  });

  it('returns null on invalid JSON array', () => {
    expect(jsonToFields('{ "name": "not-an-array" }')).toBeNull();
    expect(jsonToFields('invalid json')).toBeNull();
  });

  it('parses comma-separated schema string to fields', () => {
    const str = 'id:STRING:REQUIRED, score:FLOAT, created_at:TIMESTAMP:NULLABLE';
    const fields = stringToFields(str);
    expect(fields).toHaveLength(3);
    expect(fields[0]).toEqual({ name: 'id', type: 'STRING', mode: 'REQUIRED', description: '' });
    expect(fields[1]).toEqual({ name: 'score', type: 'FLOAT', mode: 'NULLABLE', description: '' });
    expect(fields[2]).toEqual({ name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE', description: '' });
  });
});

describe('BigQuerySchemaEditor Component', () => {
  it('renders all three tabs and initial field count', () => {
    const mockOnChange = vi.fn();
    const initialFields: BigQueryField[] = [
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED', description: '' },
      { name: 'signup_date', type: 'DATE', mode: 'NULLABLE', description: '' }
    ];

    render(<BigQuerySchemaEditor fields={initialFields} onChange={mockOnChange} />);

    expect(screen.getByRole('button', { name: /Field Builder Tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /JSON Schema Tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schema String Tab/i })).toBeInTheDocument();
    expect(screen.getByText('Field Builder (2)')).toBeInTheDocument();
  });

  it('renders fields with name, type select, and required checkbox (default off)', () => {
    const mockOnChange = vi.fn();
    const initialFields: BigQueryField[] = [
      { name: 'age', type: 'INTEGER', mode: 'NULLABLE', description: '' }
    ];

    render(<BigQuerySchemaEditor fields={initialFields} onChange={mockOnChange} />);

    const nameInput = screen.getByLabelText('Field #1 Name') as HTMLInputElement;
    const typeSelect = screen.getByLabelText('Field #1 Type') as HTMLSelectElement;
    const reqCheckbox = screen.getByLabelText('Field #1 Required') as HTMLInputElement;

    expect(nameInput.value).toBe('age');
    expect(typeSelect.value).toBe('INTEGER');
    expect(reqCheckbox.checked).toBe(false); // Default off
  });

  it('toggles required checkbox and triggers onChange with mode=REQUIRED', () => {
    const mockOnChange = vi.fn();
    const initialFields: BigQueryField[] = [
      { name: 'age', type: 'INTEGER', mode: 'NULLABLE', description: '' }
    ];

    render(<BigQuerySchemaEditor fields={initialFields} onChange={mockOnChange} />);

    const reqCheckbox = screen.getByLabelText('Field #1 Required');
    fireEvent.click(reqCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFields: expect.arrayContaining([
          expect.objectContaining({ name: 'age', mode: 'REQUIRED' })
        ])
      })
    );
  });

  it('adds a new field when clicking Add Schema Field', () => {
    const mockOnChange = vi.fn();
    render(<BigQuerySchemaEditor fields={[]} onChange={mockOnChange} />);

    const addBtn = screen.getByRole('button', { name: /Add Schema Field/i });
    fireEvent.click(addBtn);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFields: [
          { name: '', type: 'STRING', mode: 'NULLABLE', description: '' }
        ]
      })
    );
  });

  it('deletes a field when clicking delete button', () => {
    const mockOnChange = vi.fn();
    const initialFields: BigQueryField[] = [
      { name: 'field_a', type: 'STRING', mode: 'NULLABLE' },
      { name: 'field_b', type: 'INTEGER', mode: 'NULLABLE' }
    ];

    render(<BigQuerySchemaEditor fields={initialFields} onChange={mockOnChange} />);

    const deleteBtn = screen.getByLabelText('Delete Field #1');
    fireEvent.click(deleteBtn);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFields: [
          expect.objectContaining({ name: 'field_b' })
        ]
      })
    );
  });

  it('reorders fields up and down', () => {
    const mockOnChange = vi.fn();
    const initialFields: BigQueryField[] = [
      { name: 'first', type: 'STRING', mode: 'NULLABLE' },
      { name: 'second', type: 'INTEGER', mode: 'NULLABLE' }
    ];

    render(<BigQuerySchemaEditor fields={initialFields} onChange={mockOnChange} />);

    const moveDownBtn = screen.getByLabelText('Move Field #1 Down');
    fireEvent.click(moveDownBtn);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFields: [
          expect.objectContaining({ name: 'second' }),
          expect.objectContaining({ name: 'first' })
        ]
      })
    );
  });

  it('switches to JSON Schema tab without copy button and handles text updates', () => {
    const mockOnChange = vi.fn();
    const initialFields: BigQueryField[] = [
      { name: 'id', type: 'STRING', mode: 'REQUIRED' }
    ];

    const { container } = render(<BigQuerySchemaEditor fields={initialFields} onChange={mockOnChange} />);

    const jsonTabBtn = screen.getByRole('button', { name: /JSON Schema Tab/i });
    fireEvent.click(jsonTabBtn);

    // Verify NO copy button exists as requested
    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();

    const textarea = container.querySelector('#bigQuerySchemaJsonTextarea') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toContain('"id"');

    // Edit JSON
    const newJson = JSON.stringify([
      { name: 'updated_id', type: 'INTEGER', mode: 'REQUIRED' }
    ]);
    fireEvent.change(textarea, { target: { value: newJson } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFields: [
          expect.objectContaining({ name: 'updated_id', type: 'INTEGER', mode: 'REQUIRED' })
        ]
      })
    );
  });

  it('switches to Schema String tab and handles string edits', () => {
    const mockOnChange = vi.fn();
    const initialFields: BigQueryField[] = [
      { name: 'title', type: 'STRING', mode: 'NULLABLE' }
    ];

    const { container } = render(<BigQuerySchemaEditor fields={initialFields} onChange={mockOnChange} />);

    const stringTabBtn = screen.getByRole('button', { name: /Schema String Tab/i });
    fireEvent.click(stringTabBtn);

    const textarea = container.querySelector('#bigQuerySchemaStringTextarea') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe('title:STRING');

    fireEvent.change(textarea, { target: { value: 'col1:STRING:REQUIRED, col2:FLOAT' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaFields: [
          expect.objectContaining({ name: 'col1', type: 'STRING', mode: 'REQUIRED' }),
          expect.objectContaining({ name: 'col2', type: 'FLOAT', mode: 'NULLABLE' })
        ]
      })
    );
  });
});
