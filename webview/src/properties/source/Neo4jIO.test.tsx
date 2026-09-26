/**
 * Unit Tests for Neo4jIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates Neo4jIOSourceProperties form rendering, hydration from properties,
 * input change dispatches, URL format warning validation, required cypher query,
 * IPC callbacks for GCP Secret Manager secrets, advanced settings collapse,
 * error and edge cases, and code generation instructions fallback resolution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Neo4jIOSourceProperties } from './Neo4jIO';

describe('Neo4jIOSourceProperties', () => {
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

  it('renders required Connection URL and Cypher fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'Neo4j Source',
        properties: {}
      }
    };

    render(<Neo4jIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('neo4j://localhost:7687')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/MATCH \(n:Person\)/i)).toBeInTheDocument();
    expect(screen.getByText('Connection URL is required')).toBeInTheDocument();
    expect(screen.getByText('Cypher query is required')).toBeInTheDocument();
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('displays warning when URL scheme is not standard Neo4j protocol', () => {
    const node = {
      data: {
        label: 'Neo4j Source',
        properties: {
          url: 'http://localhost:7474'
        }
      }
    };

    render(<Neo4jIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByText(/Warning: Neo4j connection URLs typically start with/i)).toBeInTheDocument();
  });

  it('hydrates form fields from node properties', () => {
    const node = {
      data: {
        label: 'Neo4j Source',
        properties: {
          url: 'neo4j+s://graph.example.com:7687',
          database: 'customers',
          cypher: 'MATCH (c:Customer) RETURN c.id AS id, c.name AS name',
          rowMapper: 'com.example.CustomerRowMapper',
          parametersFunction: 'com.example.CustomerParamsFn',
          authMode: 'secret_manager' as const,
          usernameSecret: 'neo4j-user',
          passwordSecret: 'neo4j-pass',
          sessionConfig: 'fetchSize=500',
          connectionPoolSize: 100,
          maxTransactionRetryTimeMs: 15000,
          encrypted: true,
          system_instructions: 'Extract customer nodes and map to POJO'
        }
      }
    };

    render(<Neo4jIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('neo4j://localhost:7687')).toHaveValue('neo4j+s://graph.example.com:7687');
    expect(screen.getByPlaceholderText('neo4j')).toHaveValue('customers');
    expect(screen.getByPlaceholderText(/MATCH \(n:Person\)/i)).toHaveValue('MATCH (c:Customer) RETURN c.id AS id, c.name AS name');
    expect(screen.getByPlaceholderText('com.example.PersonRowMapper')).toHaveValue('com.example.CustomerRowMapper');
    expect(screen.getByPlaceholderText('com.example.PersonParamsFn')).toHaveValue('com.example.CustomerParamsFn');
    expect(screen.getByPlaceholderText(/neo4j-username/i)).toHaveValue('neo4j-user');
    expect(screen.getByPlaceholderText(/neo4j-password/i)).toHaveValue('neo4j-pass');

    // Advanced settings
    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText(/fetchSize=1000/i)).toHaveValue('fetchSize=500');
    expect(screen.getByPlaceholderText('50')).toHaveValue(100);
    expect(screen.getByPlaceholderText('30000')).toHaveValue(15000);
    expect(screen.getByLabelText(/Enable TLS \/ Encryption/i)).toBeChecked();

    expect(screen.getByPlaceholderText(/Read graph nodes matching Person/i)).toHaveValue('Extract customer nodes and map to POJO');
  });

  it('supports mapperStrategy switching between infer, schema editor, and custom class', () => {
    const { unmount } = render(
      <Neo4jIOSourceProperties
        node={{ data: { properties: { url: 'neo4j://localhost:7687', cypher: 'MATCH (n) RETURN n', mapperStrategy: 'infer' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText(/Dynamic Inference:/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('com.example.PersonRowMapper')).not.toBeInTheDocument();
    unmount();

    render(
      <Neo4jIOSourceProperties
        node={{
          data: {
            properties: {
              url: 'neo4j://localhost:7687',
              cypher: 'MATCH (n) RETURN n.id AS id, n.name AS name',
              mapperStrategy: 'schema',
              schemaString: 'id:STRING:REQUIRED, name:STRING'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('Field Builder (2)')).toBeInTheDocument();
  });

  it('updates url, database, and cypher on input change', () => {
    const node = {
      data: {
        label: 'Neo4j Source',
        properties: {}
      }
    };

    render(<Neo4jIOSourceProperties node={node} onChange={mockOnChange} />);

    const urlInput = screen.getByPlaceholderText('neo4j://localhost:7687');
    fireEvent.change(urlInput, { target: { name: 'url', value: 'bolt://localhost:7687' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      url: 'bolt://localhost:7687'
    }));

    const dbInput = screen.getByPlaceholderText('neo4j');
    fireEvent.change(dbInput, { target: { name: 'database', value: 'analytics' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      database: 'analytics'
    }));

    const cypherInput = screen.getByPlaceholderText(/MATCH \(n:Person\)/i);
    fireEvent.change(cypherInput, { target: { name: 'cypher', value: 'MATCH (n) RETURN n' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      cypher: 'MATCH (n) RETURN n'
    }));
  });

  it('supports Secret Manager authentication mode and handles IPC secretsLoaded', () => {
    const node = {
      data: {
        label: 'Neo4j Source',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<Neo4jIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText(/neo4j-username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/neo4j-password/i)).toBeInTheDocument();

    // Simulate IPC secretsLoaded event
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [
          'projects/my-proj/secrets/neo4j-user-secret',
          { id: 'neo4j-pass-secret', name: 'neo4j-pass-secret' }
        ]
      }
    }));

    const option1 = document.querySelector('datalist#neo4j-source-secret-options option[value="neo4j-user-secret"]');
    const option2 = document.querySelector('datalist#neo4j-source-secret-options option[value="neo4j-pass-secret"]');
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('displays error when secret discovery fails', () => {
    const node = {
      data: {
        label: 'Neo4j Source',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<Neo4jIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        error: 'Failed to access Secret Manager'
      }
    }));

    expect(screen.getByText('Failed to access Secret Manager')).toBeInTheDocument();
  });

  it('expands Advanced Source Settings and updates parameters', () => {
    const node = {
      data: {
        label: 'Neo4j Source',
        properties: {}
      }
    };

    render(<Neo4jIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const poolInput = screen.getByPlaceholderText('50');
    fireEvent.change(poolInput, { target: { name: 'connectionPoolSize', value: '25' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectionPoolSize: '25'
    }));

    const retryInput = screen.getByPlaceholderText('30000');
    fireEvent.change(retryInput, { target: { name: 'maxTransactionRetryTimeMs', value: '60000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxTransactionRetryTimeMs: '60000'
    }));

    const encryptedCheckbox = screen.getByLabelText(/Enable TLS \/ Encryption/i);
    fireEvent.click(encryptedCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      encrypted: true
    }));
  });

  it('handles edge cases: missing properties, numeric 0 values', () => {
    const nodeWithoutProps = {
      data: {
        label: 'Neo4j Source'
      }
    };

    const { rerender } = render(<Neo4jIOSourceProperties node={nodeWithoutProps as any} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('neo4j://localhost:7687')).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'Neo4j Source',
        properties: {
          url: 'neo4j://localhost:7687',
          cypher: 'MATCH (n) RETURN n',
          connectionPoolSize: 0,
          maxTransactionRetryTimeMs: 0
        }
      }
    };

    rerender(<Neo4jIOSourceProperties node={nodeWithZeros} onChange={mockOnChange} />);
    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);
    expect(screen.getByPlaceholderText('50')).toHaveValue(0);
    expect(screen.getByPlaceholderText('30000')).toHaveValue(0);
  });

  it('resolves system instructions via fallback chain and handles edits', () => {
    const node = {
      data: {
        label: 'Neo4j Source',
        special_instructions: 'Custom special instructions for Neo4j source'
      }
    };

    render(<Neo4jIOSourceProperties node={node as any} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Read graph nodes matching Person/i);
    expect(textarea).toHaveValue('Custom special instructions for Neo4j source');

    fireEvent.change(textarea, { target: { value: 'New prompt value' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New prompt value'
    }));
  });
});
