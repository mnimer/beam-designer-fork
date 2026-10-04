/**
 * PulsarIOSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Comprehensive unit tests validating PulsarIOSourceProperties component functionality,
 * form change callbacks, protocol helpers, topic format validation, gcloud Secret Manager integration,
 * auth mode switching, publish time & bounded stream limits,
 * Python x-lang expansion service options, and prompt instructions fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PulsarIOSourceProperties } from './PulsarIO';

describe('PulsarIOSourceProperties', () => {
  const originalPostMessage = (window as any).vscode?.postMessage;

  beforeEach(() => {
    (window as any).vscode = {
      postMessage: vi.fn()
    };
  });

  afterEach(() => {
    if (originalPostMessage) {
      (window as any).vscode.postMessage = originalPostMessage;
    } else {
      delete (window as any).vscode;
    }
  });

  it('renders default fields with documentation tooltips and placeholders', () => {
    const mockNode = {
      data: {
        label: 'Pulsar Source',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Pulsar Client Service URL/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('http://localhost:8080')).toBeInTheDocument();
    expect(screen.getByLabelText(/Pulsar Topic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Authentication Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Element Timestamp Policy/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Timestamp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Timestamp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Consumer Polling Timeout/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expansion Service Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it('populates fields with provided properties and triggers onChange on clientUrl and topic changes', () => {
    const mockNode = {
      data: {
        label: 'Pulsar',
        properties: {
          clientUrl: 'pulsar://pulsar.prod:6650',
          adminUrl: 'http://pulsar.prod:8080',
          topic: 'persistent://public/default/telemetry',
          timestampType: 'publishTime' as const,
          consumerPollingTimeout: '5',
          startTimestamp: '1695400000000',
          endTimestamp: '1695486400000'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const clientInput = screen.getByLabelText(/Pulsar Client Service URL/i);
    expect(clientInput).toHaveValue('pulsar://pulsar.prod:6650');

    const adminInput = screen.getByPlaceholderText('http://localhost:8080');
    expect(adminInput).toHaveValue('http://pulsar.prod:8080');

    const topicInput = screen.getByLabelText(/Pulsar Topic/i);
    expect(topicInput).toHaveValue('persistent://public/default/telemetry');

    const timestampSelect = screen.getByLabelText(/Element Timestamp Policy/i);
    expect(timestampSelect).toHaveValue('publishTime');

    const pollingInput = screen.getByLabelText(/Consumer Polling Timeout/i);
    expect(pollingInput).toHaveValue(5);

    fireEvent.change(timestampSelect, { target: { name: 'timestampType', value: 'processingTime' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      timestampType: 'processingTime'
    }));

    fireEvent.change(pollingInput, { target: { name: 'consumerPollingTimeout', value: '10' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      consumerPollingTimeout: '10'
    }));

    fireEvent.change(clientInput, { target: { name: 'clientUrl', value: 'pulsar://new-broker:6650' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      clientUrl: 'pulsar://new-broker:6650'
    }));

    fireEvent.change(topicInput, { target: { name: 'topic', value: 'persistent://tenant-a/ns-1/sensor-data' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'persistent://tenant-a/ns-1/sensor-data'
    }));
  });

  it('applies client and admin protocol helper pills', () => {
    const mockNode = {
      data: {
        label: 'Pulsar',
        properties: {
          clientUrl: 'pulsar://my-broker.local:6650',
          adminUrl: 'http://my-broker.local:8080'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Test client protocol pill pulsar+ssl://
    const sslButton = screen.getByTitle('Set pulsar+ssl:// scheme');
    fireEvent.click(sslButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      clientUrl: 'pulsar+ssl://my-broker.local:6650'
    }));

    // Test client protocol pill pulsar://
    const pulsarButton = screen.getByTitle('Set pulsar:// scheme');
    fireEvent.click(pulsarButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      clientUrl: 'pulsar://my-broker.local:6650'
    }));

    // Test admin protocol pill https://
    const httpsButton = screen.getByTitle('Set https:// scheme');
    fireEvent.click(httpsButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      adminUrl: 'https://my-broker.local:8080'
    }));

    // Test admin protocol pill http://
    const httpButton = screen.getByTitle('Set http:// scheme');
    fireEvent.click(httpButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      adminUrl: 'http://my-broker.local:8080'
    }));
  });

  it('validates canonical Pulsar topic format with helpful inline errors', () => {
    const mockOnChange = vi.fn();

    // 1. Missing topic
    const { rerender } = render(
      <PulsarIOSourceProperties
        node={{ data: { label: 'Pulsar', properties: { clientUrl: 'pulsar://localhost:6650', topic: '' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('Pulsar topic name is required.')).toBeInTheDocument();

    // 2. Malformed topic (missing persistent:// or non-persistent:// scheme)
    rerender(
      <PulsarIOSourceProperties
        node={{ data: { label: 'Pulsar', properties: { clientUrl: 'pulsar://localhost:6650', topic: 'my-simple-topic' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText(/Topic must follow format \(persistent\|non-persistent\):\/\/tenant\/namespace\/topic/i)).toBeInTheDocument();

    // 3. Valid non-persistent topic
    rerender(
      <PulsarIOSourceProperties
        node={{ data: { label: 'Pulsar', properties: { clientUrl: 'pulsar://localhost:6650', topic: 'non-persistent://public/default/metrics' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.queryByText(/Topic must follow format/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pulsar topic name is required/i)).not.toBeInTheDocument();
  });

  it('validates missing required clientUrl with semantic error and aria-invalid', () => {
    const mockNode = {
      data: {
        label: 'Pulsar',
        properties: {
          clientUrl: '',
          topic: 'persistent://public/default/events'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const clientInput = screen.getByLabelText(/Pulsar Client Service URL/i);
    expect(clientInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Pulsar Client Service URL is required.')).toBeInTheDocument();
  });

  it('allows selecting a secret in token mode', () => {
    const mockNode = {
      data: {
        label: 'Pulsar',
        properties: {
          authMode: 'token' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const secretDropdown = screen.getByLabelText(/Pulsar JWT Token Secret/i, { selector: 'input' });
    expect(secretDropdown).toBeInTheDocument();

    fireEvent.change(secretDropdown, { target: { name: 'tokenSecretName', value: 'pulsar-token-prod' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      tokenSecretName: 'pulsar-token-prod'
    }));
  });

  it('enforces Secret Manager usage for token auth mode and eliminates direct token entry', () => {
    const mockNode = {
      data: {
        label: 'Pulsar',
        properties: {
          authMode: 'token' as const,
          tokenSecretName: 'my-pulsar-token-secret'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Direct entry should not be present
    expect(screen.queryByLabelText(/Direct/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Direct Entry/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Show token')).not.toBeInTheDocument();

    // Secret Manager secret field is present
    expect(screen.getByLabelText(/Pulsar JWT Token Secret/i)).toBeInTheDocument();
  });

  it('supports OAuth2 and TLS authentication modes with dedicated fields', () => {
    const mockOnChange = vi.fn();

    // 1. OAuth2 mode
    const { rerender } = render(
      <PulsarIOSourceProperties
        node={{
          data: {
            label: 'Pulsar',
            properties: {
              authMode: 'oauth2' as const,
              oauthIssuerUrl: 'https://auth.mycloud.com',
              oauthAudience: 'urn:pulsar:prod',
              oauthKeySecretName: 'my-oauth2-key'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText(/OAuth2 Issuer URL/i)).toHaveValue('https://auth.mycloud.com');
    expect(screen.getByLabelText(/OAuth2 Audience/i)).toHaveValue('urn:pulsar:prod');
    expect(screen.getByLabelText(/OAuth2 Key File \/ Secret Name/i)).toHaveValue('my-oauth2-key');

    // 2. TLS mode
    rerender(
      <PulsarIOSourceProperties
        node={{
          data: {
            label: 'Pulsar',
            properties: {
              authMode: 'tls' as const,
              tlsCertSecretName: 'my-client-cert',
              tlsKeySecretName: 'my-client-key',
              tlsTrustCertSecretName: 'my-ca-cert'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText(/Client Certificate Secret \/ Path/i)).toHaveValue('my-client-cert');
    expect(screen.getByLabelText(/Client Private Key Secret \/ Path/i)).toHaveValue('my-client-key');
    expect(screen.getByLabelText(/Trust Certificate \(CA\) Secret \/ Path/i)).toHaveValue('my-ca-cert');
  });

  it('supports Python x-lang Expansion Service configuration in auto and endpoint modes', () => {
    const mockOnChange = vi.fn();

    const { rerender } = render(
      <PulsarIOSourceProperties
        node={{
          data: {
            label: 'Pulsar',
            properties: {
              expansionServiceMode: 'auto'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    // In auto mode, endpoint field is hidden
    expect(screen.queryByLabelText(/Expansion Service Endpoint/i)).not.toBeInTheDocument();

    // In endpoint mode, endpoint field is displayed and validated
    rerender(
      <PulsarIOSourceProperties
        node={{
          data: {
            label: 'Pulsar',
            properties: {
              expansionServiceMode: 'endpoint',
              expansionServiceEndpoint: ''
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    const endpointInput = screen.getByLabelText(/Expansion Service Endpoint/i);
    expect(endpointInput).toBeInTheDocument();
    expect(endpointInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Expansion service endpoint is required.')).toBeInTheDocument();

    fireEvent.change(endpointInput, { target: { name: 'expansionServiceEndpoint', value: 'localhost:8097' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      expansionServiceEndpoint: 'localhost:8097'
    }));
  });

  it('updates system_instructions when instructions textarea is edited', () => {
    const mockOnChange = vi.fn();

    render(
      <PulsarIOSourceProperties
        node={{
          data: {
            label: 'Pulsar',
            properties: {
              system_instructions: 'Initial instructions'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    const textarea = screen.getByLabelText(/Code Generation Instructions/i);
    expect(textarea).toHaveValue('Initial instructions');

    fireEvent.change(textarea, { target: { value: 'New instructions from user' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New instructions from user'
    }));
  });

  it('runs safely when window.vscode is undefined', () => {
    delete (window as any).vscode;

    const mockNode = {
      data: {
        label: 'Pulsar',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    expect(() => {
      render(<PulsarIOSourceProperties node={mockNode} onChange={mockOnChange} />);
    }).not.toThrow();
  });
});
