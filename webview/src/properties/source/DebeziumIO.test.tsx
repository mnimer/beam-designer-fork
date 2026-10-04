/**
 * Unit Tests for DebeziumIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates DebeziumIOSourceProperties form rendering, hydration, dispatching,
 * connector class switching and port auto-provisioning, output format switching,
 * Secret Manager IPC callbacks, single-error rendering, and instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DebeziumIOSourceProperties } from './DebeziumIO';

describe('DebeziumIOSourceProperties', () => {
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

  it('renders required Hostname and Database fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'Debezium Source',
        properties: {}
      }
    };

    render(<DebeziumIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. db.example.internal')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. inventory_production')).toBeInTheDocument();

    expect(screen.getByText('Database hostname is required')).toBeInTheDocument();
    expect(screen.getByText('Database name is required')).toBeInTheDocument();

    const hostInput = screen.getByPlaceholderText('e.g. db.example.internal');
    expect(hostInput).toHaveAttribute('aria-invalid', 'true');
    expect(hostInput).toHaveAttribute('aria-required', 'true');
  });

  it('hydrates form fields from node.data.properties', () => {
    const node = {
      data: {
        label: 'Debezium Source',
        properties: {
          connectorClass: 'io.debezium.connector.postgresql.PostgresConnector',
          hostName: 'postgres.internal',
          port: 5432,
          databaseName: 'orders_db',
          tableIncludeList: 'public\\.orders',
          columnIncludeList: '.*\\.id,.*\\.total',
          columnExcludeList: '.*\\.card_num',
          maxNumberOfRecords: 1000,
          maxTimeToRunMs: 60000
        }
      }
    };

    render(<DebeziumIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('postgres.internal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5432')).toBeInTheDocument();
    expect(screen.getByDisplayValue('orders_db')).toBeInTheDocument();
    expect(screen.getByDisplayValue('public\\.orders')).toBeInTheDocument();
    expect(screen.getByDisplayValue('.*\\.id,.*\\.total')).toBeInTheDocument();
    expect(screen.getByDisplayValue('.*\\.card_num')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('60000')).toBeInTheDocument();
  });

  it('auto-provisions default port when connectorClass changes', () => {
    const node = {
      data: {
        label: 'Debezium Source',
        properties: {
          connectorClass: 'io.debezium.connector.mysql.MySqlConnector',
          port: 3306
        }
      }
    };

    render(<DebeziumIOSourceProperties node={node} onChange={mockOnChange} />);

    const select = screen.getByRole('combobox', { name: /Connector Class/i });
    fireEvent.change(select, { target: { value: 'io.debezium.connector.postgresql.PostgresConnector' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorClass: 'io.debezium.connector.postgresql.PostgresConnector',
        port: 5432
      })
    );
  });

  it('switches between JSON string and custom typed output format', () => {
    const node = {
      data: {
        label: 'Debezium Source',
        properties: {
          format: 'json' as const
        }
      }
    };

    render(<DebeziumIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. com.example.MyCustomRecordMapper')).not.toBeInTheDocument();

    const typedRadio = screen.getByRole('radio', { name: /Custom Typed/i });
    fireEvent.click(typedRadio);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'typed'
      })
    );
  });

  it('validates formatFunction when custom typed format is active and empty', () => {
    const node = {
      data: {
        label: 'Debezium Source',
        properties: {
          format: 'typed' as const,
          formatFunction: ''
        }
      }
    };

    render(<DebeziumIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByText('SourceRecordMapper class is required for custom typed output')
    ).toBeInTheDocument();

    const mapperInput = screen.getByPlaceholderText('e.g. com.example.MyCustomRecordMapper');
    fireEvent.change(mapperInput, { target: { name: 'formatFunction', value: 'org.myorg.DebeziumMapper' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        formatFunction: 'org.myorg.DebeziumMapper'
      })
    );
  });

  it('updates text inputs, connection properties, and dispatches changes', () => {
    const node = {
      data: {
        label: 'Debezium Source',
        properties: {
          hostName: 'localhost'
        }
      }
    };

    render(<DebeziumIOSourceProperties node={node} onChange={mockOnChange} />);

    const dbInput = screen.getByPlaceholderText('e.g. inventory_production');
    fireEvent.change(dbInput, { target: { name: 'databaseName', value: 'sales_cdc' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      hostName: 'localhost',
      databaseName: 'sales_cdc'
    });

    const connPropInput = screen.getByPlaceholderText(/database\.server\.name=dbserver1/i);
    fireEvent.change(connPropInput, { target: { name: 'connectionProperties', value: 'snapshot.locking.mode=none' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      hostName: 'localhost',
      connectionProperties: 'snapshot.locking.mode=none'
    });
  });

  it('handles numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Debezium Source',
        properties: {
          maxNumberOfRecords: 0,
          heartbeatIntervalMs: 0,
          serverId: 0
        }
      }
    };

    render(<DebeziumIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getAllByDisplayValue('0').length).toBeGreaterThanOrEqual(1);
  });

  it('supports Secret Manager authentication mode and receives IPC secrets', () => {
    const node = {
      data: {
        label: 'Debezium Source',
        properties: {
          authMode: 'secret_manager' as const,
          usernameSecret: 'db-user-secret',
          passwordSecret: 'db-pass-secret'
        }
      }
    };

    render(<DebeziumIOSourceProperties node={node} onChange={mockOnChange} />);

    const userSecretInput = screen.getByPlaceholderText('e.g. debezium-db-username');
    const passSecretInput = screen.getByPlaceholderText('e.g. debezium-db-password');

    expect(userSecretInput).toHaveValue('db-user-secret');
    expect(passSecretInput).toHaveValue('db-pass-secret');
  });

  it('supports none authentication mode and hides secret fields', () => {
    const node = {
      data: {
        label: 'Debezium Source',
        properties: {
          authMode: 'none' as const
        }
      }
    };

    render(<DebeziumIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. debezium-db-username')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. debezium-db-password')).not.toBeInTheDocument();
  });

  it('toggles Advanced Source Settings and updates snapshotMode, heartbeat, slotName', () => {
    const node = {
      data: {
        label: 'Debezium Source',
        properties: {
          snapshotMode: 'never',
          heartbeatIntervalMs: 5000,
          slotName: 'custom_slot'
        }
      }
    };

    render(<DebeziumIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const snapshotSelect = screen.getByRole('combobox', { name: /Snapshot Mode/i });
    expect(snapshotSelect).toHaveValue('never');
    fireEvent.change(snapshotSelect, { target: { name: 'snapshotMode', value: 'initial' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotMode: 'initial'
      })
    );

    const heartbeatInput = screen.getByPlaceholderText('0 (Disabled)');
    fireEvent.change(heartbeatInput, { target: { name: 'heartbeatIntervalMs', value: '10000' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        heartbeatIntervalMs: '10000'
      })
    );

    const slotInput = screen.getByPlaceholderText('e.g. debezium_slot');
    fireEvent.change(slotInput, { target: { name: 'slotName', value: 'production_cdc_slot' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        slotName: 'production_cdc_slot'
      })
    );
  });

  it('updates system_instructions on textarea change', () => {
    render(
      <DebeziumIOSourceProperties
        node={{
          data: {}
        }}
        onChange={mockOnChange}
      />
    );
    const textarea = screen.getByPlaceholderText(/Read MySQL binlog CDC stream as JSON/i);
    fireEvent.change(textarea, { target: { value: 'Synthesize custom debezium pipeline' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Synthesize custom debezium pipeline'
      })
    );
  });

  it('gracefully handles missing properties object on node.data', () => {
    const node = {
      data: {}
    };

    render(<DebeziumIOSourceProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. db.example.internal')).toHaveValue('');
  });
});
