/**
 * Unit Tests for SolrIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates SolrIOSinkProperties form rendering, hydration, field validation,
 * SolrCloud ZooKeeper connect string validation, batch sizing, retry configuration,
 * authentication mode toggling, IPC callbacks for Secret Manager, collapsible advanced configuration,
 * and system instructions.
 *
 * Architectural Decisions:
 * - Emulates VS Code extension host postMessage IPC to verify getSecrets request and response.
 * - Thoroughly tests normal hydration, dispatch updates, edge cases, failure states, and instruction fallbacks.
 * - Uses accessible role and placeholder queries to test UI state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SolrIOSinkProperties } from './SolrIO';

describe('SolrIOSinkProperties', () => {
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

  it('renders required ZooKeeper host and collection fields with errors when empty', () => {
    const node = {
      data: {
        label: 'Solr Sink',
        properties: {},
      },
    };

    render(<SolrIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('zk1:2181,zk2:2181/solr')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. products_search')).toBeInTheDocument();
    expect(screen.getByText(/ZooKeeper Host is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Collection name is required/i)).toBeInTheDocument();

    const zkInput = screen.getByPlaceholderText('zk1:2181,zk2:2181/solr');
    expect(zkInput).toHaveAttribute('aria-invalid', 'true');
    const colInput = screen.getByPlaceholderText('e.g. products_search');
    expect(colInput).toHaveAttribute('aria-invalid', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('validates HTTP URL warning on ZooKeeper host field', () => {
    const node = {
      data: {
        label: 'Solr Sink',
        properties: {
          zkHost: 'https://solr-cloud:8983/solr',
        },
      },
    };

    const { rerender } = render(<SolrIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByText(/SolrIO connects via SolrCloud ZooKeeper ensemble string/i)).toBeInTheDocument();

    const validNode = {
      data: {
        label: 'Solr Sink',
        properties: {
          zkHost: 'zk1.prod:2181,zk2.prod:2181/solr',
        },
      },
    };
    rerender(<SolrIOSinkProperties node={validNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/SolrIO connects via SolrCloud ZooKeeper ensemble string/i)).not.toBeInTheDocument();
  });

  it('hydrates form fields from node properties correctly', () => {
    const node = {
      data: {
        label: 'Solr Sink',
        properties: {
          zkHost: 'zk1:2181,zk2:2181/solr',
          collection: 'analytics_events',
          maxBatchSize: 2000,
          retryMaxAttempts: 8,
          retryMaxDuration: '2m',
        },
      },
    };

    render(<SolrIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('zk1:2181,zk2:2181/solr')).toBeInTheDocument();
    expect(screen.getByDisplayValue('analytics_events')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2m')).toBeInTheDocument();

    expect(screen.queryByText(/ZooKeeper Host is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Collection name is required/i)).not.toBeInTheDocument();
  });

  it('dispatches updates when zkHost, collection, maxBatchSize, and retry options change', () => {
    const node = {
      data: {
        label: 'Solr Sink',
        properties: {
          zkHost: 'zk1:2181/solr',
          collection: 'items',
        },
      },
    };

    render(<SolrIOSinkProperties node={node} onChange={mockOnChange} />);

    const zkInput = screen.getByPlaceholderText('zk1:2181,zk2:2181/solr');
    fireEvent.change(zkInput, { target: { name: 'zkHost', value: 'zk1:2181,zk2:2181/solr' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      zkHost: 'zk1:2181,zk2:2181/solr',
    }));

    const colInput = screen.getByPlaceholderText('e.g. products_search');
    fireEvent.change(colInput, { target: { name: 'collection', value: 'items_v2' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'items_v2',
    }));

    const batchInput = screen.getByPlaceholderText('1000');
    fireEvent.change(batchInput, { target: { name: 'maxBatchSize', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxBatchSize: '500',
    }));

    const attemptsInput = screen.getByPlaceholderText('5');
    fireEvent.change(attemptsInput, { target: { name: 'retryMaxAttempts', value: '10' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      retryMaxAttempts: '10',
    }));

    const durationInput = screen.getByPlaceholderText('e.g. 1m');
    fireEvent.change(durationInput, { target: { name: 'retryMaxDuration', value: '3m' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      retryMaxDuration: '3m',
    }));
  });

  it('switches authentication modes and reveals Basic Auth fields', () => {
    const node = {
      data: {
        label: 'Solr Sink',
        properties: {
          authMode: 'none' as const,
        },
      },
    };

    const { rerender } = render(<SolrIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. solr-username-secret')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. solr-password-secret')).not.toBeInTheDocument();

    const authSelect = screen.getByLabelText(/Auth Mode/i, { selector: 'select' });
    fireEvent.change(authSelect, { target: { name: 'authMode', value: 'basic_secret_manager' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      authMode: 'basic_secret_manager',
    }));

    // Rerender with basic_secret_manager
    const basicNode = {
      data: {
        label: 'Solr Sink',
        properties: {
          authMode: 'basic_secret_manager' as const,
          usernameSecret: 'solr-sink-user',
          passwordSecret: 'solr-sink-pass',
        },
      },
    };
    rerender(<SolrIOSinkProperties node={basicNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. solr-username-secret')).toHaveValue('solr-sink-user');
    expect(screen.getByPlaceholderText('e.g. solr-password-secret')).toHaveValue('solr-sink-pass');
  });

  it('populates datalist with secrets loaded from extension IPC', () => {
    const node = {
      data: {
        label: 'Solr Sink',
        properties: {
          authMode: 'basic_secret_manager' as const,
        },
      },
    };

    render(<SolrIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [
          'projects/my-gcp-proj/secrets/solr-sink-secret',
          { id: 'solr-sink-creds', name: 'Solr Sink Credentials' },
        ],
      },
    }));

    const option1 = document.querySelector('datalist#solr-sink-secret-options option[value="solr-sink-secret"]');
    const option2 = document.querySelector('datalist#solr-sink-secret-options option[value="solr-sink-creds"]');
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error alert exactly once when secrets loading fails from extension IPC', () => {
    const node = {
      data: {
        label: 'Solr Sink',
        properties: {},
      },
    };

    render(<SolrIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        error: 'Failed to access GCP Secret Manager for Solr Sink',
      },
    }));

    const alerts = screen.getAllByRole('alert');
    const secretAlert = alerts.filter((a) => a.textContent?.includes('Failed to access GCP Secret Manager for Solr Sink'));
    expect(secretAlert).toHaveLength(1);
  });

  it('toggles Advanced Sink Settings and dispatches edits', () => {
    const node = {
      data: {
        label: 'Solr Sink',
        properties: {
          connectTimeout: 10000,
          socketTimeout: 25000,
          commitWithinMs: 5000,
        },
      },
    };

    render(<SolrIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    expect(screen.queryByPlaceholderText('10000')).not.toBeInTheDocument();

    // Open advanced settings
    fireEvent.click(advancedBtn);

    const connectInput = screen.getByPlaceholderText('15000');
    expect(connectInput).toHaveValue(10000);
    const socketInput = screen.getByPlaceholderText('30000');
    expect(socketInput).toHaveValue(25000);
    const commitInput = screen.getByPlaceholderText('10000');
    expect(commitInput).toHaveValue(5000);

    fireEvent.change(connectInput, { target: { name: 'connectTimeout', value: '30000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectTimeout: '30000',
    }));

    fireEvent.change(commitInput, { target: { name: 'commitWithinMs', value: '15000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      commitWithinMs: '15000',
    }));

    // Close advanced settings
    fireEvent.click(advancedBtn);
    expect(screen.queryByPlaceholderText('10000')).not.toBeInTheDocument();
  });

  it('handles edge case where properties or node.data are completely missing', () => {
    const nodeWithoutProps = {
      data: {},
    } as any;

    expect(() => {
      render(<SolrIOSinkProperties node={nodeWithoutProps} onChange={mockOnChange} />);
    }).not.toThrow();

    expect(screen.getByText(/ZooKeeper Host is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Collection name is required/i)).toBeInTheDocument();
  });

  it('respects numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Solr Sink',
        properties: {
          maxBatchSize: 0,
          retryMaxAttempts: 0,
          connectTimeout: 0,
          socketTimeout: 0,
          commitWithinMs: 0,
        },
      },
    };

    render(<SolrIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('1000')).toHaveValue(0);
    expect(screen.getByPlaceholderText('5')).toHaveValue(0);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedBtn);

    expect(screen.getByPlaceholderText('15000')).toHaveValue(0);
    expect(screen.getByPlaceholderText('30000')).toHaveValue(0);
    expect(screen.getByPlaceholderText('10000')).toHaveValue(0);
  });

  it('resolves system instructions fallback chain and dispatches updates', () => {
    // 1. Fallback to special_instructions on node.data
    const nodeSpecial = {
      data: {
        special_instructions: 'Custom special prompt for Solr sink',
        properties: {},
      },
    };

    const { rerender } = render(<SolrIOSinkProperties node={nodeSpecial} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/SolrIO\.write\(\)\.withConnectionConfiguration/i);
    expect(textarea).toHaveValue('Custom special prompt for Solr sink');

    // 2. Direct property edit
    fireEvent.change(textarea, { target: { value: 'Updated sink prompt' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated sink prompt',
    }));

    // 3. Fallback when system_instructions is directly in properties
    const nodePropInstructions = {
      data: {
        properties: {
          system_instructions: 'Sink property instructions override',
        },
      },
    };
    rerender(<SolrIOSinkProperties node={nodePropInstructions} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText(/SolrIO\.write\(\)\.withConnectionConfiguration/i)).toHaveValue('Sink property instructions override');
  });
});
