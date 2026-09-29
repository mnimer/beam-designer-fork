/**
 * IcebergIO Sink Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating IcebergIOSinkProperties component functionality,
 * form change callbacks, validation states for required fields (table and warehouseLocation),
 * conditional catalogUri rendering, accordion toggling, checkbox handling,
 * Secret Manager secret discovery, GCS bucket discovery error alerts, and code generation instructions.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode and listens for extension message dispatch events.
 * - Validates required field states (table and warehouseLocation independently).
 * - Tests conditional rendering of catalogUri across rest, hive, and hadoop catalog types.
 * - Suite-wide regression guard: verifies bucket discovery error surfaces with a valid non-empty warehouse location.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IcebergIOSinkProperties } from './IcebergIO';

describe('IcebergIOSinkProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing table and warehouseLocation', () => {
    const mockNode: any = {
      data: {
        label: 'IcebergIO',
        beam_transform: 'IcebergIO',
        properties: {}
      }
    };

    const { container } = render(<IcebergIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const tableInput = container.querySelector('#icebergSinkTable') as HTMLInputElement;
    expect(tableInput).toBeInTheDocument();
    expect(tableInput).toHaveValue('');
    expect(tableInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Table is required.')).toBeInTheDocument();

    const warehouseInput = container.querySelector('#icebergSinkWarehouseLocation') as HTMLInputElement;
    expect(warehouseInput).toBeInTheDocument();
    expect(warehouseInput).toHaveValue('');
    expect(warehouseInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Warehouse Location is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'IcebergIO',
        beam_transform: 'IcebergIO',
        properties: {
          table: 'lakehouse.events_processed',
          catalogName: 'lakehouse',
          catalogType: 'rest',
          warehouseLocation: 'gs://lakehouse/iceberg/warehouse',
          catalogUri: 'http://rest-catalog:8181',
          partitionFields: 'date, region',
          triggeringFrequencySeconds: 120,
          tableProperties: 'write.format.default=parquet',
          system_instructions: 'Custom Iceberg writer instructions'
        }
      }
    };

    const { container } = render(<IcebergIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const tableInput = container.querySelector('#icebergSinkTable') as HTMLInputElement;
    const catalogNameInput = container.querySelector('#icebergSinkCatalogName') as HTMLInputElement;
    const catalogTypeSelect = container.querySelector('#icebergSinkCatalogType') as HTMLSelectElement;
    const warehouseInput = container.querySelector('#icebergSinkWarehouseLocation') as HTMLInputElement;
    const catalogUriInput = container.querySelector('#icebergSinkCatalogUri') as HTMLInputElement;
    const partitionInput = container.querySelector('#icebergSinkPartitionFields') as HTMLInputElement;
    const instructionsTextarea = container.querySelector('#icebergSinkInstructions') as HTMLTextAreaElement;

    expect(tableInput).toHaveValue('lakehouse.events_processed');
    expect(tableInput).toHaveAttribute('aria-invalid', 'false');
    expect(catalogNameInput).toHaveValue('lakehouse');
    expect(catalogTypeSelect).toHaveValue('rest');
    expect(warehouseInput).toHaveValue('gs://lakehouse/iceberg/warehouse');
    expect(warehouseInput).toHaveAttribute('aria-invalid', 'false');
    expect(catalogUriInput).toHaveValue('http://rest-catalog:8181');
    expect(partitionInput).toHaveValue('date, region');
    expect(instructionsTextarea).toHaveValue('Custom Iceberg writer instructions');

    expect(screen.queryByText('Table is required.')).not.toBeInTheDocument();
    expect(screen.queryByText('Warehouse Location is required.')).not.toBeInTheDocument();
  });

  it('validates on/off for table and warehouseLocation independently', () => {
    // Only table provided
    const mockNodeWithTable: any = {
      data: {
        properties: {
          table: 'lakehouse.events_processed'
        }
      }
    };
    const { rerender } = render(<IcebergIOSinkProperties node={mockNodeWithTable} onChange={mockOnChange} />);
    expect(screen.queryByText('Table is required.')).not.toBeInTheDocument();
    expect(screen.getByText('Warehouse Location is required.')).toBeInTheDocument();

    // Only warehouseLocation provided
    const mockNodeWithWarehouse: any = {
      data: {
        properties: {
          warehouseLocation: 'gs://lakehouse/iceberg/warehouse'
        }
      }
    };
    rerender(<IcebergIOSinkProperties node={mockNodeWithWarehouse} onChange={mockOnChange} />);
    expect(screen.getByText('Table is required.')).toBeInTheDocument();
    expect(screen.queryByText('Warehouse Location is required.')).not.toBeInTheDocument();
  });

  it('conditionally renders catalogUri when catalogType is rest or hive, but hides it for hadoop', () => {
    // Branch 1: rest -> catalogUri shown
    const mockNodeRest: any = {
      data: {
        properties: {
          catalogType: 'rest',
          catalogUri: 'http://iceberg-rest:8181'
        }
      }
    };
    const { container, rerender } = render(<IcebergIOSinkProperties node={mockNodeRest} onChange={mockOnChange} />);
    expect(container.querySelector('#icebergSinkCatalogUri')).toBeInTheDocument();

    // Branch 2: hive -> catalogUri shown
    const mockNodeHive: any = {
      data: {
        properties: {
          catalogType: 'hive',
          catalogUri: 'thrift://metastore:9083'
        }
      }
    };
    rerender(<IcebergIOSinkProperties node={mockNodeHive} onChange={mockOnChange} />);
    expect(container.querySelector('#icebergSinkCatalogUri')).toBeInTheDocument();

    // Branch 3: hadoop -> catalogUri hidden
    const mockNodeHadoop: any = {
      data: {
        properties: {
          catalogType: 'hadoop'
        }
      }
    };
    rerender(<IcebergIOSinkProperties node={mockNodeHadoop} onChange={mockOnChange} />);
    expect(container.querySelector('#icebergSinkCatalogUri')).not.toBeInTheDocument();
  });

  it('handles field changes for table, catalogName, catalogType, catalogUri, and partitionFields', () => {
    const mockNode: any = {
      data: {
        properties: {
          catalogType: 'rest'
        }
      }
    };

    const { container } = render(<IcebergIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // table change
    const tableInput = container.querySelector('#icebergSinkTable') as HTMLInputElement;
    fireEvent.change(tableInput, {
      target: { name: 'table', value: 'lakehouse.output_table' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        table: 'lakehouse.output_table'
      })
    );

    // catalogName change
    const catalogNameInput = container.querySelector('#icebergSinkCatalogName') as HTMLInputElement;
    fireEvent.change(catalogNameInput, {
      target: { name: 'catalogName', value: 'analytics_catalog' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogName: 'analytics_catalog'
      })
    );

    // catalogType change
    const catalogTypeSelect = container.querySelector('#icebergSinkCatalogType') as HTMLSelectElement;
    fireEvent.change(catalogTypeSelect, {
      target: { name: 'catalogType', value: 'glue' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogType: 'glue'
      })
    );

    // catalogUri change
    const catalogUriInput = container.querySelector('#icebergSinkCatalogUri') as HTMLInputElement;
    fireEvent.change(catalogUriInput, {
      target: { name: 'catalogUri', value: 'http://rest-endpoint:8181' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogUri: 'http://rest-endpoint:8181'
      })
    );

    // No Write Mode control exists. Managed Iceberg has no `write_mode` config key, so an
    // `overwrite`/`upsert` selection could only ever have degraded silently to an append.
    expect(container.querySelector('#icebergSinkWriteMode')).not.toBeInTheDocument();

    // partitionFields change
    const partitionInput = container.querySelector('#icebergSinkPartitionFields') as HTMLInputElement;
    fireEvent.change(partitionInput, {
      target: { name: 'partitionFields', value: 'year, month, day' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        partitionFields: 'year, month, day'
      })
    );
  });

  it('handles accordion toggling, append-only notice, triggeringFrequencySeconds, and tableProperties in write options', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<IcebergIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Open Advanced Accordion
    const advancedToggle = screen.getByText('Table & Write Options');
    fireEvent.click(advancedToggle);

    // The former "Create Table If Not Exists" checkbox is replaced by a static notice: Managed
    // Iceberg auto-creates a missing table and always appends, so there was nothing to toggle.
    expect(container.querySelector('#icebergSinkCreateTableIfNotExists')).not.toBeInTheDocument();
    expect(screen.getByText(/append-only/i)).toBeInTheDocument();
    expect(screen.getByText(/created automatically from/i)).toBeInTheDocument();

    // triggeringFrequencySeconds input
    const frequencyInput = container.querySelector('#icebergSinkTriggeringFrequencySeconds') as HTMLInputElement;
    expect(frequencyInput).toBeInTheDocument();

    fireEvent.change(frequencyInput, {
      target: { name: 'triggeringFrequencySeconds', value: '60' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        triggeringFrequencySeconds: '60'
      })
    );

    // tableProperties textarea
    const tablePropertiesTextarea = container.querySelector('#icebergSinkTableProperties') as HTMLTextAreaElement;
    expect(tablePropertiesTextarea).toBeInTheDocument();

    fireEvent.change(tablePropertiesTextarea, {
      target: { name: 'tableProperties', value: 'write.format.default=parquet' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tableProperties: 'write.format.default=parquet'
      })
    );

    // Toggle closed again
    fireEvent.click(advancedToggle);
    expect(container.querySelector('#icebergSinkCreateTableIfNotExists')).not.toBeInTheDocument();
    expect(container.querySelector('#icebergSinkTriggeringFrequencySeconds')).not.toBeInTheDocument();
    expect(container.querySelector('#icebergSinkTableProperties')).not.toBeInTheDocument();
  });

  it('handles SecretManagerAuthFields interaction and secret discovery', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          authMode: 'secretManager',
          secretName: ''
        }
      }
    };

    const { container } = render(<IcebergIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Secret input should be rendered because authMode is secretManager
    const secretInput = container.querySelector('#icebergSinkSecretName') as HTMLInputElement;
    expect(secretInput).toBeInTheDocument();

    // Initial IPC should request secrets
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });

    // Simulate extension response event with loaded secrets
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: [
              { name: 'projects/123/secrets/iceberg-sink-key', id: 'iceberg-sink-key' }
            ]
          }
        })
      );
    });

    const datalist = document.getElementById('iceberg-sink-secrets-list');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(1);
    expect(datalist?.children[0]).toHaveAttribute('value', 'iceberg-sink-key');

    // Change secret input
    fireEvent.change(secretInput, {
      target: { name: 'secretName', value: 'iceberg-sink-key' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        secretName: 'iceberg-sink-key'
      })
    );
  });

  it('surfaces bucket discovery error with valid non-empty warehouse location', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          table: 'lakehouse.events_processed',
          warehouseLocation: 'gs://lakehouse/iceberg/warehouse'
        }
      }
    };

    render(<IcebergIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Assert initial bucket IPC request
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    // Simulate extension response error
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'storageBucketsLoaded',
            buckets: [],
            error: 'Google Cloud API error: 403 Forbidden'
          }
        })
      );
    });

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent('Failed to load Cloud Storage buckets: Google Cloud API error: 403 Forbidden');
    expect(errorAlert).toHaveClass('text-red-400');
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<IcebergIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#icebergSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Write Iceberg records with append disposition' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Write Iceberg records with append disposition'
      })
    );
  });

  it('falls back to special_instructions and property-level instructions when present', () => {
    const mockNodeSpecialData: any = {
      data: {
        special_instructions: 'Special instructions from data',
        properties: {}
      }
    };
    const { rerender } = render(<IcebergIOSinkProperties node={mockNodeSpecialData} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from data')).toBeInTheDocument();

    const mockNodePropertySys: any = {
      data: {
        properties: {
          system_instructions: 'System instructions from properties'
        }
      }
    };
    rerender(<IcebergIOSinkProperties node={mockNodePropertySys} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('System instructions from properties')).toBeInTheDocument();

    const mockNodePropertySpecial: any = {
      data: {
        properties: {
          special_instructions: 'Special instructions from properties'
        }
      }
    };
    rerender(<IcebergIOSinkProperties node={mockNodePropertySpecial} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from properties')).toBeInTheDocument();
  });
  /**
   * Regression guard for a data-integrity defect: the panel used to collect `writeMode`
   * (append/overwrite/upsert) and `createTableIfNotExists`. Beam's Managed Iceberg connector has
   * neither a `write_mode` nor a `create_table_if_not_exists` config key — writes always append
   * and a missing table is always created. A user selecting "Upsert" therefore got silent appends,
   * i.e. duplicate rows where they expected a merge. Both controls were removed rather than
   * defaulted, because an inert control still communicates a choice that does not exist.
   */
  it('never renders or emits write mode / create-table controls, even for legacy persisted values', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          table: 'lakehouse.events',
          warehouseLocation: 'gs://lakehouse/warehouse',
          // Values left behind by pipelines saved before these fields were removed.
          writeMode: 'upsert',
          createTableIfNotExists: true
        }
      }
    };

    const { container } = render(<IcebergIOSinkProperties node={mockLegacyNode} onChange={mockOnChange} />);

    // Open the accordion so hidden fields would be rendered if they still existed.
    fireEvent.click(screen.getByText('Table & Write Options'));

    expect(container.querySelector('#icebergSinkWriteMode')).not.toBeInTheDocument();
    expect(container.querySelector('#icebergSinkCreateTableIfNotExists')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="checkbox"]')).not.toBeInTheDocument();
    expect(screen.queryByText('Write Mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Table If Not Exists')).not.toBeInTheDocument();

    // Editing an unrelated field must not resurrect the stale keys as user-authored intent.
    fireEvent.change(container.querySelector('#icebergSinkPartitionFields') as HTMLInputElement, {
      target: { name: 'partitionFields', value: 'date' }
    });
    const emitted = mockOnChange.mock.calls[0][0];
    expect(emitted.partitionFields).toBe('date');
  });
});
