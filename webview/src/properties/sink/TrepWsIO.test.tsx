/**
 * Unit Tests for TrepWsIO Sink Properties Component (IO72 — D2 WebSocket API Post Bridge)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Coverage Target: 100% statements, branches, functions, and lines on
 * `webview/src/properties/sink/TrepWsIO.tsx`.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrepWsIOSinkProperties, TREP_SINK_DOCS_URL } from './TrepWsIO';
import { classifyKey } from '../../../../src/credentialRedaction';

vi.mock('../../hooks/useAssetLoader', () => ({
  useAssetLoader: vi.fn(() => ({
    items: ['trep-rto-password'],
    loading: false,
    refresh: vi.fn(),
  })),
}));

describe('TrepWsIOSinkProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { vscode?: unknown }).vscode;
  });

  it('renders with empty properties and shows required errors for hostname, username, and serviceName', () => {
    const onChange = vi.fn();
    render(<TrepWsIOSinkProperties node={{ data: {} }} onChange={onChange} />);

    expect(screen.getByText('TrepWsIO Sink (WebSocket API Post Bridge)')).toBeInTheDocument();
    expect(
      screen.getByText('ADS hostname is required unless ERT service discovery is enabled')
    ).toBeInTheDocument();
    expect(screen.getByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('Service name is required')).toBeInTheDocument();

    // Defaults: postMode = offStream, ricMode = fromElement, ackRequired = true, nakHandling = log
    expect(screen.getByLabelText(/Off-Stream \(Login stream\)/i)).toBeChecked();
    expect(screen.getByLabelText(/From Element/i)).toBeChecked();
    expect(screen.getByLabelText(/RIC Attribute/i, { selector: 'input' })).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^Fixed RIC/i, { selector: 'input[type="text"]' })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Request Ack/i)).toBeChecked();
    expect(screen.getByLabelText(/On Nak/i, { selector: 'select' })).not.toBeDisabled();
  });

  it('opens official documentation URL via window.vscode.postMessage and handles missing vscode safely', () => {
    const onChange = vi.fn();
    render(<TrepWsIOSinkProperties node={{ data: {} }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Docs/i }));

    const postMessage = vi.fn();
    (window as unknown as { vscode?: { postMessage: typeof postMessage } }).vscode = {
      postMessage,
    };
    fireEvent.click(screen.getByRole('button', { name: /Docs/i }));
    expect(postMessage).toHaveBeenCalledWith({
      command: 'openExternal',
      url: TREP_SINK_DOCS_URL,
    });
  });

  it('clears required errors when hostname, username, and serviceName are provided', () => {
    const onChange = vi.fn();
    render(
      <TrepWsIOSinkProperties
        node={{
          data: {
            properties: {
              hostname: 'ads-contrib.example.internal',
              port: '15000',
              username: 'beam-poster',
              serviceName: 'DDS_TRCE',
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
    expect(screen.queryByText('Service name is required')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Port must be an integer between 1 and 65535')
    ).not.toBeInTheDocument();
  });

  it('switches postMode, ricMode (fromElement vs fixed), ackRequired, and nakHandling', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrepWsIOSinkProperties
        node={{
          data: {
            properties: {
              hostname: 'ads-contrib.example.internal',
              username: 'beam-poster',
              serviceName: 'DDS_TRCE',
            },
          },
        }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByLabelText(/On-Stream \(Item stream\)/i));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ postMode: 'onStream' })
    );

    fireEvent.change(screen.getByLabelText(/RIC Attribute/i, { selector: 'input' }), {
      target: { name: 'ricField', value: 'name' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ ricField: 'name' })
    );

    fireEvent.click(screen.getByLabelText(/Fixed RIC/i, { selector: 'input[type="radio"]' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ ricMode: 'fixed' })
    );

    // Rerender with ricMode='fixed' and blank ricName -> error shown
    rerender(
      <TrepWsIOSinkProperties
        node={{
          data: {
            properties: {
              hostname: 'ads-contrib.example.internal',
              username: 'beam-poster',
              serviceName: 'DDS_TRCE',
              ricMode: 'fixed',
              ricName: '',
              ackRequired: false,
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('RIC is required when RIC source is Fixed')).toBeInTheDocument();
    expect(screen.getByLabelText(/On Nak/i, { selector: 'select' })).toBeDisabled();

    // Rerender with valid ricName and ackRequired=true
    rerender(
      <TrepWsIOSinkProperties
        node={{
          data: {
            properties: {
              hostname: 'ads-contrib.example.internal',
              username: 'beam-poster',
              serviceName: 'DDS_TRCE',
              ricMode: 'fixed',
              ricName: 'EURMID=',
              ackRequired: true,
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(screen.queryByText('RIC is required when RIC source is Fixed')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/On Nak/i, { selector: 'select' }), {
      target: { name: 'nakHandling', value: 'fail' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ nakHandling: 'fail' })
    );

    fireEvent.click(screen.getByLabelText(/Request Ack/i));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ ackRequired: false })
    );
  });

  it('handles ERT / RTO token authentication and service discovery', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrepWsIOSinkProperties
        node={{
          data: {
            properties: {
              username: 'GE-A-01103867-3-1234',
              serviceName: 'DDS_TRCE',
              ertAuthEnabled: true,
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(
      screen.getByText('Password secret is required when token authentication is enabled')
    ).toBeInTheDocument();
    expect(
      screen.getByText('ADS hostname is required unless ERT service discovery is enabled')
    ).toBeInTheDocument();

    // Rerender with passwordSecret and serviceDiscovery=true
    rerender(
      <TrepWsIOSinkProperties
        node={{
          data: {
            properties: {
              username: 'GE-A-01103867-3-1234',
              serviceName: 'DDS_TRCE',
              ertAuthEnabled: true,
              passwordSecret: 'trep-rto-password',
              serviceDiscovery: true,
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(
      screen.queryByText('Password secret is required when token authentication is enabled')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('ADS hostname is required unless ERT service discovery is enabled')
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Discovery Region/i, { selector: 'input' }), {
      target: { name: 'region', value: 'us' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ region: 'us' }));
  });

  it('expands Advanced Settings and validates port, appId, authPort, ertAuthPath, discoveryPath, and takeExclusiveSignOnControl', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrepWsIOSinkProperties
        node={{
          data: {
            properties: {
              hostname: 'ads-contrib.example.internal',
              port: '0',
              username: 'beam-poster',
              serviceName: 'DDS_TRCE',
              ertAuthEnabled: true,
              passwordSecret: 'trep-rto-password',
              serviceDiscovery: true,
              appId: 'invalid',
              authPort: '99999',
              ertAuthPath: 'no-slash',
              discoveryPath: 'no-slash-disc',
              takeExclusiveSignOnControl: false,
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Port must be an integer between 1 and 65535')).toBeInTheDocument();

    const advBtn = screen.getByTestId('trep-sink-group-advanced');
    expect(advBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(advBtn);
    expect(advBtn).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getByText('Application ID must be numeric')).toBeInTheDocument();
    expect(
      screen.getByText('Auth port must be an integer between 1 and 65535')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Path must start with /')).toHaveLength(2);
    expect(screen.getByLabelText(/Take exclusive sign-on control/i)).not.toBeChecked();

    // Rerender with non-digit port and valid advanced values
    rerender(
      <TrepWsIOSinkProperties
        node={{
          data: {
            properties: {
              hostname: 'ads-contrib.example.internal',
              port: 'not-a-port',
              username: 'beam-poster',
              serviceName: 'DDS_TRCE',
              ertAuthEnabled: true,
              passwordSecret: 'trep-rto-password',
              serviceDiscovery: true,
              position: '10.0.0.1',
              appId: '256',
              authServer: 'api.refinitiv.com',
              authPort: '443',
              ertAuthPath: '/auth/oauth2/v1/token',
              discoveryPath: '/streaming/pricing/v1/',
              takeExclusiveSignOnControl: true,
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Port must be an integer between 1 and 65535')).toBeInTheDocument();
    expect(screen.queryByText('Application ID must be numeric')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Auth port must be an integer between 1 and 65535')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Path must start with /')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Take exclusive sign-on control/i)).toBeChecked();
  });

  it('supports system_instructions fallback chains and updates system_instructions', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TrepWsIOSinkProperties
        node={{ data: { special_instructions: 'node special' } }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('node special');

    rerender(
      <TrepWsIOSinkProperties
        node={{ data: { properties: { system_instructions: 'prop sys' } } }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('prop sys');

    rerender(
      <TrepWsIOSinkProperties
        node={{ data: { properties: { special_instructions: 'prop special' } } }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('prop special');

    fireEvent.change(screen.getByLabelText(/Code Generation Instructions/i), {
      target: { name: 'system_instructions', value: 'Post EURMID= off-stream' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ system_instructions: 'Post EURMID= off-stream' })
    );
  });

  it('classifies every rendered [name] attribute as safe or reference via classifyKey and excludes includePostUserInfo (R3)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TrepWsIOSinkProperties
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

    fireEvent.click(screen.getByTestId('trep-sink-group-advanced'));

    const namedElements = Array.from(container.querySelectorAll('[name]'));
    const names = namedElements
      .map((el) => el.getAttribute('name') || '')
      .filter((n) => n.length > 0);

    expect(names).toContain('passwordSecret');
    expect(names).toContain('ertAuthEnabled');
    expect(names).toContain('ertAuthPath');
    expect(names).not.toContain('includePostUserInfo');

    for (const key of names) {
      const classification = classifyKey(key);
      expect(['safe', 'reference']).toContain(classification);
      if (key === 'passwordSecret') {
        expect(classification).toBe('reference');
      } else {
        expect(classification).toBe('safe');
      }
    }
  });
});
