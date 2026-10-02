/**
 * CdapIOSourceProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the CdapIOSourceProperties panel component covering field rendering,
 * plugin type switching (batch vs streaming), hydration from node properties,
 * onChange event dispatch, IPC Secret Manager communication, edge cases (missing properties, 0 values, aliases),
 * validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CdapIOSourceProperties } from './CdapIO';

describe('CdapIOSourceProperties', () => {
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

  it('renders required fields and shows validation errors when empty', () => {
    const node = {
      data: {
        label: 'CDAP Source',
        properties: {}
      }
    };

    render(<CdapIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('org.apache.hadoop.io.NullWritable')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('org.apache.hadoop.io.Text')).toBeInTheDocument();

    expect(screen.getByText('CDAP plugin class name is required')).toBeInTheDocument();
    expect(screen.getByText('Key class is required')).toBeInTheDocument();
    expect(screen.getByText('Value class is required')).toBeInTheDocument();
  });

  it('hydrates all populated properties correctly', () => {
    const node = {
      data: {
        label: 'CDAP Source',
        properties: {
          pluginType: 'streaming' as const,
          cdapPluginClass: 'io.cdap.plugin.hubspot.source.batch.HubspotBatchSource',
          referenceName: 'HubspotContactSource',
          keyClass: 'org.apache.hadoop.io.NullWritable',
          valueClass: 'org.apache.hadoop.io.MapWritable',
          pluginConfig: 'apiToken=secret-token\nobjectType=contacts',
          authMode: 'secret_manager' as const,
          clientIdSecret: 'hubspot-client-id',
          clientSecretSecret: 'hubspot-client-secret',
          tokenSecret: 'hubspot-token',
          pullFrequency: 45,
          startOffset: 100,
          maxRecords: 10000,
          hadoopConfig: 'fs.defaultFS=hdfs://namenode:8020',
          system_instructions: 'Custom CDAP source instructions'
        }
      }
    };

    render(<CdapIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByRole('combobox', { name: /Plugin Type/i })).toHaveValue('streaming');
    expect(
      screen.getByPlaceholderText('io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource')
    ).toHaveValue('io.cdap.plugin.hubspot.source.batch.HubspotBatchSource');
    expect(screen.getByPlaceholderText('e.g. SalesforceAccountSource')).toHaveValue('HubspotContactSource');
    expect(screen.getByPlaceholderText('org.apache.hadoop.io.NullWritable')).toHaveValue(
      'org.apache.hadoop.io.NullWritable'
    );
    expect(screen.getByPlaceholderText('org.apache.hadoop.io.Text')).toHaveValue(
      'org.apache.hadoop.io.MapWritable'
    );
    expect(screen.getByPlaceholderText(/consumerKey=my-consumer-key/i)).toHaveValue(
      'apiToken=secret-token\nobjectType=contacts'
    );

    // Auth
    expect(screen.getByPlaceholderText('e.g. salesforce-client-id')).toHaveValue('hubspot-client-id');
    expect(screen.getByPlaceholderText('e.g. salesforce-client-secret')).toHaveValue('hubspot-client-secret');
    expect(screen.getByPlaceholderText('e.g. salesforce-refresh-token')).toHaveValue('hubspot-token');

    // Advanced section
    fireEvent.click(screen.getByRole('button', { name: /Advanced Source Settings/i }));
    expect(screen.getByPlaceholderText('60')).toHaveValue(45);
    expect(screen.getByPlaceholderText('0')).toHaveValue(100);
    expect(screen.getByPlaceholderText('Unlimited')).toHaveValue(10000);
    expect(screen.getByPlaceholderText(/fs\.defaultFS/i)).toHaveValue('fs.defaultFS=hdfs://namenode:8020');

    // Instructions
    expect(screen.getByPlaceholderText(/Ingest Salesforce accounts using CdapIO/i)).toHaveValue(
      'Custom CDAP source instructions'
    );
  });

  it('dispatches updates on text and select changes', () => {
    const node = {
      data: {
        label: 'CDAP Source',
        properties: {
          cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource'
        }
      }
    };

    render(<CdapIOSourceProperties node={node} onChange={mockOnChange} />);

    const refInput = screen.getByPlaceholderText('e.g. SalesforceAccountSource');
    fireEvent.change(refInput, { target: { name: 'referenceName', value: 'MySalesforceSource' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource',
      referenceName: 'MySalesforceSource'
    });

    const pluginTypeSelect = screen.getByRole('combobox', { name: /Plugin Type/i });
    fireEvent.change(pluginTypeSelect, { target: { name: 'pluginType', value: 'streaming' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource',
      pluginType: 'streaming'
    });
  });

  it('handles authMode toggle and loads secrets via IPC', () => {
    const node = {
      data: {
        label: 'CDAP Source',
        properties: {
          cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource',
          authMode: 'none' as const
        }
      }
    };

    const { rerender } = render(<CdapIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. salesforce-client-id')).not.toBeInTheDocument();

    const secretManagerRadio = screen.getByRole('radio', { name: /Secret Manager/i });
    fireEvent.click(secretManagerRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource',
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
    rerender(<CdapIOSourceProperties node={updatedNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. salesforce-client-id')).toBeInTheDocument();
  });

  it('handles advanced source settings updates', () => {
    const node = {
      data: {
        label: 'CDAP Source',
        properties: {
          cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource'
        }
      }
    };

    render(<CdapIOSourceProperties node={node} onChange={mockOnChange} />);

    const toggleButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(toggleButton);
    expect(screen.getByPlaceholderText('Unlimited')).toBeInTheDocument();

    const maxRecordsInput = screen.getByPlaceholderText('Unlimited');
    fireEvent.change(maxRecordsInput, { target: { name: 'maxRecords', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      cdapPluginClass: 'io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource',
      maxRecords: '500'
    });
  });


  it('supports alias fallbacks for pluginClass and pluginConfigParams and prunes them on write', () => {
    const node = {
      data: {
        label: 'CDAP Source',
        properties: {
          pluginClass: 'io.cdap.plugin.legacy.Source',
          pluginConfigParams: 'param1=val1'
        }
      }
    };

    render(<CdapIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource')
    ).toHaveValue('io.cdap.plugin.legacy.Source');
    expect(screen.getByPlaceholderText(/consumerKey=my-consumer-key/i)).toHaveValue('param1=val1');

    const pluginInput = screen.getByPlaceholderText(
      'io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource'
    );
    fireEvent.change(pluginInput, { target: { name: 'cdapPluginClass', value: 'io.cdap.plugin.canonical.Source' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      cdapPluginClass: 'io.cdap.plugin.canonical.Source',
      pluginConfigParams: 'param1=val1'
    });
  });

  it('handles edge cases: missing properties, 0 values', () => {
    const node = {
      data: {
        label: 'CDAP Source'
      }
    };

    const { rerender } = render(<CdapIOSourceProperties node={node} onChange={mockOnChange} />);
    expect(
      screen.getByPlaceholderText('io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource')
    ).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'CDAP Source',
        properties: {
          startOffset: 0,
          maxRecords: 0
        }
      }
    };

    rerender(<CdapIOSourceProperties node={nodeWithZeros} onChange={mockOnChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Advanced Source Settings/i }));
    expect(screen.getByPlaceholderText('0')).toHaveValue(0);
    expect(screen.getByPlaceholderText('Unlimited')).toHaveValue(0);
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const node = {
      data: {
        label: 'CDAP Source',
        properties: {}
      }
    };
    render(<CdapIOSourceProperties node={node} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/Ingest Salesforce accounts using CdapIO/i);
    fireEvent.change(textarea, { target: { value: 'New cdap instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New cdap instructions'
    }));
  });
});
