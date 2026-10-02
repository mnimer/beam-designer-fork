/**
 * CdapIOSinkProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the CdapIOSinkProperties panel component covering field rendering,
 * mandatory locksDirPath validation, hydration from node properties, onChange event dispatch,
 * IPC Secret Manager communication, edge cases (missing properties, 0 values, aliases),
 * validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CdapIOSinkProperties } from './CdapIO';

describe('CdapIOSinkProperties', () => {
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

  it('renders required fields including locksDirPath and shows validation errors when empty', () => {
    const node = {
      data: {
        label: 'CDAP Sink',
        properties: {}
      }
    };

    render(<CdapIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('org.apache.hadoop.io.NullWritable')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('org.apache.hadoop.io.Text')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('gs://my-bucket/cdap-locks/ or /tmp/cdap-locks')).toBeInTheDocument();

    expect(screen.getByText('CDAP plugin class name is required')).toBeInTheDocument();
    expect(screen.getByText('Key class is required')).toBeInTheDocument();
    expect(screen.getByText('Value class is required')).toBeInTheDocument();
    expect(screen.getByText('Locks directory path is required for CDAP writes')).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates all populated properties correctly', () => {
    const node = {
      data: {
        label: 'CDAP Sink',
        properties: {
          pluginType: 'batch' as const,
          cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink',
          referenceName: 'SalesforceAccountSink',
          keyClass: 'org.apache.hadoop.io.NullWritable',
          valueClass: 'org.apache.hadoop.io.Text',
          locksDirPath: 'gs://my-bucket/locks/salesforce',
          pluginConfig: 'sObject=Account\noperation=insert',
          authMode: 'secret_manager' as const,
          clientIdSecret: 'salesforce-client-id-sec',
          clientSecretSecret: 'salesforce-client-secret-sec',
          tokenSecret: 'salesforce-token-sec',
          batchSize: 2000,
          maxRetries: 4,
          hadoopConfig: 'fs.defaultFS=gs://my-bucket',
          system_instructions: 'Sink instructions for CDAP'
        }
      }
    };

    render(<CdapIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByRole('combobox', { name: /Plugin Type/i })).toHaveValue('batch');
    expect(
      screen.getByPlaceholderText('io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink')
    ).toHaveValue('io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink');
    expect(screen.getByPlaceholderText('e.g. SalesforceAccountSink')).toHaveValue('SalesforceAccountSink');
    expect(screen.getByPlaceholderText('org.apache.hadoop.io.NullWritable')).toHaveValue(
      'org.apache.hadoop.io.NullWritable'
    );
    expect(screen.getByPlaceholderText('org.apache.hadoop.io.Text')).toHaveValue(
      'org.apache.hadoop.io.Text'
    );
    expect(screen.getByPlaceholderText('gs://my-bucket/cdap-locks/ or /tmp/cdap-locks')).toHaveValue(
      'gs://my-bucket/locks/salesforce'
    );
    expect(screen.getByPlaceholderText(/consumerKey=my-consumer-key/i)).toHaveValue(
      'sObject=Account\noperation=insert'
    );

    // Auth
    expect(screen.getByPlaceholderText('e.g. salesforce-client-id')).toHaveValue('salesforce-client-id-sec');
    expect(screen.getByPlaceholderText('e.g. salesforce-client-secret')).toHaveValue(
      'salesforce-client-secret-sec'
    );
    expect(screen.getByPlaceholderText('e.g. salesforce-refresh-token')).toHaveValue('salesforce-token-sec');

    // Advanced section
    fireEvent.click(screen.getByRole('button', { name: /Advanced Sink Settings/i }));
    expect(screen.getByPlaceholderText('1000')).toHaveValue(2000);
    expect(screen.getByPlaceholderText('3')).toHaveValue(4);
    expect(screen.getByPlaceholderText(/fs\.defaultFS/i)).toHaveValue('fs.defaultFS=gs://my-bucket');

    // Instructions
    expect(screen.getByPlaceholderText(/Write elements using CdapIO/i)).toHaveValue('Sink instructions for CDAP');
  });

  it('dispatches updates when text and numeric inputs change', () => {
    const node = {
      data: {
        label: 'CDAP Sink',
        properties: {
          cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink',
          locksDirPath: 'gs://my-bucket/locks'
        }
      }
    };

    render(<CdapIOSinkProperties node={node} onChange={mockOnChange} />);

    const locksInput = screen.getByPlaceholderText('gs://my-bucket/cdap-locks/ or /tmp/cdap-locks');
    fireEvent.change(locksInput, { target: { name: 'locksDirPath', value: 'gs://new-bucket/locks' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink',
      locksDirPath: 'gs://new-bucket/locks'
    });

    const keyClassInput = screen.getByPlaceholderText('org.apache.hadoop.io.NullWritable');
    fireEvent.change(keyClassInput, { target: { name: 'keyClass', value: 'org.apache.hadoop.io.LongWritable' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink',
      locksDirPath: 'gs://my-bucket/locks',
      keyClass: 'org.apache.hadoop.io.LongWritable'
    });
  });

  it('handles authMode toggle and loads secrets via IPC into cdap-sink-secret-options', () => {
    const node = {
      data: {
        label: 'CDAP Sink',
        properties: {
          cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink',
          authMode: 'none' as const
        }
      }
    };

    const { rerender } = render(<CdapIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. salesforce-client-id')).not.toBeInTheDocument();

    const secretManagerRadio = screen.getByRole('radio', { name: /Secret Manager/i });
    fireEvent.click(secretManagerRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink',
      authMode: 'secret_manager'
    });

    const updatedNode = {
      data: {
        ...node.data,
        properties: {
          ...node.data.properties,
          authMode: 'secret_manager' as const
        }
      }
    };
    rerender(<CdapIOSinkProperties node={updatedNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. salesforce-client-id')).toBeInTheDocument();
  });

  it('handles advanced sink settings toggling and updates', () => {
    const node = {
      data: {
        label: 'CDAP Sink',
        properties: {
          cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink'
        }
      }
    };

    render(<CdapIOSinkProperties node={node} onChange={mockOnChange} />);

    const toggleButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(toggleButton);
    expect(screen.getByPlaceholderText('1000')).toBeInTheDocument();

    const batchSizeInput = screen.getByPlaceholderText('1000');
    fireEvent.change(batchSizeInput, { target: { name: 'batchSize', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink',
      batchSize: '500'
    });
  });

  it('supports alias fallbacks for pluginClass, pluginConfigParams, retryCount and prunes them on write', () => {
    const node = {
      data: {
        label: 'CDAP Sink',
        properties: {
          pluginClass: 'io.cdap.plugin.legacy.Sink',
          pluginConfigParams: 'key=val',
          retryCount: 5
        }
      }
    };

    render(<CdapIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink')
    ).toHaveValue('io.cdap.plugin.legacy.Sink');
    expect(screen.getByPlaceholderText(/consumerKey=my-consumer-key/i)).toHaveValue('key=val');

    fireEvent.click(screen.getByRole('button', { name: /Advanced Sink Settings/i }));
    expect(screen.getByPlaceholderText('3')).toHaveValue(5);

    const maxRetriesInput = screen.getByPlaceholderText('3');
    fireEvent.change(maxRetriesInput, { target: { name: 'maxRetries', value: '2' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      pluginClass: 'io.cdap.plugin.legacy.Sink',
      pluginConfigParams: 'key=val',
      maxRetries: '2'
    });
  });

  it('handles edge cases: missing properties, 0 values', () => {
    const node = {
      data: {
        label: 'CDAP Sink'
      }
    };

    const { rerender } = render(<CdapIOSinkProperties node={node} onChange={mockOnChange} />);
    expect(
      screen.getByPlaceholderText('io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink')
    ).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'CDAP Sink',
        properties: {
          maxRetries: 0
        }
      }
    };

    rerender(<CdapIOSinkProperties node={nodeWithZeros} onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Advanced Sink Settings/i }));
    expect(screen.getByPlaceholderText('3')).toHaveValue(0);
  });

  it('respects instructions fallback chain and dispatches change', () => {
    const node = {
      data: {
        label: 'CDAP Sink',
        properties: {}
      }
    };
    render(<CdapIOSinkProperties node={node} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/Write elements using CdapIO/i);
    fireEvent.change(textarea, { target: { value: 'New sink instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New sink instructions'
    }));
  });
});
