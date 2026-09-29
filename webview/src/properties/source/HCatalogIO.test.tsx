/**
 * Unit Tests for HCatalogIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates HCatalogIOSourceProperties form rendering, hydration from properties,
 * input change dispatches, Thrift URI format validation, required fields validation,
 * Kerberos & Secret Manager authentication modes, IPC callbacks for GCP Secret Manager secrets,
 * advanced settings collapse, error and edge cases, and code generation instructions fallback resolution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HCatalogIOSourceProperties } from './HCatalogIO';

describe('HCatalogIOSourceProperties', () => {
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

  it('renders required Metastore URI and Table fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'HCatalog Source',
        properties: {}
      }
    };

    render(<HCatalogIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('thrift://localhost:9083')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my_table')).toBeInTheDocument();
    expect(screen.getByText('Hive Metastore URI is required')).toBeInTheDocument();
    expect(screen.getByText('Table is required')).toBeInTheDocument();
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('displays warning when Metastore URI does not start with thrift://', () => {
    const node = {
      data: {
        label: 'HCatalog Source',
        properties: {
          metastoreUri: 'http://metastore.example.com:9083'
        }
      }
    };

    render(<HCatalogIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByText(/Warning: Hive Metastore URIs typically start with thrift:\/\//i)).toBeInTheDocument();
  });

  it('hydrates form fields from node properties', () => {
    const node = {
      data: {
        label: 'HCatalog Source',
        properties: {
          metastoreUri: 'thrift://hive-meta.corp:9083',
          database: 'warehouse',
          table: 'events_log',
          filter: "ds = '2026-09-23'",
          partitionCols: 'ds, hr',
          configProperties: 'hive.metastore.client.socket.timeout=300',
          authMode: 'kerberos' as const,
          kerberosPrincipal: 'hive/meta.corp@CORP.NET',
          keytabSecret: 'hive-keytab',
          hiveSitePath: '/etc/hive/hive-site.xml',
          splitSize: 134217728,
          clientTimeoutSeconds: 300,
          system_instructions: 'Extract web events from Hive table'
        }
      }
    };

    render(<HCatalogIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('thrift://localhost:9083')).toHaveValue('thrift://hive-meta.corp:9083');
    expect(screen.getByPlaceholderText('default')).toHaveValue('warehouse');
    expect(screen.getByPlaceholderText('my_table')).toHaveValue('events_log');
    expect(screen.getByPlaceholderText(/ds = '2026-09-23'/i)).toHaveValue("ds = '2026-09-23'");
    expect(screen.getByPlaceholderText(/ds, region/i)).toHaveValue('ds, hr');
    expect(screen.getByPlaceholderText(/hive.metastore.client.socket.timeout/i)).toHaveValue('hive.metastore.client.socket.timeout=300');
    expect(screen.getByPlaceholderText(/hive\/metastore.example.com@EXAMPLE.COM/i)).toHaveValue('hive/meta.corp@CORP.NET');
    expect(screen.getByPlaceholderText(/hive-metastore-keytab/i)).toHaveValue('hive-keytab');

    // Advanced settings
    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('/etc/hive/conf/hive-site.xml')).toHaveValue('/etc/hive/hive-site.xml');
    expect(screen.getByPlaceholderText('67108864')).toHaveValue(134217728);
    expect(screen.getByPlaceholderText('120')).toHaveValue(300);

    expect(screen.getByPlaceholderText(/Read HCatRecord records/i)).toHaveValue('Extract web events from Hive table');
  });

  it('dispatches updates for metastoreUri, database, table, filter, and partitionCols', () => {
    const node = {
      data: {
        label: 'HCatalog Source',
        properties: {}
      }
    };

    render(<HCatalogIOSourceProperties node={node} onChange={mockOnChange} />);

    const uriInput = screen.getByPlaceholderText('thrift://localhost:9083');
    fireEvent.change(uriInput, { target: { name: 'metastoreUri', value: 'thrift://prod-meta:9083' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      metastoreUri: 'thrift://prod-meta:9083'
    }));

    const dbInput = screen.getByPlaceholderText('default');
    fireEvent.change(dbInput, { target: { name: 'database', value: 'analytics' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      database: 'analytics'
    }));

    const tableInput = screen.getByPlaceholderText('my_table');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'user_actions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      table: 'user_actions'
    }));

    const filterInput = screen.getByPlaceholderText(/ds = '2026-09-23'/i);
    fireEvent.change(filterInput, { target: { name: 'filter', value: 'year=2026' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      filter: 'year=2026'
    }));

    const colsInput = screen.getByPlaceholderText(/ds, region/i);
    fireEvent.change(colsInput, { target: { name: 'partitionCols', value: 'year, month' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      partitionCols: 'year, month'
    }));
  });

  it('supports Secret Manager authentication mode and handles IPC secretsLoaded', () => {
    const node = {
      data: {
        label: 'HCatalog Source',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<HCatalogIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText(/hive-auth-credentials/i)).toBeInTheDocument();

    // Simulate IPC secretsLoaded event
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [
          'projects/my-proj/secrets/hive-auth-token',
          { id: 'hive-user-key', name: 'hive-user-key' }
        ]
      }
    }));

    const option1 = document.querySelector('datalist#hcatalog-source-secret-options option[value="hive-auth-token"]');
    const option2 = document.querySelector('datalist#hcatalog-source-secret-options option[value="hive-user-key"]');
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error when secret discovery fails in secret_manager mode', () => {
    const node = {
      data: {
        label: 'HCatalog Source',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<HCatalogIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        error: 'Secret Manager unavailable'
      }
    }));

    expect(screen.getByText('Secret Manager unavailable')).toBeInTheDocument();
  });

  it('expands Advanced Source Settings and updates parameters', () => {
    const node = {
      data: {
        label: 'HCatalog Source',
        properties: {}
      }
    };

    render(<HCatalogIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const siteInput = screen.getByPlaceholderText('/etc/hive/conf/hive-site.xml');
    fireEvent.change(siteInput, { target: { name: 'hiveSitePath', value: '/custom/hive-site.xml' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      hiveSitePath: '/custom/hive-site.xml'
    }));

    const splitInput = screen.getByPlaceholderText('67108864');
    fireEvent.change(splitInput, { target: { name: 'splitSize', value: '33554432' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      splitSize: '33554432'
    }));

    const timeoutInput = screen.getByPlaceholderText('120');
    fireEvent.change(timeoutInput, { target: { name: 'clientTimeoutSeconds', value: '180' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      clientTimeoutSeconds: '180'
    }));
  });

  it('handles edge cases: missing properties, numeric 0 values', () => {
    const nodeWithoutProps = {
      data: {
        label: 'HCatalog Source'
      }
    };

    const { rerender } = render(<HCatalogIOSourceProperties node={nodeWithoutProps as any} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('thrift://localhost:9083')).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'HCatalog Source',
        properties: {
          metastoreUri: 'thrift://localhost:9083',
          table: 'test_table',
          splitSize: 0,
          clientTimeoutSeconds: 0
        }
      }
    };

    rerender(<HCatalogIOSourceProperties node={nodeWithZeros} onChange={mockOnChange} />);
    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);
    expect(screen.getByPlaceholderText('67108864')).toHaveValue(0);
    expect(screen.getByPlaceholderText('120')).toHaveValue(0);
  });

  it('resolves system instructions via fallback chain and handles edits', () => {
    const node = {
      data: {
        label: 'HCatalog Source',
        special_instructions: 'Custom special instructions for HCatalog'
      }
    };

    render(<HCatalogIOSourceProperties node={node as any} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Read HCatRecord records/i);
    expect(textarea).toHaveValue('Custom special instructions for HCatalog');

    fireEvent.change(textarea, { target: { value: 'Updated prompt for HCatalog' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated prompt for HCatalog'
    }));
  });
});
