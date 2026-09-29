/**
 * Unit Tests for SolrIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates SolrIOSourceProperties form rendering, hydration, field validation,
 * SolrCloud ZooKeeper connect string validation, authentication mode toggling,
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
import { SolrIOSourceProperties } from './SolrIO';

describe('SolrIOSourceProperties', () => {
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
        label: 'Solr Source',
        properties: {},
      },
    };

    render(<SolrIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('zk1:2181,zk2:2181/solr')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. products')).toBeInTheDocument();
    expect(screen.getByText(/ZooKeeper Host is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Collection name is required/i)).toBeInTheDocument();

    const zkInput = screen.getByPlaceholderText('zk1:2181,zk2:2181/solr');
    expect(zkInput).toHaveAttribute('aria-invalid', 'true');
    const colInput = screen.getByPlaceholderText('e.g. products');
    expect(colInput).toHaveAttribute('aria-invalid', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('validates HTTP URL warning on ZooKeeper host field', () => {
    const node = {
      data: {
        label: 'Solr Source',
        properties: {
          zkHost: 'http://localhost:8983/solr',
        },
      },
    };

    const { rerender } = render(<SolrIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByText(/SolrIO connects via SolrCloud ZooKeeper ensemble string/i)).toBeInTheDocument();

    const validNode = {
      data: {
        label: 'Solr Source',
        properties: {
          zkHost: 'zk1.internal:2181,zk2.internal:2181/solr',
        },
      },
    };
    rerender(<SolrIOSourceProperties node={validNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/SolrIO connects via SolrCloud ZooKeeper ensemble string/i)).not.toBeInTheDocument();
  });

  it('hydrates form fields from node properties correctly', () => {
    const node = {
      data: {
        label: 'Solr Source',
        properties: {
          zkHost: 'zk1:2181,zk2:2181/solr',
          collection: 'ecommerce_products',
          query: 'inStock:true',
          batchSize: 500,
        },
      },
    };

    render(<SolrIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('zk1:2181,zk2:2181/solr')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ecommerce_products')).toBeInTheDocument();
    expect(screen.getByDisplayValue('inStock:true')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();

    expect(screen.queryByText(/ZooKeeper Host is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Collection name is required/i)).not.toBeInTheDocument();
  });

  it('dispatches updates when zkHost, collection, query, and batchSize inputs change', () => {
    const node = {
      data: {
        label: 'Solr Source',
        properties: {
          zkHost: 'zk1:2181/solr',
          collection: 'catalog',
        },
      },
    };

    render(<SolrIOSourceProperties node={node} onChange={mockOnChange} />);

    const zkInput = screen.getByPlaceholderText('zk1:2181,zk2:2181/solr');
    fireEvent.change(zkInput, { target: { name: 'zkHost', value: 'zk1:2181,zk2:2181/solr' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      zkHost: 'zk1:2181,zk2:2181/solr',
    }));

    const colInput = screen.getByPlaceholderText('e.g. products');
    fireEvent.change(colInput, { target: { name: 'collection', value: 'catalog_v2' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'catalog_v2',
    }));

    const queryInput = screen.getByPlaceholderText('*:*');
    fireEvent.change(queryInput, { target: { name: 'query', value: 'category:electronics' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      query: 'category:electronics',
    }));

    const batchInput = screen.getByPlaceholderText('1000');
    fireEvent.change(batchInput, { target: { name: 'batchSize', value: '2000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      batchSize: '2000',
    }));
  });

  it('switches authentication modes and reveals Basic Auth fields', () => {
    const node = {
      data: {
        label: 'Solr Source',
        properties: {
          authMode: 'none' as const,
        },
      },
    };

    const { rerender } = render(<SolrIOSourceProperties node={node} onChange={mockOnChange} />);

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
        label: 'Solr Source',
        properties: {
          authMode: 'basic_secret_manager' as const,
          usernameSecret: 'solr-user',
          passwordSecret: 'solr-pass',
        },
      },
    };
    rerender(<SolrIOSourceProperties node={basicNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. solr-username-secret')).toHaveValue('solr-user');
    expect(screen.getByPlaceholderText('e.g. solr-password-secret')).toHaveValue('solr-pass');
  });

  it('populates datalist with secrets loaded from extension IPC', () => {
    const node = {
      data: {
        label: 'Solr Source',
        properties: {
          authMode: 'basic_secret_manager' as const,
        },
      },
    };

    render(<SolrIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [
          'projects/my-gcp-proj/secrets/solr-secret-password',
          { id: 'solr-prod-user', name: 'Solr Production User' },
        ],
      },
    }));

    const option1 = document.querySelector('datalist#solr-source-secret-options option[value="solr-secret-password"]');
    const option2 = document.querySelector('datalist#solr-source-secret-options option[value="solr-prod-user"]');
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error alert exactly once when secrets loading fails from extension IPC', () => {
    const node = {
      data: {
        label: 'Solr Source',
        properties: {},
      },
    };

    render(<SolrIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        error: 'Failed to access GCP Secret Manager for Solr',
      },
    }));

    const alerts = screen.getAllByRole('alert');
    const secretAlert = alerts.filter((a) => a.textContent?.includes('Failed to access GCP Secret Manager for Solr'));
    expect(secretAlert).toHaveLength(1);
  });

  it('toggles Advanced Source Settings and dispatches edits', () => {
    const node = {
      data: {
        label: 'Solr Source',
        properties: {
          fields: 'id,name,price',
          filters: 'status:ACTIVE',
          connectTimeout: 10000,
          socketTimeout: 20000,
        },
      },
    };

    render(<SolrIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Source Settings/i });
    expect(screen.queryByPlaceholderText(/id,name,category,price/i)).not.toBeInTheDocument();

    // Open advanced settings
    fireEvent.click(advancedBtn);

    const fieldsInput = screen.getByPlaceholderText(/id,name,category,price/i);
    expect(fieldsInput).toHaveValue('id,name,price');
    const filtersInput = screen.getByPlaceholderText(/inStock:true/i);
    expect(filtersInput).toHaveValue('status:ACTIVE');

    const connectInput = screen.getByPlaceholderText('15000');
    expect(connectInput).toHaveValue(10000);
    const socketInput = screen.getByPlaceholderText('30000');
    expect(socketInput).toHaveValue(20000);

    fireEvent.change(fieldsInput, { target: { name: 'fields', value: 'id,title,price' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      fields: 'id,title,price',
    }));

    fireEvent.change(filtersInput, { target: { name: 'filters', value: 'status:IN_STOCK' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      filters: 'status:IN_STOCK',
    }));

    fireEvent.change(connectInput, { target: { name: 'connectTimeout', value: '25000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectTimeout: '25000',
    }));

    // Close advanced settings
    fireEvent.click(advancedBtn);
    expect(screen.queryByPlaceholderText(/id,name,category,price/i)).not.toBeInTheDocument();
  });

  it('handles edge case where properties or node.data are completely missing', () => {
    const nodeWithoutProps = {
      data: {},
    } as any;

    expect(() => {
      render(<SolrIOSourceProperties node={nodeWithoutProps} onChange={mockOnChange} />);
    }).not.toThrow();

    expect(screen.getByText(/ZooKeeper Host is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Collection name is required/i)).toBeInTheDocument();
  });

  it('respects numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Solr Source',
        properties: {
          batchSize: 0,
          connectTimeout: 0,
          socketTimeout: 0,
        },
      },
    };

    render(<SolrIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('1000')).toHaveValue(0);

    const advancedBtn = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedBtn);

    expect(screen.getByPlaceholderText('15000')).toHaveValue(0);
    expect(screen.getByPlaceholderText('30000')).toHaveValue(0);
  });

  it('resolves system instructions fallback chain and dispatches updates', () => {
    // 1. Fallback to special_instructions on node.data
    const nodeSpecial = {
      data: {
        special_instructions: 'Custom special prompt for Solr source',
        properties: {},
      },
    };

    const { rerender } = render(<SolrIOSourceProperties node={nodeSpecial} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/SolrIO\.read\(\)\.withConnectionConfiguration/i);
    expect(textarea).toHaveValue('Custom special prompt for Solr source');

    // 2. Direct property edit
    fireEvent.change(textarea, { target: { value: 'Updated prompt instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated prompt instructions',
    }));

    // 3. Fallback when system_instructions is directly in properties
    const nodePropInstructions = {
      data: {
        properties: {
          system_instructions: 'Property instructions override',
        },
      },
    };
    rerender(<SolrIOSourceProperties node={nodePropInstructions} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText(/SolrIO\.read\(\)\.withConnectionConfiguration/i)).toHaveValue('Property instructions override');
  });
});
