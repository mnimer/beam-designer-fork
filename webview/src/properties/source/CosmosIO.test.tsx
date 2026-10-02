/**
 * CosmosIOSourceProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates the CosmosIOSourceProperties panel component covering field rendering,
 * hydration from node properties, onChange event dispatch, validation alerts,
 * and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CosmosIOSourceProperties } from './CosmosIO';

describe('CosmosIOSourceProperties', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders required fields and shows validation errors when empty', () => {
    const node = {
      data: {
        label: 'Cosmos Source',
        properties: {}
      }
    };

    const { container } = render(<CosmosIOSourceProperties node={node} onChange={mockOnChange} />);

    // Info header
    expect(screen.getAllByText('CosmosIO.read()')[0]).toBeInTheDocument();

    // Required fields & errors
    const dbInput = container.querySelector('#cosmosSourceDatabase');
    expect(dbInput).toBeInTheDocument();
    expect(screen.getByText('Database is required')).toBeInTheDocument();

    const contInput = container.querySelector('#cosmosSourceContainer');
    expect(contInput).toBeInTheDocument();
    expect(screen.getByText('Container is required')).toBeInTheDocument();
  });

  it('hydrates all populated properties correctly', () => {
    const node = {
      data: {
        label: 'Cosmos Source',
        properties: {
          database: 'production-db',
          container: 'users-collection',
          query: 'SELECT * FROM c WHERE c.active = true',
          documentClass: 'com.example.UserDocument',
          coderClass: 'com.example.UserCoder',
          system_instructions: 'Use CosmosIO.read()'
        }
      }
    };

    const { container } = render(<CosmosIOSourceProperties node={node} onChange={mockOnChange} />);

    expect((container.querySelector('#cosmosSourceDatabase') as HTMLInputElement).value).toBe('production-db');
    expect((container.querySelector('#cosmosSourceContainer') as HTMLInputElement).value).toBe('users-collection');
    expect((container.querySelector('#cosmosSourceQuery') as HTMLTextAreaElement).value).toBe('SELECT * FROM c WHERE c.active = true');
    expect((container.querySelector('#cosmosSourceDocClass') as HTMLInputElement).value).toBe('com.example.UserDocument');
    expect((container.querySelector('#cosmosSourceInstructions') as HTMLTextAreaElement).value).toBe('Use CosmosIO.read()');

    expect(screen.queryByText('Database is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Container is required')).not.toBeInTheDocument();
  });

  it('dispatches onChange when database or container changes', () => {
    const node = {
      data: {
        label: 'Cosmos Source',
        properties: {
          database: 'initial-db'
        }
      }
    };

    const { container } = render(<CosmosIOSourceProperties node={node} onChange={mockOnChange} />);

    const dbInput = container.querySelector('#cosmosSourceDatabase') as HTMLInputElement;
    fireEvent.change(dbInput, { target: { name: 'database', value: 'updated-db' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        database: 'updated-db'
      })
    );

    const contInput = container.querySelector('#cosmosSourceContainer') as HTMLInputElement;
    fireEvent.change(contInput, { target: { name: 'container', value: 'new-container' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        container: 'new-container'
      })
    );
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const node = {
      data: {
        label: 'Cosmos Source',
        properties: {}
      }
    };

    const { container } = render(<CosmosIOSourceProperties node={node} onChange={mockOnChange} />);

    const inst = container.querySelector('#cosmosSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(inst, { target: { value: 'Use CosmosIO.read()' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Use CosmosIO.read()'
      })
    );
  });
});
