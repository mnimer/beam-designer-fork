/**
 * KineticaDB Sink Properties Unit Tests (IO70)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Exercises 100% of statements, branches, functions, and lines in
 * `webview/src/properties/sink/KineticaDB.tsx`, including validation rules,
 * entity column updates, and `classifyKey` redaction hygiene.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KineticaDBSinkProperties } from './KineticaDB';
import type { KineticaEntityColumn } from '../source/KineticaDB';
import { classifyKey } from '../../../../src/credentialRedaction';

describe('KineticaDBSinkProperties (IO70)', () => {
  const mockPostMessage = vi.fn();
  const vscodeWindow = window as unknown as { vscode?: { postMessage: typeof mockPostMessage } };

  beforeEach(() => {
    mockPostMessage.mockClear();
    vscodeWindow.vscode = { postMessage: mockPostMessage };
  });

  afterEach(() => {
    delete vscodeWindow.vscode;
  });

  const validColumns: KineticaEntityColumn[] = [
    { name: 'sensorId', javaType: 'String', columnProperties: 'char32, primary_key' },
    { name: 'temperature', javaType: 'Double', columnProperties: '' },
  ];

  const validProps = {
    headNodeURL: 'http://127.0.0.1:9191',
    username: 'admin',
    passwordSecret: 'kinetica-password',
    table: 'ki_home.scientists_out',
    entityClassName: 'Scientist',
    entityColumns: validColumns,
  };

  const makeNode = (
    props?: Record<string, unknown>,
    extraData?: Record<string, unknown>
  ) => ({
    data: {
      label: 'KineticaDB',
      type: 'SINK',
      beam_transform: 'KineticaDB',
      ...(props !== undefined ? { properties: props } : {}),
      ...extraData,
    },
  });

  it('renders with undefined properties and displays required validation errors', () => {
    render(<KineticaDBSinkProperties node={makeNode(undefined)} onChange={vi.fn()} />);

    expect(screen.getByText('KineticaIO.write()')).toBeInTheDocument();
    expect(screen.getByText('Head node URL is required.')).toBeInTheDocument();
    expect(screen.getByText('Username is required.')).toBeInTheDocument();
    expect(screen.getByText('Password secret is required.')).toBeInTheDocument();
    expect(screen.getByText('Table is required.')).toBeInTheDocument();
    expect(screen.getByText('Entity class name is required.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'At least one column is required (RecordObject must have at least one column).'
      )
    ).toBeInTheDocument();
  });

  it('validates headNodeURL and entityClassName error branches on sink panel', () => {
    const { rerender } = render(
      <KineticaDBSinkProperties
        node={makeNode({
          ...validProps,
          headNodeURL: 'http://admin:secret@127.0.0.1:9191',
          entityClassName: 'lowercaseName',
        })}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText('Do not embed credentials in the URL; use Username and Password Secret.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Use a Java class name starting with an uppercase letter (e.g. KineticaRecord).'
      )
    ).toBeInTheDocument();

    rerender(
      <KineticaDBSinkProperties
        node={makeNode({
          ...validProps,
          headNodeURL: 'ftp://127.0.0.1:9191',
        })}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText(
        'Each URL must start with http:// or https:// (e.g. http://127.0.0.1:9191).'
      )
    ).toBeInTheDocument();
  });

  it('treats non-array entityColumns as an empty array', () => {
    render(
      <KineticaDBSinkProperties
        node={makeNode({ ...validProps, entityColumns: 'invalid' })}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText(
        'At least one column is required (RecordObject must have at least one column).'
      )
    ).toBeInTheDocument();
  });

  it('renders valid properties without errors and never renders plaintext password inputs', () => {
    const { container } = render(
      <KineticaDBSinkProperties node={makeNode(validProps)} onChange={vi.fn()} />
    );

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText(/Head Node URL/i, { selector: 'input' })).toHaveValue(
      'http://127.0.0.1:9191'
    );
    expect(screen.getByLabelText(/Username/i, { selector: 'input' })).toHaveValue('admin');
    expect(screen.getByLabelText(/Password Secret/i, { selector: 'input' })).toHaveValue(
      'kinetica-password'
    );
    expect(screen.getByLabelText(/^Table/i, { selector: 'input' })).toHaveValue(
      'ki_home.scientists_out'
    );
    expect(screen.getByLabelText(/Entity Class Name/i, { selector: 'input' })).toHaveValue(
      'Scientist'
    );

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('input[name="password"]')).toBeNull();
  });


  it('emits updated properties when fields and entity columns change', () => {
    const onChange = vi.fn();
    render(<KineticaDBSinkProperties node={makeNode(validProps)} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/Head Node URL/i, { selector: 'input' }), {
      target: { name: 'headNodeURL', value: 'http://kinetica-sink:9191' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...validProps,
      headNodeURL: 'http://kinetica-sink:9191',
    });

    fireEvent.change(screen.getByLabelText(/Username/i, { selector: 'input' }), {
      target: { name: 'username', value: 'writer' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...validProps,
      username: 'writer',
    });

    fireEvent.change(screen.getByLabelText(/Password Secret/i, { selector: 'input' }), {
      target: { name: 'passwordSecret', value: 'sink-pw-secret' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...validProps,
      passwordSecret: 'sink-pw-secret',
    });

    fireEvent.change(screen.getByLabelText(/^Table/i, { selector: 'input' }), {
      target: { name: 'table', value: 'ki_home.curated' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...validProps,
      table: 'ki_home.curated',
    });

    fireEvent.change(screen.getByLabelText(/Entity Class Name/i, { selector: 'input' }), {
      target: { name: 'entityClassName', value: 'CuratedRow' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...validProps,
      entityClassName: 'CuratedRow',
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Column/i }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...validProps,
      entityColumns: [
        ...validColumns,
        { name: '', javaType: 'String', columnProperties: '' },
      ],
    });
  });

  it('updates system_instructions on change', () => {
    const onChange = vi.fn();
    render(
      <KineticaDBSinkProperties
        node={makeNode(validProps)}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/Code Generation Instructions/i), {
      target: { name: 'system_instructions', value: 'custom sink instructions' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ system_instructions: 'custom sink instructions' })
    );
  });

  it('classifies every emitted property key as safe or reference via classifyKey', () => {
    const onChange = vi.fn();
    render(<KineticaDBSinkProperties node={makeNode(validProps)} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/Code Generation Instructions/i), {
      target: { name: 'system_instructions', value: 'custom' },
    });

    const emitted = onChange.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    for (const key of Object.keys(emitted)) {
      expect(['safe', 'reference']).toContain(classifyKey(key));
    }
    expect(classifyKey('passwordSecret')).toBe('reference');
  });
});
