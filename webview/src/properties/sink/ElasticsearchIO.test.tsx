/**
 * Unit Tests for ElasticsearchIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates ElasticsearchIOSinkProperties form rendering, hydration, field validation,
 * scheme warning detection, bulk options, failure/retry settings, authentication mode toggling,
 * IPC callbacks for Secret Manager, collapsible advanced configuration, and system instructions.
 *
 * Architectural Decisions:
 * - Emulates VS Code extension host postMessage IPC to verify getSecrets request and response.
 * - Thoroughly tests normal hydration, dispatch updates, edge cases, failure states, and instruction fallbacks.
 * - Uses accessible role and placeholder queries to test UI state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ElasticsearchIOSinkProperties } from './ElasticsearchIO';

describe('ElasticsearchIOSinkProperties', () => {
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

  it('renders required cluster addresses and index fields with errors when empty', () => {
    const node = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {},
      },
    };

    render(<ElasticsearchIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('http://localhost:9200')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. sensor_aggregates')).toBeInTheDocument();
    expect(screen.getByText(/Cluster Addresses are required/i)).toBeInTheDocument();
    expect(screen.getByText(/Index is required/i)).toBeInTheDocument();

    const addrInput = screen.getByPlaceholderText('http://localhost:9200');
    expect(addrInput).toHaveAttribute('aria-invalid', 'true');
    const indexInput = screen.getByPlaceholderText('e.g. sensor_aggregates');
    expect(indexInput).toHaveAttribute('aria-invalid', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('validates URL scheme format warning on cluster addresses', () => {
    const node = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {
          addresses: 'node1:9200',
        },
      },
    };

    const { rerender } = render(<ElasticsearchIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByText(/Cluster address entries should include a URL scheme/i)).toBeInTheDocument();

    const validNode = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {
          addresses: 'https://node1:9200',
        },
      },
    };
    rerender(<ElasticsearchIOSinkProperties node={validNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/Cluster address entries should include a URL scheme/i)).not.toBeInTheDocument();
  });

  it('hydrates form fields from node properties correctly', () => {
    const node = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {
          addresses: 'http://es-cluster:9200',
          index: 'orders-index',
          type: '_doc',
          maxBatchSize: 2000,
          maxBatchSizeBytes: 10485760,
          usePartialUpdate: true,
          idFn: 'orderId',
          routingFn: 'customerId',
          throwWriteErrors: false,
          retryMaxAttempts: 8,
          retryMaxDuration: '2m',
        },
      },
    };

    render(<ElasticsearchIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('http://es-cluster:9200')).toBeInTheDocument();
    expect(screen.getByDisplayValue('orders-index')).toBeInTheDocument();
    expect(screen.getByDisplayValue('_doc')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10485760')).toBeInTheDocument();
    expect(screen.getByDisplayValue('orderId')).toBeInTheDocument();
    expect(screen.getByDisplayValue('customerId')).toBeInTheDocument();

    const partialUpdateCheckbox = screen.getByLabelText(/Use Partial Update/i);
    expect(partialUpdateCheckbox).toBeChecked();

    const throwErrorsCheckbox = screen.getByLabelText(/Throw Write Errors/i);
    expect(throwErrorsCheckbox).not.toBeChecked();

    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2m')).toBeInTheDocument();

    expect(screen.queryByText(/Cluster Addresses are required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Index is required/i)).not.toBeInTheDocument();
  });

  it('dispatches updates when bulk options, retries, and errors change', () => {
    const node = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {
          addresses: 'http://localhost:9200',
          index: 'events',
        },
      },
    };

    render(<ElasticsearchIOSinkProperties node={node} onChange={mockOnChange} />);

    const maxBatchInput = screen.getByPlaceholderText('1000');
    fireEvent.change(maxBatchInput, { target: { name: 'maxBatchSize', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxBatchSize: '500',
    }));

    const bytesInput = screen.getByPlaceholderText('5242880');
    fireEvent.change(bytesInput, { target: { name: 'maxBatchSizeBytes', value: '2097152' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxBatchSizeBytes: '2097152',
    }));

    const idInput = screen.getByPlaceholderText('e.g. id or deviceId');
    fireEvent.change(idInput, { target: { name: 'idFn', value: 'uuid' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      idFn: 'uuid',
    }));

    const routingInput = screen.getByPlaceholderText('e.g. tenantId');
    fireEvent.change(routingInput, { target: { name: 'routingFn', value: 'orgId' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      routingFn: 'orgId',
    }));

    const partialCheckbox = screen.getByLabelText(/Use Partial Update/i);
    fireEvent.click(partialCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      usePartialUpdate: true,
    }));

    const throwCheckbox = screen.getByLabelText(/Throw Write Errors/i);
    fireEvent.click(throwCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      throwWriteErrors: false,
    }));

    const attemptsInput = screen.getByPlaceholderText('5');
    fireEvent.change(attemptsInput, { target: { name: 'retryMaxAttempts', value: '10' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      retryMaxAttempts: '10',
    }));

    const durationInput = screen.getByPlaceholderText('e.g. 1m');
    fireEvent.change(durationInput, { target: { name: 'retryMaxDuration', value: '45s' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      retryMaxDuration: '45s',
    }));
  });

  it('switches authentication modes and reveals Basic Auth or API Key fields', () => {
    const node = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {
          authMode: 'none' as const,
        },
      },
    };

    const { rerender } = render(<ElasticsearchIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. es-username-secret')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. es-password-secret')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. es-api-key-secret')).not.toBeInTheDocument();

    const authSelect = screen.getByLabelText(/Auth Mode/i, { selector: 'select' });
    fireEvent.change(authSelect, { target: { name: 'authMode', value: 'basic_secret_manager' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      authMode: 'basic_secret_manager',
    }));

    // Rerender with basic_secret_manager
    const basicNode = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {
          authMode: 'basic_secret_manager' as const,
          usernameSecret: 'es-user-sink',
          passwordSecret: 'es-pass-sink',
        },
      },
    };
    rerender(<ElasticsearchIOSinkProperties node={basicNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. es-username-secret')).toHaveValue('es-user-sink');
    expect(screen.getByPlaceholderText('e.g. es-password-secret')).toHaveValue('es-pass-sink');

    // Rerender with api_key_secret
    const apiKeyNode = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {
          authMode: 'api_key_secret' as const,
          apiKeySecret: 'es-sink-api-key',
        },
      },
    };
    rerender(<ElasticsearchIOSinkProperties node={apiKeyNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. es-api-key-secret')).toHaveValue('es-sink-api-key');
  });

  it('toggles Advanced Sink Settings and dispatches edits', () => {
    const node = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {
          connectTimeout: 20000,
          socketTimeout: 25000,
          trustSelfSignedCerts: true,
          allowableResponseErrors: 'version_conflict_engine_exception',
        },
      },
    };

    render(<ElasticsearchIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Sink Settings/i });

    // Open advanced settings
    fireEvent.click(advancedBtn);

    const connectInput = screen.getAllByPlaceholderText('30000')[0];
    expect(connectInput).toHaveValue(20000);
    const socketInput = screen.getAllByPlaceholderText('30000')[1];
    expect(socketInput).toHaveValue(25000);

    const trustCheckbox = screen.getByLabelText(/Trust Self-Signed Certificates/i);
    expect(trustCheckbox).toBeChecked();

    const errorsInput = screen.getByPlaceholderText(/version_conflict_engine_exception/i);
    expect(errorsInput).toHaveValue('version_conflict_engine_exception');

    fireEvent.change(connectInput, { target: { name: 'connectTimeout', value: '60000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectTimeout: '60000',
    }));

    fireEvent.click(trustCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      trustSelfSignedCerts: false,
    }));
  });

  it('handles edge case where properties or node.data are completely missing', () => {
    const nodeWithoutProps = {
      data: {},
    } as any;

    expect(() => {
      render(<ElasticsearchIOSinkProperties node={nodeWithoutProps} onChange={mockOnChange} />);
    }).not.toThrow();

    expect(screen.getByText(/Cluster Addresses are required/i)).toBeInTheDocument();
    expect(screen.getByText(/Index is required/i)).toBeInTheDocument();
  });

  it('respects numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {
          maxBatchSize: 0,
          maxBatchSizeBytes: 0,
          retryMaxAttempts: 0,
          connectTimeout: 0,
          socketTimeout: 0,
        },
      },
    };

    render(<ElasticsearchIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('1000')).toHaveValue(0);
    expect(screen.getByPlaceholderText('5242880')).toHaveValue(0);
    expect(screen.getByPlaceholderText('5')).toHaveValue(0);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedBtn);

    const inputs = screen.getAllByPlaceholderText('30000');
    expect(inputs[0]).toHaveValue(0);
    expect(inputs[1]).toHaveValue(0);
  });

  it('resolves system instructions fallback chain and dispatches updates', () => {
    const node = {
      data: {
        label: 'Elasticsearch Sink',
        properties: {},
      },
    };

    render(<ElasticsearchIOSinkProperties node={node} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/ElasticsearchIO\.write\(\)\.withConnectionConfiguration/i);
    fireEvent.change(textarea, { target: { value: 'Updated sink instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated sink instructions',
    }));
  });
});
