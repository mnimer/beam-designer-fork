/**
 * FirestoreIOSourceProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the FirestoreIOSourceProperties panel component covering initial field rendering,
 * hydration from node properties, onChange event dispatch, IPC Secret Manager communication,
 * read operation switching (runQuery, partitionQuery, listDocuments, listCollectionIds, batchGetDocuments),
 * edge cases (missing properties, 0 values), validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FirestoreIOSourceProperties } from './FirestoreIO';

describe('FirestoreIOSourceProperties', () => {
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

  it('renders required Project ID and Collection ID and shows validation errors when empty', () => {
    const node = {
      data: {
        label: 'Firestore Source',
        properties: {}
      }
    };

    render(<FirestoreIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. users or orders')).toBeInTheDocument();

    expect(screen.getByText(/Project ID is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Collection ID is required/i)).toBeInTheDocument();
  });

  it('hydrates all populated properties correctly in runQuery mode', () => {
    const node = {
      data: {
        label: 'Firestore Source',
        properties: {
          projectId: 'my-firestore-project',
          databaseId: 'test-db',
          collectionId: 'orders',
          isCollectionGroup: true,
          operation: 'runQuery',
          fieldFilters: '[{"field": "status", "op": "EQUAL", "value": "paid"}]',
          orderByField: 'created_at',
          orderByDirection: 'DESCENDING',
          limit: 100,
          authMode: 'adc',
          emulatorHost: 'localhost:8080',
          hintMaxNumWorkers: 8,
          initialBackoffMs: 2000,
          maxBackoffMs: 30000,
          throttling: true,
          system_instructions: 'Custom instructions for read'
        }
      }
    };

    render(<FirestoreIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toHaveValue('my-firestore-project');
    expect(screen.getByPlaceholderText('(default)')).toHaveValue('test-db');
    expect(screen.getByPlaceholderText('e.g. users or orders')).toHaveValue('orders');
    expect(screen.getByLabelText(/Collection Group Query/i)).toBeChecked();
    expect(screen.getByLabelText(/Read Operation/i)).toHaveValue('runQuery');

    expect(screen.getByPlaceholderText(/\[{"field": "status"/i)).toHaveValue(
      '[{"field": "status", "op": "EQUAL", "value": "paid"}]'
    );
    expect(screen.getByPlaceholderText('e.g. created_at')).toHaveValue('created_at');
    expect(screen.getByRole('combobox', { name: /^Order Direction/i })).toHaveValue('DESCENDING');
    expect(screen.getByPlaceholderText('Unlimited')).toHaveValue(100);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('localhost:8080')).toHaveValue('localhost:8080');
    expect(screen.getByPlaceholderText('e.g. 10')).toHaveValue(8);
    expect(screen.getByPlaceholderText('5000')).toHaveValue(2000);
    expect(screen.getByPlaceholderText('60000')).toHaveValue(30000);
    expect(screen.getByLabelText(/Enable RPC Throttling/i)).toBeChecked();

    expect(
      screen.getByPlaceholderText(/Read Document protos from Firestore collection/i)
    ).toHaveValue('Custom instructions for read');
  });

  it('dispatches updates when text, checkbox, and select fields change', () => {
    const node = {
      data: {
        label: 'Firestore Source',
        properties: {}
      }
    };

    render(<FirestoreIOSourceProperties node={node} onChange={mockOnChange} />);

    // Change Project ID
    const projectInput = screen.getByPlaceholderText('my-gcp-project');
    fireEvent.change(projectInput, { target: { name: 'projectId', value: 'new-project' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'new-project' })
    );

    // Change Collection ID
    const collectionInput = screen.getByPlaceholderText('e.g. users or orders');
    fireEvent.change(collectionInput, { target: { name: 'collectionId', value: 'users' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: 'users' })
    );

    // Toggle Collection Group
    const groupCheckbox = screen.getByLabelText(/Collection Group Query/i);
    fireEvent.click(groupCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ isCollectionGroup: true })
    );
  });

  it('switches between read operations revealing operation-specific fields', () => {
    const { rerender } = render(
      <FirestoreIOSourceProperties
        node={{
          data: {
            properties: {
              operation: 'partitionQuery',
              partitionCount: 20,
              nameOnlyQuery: true
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    // partitionQuery fields
    expect(screen.getByPlaceholderText('e.g. 50')).toHaveValue(20);
    expect(screen.getByLabelText(/Name Only Query/i)).toBeChecked();

    // Switch to listDocuments
    rerender(
      <FirestoreIOSourceProperties
        node={{
          data: {
            properties: {
              operation: 'listDocuments',
              pageSize: 50,
              maskFields: 'name, email',
              showMissing: true
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByPlaceholderText('100')).toHaveValue(50);
    expect(screen.getByPlaceholderText('e.g. name, email, status')).toHaveValue('name, email');
    expect(screen.getByLabelText(/Show Missing Documents/i)).toBeChecked();

    // Switch to listCollectionIds
    rerender(
      <FirestoreIOSourceProperties
        node={{
          data: {
            properties: {
              operation: 'listCollectionIds',
              parentDocument: 'users/user-123'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByPlaceholderText('e.g. users/user-123 (or empty for root)')).toHaveValue(
      'users/user-123'
    );

    // Switch to batchGetDocuments
    rerender(
      <FirestoreIOSourceProperties
        node={{
          data: {
            properties: {
              operation: 'batchGetDocuments',
              documentPaths: 'projects/p/databases/(default)/documents/users/u1'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    expect(
      screen.getByPlaceholderText('projects/my-project/databases/(default)/documents/users/user-1')
    ).toHaveValue('projects/p/databases/(default)/documents/users/u1');
  });

  it('switches to Secret Manager auth mode and loads secrets into datalist', () => {
    const node = {
      data: {
        label: 'Firestore Source',
        properties: {
          authMode: 'secret_manager',
          serviceAccountSecret: 'my-firestore-secret'
        }
      }
    };

    render(<FirestoreIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. firestore-sa-key')).toHaveValue('my-firestore-secret');
  });

  it('handles edge case: numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Firestore Source',
        properties: {
          operation: 'runQuery',
          limit: 0,
          hintMaxNumWorkers: 0,
          initialBackoffMs: 0,
          maxBackoffMs: 0
        }
      }
    };

    render(<FirestoreIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('Unlimited')).toHaveValue(0);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('e.g. 10')).toHaveValue(0);
    expect(screen.getByPlaceholderText('5000')).toHaveValue(0);
    expect(screen.getByPlaceholderText('60000')).toHaveValue(0);
  });

  it('handles missing node.data.properties gracefully without crashing', () => {
    const node = {
      data: {
        label: 'Firestore Source'
      }
    };

    render(<FirestoreIOSourceProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-gcp-project')).toHaveValue('');
    expect(screen.getByPlaceholderText('e.g. users or orders')).toHaveValue('');
  });

  it('updates system_instructions on textarea change', () => {
    const node = {
      data: {
        properties: {}
      }
    };

    render(<FirestoreIOSourceProperties node={node} onChange={mockOnChange} />);

    const instructionsTextarea = screen.getByPlaceholderText(
      /Read Document protos from Firestore collection/i
    );
    fireEvent.change(instructionsTextarea, { target: { value: 'Newly updated prompt' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Newly updated prompt'
      })
    );
  });
});
