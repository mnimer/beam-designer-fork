/**
 * SingleStoreDBIOSourceProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the SingleStoreDBIOSourceProperties panel component covering field rendering,
 * hydration from node properties, onChange event dispatch, Secret Manager authentication,
 * read mode switching (query vs table vs partitions), output parallelization toggling,
 * edge cases (missing properties, 0 values), validation alerts, and instruction updates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SingleStoreDBIOSourceProperties } from './SingleStoreDBIO';

describe('SingleStoreDBIOSourceProperties', () => {
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

  it('renders required endpoint, database, and query in query mode and shows errors when empty', () => {
    const node = {
      data: {
        label: 'SingleStore Source',
        properties: {}
      }
    };

    render(<SingleStoreDBIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1:3306')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. telemetry_db')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('SELECT * FROM sensor_readings WHERE active = 1')).toBeInTheDocument();

    expect(screen.getByText(/Endpoint host:port is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Database name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/SQL query is required in query mode/i)).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates all populated properties correctly in query mode', () => {
    const node = {
      data: {
        label: 'SingleStore Source',
        properties: {
          endpoint: 'singlestore.prod:3306',
          database: 'iot_metrics',
          readMode: 'query',
          query: 'SELECT sensor_id, reading FROM sensors',
          rowMapper: 'com.example.SensorRowMapper',
          outputParallelization: true,
          authMode: 'none',
          connectionProperties: 'connectTimeout=60000',
          connectTimeout: 60000,
          sslMode: 'VERIFY_FULL',
          system_instructions: 'Map ResultSet to Sensor POJO'
        }
      }
    };

    render(<SingleStoreDBIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1:3306')).toHaveValue('singlestore.prod:3306');
    expect(screen.getByPlaceholderText('e.g. telemetry_db')).toHaveValue('iot_metrics');
    expect(screen.getByPlaceholderText('SELECT * FROM sensor_readings WHERE active = 1')).toHaveValue('SELECT sensor_id, reading FROM sensors');
    expect(screen.getByPlaceholderText('com.example.SensorReadingRowMapper')).toHaveValue('com.example.SensorRowMapper');
    expect(screen.getByLabelText(/Enable Output Parallelization/i)).toBeChecked();

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('connectTimeout=30000;useServerPrepStmts=FALSE')).toHaveValue('connectTimeout=60000');
    expect(screen.getByPlaceholderText('30000')).toHaveValue(60000);
    expect(screen.getByRole('combobox', { name: 'SSL Mode' })).toHaveValue('VERIFY_FULL');
    expect(screen.getByPlaceholderText(/Read rows from SingleStoreDB table/i)).toHaveValue('Map ResultSet to Sensor POJO');
  });

  it('switches between read modes (query, table, partitions) and validates active targets', () => {
    const node = {
      data: {
        label: 'SingleStore Source',
        properties: {
          endpoint: '127.0.0.1:3306',
          database: 'iot_metrics',
          readMode: 'table',
          table: ''
        }
      }
    };

    render(<SingleStoreDBIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('SELECT * FROM sensor_readings WHERE active = 1')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. sensor_readings')).toBeInTheDocument();
    expect(screen.getByText(/Table name is required in table mode/i)).toBeInTheDocument();

    const partitionsRadio = screen.getByRole('radio', { name: 'Partitioned Read' });
    fireEvent.click(partitionsRadio);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      readMode: 'partitions'
    }));
  });

  it('dispatches updates when text and checkbox fields change', () => {
    const node = {
      data: {
        label: 'SingleStore Source',
        properties: {
          endpoint: '127.0.0.1:3306',
          outputParallelization: true
        }
      }
    };

    render(<SingleStoreDBIOSourceProperties node={node} onChange={mockOnChange} />);

    const databaseInput = screen.getByPlaceholderText('e.g. telemetry_db');
    fireEvent.change(databaseInput, { target: { name: 'database', value: 'analytics_db' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      endpoint: '127.0.0.1:3306',
      outputParallelization: true,
      database: 'analytics_db'
    });

    const parallelCheckbox = screen.getByLabelText(/Enable Output Parallelization/i);
    fireEvent.click(parallelCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      outputParallelization: false
    }));
  });

  it('switches to Secret Manager auth mode', () => {
    const node = {
      data: {
        label: 'SingleStore Source',
        properties: {
          endpoint: '127.0.0.1:3306',
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<SingleStoreDBIOSourceProperties node={node} onChange={mockOnChange} />);

    const usernameInput = screen.getByPlaceholderText('e.g. singlestore-username');
    const passwordInput = screen.getByPlaceholderText('e.g. singlestore-password');
    expect(usernameInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();

    fireEvent.change(usernameInput, { target: { name: 'usernameSecret', value: 'singlestore-user' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      usernameSecret: 'singlestore-user'
    }));
  });

  it('handles edge case: numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'SingleStore Source',
        properties: {
          connectTimeout: 0
        }
      }
    };

    render(<SingleStoreDBIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('30000')).toHaveValue(0);
  });

  it('handles missing node.data.properties gracefully without crashing', () => {
    const node = {
      data: {
        label: 'SingleStore Source'
      }
    } as any;

    render(<SingleStoreDBIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1:3306')).toHaveValue('');
  });

  it('updates system_instructions when code generation instructions textarea changes', () => {
    const node = {
      data: {
        label: 'SingleStore Source',
        properties: {}
      }
    };
    render(<SingleStoreDBIOSourceProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(/Read rows from SingleStoreDB table/i);
    fireEvent.change(textarea, { target: { value: 'New singlestore source prompt' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New singlestore source prompt'
    }));
  });

  it('supports mapperStrategy switching between auto-infer, schema definition, and custom class', () => {
    // 1. Default / infer strategy: shows dynamic inference banner, no schema or custom class input
    const nodeInfer = {
      data: {
        label: 'SingleStore Source',
        properties: {
          endpoint: '127.0.0.1:3306',
          database: 'telemetry_db',
          mapperStrategy: 'infer'
        }
      }
    };
    const { unmount } = render(<SingleStoreDBIOSourceProperties node={nodeInfer} onChange={mockOnChange} />);
    expect(screen.getByText(/Dynamic Inference:/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/id:BIGINT, device_id:VARCHAR/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('com.example.SensorReadingRowMapper')).not.toBeInTheDocument();
    unmount();

    // 2. Schema strategy: renders 3-tab SchemaEditor and dispatches changes
    const nodeSchema = {
      data: {
        label: 'SingleStore Source',
        properties: {
          endpoint: '127.0.0.1:3306',
          database: 'telemetry_db',
          mapperStrategy: 'schema',
          schemaString: 'id:BIGINT, metric_val:DOUBLE'
        }
      }
    };
    const { unmount: unmountSchema } = render(<SingleStoreDBIOSourceProperties node={nodeSchema} onChange={mockOnChange} />);
    expect(screen.getByText('Field Builder (2)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Schema String Tab/i }));
    const schemaInput = screen.getByPlaceholderText(/id:BIGINT, device_id:VARCHAR/i);
    expect(schemaInput).toHaveValue('id:BIGINT, metric_val:DOUBLE');
    fireEvent.change(schemaInput, { target: { value: 'id:BIGINT, metric_val:DOUBLE, ts:TIMESTAMP' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      schemaString: 'id:BIGINT, metric_val:DOUBLE, ts:TIMESTAMP'
    }));
    unmountSchema();

    // 3. Custom class strategy: renders rowMapper class input
    const nodeCustom = {
      data: {
        label: 'SingleStore Source',
        properties: {
          endpoint: '127.0.0.1:3306',
          database: 'telemetry_db',
          mapperStrategy: 'customClass',
          rowMapper: 'com.example.CustomRowMapper'
        }
      }
    };
    render(<SingleStoreDBIOSourceProperties node={nodeCustom} onChange={mockOnChange} />);
    const rowMapperInput = screen.getByPlaceholderText('com.example.SensorReadingRowMapper');
    expect(rowMapperInput).toHaveValue('com.example.CustomRowMapper');
    fireEvent.change(rowMapperInput, { target: { name: 'rowMapper', value: 'com.example.NewRowMapper' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      rowMapper: 'com.example.NewRowMapper'
    }));
  });
});
