/**
 * Unit Tests for Neo4jIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates Neo4jIOSinkProperties form rendering, hydration from properties,
 * input change dispatches (url, database, unwindMapName, cypher, batchSize, cypherLogging),
 * URL format validation, required fields validation, IPC callbacks for GCP Secret Manager secrets,
 * advanced settings collapse, error and edge cases, and code generation instructions fallback resolution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Neo4jIOSinkProperties } from './Neo4jIO';

describe('Neo4jIOSinkProperties', () => {
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

  it('renders required URL, Unwind Map Name, and Cypher fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'Neo4j Sink',
        properties: {}
      }
    };

    render(<Neo4jIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('neo4j://localhost:7687')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. rows')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/UNWIND \$rows AS row MERGE/i)).toBeInTheDocument();
    expect(screen.getByText('Connection URL is required')).toBeInTheDocument();
    expect(screen.getByText('Unwind map name is required')).toBeInTheDocument();
    expect(screen.getByText('Cypher write statement is required')).toBeInTheDocument();
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('displays warning when URL scheme is not standard Neo4j protocol', () => {
    const node = {
      data: {
        label: 'Neo4j Sink',
        properties: {
          url: 'ftp://localhost:7687'
        }
      }
    };

    render(<Neo4jIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByText(/Warning: Neo4j connection URLs typically start with/i)).toBeInTheDocument();
  });

  it('hydrates form fields from node properties', () => {
    const node = {
      data: {
        label: 'Neo4j Sink',
        properties: {
          url: 'bolt+s://db.example.com:7687',
          database: 'graphdb',
          unwindMapName: 'elements',
          cypher: 'UNWIND $elements AS item MERGE (a:Account {id: item.id})',
          batchSize: 500,
          cypherLogging: true,
          authMode: 'secret_manager' as const,
          usernameSecret: 'sink-user-secret',
          passwordSecret: 'sink-pass-secret',
          maxTransactionRetryTimeMs: 45000,
          connectionPoolSize: 80,
          encrypted: true,
          system_instructions: 'Batch write accounts with UNWIND'
        }
      }
    };

    render(<Neo4jIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('neo4j://localhost:7687')).toHaveValue('bolt+s://db.example.com:7687');
    expect(screen.getByPlaceholderText('neo4j')).toHaveValue('graphdb');
    expect(screen.getByPlaceholderText('e.g. rows')).toHaveValue('elements');
    expect(screen.getByPlaceholderText(/UNWIND \$rows AS row MERGE/i)).toHaveValue('UNWIND $elements AS item MERGE (a:Account {id: item.id})');
    expect(screen.getByPlaceholderText('1000')).toHaveValue(500);
    expect(screen.getByLabelText(/Cypher Logging/i)).toBeChecked();
    expect(screen.getByPlaceholderText(/neo4j-username/i)).toHaveValue('sink-user-secret');
    expect(screen.getByPlaceholderText(/neo4j-password/i)).toHaveValue('sink-pass-secret');

    // Advanced settings
    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('30000')).toHaveValue(45000);
    expect(screen.getByPlaceholderText('50')).toHaveValue(80);
    expect(screen.getByLabelText(/Enable TLS \/ Encryption/i)).toBeChecked();

    expect(screen.getByPlaceholderText(/Write elements to Neo4j/i)).toHaveValue('Batch write accounts with UNWIND');
  });

  it('dispatches changes for url, database, unwindMapName, cypher, batchSize, and cypherLogging', () => {
    const node = {
      data: {
        label: 'Neo4j Sink',
        properties: {}
      }
    };

    render(<Neo4jIOSinkProperties node={node} onChange={mockOnChange} />);

    const urlInput = screen.getByPlaceholderText('neo4j://localhost:7687');
    fireEvent.change(urlInput, { target: { name: 'url', value: 'neo4j://prod:7687' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      url: 'neo4j://prod:7687'
    }));

    const unwindInput = screen.getByPlaceholderText('e.g. rows');
    fireEvent.change(unwindInput, { target: { name: 'unwindMapName', value: 'records' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      unwindMapName: 'records'
    }));

    const cypherInput = screen.getByPlaceholderText(/UNWIND \$rows AS row MERGE/i);
    fireEvent.change(cypherInput, { target: { name: 'cypher', value: 'UNWIND $records AS r MERGE (u:User {id: r.id})' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      cypher: 'UNWIND $records AS r MERGE (u:User {id: r.id})'
    }));

    const batchInput = screen.getByPlaceholderText('1000');
    fireEvent.change(batchInput, { target: { name: 'batchSize', value: '250' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      batchSize: '250'
    }));

    const loggingCheckbox = screen.getByLabelText(/Cypher Logging/i);
    fireEvent.click(loggingCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      cypherLogging: true
    }));
  });

  it('supports Secret Manager authentication mode', () => {
    const node = {
      data: {
        label: 'Neo4j Sink',
        properties: {
          authMode: 'secret_manager' as const,
          usernameSecret: 'neo4j-sink-user',
          passwordSecret: 'neo4j-sink-pass'
        }
      }
    };

    render(<Neo4jIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText(/neo4j-username/i)).toHaveValue('neo4j-sink-user');
    expect(screen.getByPlaceholderText(/neo4j-password/i)).toHaveValue('neo4j-sink-pass');
  });

  it('toggles Advanced Sink Settings and updates parameters', () => {
    const node = {
      data: {
        label: 'Neo4j Sink',
        properties: {}
      }
    };

    render(<Neo4jIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    const retryInput = screen.getByPlaceholderText('30000');
    fireEvent.change(retryInput, { target: { name: 'maxTransactionRetryTimeMs', value: '20000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxTransactionRetryTimeMs: '20000'
    }));

    const poolInput = screen.getByPlaceholderText('50');
    fireEvent.change(poolInput, { target: { name: 'connectionPoolSize', value: '40' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectionPoolSize: '40'
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
        label: 'Neo4j Sink'
      }
    };

    const { rerender } = render(<Neo4jIOSinkProperties node={nodeWithoutProps as any} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('neo4j://localhost:7687')).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'Neo4j Sink',
        properties: {
          url: 'neo4j://localhost:7687',
          unwindMapName: 'rows',
          cypher: 'UNWIND $rows AS r MERGE (n {id: r.id})',
          batchSize: 0,
          maxTransactionRetryTimeMs: 0,
          connectionPoolSize: 0
        }
      }
    };

    rerender(<Neo4jIOSinkProperties node={nodeWithZeros} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('1000')).toHaveValue(0);
  });

  it('updates system_instructions when textarea changes', () => {
    const node = {
      data: {
        label: 'Neo4j Sink',
        properties: {}
      }
    };

    render(<Neo4jIOSinkProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Write elements to Neo4j/i);
    fireEvent.change(textarea, { target: { value: 'Updated Cypher write prompt' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated Cypher write prompt'
    }));
  });
});
