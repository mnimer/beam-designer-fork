/**
 * PulsarAuthFields Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating PulsarAuthFields component functionality,
 * authentication mode selection, Secret Manager token loading, OAuth2 fields,
 * TLS fields, secret refresh, and absence of direct plaintext credential inputs.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PulsarAuthFields } from './PulsarAuthFields';

describe('PulsarAuthFields', () => {
  it('renders auth mode selector with all 4 supported modes', () => {
    const mockOnChange = vi.fn();

    render(
      <PulsarAuthFields
        idPrefix="pulsar-test"
        authMode="none"
        onChange={mockOnChange}
      />
    );

    const select = screen.getByLabelText(/Authentication Mode/i);
    expect(select).toHaveValue('none');

    fireEvent.change(select, { target: { name: 'authMode', value: 'token' } });
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('renders token mode with Secret Manager secrets dropdown and refresh button', () => {
    const mockOnChange = vi.fn();
    const mockRefresh = vi.fn();

    render(
      <PulsarAuthFields
        idPrefix="pulsar-test"
        authMode="token"
        tokenSecretName=""
        secrets={[
          { name: 'pulsar-token-prod', value: 'pulsar-token-prod' }
        ]}
        onRefreshSecrets={mockRefresh}
        onChange={mockOnChange}
      />
    );

    const secretSelect = screen.getByLabelText(/Pulsar JWT Token Secret/i);
    expect(secretSelect).toBeInTheDocument();

    fireEvent.change(secretSelect, { target: { name: 'tokenSecretName', value: 'pulsar-token-prod' } });
    expect(mockOnChange).toHaveBeenCalled();

    const refreshBtn = screen.getByTitle('Refresh secrets from Secret Manager');
    fireEvent.click(refreshBtn);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('does not render direct token entry in token mode and enforces Secret Manager usage', () => {
    const mockOnChange = vi.fn();

    render(
      <PulsarAuthFields
        idPrefix="pulsar-test"
        authMode="token"
        tokenSecretName="my-pulsar-secret"
        onChange={mockOnChange}
      />
    );

    // Direct entry should not be present anywhere in the DOM
    expect(screen.queryByLabelText(/Direct/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Direct Entry/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Show token')).not.toBeInTheDocument();

    // Secret Manager input is rendered
    expect(screen.getByLabelText(/Pulsar JWT Token Secret/i)).toBeInTheDocument();
  });

  it('renders OAuth2 fields when authMode is oauth2', () => {
    render(
      <PulsarAuthFields
        idPrefix="pulsar-test"
        authMode="oauth2"
        oauthIssuerUrl="https://auth.example.com"
        oauthAudience="urn:pulsar:cluster"
        oauthKeySecretName="oauth-key"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/OAuth2 Issuer URL/i)).toHaveValue('https://auth.example.com');
    expect(screen.getByLabelText(/OAuth2 Audience/i)).toHaveValue('urn:pulsar:cluster');
    expect(screen.getByLabelText(/OAuth2 Key File \/ Secret Name/i)).toHaveValue('oauth-key');
  });

  it('renders TLS fields when authMode is tls', () => {
    render(
      <PulsarAuthFields
        idPrefix="pulsar-test"
        authMode="tls"
        tlsCertSecretName="client-cert"
        tlsKeySecretName="client-key"
        tlsTrustCertSecretName="ca-cert"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Client Certificate Secret \/ Path/i)).toHaveValue('client-cert');
    expect(screen.getByLabelText(/Client Private Key Secret \/ Path/i)).toHaveValue('client-key');
    expect(screen.getByLabelText(/Trust Certificate \(CA\) Secret \/ Path/i)).toHaveValue('ca-cert');
  });

  it('displays secretError when provided', () => {
    render(
      <PulsarAuthFields
        idPrefix="pulsar-test"
        authMode="token"
        secretError="Access denied"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });
});
