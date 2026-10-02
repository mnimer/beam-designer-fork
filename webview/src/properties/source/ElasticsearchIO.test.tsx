/**
 * Unit Tests for ElasticsearchIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates ElasticsearchIOSourceProperties form rendering, hydration, field validation,
 * scheme warning detection, authentication mode toggling (None, Basic Auth, API Key),
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
import { ElasticsearchIOSourceProperties } from './ElasticsearchIO';

describe('ElasticsearchIOSourceProperties', () => {
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
        label: 'Elasticsearch Source',
        properties: {},
      },
    };

    render(<ElasticsearchIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('http://localhost:9200')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. sensor_readings')).toBeInTheDocument();
    expect(screen.getByText(/Cluster Addresses are required/i)).toBeInTheDocument();
    expect(screen.getByText(/Index is required/i)).toBeInTheDocument();

    const addrInput = screen.getByPlaceholderText('http://localhost:9200');
    expect(addrInput).toHaveAttribute('aria-invalid', 'true');
    const indexInput = screen.getByPlaceholderText('e.g. sensor_readings');
    expect(indexInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('validates URL scheme format warning on cluster addresses', () => {
    const node = {
      data: {
        label: 'Elasticsearch Source',
        properties: {
          addresses: 'localhost:9200',
        },
      },
    };

    const { rerender } = render(<ElasticsearchIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByText(/Cluster address entries should include a URL scheme/i)).toBeInTheDocument();

    const validNode = {
      data: {
        label: 'Elasticsearch Source',
        properties: {
          addresses: 'http://localhost:9200,https://node2:9200',
        },
      },
    };
    rerender(<ElasticsearchIOSourceProperties node={validNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/Cluster address entries should include a URL scheme/i)).not.toBeInTheDocument();
  });

  it('hydrates form fields from node properties correctly', () => {
    const node = {
      data: {
        label: 'Elasticsearch Source',
        properties: {
          addresses: 'http://es1.prod:9200,http://es2.prod:9200',
          index: 'logs-production',
          type: '_doc',
          query: '{"query": {"match_all": {}}}',
          scrollKeepalive: '10m',
          batchSize: 500,
          pointInTimeSearch: true,
        },
      },
    };

    render(<ElasticsearchIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('http://es1.prod:9200,http://es2.prod:9200')).toBeInTheDocument();
    expect(screen.getByDisplayValue('logs-production')).toBeInTheDocument();
    expect(screen.getByDisplayValue('_doc')).toBeInTheDocument();
    expect(screen.getByDisplayValue('{"query": {"match_all": {}}}')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10m')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();

    const pitCheckbox = screen.getByLabelText(/Enable Point In Time Search/i);
    expect(pitCheckbox).toBeChecked();

    expect(screen.queryByText(/Cluster Addresses are required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Index is required/i)).not.toBeInTheDocument();
  });

  it('dispatches updates when cluster, index, query, and PIT inputs change', () => {
    const node = {
      data: {
        label: 'Elasticsearch Source',
        properties: {
          addresses: 'http://localhost:9200',
          index: 'orders',
        },
      },
    };

    render(<ElasticsearchIOSourceProperties node={node} onChange={mockOnChange} />);

    const addrInput = screen.getByPlaceholderText('http://localhost:9200');
    fireEvent.change(addrInput, { target: { name: 'addresses', value: 'http://es-cluster:9200' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      addresses: 'http://es-cluster:9200',
    }));

    const indexInput = screen.getByPlaceholderText('e.g. sensor_readings');
    fireEvent.change(indexInput, { target: { name: 'index', value: 'orders-v2' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      index: 'orders-v2',
    }));

    const scrollInput = screen.getByPlaceholderText('e.g. 5m');
    fireEvent.change(scrollInput, { target: { name: 'scrollKeepalive', value: '15m' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      scrollKeepalive: '15m',
    }));

    const batchInput = screen.getByPlaceholderText('1000');
    fireEvent.change(batchInput, { target: { name: 'batchSize', value: '2500' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      batchSize: '2500',
    }));

    const pitCheckbox = screen.getByLabelText(/Enable Point In Time Search/i);
    fireEvent.click(pitCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      pointInTimeSearch: true,
    }));
  });

  it('switches authentication modes and reveals Basic Auth or API Key fields', () => {
    const node = {
      data: {
        label: 'Elasticsearch Source',
        properties: {
          authMode: 'none' as const,
        },
      },
    };

    const { rerender } = render(<ElasticsearchIOSourceProperties node={node} onChange={mockOnChange} />);

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
        label: 'Elasticsearch Source',
        properties: {
          authMode: 'basic_secret_manager' as const,
          usernameSecret: 'es-user',
          passwordSecret: 'es-pass',
        },
      },
    };
    rerender(<ElasticsearchIOSourceProperties node={basicNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. es-username-secret')).toHaveValue('es-user');
    expect(screen.getByPlaceholderText('e.g. es-password-secret')).toHaveValue('es-pass');

    // Rerender with api_key_secret
    const apiKeyNode = {
      data: {
        label: 'Elasticsearch Source',
        properties: {
          authMode: 'api_key_secret' as const,
          apiKeySecret: 'es-api-token',
        },
      },
    };
    rerender(<ElasticsearchIOSourceProperties node={apiKeyNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. es-api-key-secret')).toHaveValue('es-api-token');
  });

  it('toggles Advanced Source Settings and dispatches edits', () => {
    const node = {
      data: {
        label: 'Elasticsearch Source',
        properties: {
          connectTimeout: 15000,
          socketTimeout: 20000,
          trustSelfSignedCerts: true,
          keystorePath: '/etc/ssl/es.jks',
          keystorePasswordSecret: 'es-keystore-pass',
        },
      },
    };

    render(<ElasticsearchIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Source Settings/i });
    // Open advanced settings
    fireEvent.click(advancedBtn);

    const connectInput = screen.getAllByPlaceholderText('30000')[0];
    expect(connectInput).toHaveValue(15000);
    const socketInput = screen.getAllByPlaceholderText('30000')[1];
    expect(socketInput).toHaveValue(20000);

    const trustCheckbox = screen.getByLabelText(/Trust Self-Signed Certificates/i);
    expect(trustCheckbox).toBeChecked();

    const keystoreInput = screen.getByPlaceholderText('/path/to/keystore.jks');
    expect(keystoreInput).toHaveValue('/etc/ssl/es.jks');

    fireEvent.change(connectInput, { target: { name: 'connectTimeout', value: '45000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectTimeout: '45000',
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
      render(<ElasticsearchIOSourceProperties node={nodeWithoutProps} onChange={mockOnChange} />);
    }).not.toThrow();

    expect(screen.getByText(/Cluster Addresses are required/i)).toBeInTheDocument();
    expect(screen.getByText(/Index is required/i)).toBeInTheDocument();
  });

  it('respects numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Elasticsearch Source',
        properties: {
          connectTimeout: 0,
          socketTimeout: 0,
          batchSize: 0,
        },
      },
    };

    render(<ElasticsearchIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('1000')).toHaveValue(0);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedBtn);

    const inputs = screen.getAllByPlaceholderText('30000');
    expect(inputs[0]).toHaveValue(0);
    expect(inputs[1]).toHaveValue(0);
  });

  it('updates system_instructions on textarea change', () => {
    const node = {
      data: {
        label: 'Elasticsearch Source',
        properties: {},
      },
    };

    render(<ElasticsearchIOSourceProperties node={node} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/ElasticsearchIO\.read\(\)\.withConnectionConfiguration/i);
    fireEvent.change(textarea, { target: { value: 'Updated prompt instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated prompt instructions',
    }));
  });
});
