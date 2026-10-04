/**
 * PyodbcSourceProperties Unit Tests (IO76)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PyodbcSourceProperties } from './Pyodbc';
import { classifyKey } from '../../../../src/credentialRedaction';

const PYODBC_DRIVER_SUGGESTIONS = [
  'ODBC Driver 18 for SQL Server',
  'ODBC Driver 17 for SQL Server',
  'PostgreSQL Unicode',
  'MySQL ODBC 8.0 Unicode Driver',
];

describe('PyodbcSourceProperties', () => {
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
    const onChange = vi.fn();
    const { container } = render(<PyodbcSourceProperties node={mkNode(undefined)} onChange={onChange} />);

    const driverOptions = Array.from(
      container.querySelectorAll('#pyodbc-source-driver-options option')
    ).map((o) => o.getAttribute('value'));
    expect(driverOptions).toEqual(PYODBC_DRIVER_SUGGESTIONS);

    const portInput = container.querySelector('#pyodbcSourcePort') as HTMLInputElement;
    expect(portInput).toHaveAttribute('placeholder', 'driver default');

    expect(screen.getByText('ODBC driver is required.')).toBeInTheDocument();
    expect(screen.getByText('Host is required.')).toBeInTheDocument();
    expect(screen.getByText('Database is required.')).toBeInTheDocument();
    expect(screen.getByText('User is required.')).toBeInTheDocument();
    expect(screen.getByText('Password secret is required.')).toBeInTheDocument();
    expect(screen.getByText('Query is required.')).toBeInTheDocument();
  });

  it('renders without alerts when all properties are valid', () => {
    render(
      <PyodbcSourceProperties
        node={mkNode({
          driver: 'ODBC Driver 18 for SQL Server',
          host: '10.0.0.5',
          port: '1433',
          database: 'orders_db',
          user: 'reader_user',
          passwordSecret: 'orders-db-pw',
          extraAttributes: 'Encrypt=yes;TrustServerCertificate=no;;',
          query: 'SELECT * FROM dbo.orders',
        })}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryAllByRole('alert')).toHaveLength(0);
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
      <PyodbcSourceProperties node={mkNode({ driver: cases[0][0] })} onChange={vi.fn()} />
    );

    for (const [driverName, expectedPlaceholder] of cases) {
      rerender(<PyodbcSourceProperties node={mkNode({ driver: driverName })} onChange={vi.fn()} />);
      const portInput = container.querySelector('#pyodbcSourcePort') as HTMLInputElement;
      expect(portInput).toHaveAttribute('placeholder', expectedPlaceholder);
    }
  });

  it('validates driver, host, port, and extraAttributes across all branches', () => {
    const baseValid = {
      driver: 'ODBC Driver 18 for SQL Server',
      host: 'db.example.com',
      port: '1433',
      database: 'db',
      user: 'u',
      passwordSecret: 'pw',
      extraAttributes: '',
      query: 'SELECT 1',
    };

    const { rerender } = render(
      <PyodbcSourceProperties
        node={mkNode({
          ...baseValid,
          driver: '{BadDriver}',
          host: 'bad,host',
          port: 'abc',
          extraAttributes: 'Encrypt',
        })}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText(/without braces or ';'/)).toBeInTheDocument();
    expect(screen.getByText(/hostname or IP address only/)).toBeInTheDocument();
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();
    expect(screen.getByText("Use key=value pairs separated by ';'.")).toBeInTheDocument();

    // Port < 1 ('0') and extraAttributes credential key ('PWD=secret')
    rerender(
      <PyodbcSourceProperties
        node={mkNode({
          ...baseValid,
          port: '0',
          extraAttributes: 'Encrypt=yes; PWD=secret',
        })}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();
    expect(screen.getByText(/Credentials are not allowed here/)).toBeInTheDocument();

    // Port > 65535 ('65536') and extraAttributes dedicated key ('Server=myhost')
    rerender(
      <PyodbcSourceProperties
        node={mkNode({
          ...baseValid,
          port: '65536',
          extraAttributes: 'Server=myhost',
        })}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();
    expect(
      screen.getByText('Server has its own field. Remove it from Extra Attributes.')
    ).toBeInTheDocument();
  });

  it('emits updated properties on field changes while preserving existing keys and classifies all keys as safe or reference', () => {
    const onChange = vi.fn();
    const { container } = render(
      <PyodbcSourceProperties node={mkNode({ existingKey: 'preserved' })} onChange={onChange} />
    );

    const edits: Array<[string, string, string]> = [
      ['#pyodbcSourceDriver', 'driver', 'ODBC Driver 18 for SQL Server'],
      ['#pyodbcSourceHost', 'host', '10.20.0.5'],
      ['#pyodbcSourcePort', 'port', '1433'],
      ['#pyodbcSourceDatabase', 'database', 'orders_oltp'],
      ['#pyodbcSourceUser', 'user', 'beam_reader'],
      ['#pyodbcSourcePasswordSecret', 'passwordSecret', 'orders-pw-secret'],
      ['#pyodbcSourceExtraAttributes', 'extraAttributes', 'Encrypt=yes'],
      ['#pyodbcSourceQuery', 'query', 'SELECT * FROM dbo.orders'],
      ['#pyodbcSourceSystemInstructions', 'system_instructions', 'custom read instructions'],
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


});
