/**
 * Unit Tests for InfluxDbIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates InfluxDbIOSinkProperties form rendering, hydration, dispatching,
 * consistencyLevel and batchSize updates, Secret Manager IPC callbacks,
 * single-error rendering, validation states, and system instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InfluxDbIOSinkProperties } from './InfluxDbIO';

describe('InfluxDbIOSinkProperties', () => {
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

  it('renders required Server URL and Database fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'InfluxDB Sink',
        properties: {}
      }
    };

    render(<InfluxDbIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('http://localhost:8086')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. metrics')).toBeInTheDocument();

    expect(screen.getByText('Server URL is required')).toBeInTheDocument();
    expect(screen.getByText('Database name is required')).toBeInTheDocument();

    const urlInput = screen.getByPlaceholderText('http://localhost:8086');
    expect(urlInput).toHaveAttribute('aria-invalid', 'true');
    expect(urlInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node.data.properties', () => {
    const node = {
      data: {
        label: 'InfluxDB Sink',
        properties: {
          url: 'https://influx-secure:8086',
          database: 'aggregated_metrics',
          retentionPolicy: 'one_month',
          consistencyLevel: 'QUORUM',
          batchSize: 2000
        }
      }
    };

    render(<InfluxDbIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('https://influx-secure:8086')).toBeInTheDocument();
    expect(screen.getByDisplayValue('aggregated_metrics')).toBeInTheDocument();
    expect(screen.getByDisplayValue('one_month')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2000')).toBeInTheDocument();

    const consistencySelect = screen.getByRole('combobox', { name: /Write Consistency Level/i });
    expect(consistencySelect).toHaveValue('QUORUM');
  });

  it('validates URL scheme format and displays warning when not starting with http:// or https://', () => {
    const node = {
      data: {
        label: 'InfluxDB Sink',
        properties: {
          url: 'udp://localhost:8086'
        }
      }
    };

    render(<InfluxDbIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByText(/Warning: InfluxDB URL should start with "http:\/\/" or "https:\/\/"/i)
    ).toBeInTheDocument();
  });

  it('updates text inputs, batchSize, and consistencyLevel and dispatches changes', () => {
    const node = {
      data: {
        label: 'InfluxDB Sink',
        properties: {
          url: 'http://localhost:8086'
        }
      }
    };

    render(<InfluxDbIOSinkProperties node={node} onChange={mockOnChange} />);

    const dbInput = screen.getByPlaceholderText('e.g. metrics');
    fireEvent.change(dbInput, { target: { name: 'database', value: 'system_stats' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'http://localhost:8086',
      database: 'system_stats'
    });

    const rpInput = screen.getByPlaceholderText('e.g. autogen');
    fireEvent.change(rpInput, { target: { name: 'retentionPolicy', value: 'yearly' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'http://localhost:8086',
      retentionPolicy: 'yearly'
    });

    const batchSizeInput = screen.getByPlaceholderText('1000');
    fireEvent.change(batchSizeInput, { target: { name: 'batchSize', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'http://localhost:8086',
      batchSize: '500'
    });

    const consistencySelect = screen.getByRole('combobox', { name: /Write Consistency Level/i });
    fireEvent.change(consistencySelect, { target: { name: 'consistencyLevel', value: 'ALL' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'http://localhost:8086',
      consistencyLevel: 'ALL'
    });
  });

  it('handles numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'InfluxDB Sink',
        properties: {
          batchSize: 0,
          connectTimeout: 0,
          readTimeout: 0
        }
      }
    };

    render(<InfluxDbIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getAllByDisplayValue('0').length).toBeGreaterThanOrEqual(1);
  });

  it('supports Secret Manager authentication mode', () => {
    const node = {
      data: {
        label: 'InfluxDB Sink',
        properties: {
          authMode: 'secret_manager' as const,
          usernameSecret: 'sink-user',
          passwordSecret: 'sink-pass'
        }
      }
    };

    render(<InfluxDbIOSinkProperties node={node} onChange={mockOnChange} />);

    const userSecretInput = screen.getByPlaceholderText('e.g. influxdb-username');
    const passSecretInput = screen.getByPlaceholderText('e.g. influxdb-password');

    expect(userSecretInput).toHaveValue('sink-user');
    expect(passSecretInput).toHaveValue('sink-pass');
  });

  it('toggles Advanced Sink Settings and updates SSL flags and timeouts', () => {
    const node = {
      data: {
        label: 'InfluxDB Sink',
        properties: {
          sslInvalidHostNameAllowed: false,
          disableCertificateValidation: false,
          connectTimeout: 5000,
          readTimeout: 10000
        }
      }
    };

    render(<InfluxDbIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    const allowInvalidHost = screen.getByLabelText(/Allow Invalid Hostname/i);
    expect(allowInvalidHost).not.toBeChecked();
    fireEvent.click(allowInvalidHost);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sslInvalidHostNameAllowed: true
      })
    );

    const disableCertVal = screen.getByLabelText(/Disable Certificate Validation/i);
    expect(disableCertVal).not.toBeChecked();
    fireEvent.click(disableCertVal);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        disableCertificateValidation: true
      })
    );

    const readTimeoutInput = screen.getByPlaceholderText('30000');
    fireEvent.change(readTimeoutInput, { target: { name: 'readTimeout', value: '25000' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        readTimeout: '25000'
      })
    );
  });

  it('dispatches system instructions updates', () => {
    render(
      <InfluxDbIOSinkProperties
        node={{
          data: {}
        }}
        onChange={mockOnChange}
      />
    );
    const textarea = screen.getByPlaceholderText(/Format input elements as InfluxDB line-protocol strings/i);
    expect(textarea).toHaveValue('');

    fireEvent.change(textarea, { target: { value: 'Synthesize custom influx sink' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Synthesize custom influx sink'
      })
    );
  });

  it('gracefully handles missing properties object on node.data', () => {
    const node = {
      data: {}
    };

    render(<InfluxDbIOSinkProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('http://localhost:8086')).toHaveValue('');
  });
});
