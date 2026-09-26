/**
 * GoogleAdsIOSourceProperties Test Suite
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Unit tests validating GoogleAdsIOSourceProperties rendering, readMode switching,
 * Customer ID hyphen/empty validation, GAQL query updates, Secret Manager dynamic
 * discovery (`getSecrets`), OAuth2 Secret Manager fields, and system_instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GoogleAdsIOSourceProperties } from './GoogleAdsIO';

describe('GoogleAdsIOSourceProperties', () => {
  let originalVscode: any;

  beforeEach(() => {
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders all documented GoogleAdsIO and GoogleAdsOptions fields', () => {
    const mockNode = {
      data: {
        label: 'Google Ads Source',
        properties: {},
      },
    };
    const mockOnChange = vi.fn();

    const { container } = render(<GoogleAdsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('select[name="readMode"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="customerId"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="loginCustomerId"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="linkedCustomerId"]')).toBeInTheDocument();
    expect(container.querySelector('textarea[name="query"]')).toBeInTheDocument();
    expect(container.querySelector('select[name="authMode"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="developerTokenSecret"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="clientId"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="clientSecretSecret"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="refreshTokenSecret"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="googleAdsEndpoint"]')).toHaveValue('googleads.googleapis.com:443');
  });

  it('validates customerId (rejecting empty or hyphenated IDs) and query when readMode is read', () => {
    const mockOnChange = vi.fn();
    const { container, rerender } = render(
      <GoogleAdsIOSourceProperties
        node={{ data: { label: 'GoogleAds', properties: { readMode: 'read', customerId: '123-456-7890', query: '' } } }}
        onChange={mockOnChange}
      />
    );

    const customerIdInput = container.querySelector('input[name="customerId"]') as HTMLInputElement;
    const queryTextarea = container.querySelector('textarea[name="query"]') as HTMLTextAreaElement;

    expect(customerIdInput).toHaveAttribute('aria-invalid', 'true');
    expect(queryTextarea).toHaveAttribute('aria-invalid', 'true');

    rerender(
      <GoogleAdsIOSourceProperties
        node={{
          data: {
            label: 'GoogleAds',
            properties: {
              readMode: 'read',
              customerId: '1234567890',
              query: 'SELECT campaign.id FROM campaign',
            },
          },
        }}
        onChange={mockOnChange}
      />
    );

    expect(customerIdInput).toHaveAttribute('aria-invalid', 'false');
    expect(queryTextarea).toHaveAttribute('aria-invalid', 'false');
  });

  it('relaxes customerId and query validation when readMode is readAll', () => {
    const mockOnChange = vi.fn();
    const { container } = render(
      <GoogleAdsIOSourceProperties
        node={{ data: { label: 'GoogleAds', properties: { readMode: 'readAll', customerId: '', query: '' } } }}
        onChange={mockOnChange}
      />
    );

    expect(container.querySelector('input[name="customerId"]')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('textarea[name="query"]')).toHaveAttribute('aria-invalid', 'false');
  });

  it('updates account IDs, GAQL query, and OAuth2 Secret Manager properties on change', () => {
    const mockOnChange = vi.fn();
    const { container } = render(
      <GoogleAdsIOSourceProperties
        node={{ data: { label: 'GoogleAds', properties: {} } }}
        onChange={mockOnChange}
      />
    );

    fireEvent.change(container.querySelector('input[name="customerId"]')!, {
      target: { name: 'customerId', value: '1234567890' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ customerId: '1234567890' }));

    fireEvent.change(container.querySelector('input[name="loginCustomerId"]')!, {
      target: { name: 'loginCustomerId', value: '9988776655' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ loginCustomerId: '9988776655' }));

    fireEvent.change(container.querySelector('textarea[name="query"]')!, {
      target: { name: 'query', value: 'SELECT campaign.id, campaign.name FROM campaign' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'SELECT campaign.id, campaign.name FROM campaign' })
    );

    fireEvent.change(container.querySelector('input[name="clientSecretSecret"]')!, {
      target: { name: 'clientSecretSecret', value: 'gads-client-secret' },
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecretSecret: 'gads-client-secret' })
    );
  });

  it('hides OAuth2 Secret Manager fields when authMode is switched to adc', () => {
    const mockOnChange = vi.fn();
    const { container } = render(
      <GoogleAdsIOSourceProperties
        node={{ data: { label: 'GoogleAds', properties: { authMode: 'adc' } } }}
        onChange={mockOnChange}
      />
    );

    expect(container.querySelector('input[name="developerTokenSecret"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="clientSecretSecret"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="refreshTokenSecret"]')).not.toBeInTheDocument();
  });

  it('requests secrets via vscode.postMessage(getSecrets) and populates datalist options', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    render(
      <GoogleAdsIOSourceProperties
        node={{ data: { label: 'GoogleAds', properties: { authMode: 'secretManager' } } }}
        onChange={vi.fn()}
      />
    );

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: [{ name: 'projects/123/secrets/google-ads-dev-token', id: 'google-ads-dev-token' }],
          },
        })
      );
    });

    const datalist = document.getElementById('google-ads-secrets-list');
    expect(datalist?.children.length).toBe(1);
    expect(datalist?.children[0]).toHaveAttribute('value', 'google-ads-dev-token');
  });

  it('updates system_instructions when code generation instructions textarea is edited', () => {
    const mockOnChange = vi.fn();
    const { container } = render(
      <GoogleAdsIOSourceProperties
        node={{ data: { label: 'GoogleAds', system_instructions: 'Initial prompt' } }}
        onChange={mockOnChange}
      />
    );

    const instructionsArea = container.querySelector('#googleAdsSourceInstructions') as HTMLTextAreaElement;
    expect(instructionsArea).toHaveValue('Initial prompt');

    fireEvent.change(instructionsArea, {
      target: { value: 'Parse GoogleAdsRow campaign metrics into BigQuery TableRow' },
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Parse GoogleAdsRow campaign metrics into BigQuery TableRow',
      })
    );
  });
});
