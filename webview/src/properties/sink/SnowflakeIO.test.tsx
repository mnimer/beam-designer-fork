/**
 * Unit Tests for SnowflakeIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates SnowflakeIOSinkProperties form rendering, hydration, property change dispatching,
 * destination table, staging bucket/integration validation, write/create dispositions,
 * auth mode switching, IPC callbacks for GCP Secret Manager, and system instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SnowflakeIOSinkProperties } from './SnowflakeIO';

describe('SnowflakeIOSinkProperties', () => {
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

  it('renders required connection, staging, and table fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'Snowflake Sink',
        properties: {}
      }
    };

    render(<SnowflakeIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('e.g. xy12345.us-central1.gcp.snowflakecomputing.com')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. ANALYTICS_DB')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. AGGREGATED_METRICS')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('gs://my-bucket/staging-path/')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. GCS_STORAGE_INT')).toBeInTheDocument();

    expect(screen.getByText('Snowflake account/server name is required')).toBeInTheDocument();
    expect(screen.getByText('Snowflake database is required')).toBeInTheDocument();
    expect(screen.getByText('Destination table name is required')).toBeInTheDocument();
    expect(screen.getByText('Staging bucket name is required')).toBeInTheDocument();
    expect(screen.getByText('Storage integration name is required')).toBeInTheDocument();

    const tableInput = screen.getByPlaceholderText('e.g. AGGREGATED_METRICS');
    expect(tableInput).toHaveAttribute('aria-invalid', 'true');
    expect(tableInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('renders hydrated values from node.data.properties', () => {
    const node = {
      data: {
        label: 'Snowflake Sink',
        properties: {
          serverName: 'xy12345.snowflakecomputing.com',
          database: 'DATA_WAREHOUSE',
          schema: 'PUBLIC',
          warehouse: 'BATCH_WH',
          role: 'WRITER_ROLE',
          table: 'DAILY_SUMMARIES',
          stagingBucketName: 'gs://snowflake-write-staging/',
          storageIntegrationName: 'GCS_WRITE_INT',
          writeDisposition: 'TRUNCATE' as const,
          createDisposition: 'CREATE_IF_NEEDED' as const,
          userDataMapper: 'com.example.SummaryUserDataMapper',
          tableSchema: 'com.example.SummaryTableSchema',
          quotationMark: '"',
          fileNameTemplate: 'shard-%s.csv',
          authMode: 'username_password' as const,
          usernameSecret: 'WRITER_USER_SECRET',
          passwordSecret: 'writer-password'
        }
      }
    };

    render(<SnowflakeIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('xy12345.snowflakecomputing.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DATA_WAREHOUSE')).toBeInTheDocument();
    expect(screen.getByDisplayValue('BATCH_WH')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DAILY_SUMMARIES')).toBeInTheDocument();
    expect(screen.getByDisplayValue('gs://snowflake-write-staging/')).toBeInTheDocument();
    expect(screen.getByDisplayValue('GCS_WRITE_INT')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TRUNCATE (Truncate table before writing)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CREATE_IF_NEEDED')).toBeInTheDocument();
    expect(screen.getByDisplayValue('com.example.SummaryTableSchema')).toBeInTheDocument();
    expect(screen.getByDisplayValue('shard-%s.csv')).toBeInTheDocument();
  });

  it('updates table, database, and staging bucket inputs and dispatches changes', () => {
    const node = {
      data: {
        label: 'Snowflake Sink',
        properties: {
          serverName: 'xy12345'
        }
      }
    };

    render(<SnowflakeIOSinkProperties node={node} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('e.g. AGGREGATED_METRICS');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'SENSOR_SUMMARIES' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      serverName: 'xy12345',
      table: 'SENSOR_SUMMARIES'
    });

    const bucketInput = screen.getByPlaceholderText('gs://my-bucket/staging-path/');
    fireEvent.change(bucketInput, { target: { name: 'stagingBucketName', value: 'gs://new-bucket/stage/' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      serverName: 'xy12345',
      stagingBucketName: 'gs://new-bucket/stage/'
    });
  });

  it('updates writeDisposition and createDisposition', () => {
    const node = {
      data: {
        label: 'Snowflake Sink',
        properties: {
          serverName: 'xy12345',
          writeDisposition: 'APPEND' as const,
          createDisposition: 'CREATE_IF_NEEDED' as const
        }
      }
    };

    render(<SnowflakeIOSinkProperties node={node} onChange={mockOnChange} />);

    const writeDispSelect = screen.getByRole('combobox', { name: /^Write Disposition/i });
    fireEvent.change(writeDispSelect, { target: { name: 'writeDisposition', value: 'EMPTY' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        writeDisposition: 'EMPTY'
      })
    );

    const createDispSelect = screen.getByRole('combobox', { name: /^Create Disposition/i });
    fireEvent.change(createDispSelect, { target: { name: 'createDisposition', value: 'CREATE_NEVER' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        createDisposition: 'CREATE_NEVER'
      })
    );
  });

  it('supports Key Pair and OAuth authentication modes in sink', () => {
    const node = {
      data: {
        label: 'Snowflake Sink',
        properties: {
          authMode: 'key_pair' as const,
          usernameSecret: 'KEY_USER_SECRET',
          privateKeySecret: 'sink-pk-secret'
        }
      }
    };

    render(<SnowflakeIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. snowflake-rsa-private-key')).toHaveValue('sink-pk-secret');

    const authSelect = screen.getByRole('combobox', { name: /^Authentication Strategy/i });
    fireEvent.change(authSelect, { target: { name: 'authMode', value: 'oauth' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        authMode: 'oauth'
      })
    );
  });

  it('supports Secret Manager authentication mode in sink', () => {
    const node = {
      data: {
        label: 'Snowflake Sink',
        properties: {
          authMode: 'username_password' as const,
          passwordSecret: 'snowflake-sink-pw'
        }
      }
    };

    render(<SnowflakeIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. snowflake-password')).toHaveValue('snowflake-sink-pw');
  });

  it('toggles Advanced Sink Settings and updates flush row limit and login timeout', () => {
    const node = {
      data: {
        label: 'Snowflake Sink',
        properties: {
          flushRowLimit: 5000,
          loginTimeout: 30,
          extraParameters: 'AUTOCOMMIT=TRUE'
        }
      }
    };

    render(<SnowflakeIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    const flushInput = screen.getByPlaceholderText('e.g. 10000');
    expect(flushInput).toHaveValue(5000);

    const timeoutInput = screen.getByPlaceholderText('e.g. 60');
    expect(timeoutInput).toHaveValue(30);

    fireEvent.change(flushInput, { target: { name: 'flushRowLimit', value: '25000' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        flushRowLimit: '25000'
      })
    );
  });

  it('handles edge case of missing properties object cleanly', () => {
    const node = {
      data: {
        label: 'Snowflake Sink'
      }
    };

    render(<SnowflakeIOSinkProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByText('Snowflake account/server name is required')).toBeInTheDocument();
    expect(screen.getByText('Snowflake database is required')).toBeInTheDocument();
    expect(screen.getByText('Destination table name is required')).toBeInTheDocument();
  });


  it('updates system_instructions when textarea changes', () => {
    const node = {
      data: {
        label: 'Snowflake Sink',
        properties: {}
      }
    };

    render(<SnowflakeIOSinkProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(
      'Custom prompt instructions for generating the Apache Beam SnowflakeIO sink step...'
    );
    fireEvent.change(textarea, {
      target: { value: 'Write records to Snowflake table using user data mapper and staging bucket.' }
    });

    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Write records to Snowflake table using user data mapper and staging bucket.'
    });
  });
});
