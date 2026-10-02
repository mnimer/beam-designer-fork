/**
 * SingleStoreDBIOSinkProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the SingleStoreDBIOSinkProperties panel component covering field rendering,
 * hydration from node properties, onChange event dispatch, IPC Secret Manager communication,
 * batch size settings, edge cases (missing properties, 0 values), validation alerts,
 * and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SingleStoreDBIOSinkProperties } from './SingleStoreDBIO';

describe('SingleStoreDBIOSinkProperties', () => {
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

  it('renders required endpoint, database, and destination table and shows errors when empty', () => {
    const node = {
      data: {
        label: 'SingleStore Sink',
        properties: {}
      }
    };

    render(<SingleStoreDBIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1:3306')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. telemetry_db')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. telemetry_rollups')).toBeInTheDocument();

    expect(screen.getByText(/Endpoint host:port is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Database name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Destination table is required/i)).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates all populated sink properties correctly', () => {
    const node = {
      data: {
        label: 'SingleStore Sink',
        properties: {
          endpoint: 'singlestore.prod:3306',
          database: 'iot_metrics',
          table: 'sensor_rollups',
          userDataMapper: 'com.example.SensorRollupMapper',
          batchSize: 50000,
          authMode: 'none',
          connectionProperties: 'connectTimeout=30000',
          connectTimeout: 30000,
          sslMode: 'TRUST',
          system_instructions: 'Insert aggregated rollups using UserDataMapper'
        }
      }
    };

    render(<SingleStoreDBIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1:3306')).toHaveValue('singlestore.prod:3306');
    expect(screen.getByPlaceholderText('e.g. telemetry_db')).toHaveValue('iot_metrics');
    expect(screen.getByPlaceholderText('e.g. telemetry_rollups')).toHaveValue('sensor_rollups');
    expect(screen.getByPlaceholderText('com.example.SensorRollupUserDataMapper')).toHaveValue('com.example.SensorRollupMapper');
    expect(screen.getByPlaceholderText('10000')).toHaveValue(50000);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('connectTimeout=30000;useServerPrepStmts=FALSE')).toHaveValue('connectTimeout=30000');
    expect(screen.getByPlaceholderText('30000')).toHaveValue(30000);
    expect(screen.getByRole('combobox', { name: 'SSL Mode' })).toHaveValue('TRUST');
    expect(screen.getByPlaceholderText(/Write SensorRollup records to SingleStore table/i)).toHaveValue('Insert aggregated rollups using UserDataMapper');
  });

  it('dispatches updates when text and number fields change', () => {
    const node = {
      data: {
        label: 'SingleStore Sink',
        properties: {
          endpoint: '127.0.0.1:3306',
          database: 'iot_metrics'
        }
      }
    };

    render(<SingleStoreDBIOSinkProperties node={node} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('e.g. telemetry_rollups');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'daily_rollups' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      endpoint: '127.0.0.1:3306',
      database: 'iot_metrics',
      table: 'daily_rollups'
    });

    const batchSizeInput = screen.getByPlaceholderText('10000');
    fireEvent.change(batchSizeInput, { target: { name: 'batchSize', value: '25000' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      endpoint: '127.0.0.1:3306',
      database: 'iot_metrics',
      batchSize: '25000'
    });
  });

  it('switches to Secret Manager auth mode and updates passwordSecret', () => {
    const node = {
      data: {
        label: 'SingleStore Sink',
        properties: {
          endpoint: '127.0.0.1:3306',
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<SingleStoreDBIOSinkProperties node={node} onChange={mockOnChange} />);

    const usernameInput = screen.getByPlaceholderText('e.g. singlestore-username');
    const passwordInput = screen.getByPlaceholderText('e.g. singlestore-password');
    expect(usernameInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();

    fireEvent.change(passwordInput, { target: { name: 'passwordSecret', value: 'singlestore-sink-pass' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      passwordSecret: 'singlestore-sink-pass'
    }));
  });

  it('handles edge case: numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'SingleStore Sink',
        properties: {
          batchSize: 0,
          connectTimeout: 0
        }
      }
    };

    render(<SingleStoreDBIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('10000')).toHaveValue(0);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('30000')).toHaveValue(0);
  });

  it('handles missing node.data.properties gracefully without crashing', () => {
    const node = {
      data: {
        label: 'SingleStore Sink'
      }
    } as any;

    render(<SingleStoreDBIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1:3306')).toHaveValue('');
  });

  it('updates system_instructions when textarea changes', () => {
    const node = {
      data: {
        label: 'SingleStore Sink',
        properties: {}
      }
    };
    render(<SingleStoreDBIOSinkProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Write SensorRollup records to SingleStore table/i);
    fireEvent.change(textarea, { target: { value: 'New singlestore sink prompt' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New singlestore sink prompt'
    }));
  });

  it('supports mapperStrategy switching between auto-infer, schema definition, and custom class', () => {
    // 1. Default / infer strategy: shows dynamic inference banner, no schema or custom class input
    const nodeInfer = {
      data: {
        label: 'SingleStore Sink',
        properties: {
          endpoint: '127.0.0.1:3306',
          database: 'telemetry_db',
          table: 'telemetry_rollups',
          mapperStrategy: 'infer'
        }
      }
    };
    const { unmount } = render(<SingleStoreDBIOSinkProperties node={nodeInfer} onChange={mockOnChange} />);
    expect(screen.getByText(/Dynamic Inference:/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/id:BIGINT, device_id:VARCHAR/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('com.example.SensorRollupUserDataMapper')).not.toBeInTheDocument();
    unmount();

    // 2. Schema strategy: renders 3-tab SchemaEditor and dispatches changes
    const nodeSchema = {
      data: {
        label: 'SingleStore Sink',
        properties: {
          endpoint: '127.0.0.1:3306',
          database: 'telemetry_db',
          table: 'telemetry_rollups',
          mapperStrategy: 'schema',
          schemaString: 'id:BIGINT, metric_val:DOUBLE'
        }
      }
    };
    const { unmount: unmountSchema } = render(<SingleStoreDBIOSinkProperties node={nodeSchema} onChange={mockOnChange} />);
    expect(screen.getByText('Field Builder (2)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Schema String Tab/i }));
    const schemaInput = screen.getByPlaceholderText(/id:BIGINT, device_id:VARCHAR/i);
    expect(schemaInput).toHaveValue('id:BIGINT, metric_val:DOUBLE');
    fireEvent.change(schemaInput, { target: { value: 'id:BIGINT, metric_val:DOUBLE, ts:TIMESTAMP' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      schemaString: 'id:BIGINT, metric_val:DOUBLE, ts:TIMESTAMP'
    }));
    unmountSchema();

    // 3. Custom class strategy: renders userDataMapper class input
    const nodeCustom = {
      data: {
        label: 'SingleStore Sink',
        properties: {
          endpoint: '127.0.0.1:3306',
          database: 'telemetry_db',
          table: 'telemetry_rollups',
          mapperStrategy: 'customClass',
          userDataMapper: 'com.example.CustomUserDataMapper'
        }
      }
    };
    render(<SingleStoreDBIOSinkProperties node={nodeCustom} onChange={mockOnChange} />);
    const userDataMapperInput = screen.getByPlaceholderText('com.example.SensorRollupUserDataMapper');
    expect(userDataMapperInput).toHaveValue('com.example.CustomUserDataMapper');
    fireEvent.change(userDataMapperInput, { target: { name: 'userDataMapper', value: 'com.example.NewUserDataMapper' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      userDataMapper: 'com.example.NewUserDataMapper'
    }));
  });
});
