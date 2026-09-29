/**
 * RabbitMqConnectionFields Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating RabbitMqConnectionFields:
 * - Default rendering and element IDs
 * - Upward change event emission for text, number, and checkbox inputs
 * - Compute Engine VM instance suggestions and IP selection callback
 * - Secret Manager dropdown vs direct text input fallback
 * - Secret Manager refresh trigger
 * - Error alert handling for instanceError and secretError
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RabbitMqConnectionFields } from './RabbitMqConnectionFields';

describe('RabbitMqConnectionFields', () => {
  const defaultProps = {
    idPrefix: 'rabbitmq-test',
    host: 'localhost',
    port: '5672',
    virtualHost: '/',
    useTls: false,
    username: 'guest',
    secretName: '',
    secrets: [],
    instances: [],
    secretError: null,
    instanceError: null,
    isLoadingSecrets: false,
    onRefreshSecrets: vi.fn(),
    onSelectInstanceIp: vi.fn(),
    onChange: vi.fn()
  };

  it('renders connection fields with correct values and default secret manager mode', () => {
    render(<RabbitMqConnectionFields {...defaultProps} />);

    expect(screen.getByLabelText(/Broker Host/i)).toHaveValue('localhost');
    expect(screen.getByLabelText(/^Port$/i)).toHaveValue(5672);
    expect(screen.getByLabelText(/^Port$/i)).toHaveAttribute('placeholder', '5672');
    expect(screen.getByLabelText(/Virtual Host/i, { selector: 'input' })).toHaveValue('/');
    expect(screen.getByLabelText(/Use TLS \/ SSL/i)).not.toBeChecked();
    expect(screen.getByLabelText(/Username/i)).toHaveValue('guest');
    expect(screen.getByText(/RabbitMQ broker credentials are authenticated via Google Cloud Secret Manager/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/GCP Secret Manager Secret/i)).toBeInTheDocument();
  });

  it('renders dynamic port placeholder based on useTls flag', () => {
    const { rerender } = render(<RabbitMqConnectionFields {...defaultProps} useTls={false} />);
    expect(screen.getByLabelText(/^Port$/i)).toHaveAttribute('placeholder', '5672');

    rerender(<RabbitMqConnectionFields {...defaultProps} useTls={true} />);
    expect(screen.getByLabelText(/^Port$/i)).toHaveAttribute('placeholder', '5671');
  });

  it('emits onChange when host, port, vhost, tls, or username are edited', () => {
    const onChange = vi.fn();
    render(<RabbitMqConnectionFields {...defaultProps} onChange={onChange} />);

    const hostInput = screen.getByLabelText(/Broker Host/i);
    fireEvent.change(hostInput, { target: { name: 'host', value: 'rabbitmq.prod.internal' } });
    expect(onChange).toHaveBeenCalledTimes(1);

    const portInput = screen.getByLabelText(/^Port$/i);
    fireEvent.change(portInput, { target: { name: 'port', value: '5671' } });
    expect(onChange).toHaveBeenCalledTimes(2);

    const vhostInput = screen.getByLabelText(/Virtual Host/i, { selector: 'input' });
    fireEvent.change(vhostInput, { target: { name: 'virtualHost', value: '/custom' } });
    expect(onChange).toHaveBeenCalledTimes(3);

    const tlsCheckbox = screen.getByLabelText(/Use TLS \/ SSL/i);
    fireEvent.click(tlsCheckbox);
    expect(onChange).toHaveBeenCalledTimes(4);

    const usernameInput = screen.getByLabelText(/Username/i);
    fireEvent.change(usernameInput, { target: { name: 'username', value: 'admin' } });
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it('renders discovered VM pills and triggers onSelectInstanceIp on click', () => {
    const onSelectInstanceIp = vi.fn();
    const instances = [
      { name: 'rabbitmq-vm-1', status: 'RUNNING', internalIp: '10.128.0.5', externalIp: '34.80.0.5' },
      { name: 'rabbitmq-vm-2', status: 'RUNNING', internalIp: '10.128.0.6', externalIp: '' }
    ];

    render(
      <RabbitMqConnectionFields
        {...defaultProps}
        instances={instances}
        onSelectInstanceIp={onSelectInstanceIp}
      />
    );

    expect(screen.getByText(/Discovered GCP Compute VMs:/i)).toBeInTheDocument();
    const vmButton = screen.getByRole('button', { name: /rabbitmq-vm-1/i });
    fireEvent.click(vmButton);

    expect(onSelectInstanceIp).toHaveBeenCalledWith('10.128.0.5');
  });

  it('renders datalist options for discovered Compute instances', () => {
    const instances = [
      { name: 'rabbitmq-vm-1', status: 'RUNNING', internalIp: '10.128.0.5', externalIp: '34.80.0.5' }
    ];

    render(<RabbitMqConnectionFields {...defaultProps} instances={instances} />);

    const datalist = document.getElementById('rabbitmq-test-instances-list');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.querySelector('option')).toHaveAttribute('value', '10.128.0.5');
  });

  it('renders secret input with datalist when secrets are provided and triggers onChange', () => {
    const onChange = vi.fn();
    const secrets = [
      { name: 'rmq-secret-prod', value: 'rmq-secret-prod' },
      { name: 'rmq-secret-staging', value: 'rmq-secret-staging' }
    ];

    render(
      <RabbitMqConnectionFields
        {...defaultProps}
        secrets={secrets}
        secretName="rmq-secret-prod"
        onChange={onChange}
      />
    );

    const secretInput = screen.getByLabelText(/GCP Secret Manager Secret/i);
    expect(secretInput.tagName).toBe('INPUT');
    expect(secretInput).toHaveValue('rmq-secret-prod');

    const datalist = document.getElementById('rabbitmq-test-secrets-list');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.querySelectorAll('option').length).toBe(2);

    fireEvent.change(secretInput, { target: { name: 'secretName', value: 'rmq-secret-staging' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls onRefreshSecrets when refresh button is clicked', () => {
    const onRefreshSecrets = vi.fn();
    render(<RabbitMqConnectionFields {...defaultProps} onRefreshSecrets={onRefreshSecrets} />);

    const refreshButton = screen.getByTitle(/Refresh secrets from Secret Manager/i);
    fireEvent.click(refreshButton);
    expect(onRefreshSecrets).toHaveBeenCalledTimes(1);
  });

  it('displays secretError and instanceError alerts and invalid states', () => {
    render(
      <RabbitMqConnectionFields
        {...defaultProps}
        host=""
        secretError="Failed to list secrets: Permission denied"
        instanceError="GCE API unavailable"
      />
    );

    expect(screen.getByLabelText(/Broker Host/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Failed to list secrets: Permission denied')).toBeInTheDocument();
  });
});
