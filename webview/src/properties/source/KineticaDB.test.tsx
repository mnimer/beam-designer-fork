/**
 * KineticaDB Source Properties Unit Tests (IO70)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Exercises 100% of statements, branches, functions, and lines in
 * `webview/src/properties/source/KineticaDB.tsx`, including validation rules,
 * `KineticaEntityColumnsEditor`, `SecretManagerSecretField` integration,
 * external documentation link IPC, `classifyKey` credential redaction hygiene,
 * and static validation of `src/test/integration/kineticadb.beam`.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  KINETICA_DOC_URL,
  KineticaDBSourceProperties,
} from './KineticaDB';
import type { KineticaEntityColumn } from './KineticaDB';
import { classifyKey, redactPipelineYaml } from '../../../../src/credentialRedaction';

describe('KineticaDBSourceProperties (IO70)', () => {
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
    table: 'ki_home.scientists',
    entityClassName: 'Scientist',
    entityColumns: validColumns,
  };

  const makeNode = (
    props?: Record<string, unknown>,
    extraData?: Record<string, unknown>
  ) => ({
    data: {
      label: 'KineticaDB',
      type: 'SOURCE',
      beam_transform: 'KineticaDB',
      ...(props !== undefined ? { properties: props } : {}),
      ...extraData,
    },
  });

  describe('field validation via rendered component', () => {
    it('validates headNodeURL: empty, credentials-in-url, bad scheme, single URL, and HA multi-URL', () => {
      const { rerender } = render(
        <KineticaDBSourceProperties
          node={makeNode({ ...validProps, headNodeURL: '   ' })}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText('Head node URL is required.')).toBeInTheDocument();

      rerender(
        <KineticaDBSourceProperties
          node={makeNode({ ...validProps, headNodeURL: 'http://admin:secret@127.0.0.1:9191' })}
          onChange={vi.fn()}
        />
      );
      expect(
        screen.getByText('Do not embed credentials in the URL; use Username and Password Secret.')
      ).toBeInTheDocument();

      rerender(
        <KineticaDBSourceProperties
          node={makeNode({ ...validProps, headNodeURL: '127.0.0.1:9191' })}
          onChange={vi.fn()}
        />
      );
      expect(
        screen.getByText(
          'Each URL must start with http:// or https:// (e.g. http://127.0.0.1:9191).'
        )
      ).toBeInTheDocument();

      rerender(
        <KineticaDBSourceProperties
          node={makeNode({ ...validProps, headNodeURL: 'http://host1:9191,,ftp://host2:9191' })}
          onChange={vi.fn()}
        />
      );
      expect(
        screen.getByText(
          'Each URL must start with http:// or https:// (e.g. http://127.0.0.1:9191).'
        )
      ).toBeInTheDocument();

      rerender(
        <KineticaDBSourceProperties
          node={makeNode({
            ...validProps,
            headNodeURL: 'http://172.42.40.1:9191,,https://172.42.40.2:9191/gpudb',
          })}
          onChange={vi.fn()}
        />
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('validates entityClassName: empty, non-uppercase, and valid Java class names', () => {
      const { rerender } = render(
        <KineticaDBSourceProperties
          node={makeNode({ ...validProps, entityClassName: '   ' })}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText('Entity class name is required.')).toBeInTheDocument();

      rerender(
        <KineticaDBSourceProperties
          node={makeNode({ ...validProps, entityClassName: 'scientist' })}
          onChange={vi.fn()}
        />
      );
      expect(
        screen.getByText(
          'Use a Java class name starting with an uppercase letter (e.g. KineticaRecord).'
        )
      ).toBeInTheDocument();

      rerender(
        <KineticaDBSourceProperties
          node={makeNode({ ...validProps, entityClassName: 'Kinetica_Record1' })}
          onChange={vi.fn()}
        />
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('validates entityColumns: empty list, empty name, invalid identifier, duplicate, and unknown columnProperty', () => {
      render(
        <KineticaDBSourceProperties
          node={makeNode({
            ...validProps,
            entityColumns: [
              { name: '  ', javaType: 'String', columnProperties: '' },
              { name: 'bad-name', javaType: 'String', columnProperties: '' },
              { name: 'valid_1', javaType: 'Integer', columnProperties: 'char32 , nullable ,' },
              { name: 'valid_1', javaType: 'Long', columnProperties: '' },
              { name: 'valid_2', javaType: 'Double', columnProperties: 'char32, invalid_prop' },
            ],
          })}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText('Column name is required.')).toBeInTheDocument();
      expect(
        screen.getByText('Column name must be a valid Java identifier (letters, digits, _).')
      ).toBeInTheDocument();
      expect(screen.getByText('Duplicate column name.')).toBeInTheDocument();
      expect(screen.getByText('Unknown column property: invalid_prop')).toBeInTheDocument();
    });
  });

  describe('component rendering & interactions', () => {
    it('renders with undefined properties and displays required validation messages', () => {
      render(<KineticaDBSourceProperties node={makeNode(undefined)} onChange={vi.fn()} />);

      expect(screen.getByText('Connection')).toBeInTheDocument();
      expect(screen.getByText('Entity (RecordObject POJO)')).toBeInTheDocument();
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

    it('treats non-array entityColumns as an empty array', () => {
      render(
        <KineticaDBSourceProperties
          node={makeNode({ ...validProps, entityColumns: 'not-an-array' })}
          onChange={vi.fn()}
        />
      );
      expect(
        screen.getByText(
          'At least one column is required (RecordObject must have at least one column).'
        )
      ).toBeInTheDocument();
    });

    it('renders valid properties with zero error alerts and never renders plaintext password inputs', () => {
      const { container } = render(
        <KineticaDBSourceProperties node={makeNode(validProps)} onChange={vi.fn()} />
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
        'ki_home.scientists'
      );
      expect(screen.getByLabelText(/Entity Class Name/i, { selector: 'input' })).toHaveValue(
        'Scientist'
      );
      expect(screen.getByLabelText('Column name 1')).toHaveValue('sensorId');
      expect(screen.getByLabelText('Java type 2')).toHaveValue('Double');

      expect(container.querySelector('input[type="password"]')).toBeNull();
      expect(container.querySelector('input[name="password"]')).toBeNull();
      expect(container.querySelector('select[name="authMode"]')).toBeNull();
    });

    it('opens external Kinetica documentation when Docs ↗ button is clicked and handles missing vscode API', () => {
      render(<KineticaDBSourceProperties node={makeNode(validProps)} onChange={vi.fn()} />);

      const docsBtn = screen.getByRole('button', { name: 'Open KineticaIO documentation' });
      fireEvent.click(docsBtn);

      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'openExternal',
        url: KINETICA_DOC_URL,
      });

      mockPostMessage.mockClear();
      delete vscodeWindow.vscode;
      fireEvent.click(docsBtn);
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('loads Secret Manager secrets via getSecrets and populates datalist options', () => {
      render(<KineticaDBSourceProperties node={makeNode(validProps)} onChange={vi.fn()} />);

      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'secretsLoaded',
              secrets: ['projects/p/secrets/kinetica-password', 'backup-secret'],
            },
          })
        );
      });

      const options = Array.from(
        document.querySelectorAll('#kineticaSourcePasswordSecret-secret-options option')
      ).map((o) => o.getAttribute('value'));
      expect(options).toEqual(['kinetica-password', 'backup-secret']);
      expect(screen.getByText('gcloud secrets list')).toBeInTheDocument();
    });

    it('emits updated properties on field changes', () => {
      const onChange = vi.fn();
      render(<KineticaDBSourceProperties node={makeNode(validProps)} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText(/Head Node URL/i, { selector: 'input' }), {
        target: { name: 'headNodeURL', value: 'http://kinetica-prod:9191' },
      });
      expect(onChange).toHaveBeenLastCalledWith({
        ...validProps,
        headNodeURL: 'http://kinetica-prod:9191',
      });

      fireEvent.change(screen.getByLabelText(/Username/i, { selector: 'input' }), {
        target: { name: 'username', value: 'etl_user' },
      });
      expect(onChange).toHaveBeenLastCalledWith({
        ...validProps,
        username: 'etl_user',
      });

      fireEvent.change(screen.getByLabelText(/Password Secret/i, { selector: 'input' }), {
        target: { name: 'passwordSecret', value: 'new-kinetica-secret' },
      });
      expect(onChange).toHaveBeenLastCalledWith({
        ...validProps,
        passwordSecret: 'new-kinetica-secret',
      });

      fireEvent.change(screen.getByLabelText(/^Table/i, { selector: 'input' }), {
        target: { name: 'table', value: 'ki_home.events' },
      });
      expect(onChange).toHaveBeenLastCalledWith({
        ...validProps,
        table: 'ki_home.events',
      });

      fireEvent.change(screen.getByLabelText(/Entity Class Name/i, { selector: 'input' }), {
        target: { name: 'entityClassName', value: 'EventRecord' },
      });
      expect(onChange).toHaveBeenLastCalledWith({
        ...validProps,
        entityClassName: 'EventRecord',
      });
    });

    it('supports adding, editing, and removing entity columns and displays row errors', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <KineticaDBSourceProperties node={makeNode(validProps)} onChange={onChange} />
      );

      // Edit column 1 name
      fireEvent.change(screen.getByLabelText('Column name 1'), {
        target: { value: 'deviceId' },
      });
      expect(onChange).toHaveBeenLastCalledWith({
        ...validProps,
        entityColumns: [
          { name: 'deviceId', javaType: 'String', columnProperties: 'char32, primary_key' },
          validColumns[1],
        ],
      });

      // Edit column 2 javaType
      fireEvent.change(screen.getByLabelText('Java type 2'), {
        target: { value: 'ByteBuffer' },
      });
      expect(onChange).toHaveBeenLastCalledWith({
        ...validProps,
        entityColumns: [
          validColumns[0],
          { name: 'temperature', javaType: 'ByteBuffer', columnProperties: '' },
        ],
      });

      // Edit column 1 columnProperties
      fireEvent.change(screen.getByLabelText('Column properties 1'), {
        target: { value: 'char64' },
      });
      expect(onChange).toHaveBeenLastCalledWith({
        ...validProps,
        entityColumns: [
          { name: 'sensorId', javaType: 'String', columnProperties: 'char64' },
          validColumns[1],
        ],
      });

      // Add column
      fireEvent.click(screen.getByRole('button', { name: /Add Column/i }));
      expect(onChange).toHaveBeenLastCalledWith({
        ...validProps,
        entityColumns: [
          ...validColumns,
          { name: '', javaType: 'String', columnProperties: '' },
        ],
      });

      // Remove column 1
      fireEvent.click(screen.getByRole('button', { name: 'Remove column 1' }));
      expect(onChange).toHaveBeenLastCalledWith({
        ...validProps,
        entityColumns: [validColumns[1]],
      });

      // Render with invalid row to verify row alert rendering
      rerender(
        <KineticaDBSourceProperties
          node={makeNode({
            ...validProps,
            entityColumns: [{ name: '', javaType: 'String', columnProperties: '' }],
          })}
          onChange={onChange}
        />
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Column name is required.');
    });

    it('resolves system_instructions across all 4 fallback levels and updates on change', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <KineticaDBSourceProperties
          node={makeNode(validProps, { system_instructions: 'from node system' })}
          onChange={onChange}
        />
      );
      expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue(
        'from node system'
      );

      rerender(
        <KineticaDBSourceProperties
          node={makeNode(validProps, { special_instructions: 'from node special' })}
          onChange={onChange}
        />
      );
      expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue(
        'from node special'
      );

      rerender(
        <KineticaDBSourceProperties
          node={makeNode({ ...validProps, system_instructions: 'from props system' })}
          onChange={onChange}
        />
      );
      expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue(
        'from props system'
      );

      rerender(
        <KineticaDBSourceProperties
          node={makeNode({ ...validProps, special_instructions: 'from props special' })}
          onChange={onChange}
        />
      );
      expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue(
        'from props special'
      );

      fireEvent.change(screen.getByLabelText(/Code Generation Instructions/i), {
        target: { name: 'system_instructions', value: 'updated instructions' },
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ system_instructions: 'updated instructions' })
      );
    });

    it('classifies every emitted property key and nested column key as safe or reference via classifyKey', () => {
      const onChange = vi.fn();
      render(<KineticaDBSourceProperties node={makeNode(validProps)} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText(/Code Generation Instructions/i), {
        target: { name: 'system_instructions', value: 'custom' },
      });

      const emitted = onChange.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      const topKeys = Object.keys(emitted);
      expect(topKeys).toEqual(
        expect.arrayContaining([
          'headNodeURL',
          'username',
          'passwordSecret',
          'table',
          'entityClassName',
          'entityColumns',
          'system_instructions',
        ])
      );

      for (const key of topKeys) {
        const classification = classifyKey(key);
        expect(['safe', 'reference']).toContain(classification);
      }
      expect(classifyKey('passwordSecret')).toBe('reference');

      const colKeys = Object.keys((emitted.entityColumns as KineticaEntityColumn[])[0]);
      for (const key of colKeys) {
        expect(classifyKey(key)).toBe('safe');
      }
    });

    it('validates src/test/integration/sources/java/kineticadb-source.beam fixture with zero redactions and safe/reference keys', () => {
      const beamPath = path.resolve(
        __dirname,
        '../../../../src/test/integration/sources/java/kineticadb-source.beam'
      );
      const rawYaml = fs.readFileSync(beamPath, 'utf-8');
      const redaction = redactPipelineYaml(rawYaml);
      expect(redaction.redactedPaths).toEqual([]);

      const parsed = yaml.parse(rawYaml) as {
        nodes: Array<{ properties?: Record<string, unknown> }>;
      };
      expect(parsed.nodes.length).toBeGreaterThanOrEqual(3);
      for (const node of parsed.nodes) {
        for (const key of Object.keys(node.properties || {})) {
          expect(['safe', 'reference']).toContain(classifyKey(key));
        }
      }
    });
  });
});
