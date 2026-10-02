/**
 * IcebergIO Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating IcebergIOSourceProperties component functionality,
 * form change callbacks, validation states for required fields (table and warehouseLocation),
 * mutually exclusive time-travel validation, conditional catalogUri rendering, accordion toggling,
 * Secret Manager authentication, and code generation instructions.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Validates required field states (table and warehouseLocation independently).
 * - Tests time-travel mutual exclusivity across all four states (neither, snapshot only, timestamp only, both).
 * - Tests conditional rendering of catalogUri across rest, hive, and hadoop catalog types.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IcebergIOSourceProperties } from './IcebergIO';

describe('IcebergIOSourceProperties', () => {
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

    const { container } = render(<IcebergIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const tableInput = container.querySelector('#icebergSourceTable') as HTMLInputElement;
    expect(tableInput).toBeInTheDocument();
    expect(tableInput).toHaveValue('');
    expect(tableInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Table is required.')).toBeInTheDocument();

    const warehouseInput = container.querySelector('#icebergSourceWarehouseLocation') as HTMLInputElement;
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
          table: 'lakehouse.events',
          catalogName: 'lakehouse',
          catalogType: 'rest',
          warehouseLocation: 'gs://lakehouse/iceberg/warehouse',
          catalogUri: 'http://rest-catalog:8181',
          snapshotId: '1234567890123456789',
          filterExpression: "status = 'ACTIVE'",
          columnProjection: 'id, timestamp, status',
          configProperties: 'io-impl=org.apache.iceberg.gcp.gcs.GCSFileIO',
          system_instructions: 'Custom Iceberg reader instructions'
        }
      }
    };

    const { container } = render(<IcebergIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const tableInput = container.querySelector('#icebergSourceTable') as HTMLInputElement;
    const catalogNameInput = container.querySelector('#icebergSourceCatalogName') as HTMLInputElement;
    const catalogTypeSelect = container.querySelector('#icebergSourceCatalogType') as HTMLSelectElement;
    const warehouseInput = container.querySelector('#icebergSourceWarehouseLocation') as HTMLInputElement;
    const catalogUriInput = container.querySelector('#icebergSourceCatalogUri') as HTMLInputElement;
    const snapshotInput = container.querySelector('#icebergSourceSnapshotId') as HTMLInputElement;
    const filterInput = container.querySelector('#icebergSourceFilterExpression') as HTMLInputElement;
    const projectionInput = container.querySelector('#icebergSourceColumnProjection') as HTMLInputElement;
    const instructionsTextarea = container.querySelector('#icebergSourceInstructions') as HTMLTextAreaElement;

    expect(tableInput).toHaveValue('lakehouse.events');
    expect(tableInput).toHaveAttribute('aria-invalid', 'false');
    expect(catalogNameInput).toHaveValue('lakehouse');
    expect(catalogTypeSelect).toHaveValue('rest');
    expect(warehouseInput).toHaveValue('gs://lakehouse/iceberg/warehouse');
    expect(warehouseInput).toHaveAttribute('aria-invalid', 'false');
    expect(catalogUriInput).toHaveValue('http://rest-catalog:8181');
    expect(snapshotInput).toHaveValue('1234567890123456789');
    expect(filterInput).toHaveValue("status = 'ACTIVE'");
    expect(projectionInput).toHaveValue('id, timestamp, status');
    expect(instructionsTextarea).toHaveValue('Custom Iceberg reader instructions');

    expect(screen.queryByText('Table is required.')).not.toBeInTheDocument();
    expect(screen.queryByText('Warehouse Location is required.')).not.toBeInTheDocument();
  });

  it('validates on/off for table and warehouseLocation independently', () => {
    // Only table provided
    const mockNodeWithTable: any = {
      data: {
        properties: {
          table: 'lakehouse.events'
        }
      }
    };
    const { rerender } = render(<IcebergIOSourceProperties node={mockNodeWithTable} onChange={mockOnChange} />);
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
    rerender(<IcebergIOSourceProperties node={mockNodeWithWarehouse} onChange={mockOnChange} />);
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
    const { container, rerender } = render(<IcebergIOSourceProperties node={mockNodeRest} onChange={mockOnChange} />);
    expect(container.querySelector('#icebergSourceCatalogUri')).toBeInTheDocument();

    // Branch 2: hive -> catalogUri shown
    const mockNodeHive: any = {
      data: {
        properties: {
          catalogType: 'hive',
          catalogUri: 'thrift://metastore:9083'
        }
      }
    };
    rerender(<IcebergIOSourceProperties node={mockNodeHive} onChange={mockOnChange} />);
    expect(container.querySelector('#icebergSourceCatalogUri')).toBeInTheDocument();

    // Branch 3: hadoop -> catalogUri hidden
    const mockNodeHadoop: any = {
      data: {
        properties: {
          catalogType: 'hadoop'
        }
      }
    };
    rerender(<IcebergIOSourceProperties node={mockNodeHadoop} onChange={mockOnChange} />);
    expect(container.querySelector('#icebergSourceCatalogUri')).not.toBeInTheDocument();
  });

  it('validates mutually exclusive time-travel: neither, snapshot only, timestamp only, and both', () => {
    const baseNode: any = {
      data: {
        properties: {}
      }
    };

    // Case 1: neither set -> valid
    const { container, rerender } = render(<IcebergIOSourceProperties node={baseNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/Time travel parameters are mutually exclusive/i)).not.toBeInTheDocument();
    expect(container.querySelector('#icebergSourceSnapshotId')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#icebergSourceAsOfTimestamp')).toHaveAttribute('aria-invalid', 'false');

    // Case 2: snapshotId only -> valid
    const nodeWithSnapshot: any = {
      data: {
        properties: {
          snapshotId: '1234567890'
        }
      }
    };
    rerender(<IcebergIOSourceProperties node={nodeWithSnapshot} onChange={mockOnChange} />);
    expect(screen.queryByText(/Time travel parameters are mutually exclusive/i)).not.toBeInTheDocument();
    expect(container.querySelector('#icebergSourceSnapshotId')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#icebergSourceAsOfTimestamp')).toHaveAttribute('aria-invalid', 'false');

    // Case 3: asOfTimestamp only -> valid
    const nodeWithTimestamp: any = {
      data: {
        properties: {
          asOfTimestamp: '2024-01-01T00:00:00Z'
        }
      }
    };
    rerender(<IcebergIOSourceProperties node={nodeWithTimestamp} onChange={mockOnChange} />);
    expect(screen.queryByText(/Time travel parameters are mutually exclusive/i)).not.toBeInTheDocument();
    expect(container.querySelector('#icebergSourceSnapshotId')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#icebergSourceAsOfTimestamp')).toHaveAttribute('aria-invalid', 'false');

    // Case 4: BOTH set -> invalid error alert
    const nodeWithBoth: any = {
      data: {
        properties: {
          snapshotId: '1234567890',
          asOfTimestamp: '2024-01-01T00:00:00Z'
        }
      }
    };
    rerender(<IcebergIOSourceProperties node={nodeWithBoth} onChange={mockOnChange} />);
    const alert = screen.getByText('Cannot specify both Snapshot ID and As Of Timestamp. Time travel parameters are mutually exclusive.');
    expect(alert).toBeInTheDocument();
    expect(container.querySelector('#icebergSourceSnapshotId')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#icebergSourceAsOfTimestamp')).toHaveAttribute('aria-invalid', 'true');
  });

  it('handles field changes for table, catalogName, catalogType, catalogUri, snapshotId, asOfTimestamp, filterExpression, and columnProjection', () => {
    const mockNode: any = {
      data: {
        properties: {
          catalogType: 'rest'
        }
      }
    };

    const { container } = render(<IcebergIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // table change
    const tableInput = container.querySelector('#icebergSourceTable') as HTMLInputElement;
    fireEvent.change(tableInput, {
      target: { name: 'table', value: 'default.orders' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        table: 'default.orders'
      })
    );

    // catalogName change
    const catalogNameInput = container.querySelector('#icebergSourceCatalogName') as HTMLInputElement;
    fireEvent.change(catalogNameInput, {
      target: { name: 'catalogName', value: 'prod_iceberg' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogName: 'prod_iceberg'
      })
    );

    // catalogType change
    const catalogTypeSelect = container.querySelector('#icebergSourceCatalogType') as HTMLSelectElement;
    fireEvent.change(catalogTypeSelect, {
      target: { name: 'catalogType', value: 'hive' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogType: 'hive'
      })
    );

    // catalogUri change
    const catalogUriInput = container.querySelector('#icebergSourceCatalogUri') as HTMLInputElement;
    fireEvent.change(catalogUriInput, {
      target: { name: 'catalogUri', value: 'http://rest-server:8181' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogUri: 'http://rest-server:8181'
      })
    );

    // snapshotId change
    const snapshotInput = container.querySelector('#icebergSourceSnapshotId') as HTMLInputElement;
    fireEvent.change(snapshotInput, {
      target: { name: 'snapshotId', value: '9876543210' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: '9876543210'
      })
    );

    // asOfTimestamp change
    const timestampInput = container.querySelector('#icebergSourceAsOfTimestamp') as HTMLInputElement;
    fireEvent.change(timestampInput, {
      target: { name: 'asOfTimestamp', value: '2024-06-01T12:00:00Z' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        asOfTimestamp: '2024-06-01T12:00:00Z'
      })
    );

    // filterExpression change
    const filterInput = container.querySelector('#icebergSourceFilterExpression') as HTMLInputElement;
    fireEvent.change(filterInput, {
      target: { name: 'filterExpression', value: "region = 'US' AND active = true" }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filterExpression: "region = 'US' AND active = true"
      })
    );

    // columnProjection change
    const projectionInput = container.querySelector('#icebergSourceColumnProjection') as HTMLInputElement;
    fireEvent.change(projectionInput, {
      target: { name: 'columnProjection', value: 'order_id, user_id, total' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        columnProjection: 'order_id, user_id, total'
      })
    );
  });

  it('handles accordion toggling and configProperties input in advanced configuration', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<IcebergIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Open Advanced Accordion
    const advancedToggle = screen.getByText('Advanced & Catalog Configuration');
    fireEvent.click(advancedToggle);

    const configPropertiesTextarea = container.querySelector('#icebergSourceConfigProperties') as HTMLTextAreaElement;
    expect(configPropertiesTextarea).toBeInTheDocument();

    fireEvent.change(configPropertiesTextarea, {
      target: { name: 'configProperties', value: 'io-impl=org.apache.iceberg.gcp.gcs.GCSFileIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configProperties: 'io-impl=org.apache.iceberg.gcp.gcs.GCSFileIO'
      })
    );

  });

  it('handles SecretManagerAuthFields interaction', () => {
    const mockNode: any = {
      data: {
        properties: {
          authMode: 'secretManager',
          secretName: ''
        }
      }
    };

    const { container } = render(<IcebergIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Secret input should be rendered because authMode is secretManager
    const secretInput = container.querySelector('#icebergSourceSecretName') as HTMLInputElement;
    expect(secretInput).toBeInTheDocument();

    // Change secret input
    fireEvent.change(secretInput, {
      target: { name: 'secretName', value: 'iceberg-catalog-key' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        secretName: 'iceberg-catalog-key'
      })
    );
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<IcebergIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#icebergSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Read Iceberg records and apply pushdown projection' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Read Iceberg records and apply pushdown projection'
      })
    );
  });
});
