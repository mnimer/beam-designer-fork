/**
 * Unit Tests for TrepWsIO Source Properties Component (IO72)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Coverage Target: 100% statements, branches, functions, and lines on
 * `webview/src/properties/source/TrepWsIO.tsx`.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TrepWsIOSourceProperties,
  TREP_SOURCE_DOCS_URL,
  DEFAULT_TREP_AUTH_SERVER,
} from './TrepWsIO';
import { classifyKey, redactPipelineYaml } from '../../../../src/credentialRedaction';

vi.mock('../../hooks/useAssetLoader', () => ({
  useAssetLoader: vi.fn(() => ({
    items: ['trep-ert-password', 'trep-rto-password'],
    loading: false,
    refresh: vi.fn(),
  })),
}));

describe('TrepWsIOSourceProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { vscode?: unknown }).vscode;
  });

  it('renders with empty properties, defaults to one instrument row, and shows required errors', () => {
    const onChange = vi.fn();
    render(<TrepWsIOSourceProperties node={{ data: {} }} onChange={onChange} />);

    expect(screen.getByText('TrepWsIO Source')).toBeInTheDocument();
    expect(
      screen.getByText('ADS hostname is required unless ERT service discovery is enabled')
    ).toBeInTheDocument();
    expect(screen.getByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('At least one instrument (RIC list) is required')).toBeInTheDocument();
    expect(screen.getByText('Instrument #1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove instrument 1' })).toBeDisabled();

    // Optional fields hidden by default
    expect(screen.queryByLabelText(/Discovery Region/i, { selector: 'input' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/ERT Password Secret/i, { selector: 'input' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Token Store Location/i, { selector: 'input' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Cached Fields/i, { selector: 'input' })).not.toBeInTheDocument();
  });

  it('opens official documentation URL via window.vscode.postMessage and handles missing vscode safely', () => {
    const onChange = vi.fn();
    render(<TrepWsIOSourceProperties node={{ data: {} }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Docs/i }));

    const postMessage = vi.fn();
    (window as unknown as { vscode?: { postMessage: typeof postMessage } }).vscode = {
      postMessage,
    };
    fireEvent.click(screen.getByRole('button', { name: /Docs/i }));
    expect(postMessage).toHaveBeenCalledWith({
      command: 'openExternal',
      url: TREP_SOURCE_DOCS_URL,
    });
  });

  it('clears required errors when hostname, username, and instrument RICs are provided', () => {
    const onChange = vi.fn();
    render(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              hostname: 'websocket-ads.example.internal',
              port: '15000',
              username: 'GE-A-01103867-3-1234',
              instrumentTuples: [{ service: 'IDN_RDF', rics: 'EUR=, JPY=', fields: 'BID, ASK' }],
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(
      screen.queryByText('ADS hostname is required unless ERT service discovery is enabled')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Username is required')).not.toBeInTheDocument();
    expect(
      screen.queryByText('At least one instrument (RIC list) is required')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Port must be an integer between 1 and 65535')
    ).not.toBeInTheDocument();
  });

  it('handles missing fields on instrumentTuples objects and validates per-row missing RICs', () => {
    const onChange = vi.fn();
    render(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              hostname: 'websocket-ads.example.internal',
              username: 'dacs-user',
              instrumentTuples: [
                {} as unknown as { service: string; rics: string; fields: string },
                { service: 'IDN_RDF', rics: '', fields: '' },
                { service: '', rics: '', fields: 'BID' },
              ],
            },
          },
        }}
        onChange={onChange}
      />
    );

    const rowErrors = screen.getAllByText('RIC list is required for each instrument');
    expect(rowErrors).toHaveLength(2);
  });

  it('adds, edits, and removes instrument tuple rows', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              hostname: 'websocket-ads.example.internal',
              username: 'dacs-user',
              instrumentTuples: [{ service: 'IDN_RDF', rics: 'EUR=', fields: 'BID' }],
            },
          },
        }}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Service/i), {
      target: { value: 'ELEKTRON_DD' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        instrumentTuples: [{ service: 'ELEKTRON_DD', rics: 'EUR=', fields: 'BID' }],
      })
    );

    fireEvent.change(screen.getByLabelText(/^RICs/i), {
      target: { value: 'EUR=, GBP=' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        instrumentTuples: [{ service: 'IDN_RDF', rics: 'EUR=, GBP=', fields: 'BID' }],
      })
    );

    fireEvent.change(screen.getByLabelText(/^Fields/i), {
      target: { value: 'BID, ASK' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        instrumentTuples: [{ service: 'IDN_RDF', rics: 'EUR=', fields: 'BID, ASK' }],
      })
    );

    // Add a second tuple row
    fireEvent.click(screen.getByRole('button', { name: '+ Add instrument' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        instrumentTuples: [
          { service: 'IDN_RDF', rics: 'EUR=', fields: 'BID' },
          { service: '', rics: '', fields: '' },
        ],
      })
    );

    // Rerender with two rows so we can test editing row 2 (preserving row 1) and removing row 1
    rerender(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              hostname: 'websocket-ads.example.internal',
              username: 'dacs-user',
              instrumentTuples: [
                { service: 'IDN_RDF', rics: 'EUR=', fields: 'BID' },
                { service: 'ELEKTRON_DD', rics: 'JPY=', fields: 'ASK' },
              ],
            },
          },
        }}
        onChange={onChange}
      />
    );

    const ricsInputs = screen.getAllByLabelText(/^RICs/i);
    fireEvent.change(ricsInputs[1], { target: { value: 'JPY=, CHF=' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        instrumentTuples: [
          { service: 'IDN_RDF', rics: 'EUR=', fields: 'BID' },
          { service: 'ELEKTRON_DD', rics: 'JPY=, CHF=', fields: 'ASK' },
        ],
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove instrument 1' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        instrumentTuples: [{ service: 'ELEKTRON_DD', rics: 'JPY=', fields: 'ASK' }],
      })
    );
  });

  it('toggles serviceDiscovery and relaxes hostname requirement when enabled', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrepWsIOSourceProperties node={{ data: { properties: {} } }} onChange={onChange} />
    );

    fireEvent.click(screen.getByLabelText(/Use ERT service discovery/i));
    expect(onChange).toHaveBeenLastCalledWith({ serviceDiscovery: true });

    rerender(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              serviceDiscovery: true,
              username: 'GE-A-01103867-3-1234',
              instrumentTuples: [{ service: 'ELEKTRON_DD', rics: 'EUR=', fields: 'BID' }],
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(
      screen.queryByText('ADS hostname is required unless ERT service discovery is enabled')
    ).not.toBeInTheDocument();

    const regionInput = screen.getByLabelText(/Discovery Region/i, { selector: 'input' });
    fireEvent.change(regionInput, { name: 'region', target: { name: 'region', value: 'eu' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ region: 'eu' }));
  });

  it('validates ERT token authentication fields, gs:// warning, and read-only authServer safeguard', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              hostname: 'websocket-ads.example.internal',
              username: 'GE-A-01103867-3-1234',
              instrumentTuples: [{ service: 'ELEKTRON_DD', rics: 'EUR=', fields: 'BID' }],
            },
          },
        }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByLabelText(/Use ERT token authentication/i));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ ertAuthEnabled: true })
    );

    // Rerender with ertAuthEnabled=true and missing passwordSecret & ertAuthStoreLocation
    rerender(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              hostname: 'websocket-ads.example.internal',
              username: 'GE-A-01103867-3-1234',
              ertAuthEnabled: true,
              instrumentTuples: [{ service: 'ELEKTRON_DD', rics: 'EUR=', fields: 'BID' }],
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(
      screen.getByText('Password secret is required when ERT token authentication is enabled')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Token store location is required when ERT token authentication is enabled')
    ).toBeInTheDocument();

    // Auth Server is read-only with default value and has no name attribute
    const authServerInput = screen.getByLabelText(/Auth Server \(Connector Default\)/i);
    expect(authServerInput).toHaveValue(DEFAULT_TREP_AUTH_SERVER);
    expect(authServerInput).toHaveAttribute('readonly');
    expect(authServerInput).not.toHaveAttribute('name');

    // Rerender with non-gs:// store location to trigger warning
    rerender(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              hostname: 'websocket-ads.example.internal',
              username: 'GE-A-01103867-3-1234',
              ertAuthEnabled: true,
              passwordSecret: 'trep-ert-password',
              ertAuthStoreLocation: '/tmp/tokens',
              instrumentTuples: [{ service: 'ELEKTRON_DD', rics: 'EUR=', fields: 'BID' }],
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(
      screen.queryByText('Password secret is required when ERT token authentication is enabled')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Token store is normally a gs:// location (e.g. the Dataflow temp location)')
    ).toBeInTheDocument();

    // Rerender with valid gs:// location
    rerender(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              hostname: 'websocket-ads.example.internal',
              username: 'GE-A-01103867-3-1234',
              ertAuthEnabled: true,
              passwordSecret: 'trep-ert-password',
              ertAuthStoreLocation: 'gs://my-bucket/trep-token-store',
              instrumentTuples: [{ service: 'ELEKTRON_DD', rics: 'EUR=', fields: 'BID' }],
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(
      screen.queryByText(
        'Token store is normally a gs:// location (e.g. the Dataflow temp location)'
      )
    ).not.toBeInTheDocument();
  });

  it('expands Advanced Settings and validates port, maxMounts, appId, timeout, maxNumRecords, authPort, ertAuthPath, and discoveryPath', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              hostname: 'websocket-ads.example.internal',
              port: '70000',
              username: 'GE-A-01103867-3-1234',
              ertAuthEnabled: true,
              passwordSecret: 'trep-ert-password',
              ertAuthStoreLocation: 'gs://bucket/tokens',
              serviceDiscovery: true,
              maxMounts: '0',
              appId: 'abc',
              timeout: '30000',
              maxNumRecords: 'not-a-num',
              authPort: '0',
              ertAuthPath: 'relative/path',
              discoveryPath: 'relative/discovery',
              instrumentTuples: [{ service: 'ELEKTRON_DD', rics: 'EUR=', fields: 'BID' }],
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Port must be an integer between 1 and 65535')).toBeInTheDocument();

    const advBtn = screen.getByTestId('trep-source-group-advanced');
    expect(advBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(advBtn);
    expect(advBtn).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getByText('Max mounts must be an integer ≥ 1')).toBeInTheDocument();
    expect(screen.getByText('Application ID must be numeric')).toBeInTheDocument();
    expect(
      screen.getByText('Timeout must be at least 60000 ms (larger than ping timer x2)')
    ).toBeInTheDocument();
    expect(screen.getByText('Max records must be a positive integer')).toBeInTheDocument();
    expect(
      screen.getByText('Auth port must be an integer between 1 and 65535')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Path must start with /')).toHaveLength(2);

    // Rerender with non-numeric port and valid advanced fields
    rerender(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              hostname: 'websocket-ads.example.internal',
              port: 'abc',
              username: 'GE-A-01103867-3-1234',
              ertAuthEnabled: true,
              passwordSecret: 'trep-ert-password',
              ertAuthStoreLocation: 'gs://bucket/tokens',
              serviceDiscovery: true,
              cachedFields: 'PROD_PERM',
              maxMounts: '2',
              position: '10.0.0.1',
              appId: '256',
              timeout: '60000',
              maxNumRecords: '500',
              authPort: '443',
              ertAuthPath: '/auth/oauth2/beta1/token',
              discoveryPath: '/streaming/pricing/v1/',
              instrumentTuples: [{ service: 'ELEKTRON_DD', rics: 'EUR=', fields: 'BID' }],
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Port must be an integer between 1 and 65535')).toBeInTheDocument();
    expect(screen.queryByText('Max mounts must be an integer ≥ 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Application ID must be numeric')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Timeout must be at least 60000 ms (larger than ping timer x2)')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Max records must be a positive integer')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Auth port must be an integer between 1 and 65535')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Path must start with /')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Cached Fields/i), {
      target: { name: 'cachedFields', value: 'PROD_PERM, CONTR_MNTH' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ cachedFields: 'PROD_PERM, CONTR_MNTH' })
    );
  });

  it('supports system_instructions fallback chains and updates system_instructions', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrepWsIOSourceProperties
        node={{ data: { special_instructions: 'node special' } }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('node special');

    rerender(
      <TrepWsIOSourceProperties
        node={{ data: { properties: { system_instructions: 'prop sys' } } }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('prop sys');

    rerender(
      <TrepWsIOSourceProperties
        node={{ data: { properties: { special_instructions: 'prop special' } } }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('prop special');

    fireEvent.change(screen.getByLabelText(/Code Generation Instructions/i), {
      target: { name: 'system_instructions', value: 'Read EUR= and JPY=' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ system_instructions: 'Read EUR= and JPY=' })
    );
  });

  it('classifies every rendered [name] and emitted property key as safe or reference via classifyKey (R3)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TrepWsIOSourceProperties
        node={{
          data: {
            properties: {
              ertAuthEnabled: true,
              serviceDiscovery: true,
            },
          },
        }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('trep-source-group-advanced'));

    const namedElements = Array.from(container.querySelectorAll('[name]'));
    const names = namedElements
      .map((el) => el.getAttribute('name') || '')
      .filter((n) => n.length > 0);

    expect(names).toContain('passwordSecret');
    expect(names).toContain('ertAuthEnabled');
    expect(names).toContain('ertAuthStoreLocation');
    expect(names).toContain('ertAuthPath');
    expect(names).not.toContain('authServer');

    for (const key of [...names, 'instrumentTuples']) {
      const classification = classifyKey(key);
      expect(['safe', 'reference']).toContain(classification);
      if (key === 'passwordSecret') {
        expect(classification).toBe('reference');
      } else {
        expect(classification).toBe('safe');
      }
    }
  });

  it('validates trepwsio.beam integration fixture against redactPipelineYaml and classifyKey', () => {
    const beamPath = path.resolve(__dirname, '../../../../src/test/integration/trepwsio.beam');
    const raw = fs.readFileSync(beamPath, 'utf8');
    const parsed = yaml.parse(raw) as {
      nodes: Array<{ id: string; data?: { properties?: Record<string, unknown> } }>;
    };

    const redactionResult = redactPipelineYaml(raw);
    expect(redactionResult.redactedPaths).toEqual([]);

    for (const node of parsed.nodes) {
      for (const key of Object.keys(node.data?.properties || {})) {
        expect(['safe', 'reference']).toContain(classifyKey(key));
      }
    }
  });
});
