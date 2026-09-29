/**
 * Unit Tests for SparkReceiverIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates SparkReceiverIOSourceProperties form rendering, hydration, dispatching,
 * IPC callbacks for GCP Secret Manager, field validation, and system instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SparkReceiverIOSourceProperties } from './SparkReceiverIO';

describe('SparkReceiverIOSourceProperties', () => {
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

  it('renders required Receiver Class field, alerts when empty, and displays replayability callout', () => {
    const node = {
      data: {
        label: 'Spark Receiver Source',
        properties: {}
      }
    };

    render(<SparkReceiverIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('e.g. io.cdap.plugin.salesforce.SalesforceStreamingReceiver')
    ).toBeInTheDocument();
    expect(screen.getByText('Spark Receiver class name is required')).toBeInTheDocument();

    const classInput = screen.getByPlaceholderText('e.g. io.cdap.plugin.salesforce.SalesforceStreamingReceiver');
    expect(classInput).toHaveAttribute('aria-invalid', 'true');
    expect(classInput).toHaveAttribute('aria-required', 'true');

    // Replayability banner
    expect(screen.getByText(/Replayability & Exactly-Once Semantics/i)).toBeInTheDocument();
    expect(
      screen.getByText(/The configured Spark Receiver must be offset-based and replayable/i)
    ).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('renders hydrated values from node.data.properties', () => {
    const node = {
      data: {
        label: 'Spark Receiver Source',
        properties: {
          receiverClass: 'org.apache.spark.streaming.hubspot.HubspotReceiver',
          constructorArgs: 'apiKey=xyz123\nportalId=456',
          storageLevel: 'MEMORY_ONLY'
        }
      }
    };

    render(<SparkReceiverIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('org.apache.spark.streaming.hubspot.HubspotReceiver')).toBeInTheDocument();
    expect(screen.getByLabelText(/Receiver Constructor Arguments/i)).toHaveValue('apiKey=xyz123\nportalId=456');
  });

  it('fires onChange when editing receiverClass and constructorArgs', () => {
    const node = {
      data: {
        label: 'Spark Receiver Source',
        properties: {
          receiverClass: 'org.apache.spark.streaming.custom.MyReceiver'
        }
      }
    };

    render(<SparkReceiverIOSourceProperties node={node} onChange={mockOnChange} />);

    const classInput = screen.getByDisplayValue('org.apache.spark.streaming.custom.MyReceiver');
    fireEvent.change(classInput, { target: { name: 'receiverClass', value: 'com.example.UpdatedReceiver' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ receiverClass: 'com.example.UpdatedReceiver' })
    );

    const argsInput = screen.getByLabelText(/Receiver Constructor Arguments/i);
    fireEvent.change(argsInput, { target: { name: 'constructorArgs', value: 'endpoint=https://api.example.com' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ constructorArgs: 'endpoint=https://api.example.com' })
    );
  });

  it('handles Secret Manager IPC callback and radio selection', () => {
    const node = {
      data: {
        label: 'Spark Receiver Source',
        properties: {
          authMode: 'secret_manager',
          authSecret: 'spark-api-key',
          usernameSecret: 'spark-user',
          passwordSecret: 'spark-pass'
        }
      }
    };

    render(<SparkReceiverIOSourceProperties node={node} onChange={mockOnChange} />);

    // IPC message with string and object shapes
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            'projects/my-project/secrets/spark-api-key',
            { id: 'spark-token-secret', name: 'spark-token-secret' }
          ]
        }
      })
    );

    const datalist = document.getElementById('sparkreceiver-source-secret-options');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);

    expect(screen.getByDisplayValue('spark-api-key')).toBeInTheDocument();
    expect(screen.getByDisplayValue('spark-user')).toBeInTheDocument();
    expect(screen.getByDisplayValue('spark-pass')).toBeInTheDocument();

    const authSecretInput = screen.getByDisplayValue('spark-api-key');
    fireEvent.change(authSecretInput, { target: { name: 'authSecret', value: 'new-api-key-secret' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ authSecret: 'new-api-key-secret' })
    );
  });

  it('displays secret loading errors from IPC callback', () => {
    const node = {
      data: {
        label: 'Spark Receiver Source',
        properties: {
          authMode: 'secret_manager'
        }
      }
    };

    render(<SparkReceiverIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [],
          error: 'Access denied reading secrets'
        }
      })
    );

    expect(screen.getAllByText('Access denied reading secrets').length).toBeGreaterThan(0);
  });

  it('toggles authMode radio button between none and Secret Manager', () => {
    const node = {
      data: {
        label: 'Spark Receiver Source',
        properties: {
          authMode: 'none'
        }
      }
    };

    render(<SparkReceiverIOSourceProperties node={node} onChange={mockOnChange} />);

    const secretRadio = screen.getByLabelText('GCP Secret Manager');
    fireEvent.click(secretRadio);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ authMode: 'secret_manager' })
    );
  });

  it('expands Advanced Source Settings accordion and edits runtime settings', () => {
    const node = {
      data: {
        label: 'Spark Receiver Source',
        properties: {
          pullFrequencyMs: '',
          startOffset: '',
          maxRecordsPerBundle: '',
          restartOnFailure: true,
          storageLevel: 'MEMORY_AND_DISK_SER'
        }
      }
    };

    render(<SparkReceiverIOSourceProperties node={node} onChange={mockOnChange} />);

    const accordionBtn = screen.getByText('Advanced Source Settings');
    fireEvent.click(accordionBtn);

    const pullFreqInput = screen.getByPlaceholderText('e.g. 200');
    fireEvent.change(pullFreqInput, { target: { name: 'pullFrequencyMs', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ pullFrequencyMs: '500' })
    );

    const startOffsetInput = screen.getByPlaceholderText('e.g. 0');
    fireEvent.change(startOffsetInput, { target: { name: 'startOffset', value: '100' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ startOffset: '100' })
    );

    const maxRecordsInput = screen.getByPlaceholderText('e.g. 1000');
    fireEvent.change(maxRecordsInput, { target: { name: 'maxRecordsPerBundle', value: '2500' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxRecordsPerBundle: '2500' })
    );

    const storageLevelSelect = screen.getByLabelText(/Receiver Storage Level/i);
    fireEvent.change(storageLevelSelect, { target: { name: 'storageLevel', value: 'MEMORY_ONLY' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ storageLevel: 'MEMORY_ONLY' })
    );

    const restartCheckbox = screen.getByLabelText(/Restart Receiver on Failure/i);
    expect(restartCheckbox).toBeChecked();
    fireEvent.click(restartCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ restartOnFailure: false })
    );

    // Toggle closed
    fireEvent.click(accordionBtn);
    expect(screen.queryByPlaceholderText('e.g. 200')).not.toBeInTheDocument();
  });

  it('falls back through system instructions hierarchy and edits instructions', () => {
    // 1. node.data.system_instructions
    const { unmount: unmount1 } = render(
      <SparkReceiverIOSourceProperties
        node={{ data: { system_instructions: 'Data system instruction' } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Data system instruction')).toBeInTheDocument();
    unmount1();

    // 2. node.data.special_instructions
    const { unmount: unmount2 } = render(
      <SparkReceiverIOSourceProperties
        node={{ data: { special_instructions: 'Data special instruction' } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Data special instruction')).toBeInTheDocument();
    unmount2();

    // 3. properties.system_instructions
    const { unmount: unmount3 } = render(
      <SparkReceiverIOSourceProperties
        node={{ data: { properties: { system_instructions: 'Props system instruction' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Props system instruction')).toBeInTheDocument();
    unmount3();

    // 4. properties.special_instructions
    const { unmount: unmount4 } = render(
      <SparkReceiverIOSourceProperties
        node={{ data: { properties: { special_instructions: 'Props special instruction' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Props special instruction')).toBeInTheDocument();
    unmount4();

    // Edit instructions
    render(
      <SparkReceiverIOSourceProperties
        node={{ data: { properties: { receiverClass: 'com.example.TestReceiver' } } }}
        onChange={mockOnChange}
      />
    );
    const textarea = screen.getByPlaceholderText(
      'Custom prompt instructions for generating the Apache Beam SparkReceiverIO source step...'
    );
    fireEvent.change(textarea, { target: { value: 'Ensure custom coder is passed' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverClass: 'com.example.TestReceiver',
        system_instructions: 'Ensure custom coder is passed'
      })
    );
  });

  it('handles missing window.vscode gracefully on mount without crashing', () => {
    delete (window as any).vscode;
    const node = {
      data: {
        properties: {}
      }
    };

    expect(() => render(<SparkReceiverIOSourceProperties node={node} onChange={mockOnChange} />)).not.toThrow();
  });
});
