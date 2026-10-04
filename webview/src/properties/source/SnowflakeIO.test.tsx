/**
 * Unit Tests for SnowflakeIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates SnowflakeIOSourceProperties form rendering, hydration, property change dispatching,
 * query vs table read target branch validation, staging parameters, auth mode switching,
 * field validation, and system instructions editing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SnowflakeIOSourceProperties } from './SnowflakeIO';

describe('SnowflakeIOSourceProperties', () => {
  const mockOnChange = vi.fn();
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    postMessageSpy = vi.fn();
    (window as any).vscode = { postMessage: postMessageSpy };
  });

  afterEach(() => {
    delete (window as any).vscode;
  });

  it('renders required connection, staging, and query fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'Snowflake Source',
        properties: {}
      }
    };

    render(<SnowflakeIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('e.g. xy12345.us-central1.gcp.snowflakecomputing.com')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. ANALYTICS_DB')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/SELECT id, name, amount/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('gs://my-bucket/staging-path/')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. GCS_STORAGE_INT')).toBeInTheDocument();

    expect(screen.getByText('Snowflake account/server name is required')).toBeInTheDocument();
    expect(screen.getByText('Snowflake database is required')).toBeInTheDocument();
    expect(screen.getByText('SQL query is required for Query read mode')).toBeInTheDocument();
    expect(screen.getByText('Staging bucket name is required')).toBeInTheDocument();
    expect(screen.getByText('Storage integration name is required')).toBeInTheDocument();

    const serverInput = screen.getByPlaceholderText('e.g. xy12345.us-central1.gcp.snowflakecomputing.com');
    expect(serverInput).toHaveAttribute('aria-invalid', 'true');
    expect(serverInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('renders hydrated values from node.data.properties in query mode', () => {
    const node = {
      data: {
        label: 'Snowflake Source',
        properties: {
          serverName: 'my-org-my-account.snowflakecomputing.com',
          database: 'PROD_DB',
          schema: 'PUBLIC',
          warehouse: 'LOAD_WH',
          role: 'DATA_ENG',
          readMode: 'query' as const,
          query: 'SELECT * FROM EVENTS',
          stagingBucketName: 'gs://snowflake-dataflow-staging/',
          storageIntegrationName: 'GCS_INT_PROD',
          csvMapper: 'com.example.EventCsvMapper',
          coder: 'AvroCoder.of(Event.class)',
          authMode: 'username_password' as const,
          usernameSecret: 'ETL_USER_SECRET',
          passwordSecret: 'etl-pass'
        }
      }
    };

    render(<SnowflakeIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByDisplayValue('my-org-my-account.snowflakecomputing.com')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('PROD_DB')).toBeInTheDocument();
    expect(screen.getByDisplayValue('PUBLIC')).toBeInTheDocument();
    expect(screen.getByDisplayValue('LOAD_WH')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DATA_ENG')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SELECT * FROM EVENTS')).toBeInTheDocument();
    expect(screen.getByDisplayValue('gs://snowflake-dataflow-staging/')).toBeInTheDocument();
    expect(screen.getByDisplayValue('GCS_INT_PROD')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ETL_USER_SECRET')).toBeInTheDocument();
    expect(screen.getByDisplayValue('etl-pass')).toBeInTheDocument();
  });

  it('switches to table read mode and displays table name with validation', () => {
    const node = {
      data: {
        label: 'Snowflake Source',
        properties: {
          readMode: 'table' as const,
          table: ''
        }
      }
    };

    render(<SnowflakeIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. TRANSACTIONS')).toBeInTheDocument();
    expect(screen.getByText('Table name is required for Table read mode')).toBeInTheDocument();

    const tableInput = screen.getByPlaceholderText('e.g. TRANSACTIONS');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'CUSTOMERS' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        table: 'CUSTOMERS'
      })
    );
  });

  it('updates text inputs and dispatches changes', () => {
    const node = {
      data: {
        label: 'Snowflake Source',
        properties: {
          serverName: 'xy12345'
        }
      }
    };

    render(<SnowflakeIOSourceProperties node={node} onChange={mockOnChange} />);

    const dbInput = screen.getByPlaceholderText('e.g. ANALYTICS_DB');
    fireEvent.change(dbInput, { target: { name: 'database', value: 'SALES_DB' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      serverName: 'xy12345',
      database: 'SALES_DB'
    });

    const stagingInput = screen.getByPlaceholderText('gs://my-bucket/staging-path/');
    fireEvent.change(stagingInput, {
      target: { name: 'stagingBucketName', value: 'gs://my-bucket/stage/' }
    });
    expect(mockOnChange).toHaveBeenCalledWith({
      serverName: 'xy12345',
      stagingBucketName: 'gs://my-bucket/stage/'
    });
  });

  it('supports Key Pair authentication mode and reveals private key secrets', () => {
    const node = {
      data: {
        label: 'Snowflake Source',
        properties: {
          authMode: 'key_pair' as const,
          usernameSecret: 'KEY_USER_SECRET',
          privateKeySecret: 'pk-secret',
          privateKeyPassphraseSecret: 'pk-passphrase'
        }
      }
    };

    render(<SnowflakeIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. snowflake-rsa-private-key')).toHaveValue('pk-secret');
    expect(screen.getByPlaceholderText('e.g. snowflake-key-passphrase')).toHaveValue('pk-passphrase');
  });

  it('supports OAuth authentication mode and reveals oauth token secret', () => {
    const node = {
      data: {
        label: 'Snowflake Source',
        properties: {
          authMode: 'oauth' as const,
          oauthTokenSecret: 'oauth-token-secret'
        }
      }
    };

    render(<SnowflakeIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. snowflake-oauth-token')).toHaveValue('oauth-token-secret');
    expect(screen.queryByPlaceholderText('e.g. snowflake-username')).not.toBeInTheDocument();
  });


  it('toggles Advanced Source Settings and updates quotation mark and timeout', () => {
    const node = {
      data: {
        label: 'Snowflake Source',
        properties: {
          quotationMark: '"',
          loginTimeout: 0,
          extraParameters: 'CLIENT_SESSION_KEEP_ALIVE=true'
        }
      }
    };

    render(<SnowflakeIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const quoteInput = screen.getByPlaceholderText('e.g. "');
    expect(quoteInput).toHaveValue('"');

    const timeoutInput = screen.getByPlaceholderText('e.g. 60');
    expect(timeoutInput).toHaveValue(0);

    const extraInput = screen.getByPlaceholderText('CLIENT_SESSION_KEEP_ALIVE=true');
    expect(extraInput).toHaveValue('CLIENT_SESSION_KEEP_ALIVE=true');

    fireEvent.change(timeoutInput, { target: { name: 'loginTimeout', value: '120' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        loginTimeout: '120'
      })
    );
  });

  it('handles edge case of missing properties object cleanly', () => {
    const node = {
      data: {
        label: 'Snowflake Source'
      }
    };

    render(<SnowflakeIOSourceProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByText('Snowflake account/server name is required')).toBeInTheDocument();
    expect(screen.getByText('Snowflake database is required')).toBeInTheDocument();
  });


  it('updates system_instructions when textarea changes', () => {
    const node = {
      data: {
        label: 'Snowflake Source',
        properties: {}
      }
    };

    render(<SnowflakeIOSourceProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(
      'Custom prompt instructions for generating the Apache Beam SnowflakeIO source step...'
    );
    fireEvent.change(textarea, {
      target: { value: 'Read from Snowflake via query and staging bucket.' }
    });

    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Read from Snowflake via query and staging bucket.'
    });
  });
});
