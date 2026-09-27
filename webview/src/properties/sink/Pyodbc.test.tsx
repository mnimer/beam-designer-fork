/**
 * PyodbcSinkProperties Unit Tests (IO76)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PyodbcSinkProperties } from './Pyodbc';
import { classifyKey } from '../../../../src/credentialRedaction';

const PYODBC_DOCS_URL = 'https://github.com/314e/beam-pyodbc-connector';

const PYODBC_DRIVER_SUGGESTIONS = [
  'ODBC Driver 18 for SQL Server',
  'ODBC Driver 17 for SQL Server',
  'PostgreSQL Unicode',
  'MySQL ODBC 8.0 Unicode Driver',
];

describe('PyodbcSinkProperties', () => {
  const mockPostMessage = vi.fn();
  const vscodeWindow = window as unknown as { vscode?: { postMessage: typeof mockPostMessage } };

  beforeEach(() => {
    mockPostMessage.mockClear();
    vscodeWindow.vscode = { postMessage: mockPostMessage };
  });

  afterEach(() => {
    delete vscodeWindow.vscode;
  });

  const mkNode = (
    props?: Record<string, unknown>,
    extraData?: { system_instructions?: string; special_instructions?: string }
  ) => ({
    data: {
      label: 'Pyodbc',
      ...(props !== undefined ? { properties: props } : {}),
      ...extraData,
    },
  });

  it('renders all fields with defaults when properties is undefined and shows required errors', () => {
    const { container } = render(<PyodbcSinkProperties node={mkNode(undefined)} onChange={vi.fn()} />);

    const driverOptions = Array.from(
      container.querySelectorAll('#pyodbc-sink-driver-options option')
    ).map((o) => o.getAttribute('value'));
    expect(driverOptions).toEqual(PYODBC_DRIVER_SUGGESTIONS);

    const portInput = container.querySelector('#pyodbcSinkPort') as HTMLInputElement;
    expect(portInput).toHaveAttribute('placeholder', 'driver default');

    const batchInput = container.querySelector('#pyodbcSinkBatchSize') as HTMLInputElement;
    expect(batchInput).toHaveAttribute('placeholder', '1000');

    expect(screen.getByText('ODBC driver is required.')).toBeInTheDocument();
    expect(screen.getByText('Host is required.')).toBeInTheDocument();
    expect(screen.getByText('Database is required.')).toBeInTheDocument();
    expect(screen.getByText('Table is required.')).toBeInTheDocument();
    expect(screen.getByText('User is required.')).toBeInTheDocument();
    expect(screen.getByText('Password secret is required.')).toBeInTheDocument();
  });

  it('renders without alerts when all properties are valid', () => {
    render(
      <PyodbcSinkProperties
        node={mkNode({
          driver: 'ODBC Driver 18 for SQL Server',
          host: '10.20.0.9',
          port: 1433,
          database: 'orders_reporting',
          table: 'dbo.orders_daily',
          user: 'beam_writer',
          passwordSecret: 'orders-reporting-pw',
          extraAttributes: 'Encrypt=yes;TrustServerCertificate=no;;',
          batchSize: 500,
        })}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('opens external documentation link when Docs button is clicked (with and without window.vscode)', () => {
    render(<PyodbcSinkProperties node={mkNode({})} onChange={vi.fn()} />);

    const docsBtn = screen.getByRole('button', { name: /Docs/i });
    fireEvent.click(docsBtn);
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'openExternal',
      url: PYODBC_DOCS_URL,
    });

    mockPostMessage.mockClear();
    delete vscodeWindow.vscode;
    expect(() => fireEvent.click(docsBtn)).not.toThrow();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('computes driver-specific port placeholders for SQL Server, PostgreSQL, MySQL/MariaDB, and default', () => {
    const cases: Array<[string, string]> = [
      ['ODBC Driver 18 for SQL Server', '1433'],
      ['PostgreSQL Unicode', '5432'],
      ['MySQL ODBC 8.0 Unicode Driver', '3306'],
      ['MariaDB ODBC 3.1 Driver', '3306'],
      ['FreeTDS', 'driver default'],
    ];

    const { container, rerender } = render(
      <PyodbcSinkProperties node={mkNode({ driver: cases[0][0] })} onChange={vi.fn()} />
    );

    for (const [driverName, expectedPlaceholder] of cases) {
      rerender(<PyodbcSinkProperties node={mkNode({ driver: driverName })} onChange={vi.fn()} />);
      const portInput = container.querySelector('#pyodbcSinkPort') as HTMLInputElement;
      expect(portInput).toHaveAttribute('placeholder', expectedPlaceholder);
    }
  });

  it('displays validation errors across all branches for driver, host, port, table, extraAttributes, and batchSize', () => {
    const baseValid = {
      driver: 'ODBC Driver 18 for SQL Server',
      host: '10.20.0.9',
      port: '1433',
      database: 'db',
      table: 'dbo.orders_daily',
      user: 'u',
      passwordSecret: 'pw',
      extraAttributes: '',
      batchSize: '500',
    };

    const { rerender } = render(
      <PyodbcSinkProperties
        node={mkNode({
          ...baseValid,
          driver: '{Bad}',
          host: 'bad;host',
          port: 'abc',
          table: 'bad table;',
          extraAttributes: 'Encrypt',
          batchSize: 'abc',
        })}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText(/without braces or ';'/)).toBeInTheDocument();
    expect(screen.getByText(/hostname or IP address only/)).toBeInTheDocument();
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();
    expect(screen.getByText("Table name must not contain spaces, quotes or ';'.")).toBeInTheDocument();
    expect(screen.getByText("Use key=value pairs separated by ';'.")).toBeInTheDocument();
    expect(screen.getByText('Batch size must be a positive integer.')).toBeInTheDocument();

    // Port < 1 ('0'), extraAttributes credential key ('PWD=secret'), batchSize < 1 ('0')
    rerender(
      <PyodbcSinkProperties
        node={mkNode({
          ...baseValid,
          port: '0',
          extraAttributes: 'PWD=secret',
          batchSize: '0',
        })}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();
    expect(screen.getByText(/Credentials are not allowed here/)).toBeInTheDocument();
    expect(screen.getByText('Batch size must be a positive integer.')).toBeInTheDocument();

    // Port > 65535 ('65536') and extraAttributes dedicated key ('DSN=my_dsn')
    rerender(
      <PyodbcSinkProperties
        node={mkNode({
          ...baseValid,
          port: '65536',
          extraAttributes: 'DSN=my_dsn',
        })}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();
    expect(screen.getByText('DSN has its own field. Remove it from Extra Attributes.')).toBeInTheDocument();
  });

  it('emits updated properties on field changes while preserving existing keys and classifies all keys as safe or reference', () => {
    const onChange = vi.fn();
    const { container } = render(
      <PyodbcSinkProperties node={mkNode({ existingKey: 'preserved' })} onChange={onChange} />
    );

    const edits: Array<[string, string, string]> = [
      ['#pyodbcSinkDriver', 'driver', 'ODBC Driver 18 for SQL Server'],
      ['#pyodbcSinkHost', 'host', '10.20.0.9'],
      ['#pyodbcSinkPort', 'port', '1433'],
      ['#pyodbcSinkDatabase', 'database', 'orders_reporting'],
      ['#pyodbcSinkTable', 'table', 'dbo.orders_daily'],
      ['#pyodbcSinkUser', 'user', 'beam_writer'],
      ['#pyodbcSinkPasswordSecret', 'passwordSecret', 'orders-writer-pw'],
      ['#pyodbcSinkExtraAttributes', 'extraAttributes', 'Encrypt=yes'],
      ['#pyodbcSinkBatchSize', 'batchSize', '500'],
      ['#pyodbcSinkSystemInstructions', 'system_instructions', 'custom write instructions'],
    ];

    for (const [selector, key, val] of edits) {
      const el = container.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      expect(el).not.toBeNull();
      fireEvent.change(el, { target: { name: key, value: val } });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          existingKey: 'preserved',
          [key]: val,
        })
      );
      expect(['safe', 'reference']).toContain(classifyKey(key));
    }

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('[name="password"]')).toBeNull();
  });

  it('requests secrets via SecretManagerSecretField and populates datalist options on secretsLoaded', () => {
    render(<PyodbcSinkProperties node={mkNode({})} onChange={vi.fn()} />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'secretsLoaded', secrets: ['writer-pw'] },
        })
      );
    });

    const options = Array.from(
      document.querySelectorAll('#pyodbcSinkPasswordSecret-secret-options option')
    ).map((o) => o.getAttribute('value'));
    expect(options).toEqual(['writer-pw']);
  });

  it('resolves system_instructions fallback chain in priority order', () => {
    const { unmount: u1 } = render(
      <PyodbcSinkProperties
        node={mkNode(
          { system_instructions: 'prop-sys', special_instructions: 'prop-spec' },
          { system_instructions: 'node-sys', special_instructions: 'node-spec' }
        )}
        onChange={vi.fn()}
      />
    );
    expect((document.querySelector('#pyodbcSinkSystemInstructions') as HTMLTextAreaElement).value).toBe('node-sys');
    u1();

    const { unmount: u2 } = render(
      <PyodbcSinkProperties
        node={mkNode(
          { system_instructions: 'prop-sys', special_instructions: 'prop-spec' },
          { special_instructions: 'node-spec' }
        )}
        onChange={vi.fn()}
      />
    );
    expect((document.querySelector('#pyodbcSinkSystemInstructions') as HTMLTextAreaElement).value).toBe('node-spec');
    u2();

    const { unmount: u3 } = render(
      <PyodbcSinkProperties
        node={mkNode({ system_instructions: 'prop-sys', special_instructions: 'prop-spec' })}
        onChange={vi.fn()}
      />
    );
    expect((document.querySelector('#pyodbcSinkSystemInstructions') as HTMLTextAreaElement).value).toBe('prop-sys');
    u3();

    const { unmount: u4 } = render(
      <PyodbcSinkProperties
        node={mkNode({ special_instructions: 'prop-spec' })}
        onChange={vi.fn()}
      />
    );
    expect((document.querySelector('#pyodbcSinkSystemInstructions') as HTMLTextAreaElement).value).toBe('prop-spec');
    u4();
  });
});
