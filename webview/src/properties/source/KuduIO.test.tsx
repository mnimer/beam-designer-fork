/**
 * Unit Tests for KuduIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates KuduIOSourceProperties form rendering, hydration, property change dispatching,
 * field validation, and system instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KuduIOSourceProperties } from './KuduIO';

describe('KuduIOSourceProperties', () => {
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

  it('renders required Master Addresses and Table fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'Kudu Source',
        properties: {}
      }
    };

    render(<KuduIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByPlaceholderText('e.g. kudu-master-1:7051,kudu-master-2:7051')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. impala::default.sensor_telemetry')
    ).toBeInTheDocument();

    expect(screen.getByText('Kudu master addresses are required')).toBeInTheDocument();
    expect(screen.getByText('Table name is required')).toBeInTheDocument();

    const masterInput = screen.getByPlaceholderText('e.g. kudu-master-1:7051,kudu-master-2:7051');
    expect(masterInput).toHaveAttribute('aria-invalid', 'true');
    expect(masterInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('renders hydrated values from node.data.properties', () => {
    const node = {
      data: {
        label: 'Kudu Source',
        properties: {
          masterAddresses: 'kudu1:7051,kudu2:7051',
          table: 'impala::default.sensor_data',
          projectedColumns: 'id, metric, value, recorded_at',
          predicates: 'value > 100',
          faultTolerant: true,
          authMode: 'none'
        }
      }
    };

    render(<KuduIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('kudu1:7051,kudu2:7051')).toBeInTheDocument();
    expect(screen.getByDisplayValue('impala::default.sensor_data')).toBeInTheDocument();
    expect(screen.getByDisplayValue('id, metric, value, recorded_at')).toBeInTheDocument();
    expect(screen.getByDisplayValue('value > 100')).toBeInTheDocument();
    expect(screen.getByLabelText(/Fault Tolerant Scan/i)).toBeChecked();
  });

  it('updates masterAddresses, table, projectedColumns, and predicates when changed', () => {
    const node = {
      data: {
        label: 'Kudu Source',
        properties: {
          masterAddresses: 'kudu1:7051'
        }
      }
    };

    render(<KuduIOSourceProperties node={node} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('e.g. impala::default.sensor_telemetry');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'analytics.events' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      masterAddresses: 'kudu1:7051',
      table: 'analytics.events'
    });

    const projInput = screen.getByPlaceholderText('e.g. id, timestamp, metric_name, value');
    fireEvent.change(projInput, { target: { name: 'projectedColumns', value: 'id, val' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      masterAddresses: 'kudu1:7051',
      projectedColumns: 'id, val'
    });

    const predInput = screen.getByPlaceholderText('e.g. timestamp >= 1600000000');
    fireEvent.change(predInput, { target: { name: 'predicates', value: 'status = "ACTIVE"' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      masterAddresses: 'kudu1:7051',
      predicates: 'status = "ACTIVE"'
    });
  });

  it('toggles faultTolerant checkbox and dispatches update', () => {
    const node = {
      data: {
        label: 'Kudu Source',
        properties: {
          faultTolerant: false
        }
      }
    };

    render(<KuduIOSourceProperties node={node} onChange={mockOnChange} />);

    const faultCheckbox = screen.getByLabelText(/Fault Tolerant Scan/i);
    expect(faultCheckbox).not.toBeChecked();

    fireEvent.click(faultCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        faultTolerant: true
      })
    );
  });

  it('supports Kerberos authentication mode and updates principal and keytab secret', () => {
    const node = {
      data: {
        label: 'Kudu Source',
        properties: {
          authMode: 'kerberos' as const,
          principal: 'kudu/master@EXAMPLE.COM',
          keytabSecret: 'kudu-keytab'
        }
      }
    };

    render(<KuduIOSourceProperties node={node} onChange={mockOnChange} />);

    const principalInput = screen.getByPlaceholderText('e.g. kudu/master@EXAMPLE.COM');
    const keytabInput = screen.getByPlaceholderText('e.g. kudu-keytab-secret');

    expect(principalInput).toHaveValue('kudu/master@EXAMPLE.COM');
    expect(keytabInput).toHaveValue('kudu-keytab');

    fireEvent.change(principalInput, { target: { name: 'principal', value: 'user@REALM' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: 'user@REALM'
      })
    );
  });

  it('toggles Advanced Source Settings and handles numeric fields including 0', () => {
    const node = {
      data: {
        label: 'Kudu Source',
        properties: {
          batchSizeBytes: 0,
          scanRequestTimeoutMs: 30000,
          socketReadTimeoutMs: 10000
        }
      }
    };

    render(<KuduIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const batchSizeInput = screen.getByPlaceholderText('e.g. 1048576 (1MB)');
    expect(batchSizeInput).toHaveValue(0);

    const scanTimeoutInput = screen.getByPlaceholderText('e.g. 30000');
    expect(scanTimeoutInput).toHaveValue(30000);

    const socketTimeoutInput = screen.getByPlaceholderText('e.g. 10000');
    expect(socketTimeoutInput).toHaveValue(10000);

    fireEvent.change(batchSizeInput, { target: { name: 'batchSizeBytes', value: '2097152' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        batchSizeBytes: '2097152'
      })
    );
  });

  it('handles edge case of missing properties object cleanly', () => {
    const node = {
      data: {
        label: 'Kudu Source'
      }
    };

    render(<KuduIOSourceProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByText('Kudu master addresses are required')).toBeInTheDocument();
    expect(screen.getByText('Table name is required')).toBeInTheDocument();
  });


  it('updates system_instructions when textarea changes', () => {
    const node = {
      data: {
        label: 'Kudu Source',
        properties: {}
      }
    };

    render(<KuduIOSourceProperties node={node} onChange={mockOnChange} />);

    const textarea = screen.getByPlaceholderText(
      'Custom prompt instructions for generating the Apache Beam KuduIO source step...'
    );
    fireEvent.change(textarea, {
      target: { value: 'Scan Kudu table with projected columns and fault tolerance.' }
    });

    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Scan Kudu table with projected columns and fault tolerance.'
    });
  });
});
