/**
 * Unit Tests for HCatalogIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates HCatalogIOSinkProperties form rendering, hydration from properties,
 * input change dispatches (metastoreUri, database, table, partition, batchSize, configProperties),
 * Thrift URI format validation, required fields validation, Kerberos & Secret Manager authentication modes,
 * IPC callbacks for GCP Secret Manager secrets, advanced settings collapse, error and edge cases,
 * and code generation instructions fallback resolution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HCatalogIOSinkProperties } from './HCatalogIO';

describe('HCatalogIOSinkProperties', () => {
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
        label: 'HCatalog Sink',
        properties: {}
      }
    };

    render(<HCatalogIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('thrift://localhost:9083')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my_table')).toBeInTheDocument();
    expect(screen.getByText('Hive Metastore URI is required')).toBeInTheDocument();
    expect(screen.getByText('Table is required')).toBeInTheDocument();
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('displays warning when Metastore URI does not start with thrift://', () => {
    const node = {
      data: {
        label: 'HCatalog Sink',
        properties: {
          metastoreUri: 'bolt://localhost:9083'
        }
      }
    };

    render(<HCatalogIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByText(/Warning: Hive Metastore URIs typically start with thrift:\/\//i)).toBeInTheDocument();
  });

  it('hydrates form fields from node properties', () => {
    const node = {
      data: {
        label: 'HCatalog Sink',
        properties: {
          metastoreUri: 'thrift://metastore-prod:9083',
          database: 'sales_db',
          table: 'daily_aggregates',
          partition: 'year=2026\nmonth=09',
          batchSize: 2048,
          configProperties: 'hive.metastore.client.socket.timeout=600',
          authMode: 'kerberos' as const,
          kerberosPrincipal: 'hive/meta@CORP.NET',
          keytabSecret: 'meta-keytab',
          hiveSitePath: '/opt/hive/hive-site.xml',
          clientTimeoutSeconds: 600,
          commitBehavior: 'DIRECT_WRITE',
          system_instructions: 'Write daily aggregates to partitioned Hive table'
        }
      }
    };

    render(<HCatalogIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('thrift://localhost:9083')).toHaveValue('thrift://metastore-prod:9083');
    expect(screen.getByPlaceholderText('default')).toHaveValue('sales_db');
    expect(screen.getByPlaceholderText('my_table')).toHaveValue('daily_aggregates');
    expect(screen.getByPlaceholderText(/ds=2026-09-23/i)).toHaveValue('year=2026\nmonth=09');
    expect(screen.getByPlaceholderText('1024')).toHaveValue(2048);
    expect(screen.getByPlaceholderText(/hive.metastore.client.socket.timeout/i)).toHaveValue('hive.metastore.client.socket.timeout=600');
    expect(screen.getByPlaceholderText(/hive\/metastore.example.com@EXAMPLE.COM/i)).toHaveValue('hive/meta@CORP.NET');
    expect(screen.getByPlaceholderText(/hive-metastore-keytab/i)).toHaveValue('meta-keytab');

    // Advanced settings
    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('/etc/hive/conf/hive-site.xml')).toHaveValue('/opt/hive/hive-site.xml');
    expect(screen.getByPlaceholderText('120')).toHaveValue(600);
    expect(screen.getByPlaceholderText(/e.g. DIRECT_WRITE/i)).toHaveValue('DIRECT_WRITE');

    expect(screen.getByPlaceholderText(/Write PCollection<HCatRecord>/i)).toHaveValue('Write daily aggregates to partitioned Hive table');
  });

  it('dispatches updates for metastoreUri, database, table, partition, and batchSize', () => {
    const node = {
      data: {
        label: 'HCatalog Sink',
        properties: {}
      }
    };

    render(<HCatalogIOSinkProperties node={node} onChange={mockOnChange} />);

    const uriInput = screen.getByPlaceholderText('thrift://localhost:9083');
    fireEvent.change(uriInput, { target: { name: 'metastoreUri', value: 'thrift://cluster-meta:9083' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      metastoreUri: 'thrift://cluster-meta:9083'
    }));

    const dbInput = screen.getByPlaceholderText('default');
    fireEvent.change(dbInput, { target: { name: 'database', value: 'marketing' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      database: 'marketing'
    }));

    const tableInput = screen.getByPlaceholderText('my_table');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'campaign_results' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      table: 'campaign_results'
    }));

    const partInput = screen.getByPlaceholderText(/ds=2026-09-23/i);
    fireEvent.change(partInput, { target: { name: 'partition', value: 'campaign=fall2026' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      partition: 'campaign=fall2026'
    }));

    const batchInput = screen.getByPlaceholderText('1024');
    fireEvent.change(batchInput, { target: { name: 'batchSize', value: '512' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      batchSize: '512'
    }));
  });

  it('supports Secret Manager authentication mode with IPC secretsLoaded', () => {
    const node = {
      data: {
        label: 'HCatalog Sink',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<HCatalogIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText(/hive-auth-credentials/i)).toBeInTheDocument();

    // Simulate IPC secretsLoaded event
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [
          'projects/gcp/secrets/hcat-sink-token',
          { id: 'hcat-secret', name: 'hcat-secret' }
        ]
      }
    }));

    const option1 = document.querySelector('datalist#hcatalog-sink-secret-options option[value="hcat-sink-token"]');
    const option2 = document.querySelector('datalist#hcatalog-sink-secret-options option[value="hcat-secret"]');
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error message when secret discovery fails', () => {
    const node = {
      data: {
        label: 'HCatalog Sink',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<HCatalogIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        error: 'Failed to access Secret Manager'
      }
    }));

    expect(screen.getByText('Failed to access Secret Manager')).toBeInTheDocument();
  });

  it('toggles Advanced Sink Settings and updates parameters', () => {
    const node = {
      data: {
        label: 'HCatalog Sink',
        properties: {}
      }
    };

    render(<HCatalogIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    const siteInput = screen.getByPlaceholderText('/etc/hive/conf/hive-site.xml');
    fireEvent.change(siteInput, { target: { name: 'hiveSitePath', value: '/custom/hive-site.xml' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      hiveSitePath: '/custom/hive-site.xml'
    }));

    const timeoutInput = screen.getByPlaceholderText('120');
    fireEvent.change(timeoutInput, { target: { name: 'clientTimeoutSeconds', value: '240' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      clientTimeoutSeconds: '240'
    }));

    const commitInput = screen.getByPlaceholderText(/e.g. DIRECT_WRITE/i);
    fireEvent.change(commitInput, { target: { name: 'commitBehavior', value: 'STAGED' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      commitBehavior: 'STAGED'
    }));
  });

  it('handles edge cases: missing properties, numeric 0 values', () => {
    const nodeWithoutProps = {
      data: {
        label: 'HCatalog Sink'
      }
    };

    const { rerender } = render(<HCatalogIOSinkProperties node={nodeWithoutProps as any} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('thrift://localhost:9083')).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'HCatalog Sink',
        properties: {
          metastoreUri: 'thrift://localhost:9083',
          table: 'dest_table',
          batchSize: 0,
          clientTimeoutSeconds: 0
        }
      }
    };

    rerender(<HCatalogIOSinkProperties node={nodeWithZeros} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('1024')).toHaveValue(0);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);
    expect(screen.getByPlaceholderText('120')).toHaveValue(0);
  });

  it('resolves system instructions via fallback chain and handles edits', () => {
    const node = {
      data: {
        label: 'HCatalog Sink',
        properties: {
          special_instructions: 'Custom write instructions for HCatalog sink'
        }
      }
    };

    render(<HCatalogIOSinkProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Write PCollection<HCatRecord>/i);
    expect(textarea).toHaveValue('Custom write instructions for HCatalog sink');

    fireEvent.change(textarea, { target: { value: 'Updated write instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated write instructions'
    }));
  });
});
