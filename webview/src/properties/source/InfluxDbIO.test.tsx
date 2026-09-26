/**
 * Unit Tests for InfluxDbIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates InfluxDbIOSourceProperties form rendering, hydration, dispatching,
 * query vs metric mode switching, IPC callbacks for GCP Secret Manager,
 * single-error rendering, validation states, and system instructions fallback chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InfluxDbIOSourceProperties } from './InfluxDbIO';

describe('InfluxDbIOSourceProperties', () => {
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

  it('renders required Server URL, Database, and InfluxQL Query fields and alerts when empty', () => {
    const node = {
      data: {
        label: 'InfluxDB Source',
        properties: {}
      }
    };

    render(<InfluxDbIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('http://localhost:8086')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. metrics')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('SELECT * FROM cpu_usage')).toBeInTheDocument();

    expect(screen.getByText('Server URL is required')).toBeInTheDocument();
    expect(screen.getByText('Database name is required')).toBeInTheDocument();
    expect(
      screen.getByText('InfluxQL query is required when query mode is selected')
    ).toBeInTheDocument();

    const urlInput = screen.getByPlaceholderText('http://localhost:8086');
    expect(urlInput).toHaveAttribute('aria-invalid', 'true');
    expect(urlInput).toHaveAttribute('aria-required', 'true');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates form fields from node.data.properties', () => {
    const node = {
      data: {
        label: 'InfluxDB Source',
        properties: {
          url: 'http://influx-server:8086',
          database: 'telemetry',
          retentionPolicy: 'two_weeks',
          queryMode: 'query' as const,
          query: 'SELECT mean(usage) FROM cpu GROUP BY time(5m)',
          numOfElementsToFetchPerQuery: 5000
        }
      }
    };

    render(<InfluxDbIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('http://influx-server:8086')).toBeInTheDocument();
    expect(screen.getByDisplayValue('telemetry')).toBeInTheDocument();
    expect(screen.getByDisplayValue('two_weeks')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SELECT mean(usage) FROM cpu GROUP BY time(5m)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
  });

  it('validates URL scheme format and displays warning when not starting with http:// or https://', () => {
    const node = {
      data: {
        label: 'InfluxDB Source',
        properties: {
          url: 'tcp://localhost:8086'
        }
      }
    };

    render(<InfluxDbIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(
      screen.getByText(/Warning: InfluxDB URL should start with "http:\/\/" or "https:\/\/"/i)
    ).toBeInTheDocument();
  });

  it('switches to metric query mode and validates required metric field', () => {
    const node = {
      data: {
        label: 'InfluxDB Source',
        properties: {
          queryMode: 'metric' as const,
          metric: ''
        }
      }
    };

    render(<InfluxDbIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('SELECT * FROM cpu_usage')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. cpu_usage')).toBeInTheDocument();
    expect(
      screen.getByText('Measurement metric name is required when metric mode is selected')
    ).toBeInTheDocument();

    const metricInput = screen.getByPlaceholderText('e.g. cpu_usage');
    fireEvent.change(metricInput, { target: { name: 'metric', value: 'disk_free' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'disk_free'
      })
    );
  });

  it('updates text and number inputs and dispatches changes', () => {
    const node = {
      data: {
        label: 'InfluxDB Source',
        properties: {
          url: 'http://localhost:8086'
        }
      }
    };

    render(<InfluxDbIOSourceProperties node={node} onChange={mockOnChange} />);

    const dbInput = screen.getByPlaceholderText('e.g. metrics');
    fireEvent.change(dbInput, { target: { name: 'database', value: 'iot_db' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'http://localhost:8086',
      database: 'iot_db'
    });

    const rpInput = screen.getByPlaceholderText('e.g. autogen');
    fireEvent.change(rpInput, { target: { name: 'retentionPolicy', value: 'custom_rp' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'http://localhost:8086',
      retentionPolicy: 'custom_rp'
    });

    const fetchBatchInput = screen.getByPlaceholderText('e.g. 1000');
    fireEvent.change(fetchBatchInput, { target: { name: 'numOfElementsToFetchPerQuery', value: '2500' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'http://localhost:8086',
      numOfElementsToFetchPerQuery: '2500'
    });
  });

  it('handles numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'InfluxDB Source',
        properties: {
          numOfElementsToFetchPerQuery: 0,
          connectTimeout: 0,
          readTimeout: 0
        }
      }
    };

    render(<InfluxDbIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getAllByDisplayValue('0').length).toBeGreaterThanOrEqual(1);
  });

  it('supports Secret Manager authentication mode and receives IPC secrets', () => {
    const node = {
      data: {
        label: 'InfluxDB Source',
        properties: {
          authMode: 'secret_manager' as const,
          usernameSecret: 'influx-user',
          passwordSecret: 'influx-pass'
        }
      }
    };

    render(<InfluxDbIOSourceProperties node={node} onChange={mockOnChange} />);

    const userSecretInput = screen.getByPlaceholderText('e.g. influxdb-username');
    const passSecretInput = screen.getByPlaceholderText('e.g. influxdb-password');

    expect(userSecretInput).toHaveValue('influx-user');
    expect(passSecretInput).toHaveValue('influx-pass');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            'projects/my-project/secrets/influx-user-secret',
            { id: 'influx-pass-secret', name: 'influx-pass-secret' }
          ]
        }
      })
    );

    const option1 = document.querySelector(
      'datalist#influxdb-source-secret-options option[value="influx-user-secret"]'
    );
    const option2 = document.querySelector(
      'datalist#influxdb-source-secret-options option[value="influx-pass-secret"]'
    );
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();
  });

  it('renders Secret Manager error once when secretsLoaded contains error', () => {
    const node = {
      data: {
        label: 'InfluxDB Source',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<InfluxDbIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Failed to access GCP Secret Manager for InfluxDB'
        }
      })
    );

    expect(screen.getByText('Failed to access GCP Secret Manager for InfluxDB')).toBeInTheDocument();
  });

  it('toggles Advanced Source Settings and updates SSL flags and timeouts', () => {
    const node = {
      data: {
        label: 'InfluxDB Source',
        properties: {
          sslInvalidHostNameAllowed: false,
          disableCertificateValidation: false,
          connectTimeout: 5000,
          readTimeout: 15000
        }
      }
    };

    render(<InfluxDbIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
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

    const connectTimeoutInput = screen.getByPlaceholderText('10000');
    fireEvent.change(connectTimeoutInput, { target: { name: 'connectTimeout', value: '8000' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        connectTimeout: '8000'
      })
    );
  });

  it('resolves system instructions across the fallback chain', () => {
    // 1. node.data.system_instructions
    const { unmount: unmount1 } = render(
      <InfluxDbIOSourceProperties
        node={{
          data: {
            system_instructions: 'Node level system instructions',
            properties: {}
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Node level system instructions')).toBeInTheDocument();
    unmount1();

    // 2. node.data.special_instructions
    const { unmount: unmount2 } = render(
      <InfluxDbIOSourceProperties
        node={{
          data: {
            special_instructions: 'Node level special instructions',
            properties: {}
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Node level special instructions')).toBeInTheDocument();
    unmount2();

    // 3. properties.system_instructions
    const { unmount: unmount3 } = render(
      <InfluxDbIOSourceProperties
        node={{
          data: {
            properties: {
              system_instructions: 'Property level system instructions'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Property level system instructions')).toBeInTheDocument();
    unmount3();

    // 4. properties.special_instructions
    const { unmount: unmount4 } = render(
      <InfluxDbIOSourceProperties
        node={{
          data: {
            properties: {
              special_instructions: 'Property level special instructions'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByDisplayValue('Property level special instructions')).toBeInTheDocument();
    unmount4();

    // 5. empty fallback
    render(
      <InfluxDbIOSourceProperties
        node={{
          data: {}
        }}
        onChange={mockOnChange}
      />
    );
    const textarea = screen.getByPlaceholderText(/Ingest time-series data from InfluxDB/i);
    expect(textarea).toHaveValue('');

    fireEvent.change(textarea, { target: { value: 'Synthesize custom influx query pipeline' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Synthesize custom influx query pipeline'
      })
    );
  });

  it('gracefully handles missing properties object on node.data', () => {
    const node = {
      data: {}
    };

    render(<InfluxDbIOSourceProperties node={node as any} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('http://localhost:8086')).toHaveValue('');
  });
});
