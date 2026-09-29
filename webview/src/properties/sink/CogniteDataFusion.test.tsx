/**
 * CogniteDataFusionSinkProperties Unit Test Suite (IO69)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Coverage target: 100% statements, branches, functions, and lines for
 * webview/src/properties/sink/CogniteDataFusion.tsx.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  CogniteDataFusionSinkProperties,
  CDF_DOCS_URL,
} from './CogniteDataFusion';
import { classifyKey } from '../../../../src/credentialRedaction';

describe('CogniteDataFusionSinkProperties (IO69)', () => {
  let postMessageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageMock = vi.fn();
    (window as unknown as { vscode?: { postMessage: typeof postMessageMock } }).vscode = {
      postMessage: postMessageMock,
    };
  });

  afterEach(() => {
    delete (window as unknown as { vscode?: unknown }).vscode;
  });

  const makeNode = (
    properties?: Record<string, unknown>,
    extras?: { system_instructions?: string; special_instructions?: string }
  ) => ({
    data: {
      ...(properties !== undefined ? { properties } : {}),
      ...extras,
    },
  });

  it('validates ISO-8601 duration branches (days, hours, minutes, seconds, empty P/PT, invalid)', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'events',
          writeMaxBatchLatency: 'P',
        })}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId('cdf-sink-group-hints'));
    expect(screen.getByText('Must be > 10ms and < 12h, e.g. PT5S')).toBeInTheDocument();

    for (const bad of ['PT', 'invalid', 'P1D']) {
      rerender(
        <CogniteDataFusionSinkProperties
          node={makeNode({
            project: 'p',
            clientId: 'c',
            clientSecretSecret: 's',
            authServerUrl: 'https://example.com/token',
            resourceType: 'events',
            writeMaxBatchLatency: bad,
          })}
          onChange={onChange}
        />
      );
      expect(screen.getByText('Must be > 10ms and < 12h, e.g. PT5S')).toBeInTheDocument();
    }

    for (const valid of ['PT1H', 'PT1M', 'PT5S', 'PT1H1M1.5S']) {
      rerender(
        <CogniteDataFusionSinkProperties
          node={makeNode({
            project: 'p',
            clientId: 'c',
            clientSecretSecret: 's',
            authServerUrl: 'https://example.com/token',
            resourceType: 'events',
            writeMaxBatchLatency: valid,
          })}
          onChange={onChange}
        />
      );
      expect(screen.queryByText('Must be > 10ms and < 12h, e.g. PT5S')).not.toBeInTheDocument();
    }
  });

  it('renders defaults when properties is undefined and does not call onChange on mount', () => {
    const onChange = vi.fn();
    render(<CogniteDataFusionSinkProperties node={makeNode(undefined)} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('CDF project is required')).toBeInTheDocument();
    expect(screen.getByText('Client ID is required')).toBeInTheDocument();
    expect(
      screen.getByText('Select the Secret Manager secret holding the client secret')
    ).toBeInTheDocument();
    expect(screen.getByText('Token URL is required (http(s) URL)')).toBeInTheDocument();
    expect(screen.getByText('Resource type is required')).toBeInTheDocument();

    expect(screen.getByTestId('cdf-sink-group-writer')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('cdf-sink-group-hints')).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens external documentation when Docs button is clicked (with and without window.vscode)', () => {
    const onChange = vi.fn();
    render(<CogniteDataFusionSinkProperties node={makeNode({})} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Docs/i }));
    expect(postMessageMock).toHaveBeenCalledWith({
      command: 'openExternal',
      url: CDF_DOCS_URL,
    });

    delete (window as unknown as { vscode?: unknown }).vscode;
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Docs/i }))).not.toThrow();
  });

  it('loads secrets and GCP projects via useAssetLoader and surfaces discovery errors', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://login.microsoftonline.com/t/oauth2/v2.0/token',
          resourceType: 'events',
        })}
        onChange={onChange}
      />
    );

    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getSecrets' });
    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getProjects' });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'secretsLoaded', secrets: ['sec-a', 'sec-b'] },
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'projectsLoaded', projects: ['proj-a'] },
        })
      );
    });

    expect(
      container.querySelectorAll('#cdfSinkClientSecretSecret-secret-options option')
    ).toHaveLength(2);
    expect(container.querySelectorAll('#cdf-sink-secret-project-options option')).toHaveLength(1);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'secretsLoaded', secrets: [], error: 'Sink secret error' },
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'projectsLoaded', projects: [], error: 'Sink project error' },
        })
      );
    });

    expect(screen.getByText('Sink secret error')).toBeInTheDocument();
    expect(screen.getByText('Sink project error')).toBeInTheDocument();
  });

  it('handles Connection and Authentication validation, azureTenantId helper, and authType switching', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          baseUrl: 'invalid-url',
          clientId: 'cid',
          clientSecretSecret: 'csec',
          azureTenantId: 'bad tenant!',
          authServerUrl: 'bad-token-url',
          authScopes: 's1',
          secretVersion: 'bad ver!',
          resourceType: 'events',
        })}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Must be an http(s) URL')).toBeInTheDocument();
    expect(screen.getByText('Invalid tenant id')).toBeInTheDocument();
    expect(screen.getByText('Token URL is required (http(s) URL)')).toBeInTheDocument();
    expect(screen.getByText('Invalid secret version')).toBeInTheDocument();

    // Valid azureTenantId updates authServerUrl
    fireEvent.change(screen.getByLabelText(/Azure AD Tenant ID/i), {
      target: { value: 'acme.onmicrosoft.com' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        azureTenantId: 'acme.onmicrosoft.com',
        authServerUrl: 'https://login.microsoftonline.com/acme.onmicrosoft.com/oauth2/v2.0/token',
      })
    );

    // Invalid azureTenantId does not update authServerUrl
    fireEvent.change(screen.getByLabelText(/Azure AD Tenant ID/i), {
      target: { value: 'another bad tenant!' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        azureTenantId: 'another bad tenant!',
        authServerUrl: 'bad-token-url',
      })
    );

    // Switch to apiKey mode
    fireEvent.change(screen.getByLabelText(/^Authentication/i), {
      target: { value: 'apiKey' },
    });
    const apiKeyCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Record<
      string,
      unknown
    >;
    expect(apiKeyCall.authType).toBe('apiKey');
    expect(apiKeyCall).not.toHaveProperty('clientId');
    expect(apiKeyCall).not.toHaveProperty('clientSecretSecret');
    expect(apiKeyCall).not.toHaveProperty('azureTenantId');
    expect(apiKeyCall).not.toHaveProperty('authServerUrl');
    expect(apiKeyCall).not.toHaveProperty('authScopes');

    // Rerender in apiKey mode with empty apiKeySecret
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          baseUrl: 'https://api.cognitedata.com',
          authType: 'apiKey',
          secretVersion: 'latest',
          resourceType: 'events',
        })}
        onChange={onChange}
      />
    );
    expect(
      screen.getByText('Select the Secret Manager secret holding the API key')
    ).toBeInTheDocument();

    // Rerender in apiKey mode with apiKeySecret set + discovery error
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          authType: 'apiKey',
          apiKeySecret: 'k-sec',
          resourceType: 'events',
        })}
        onChange={onChange}
      />
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'secretsLoaded', secrets: [], error: 'Sink API key secret error' },
        })
      );
    });
    expect(screen.getByText('Sink API key secret error')).toBeInTheDocument();

    // Switch back to clientCredentials -> deletes apiKeySecret
    fireEvent.change(screen.getByLabelText(/^Authentication/i), {
      target: { value: 'clientCredentials' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ apiKeySecret: expect.anything() })
    );
  });

  it('handles resourceType, writeOperation, directWrite, upsertMode, and deleteTempFile', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'assets',
          writeOperation: 'synchronizeHierarchies',
        })}
        onChange={onChange}
      />
    );

    expect(screen.getByText('PCollection<KV<String, Asset>>')).toBeInTheDocument();

    // Switch operation to writeMultipleHierarchies -> deletes directWrite if present
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'assets',
          directWrite: true,
        })}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/^Operation/i), {
      target: { value: 'writeMultipleHierarchies' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ directWrite: expect.anything() })
    );

    // Switch resourceType from assets (with synchronizeHierarchies) to events -> unsupported op is deleted
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'assets',
          writeOperation: 'synchronizeHierarchies',
        })}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/Resource Type/i, { selector: 'select' }), {
      target: { value: 'events' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ writeOperation: expect.anything() })
    );

    // Rerender with events + directWrite: true -> shows Iterable<Event>
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'events',
          directWrite: true,
          upsertMode: 'REPLACE',
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByText('PCollection<Iterable<Event>>')).toBeInTheDocument();

    // Change operation to delete -> deletes upsertMode, directWrite, deleteTempFile and shows PCollection<Item>
    fireEvent.change(screen.getByLabelText(/^Operation/i), {
      target: { value: 'delete' },
    });
    const delCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Record<
      string,
      unknown
    >;
    expect(delCall.writeOperation).toBe('delete');
    expect(delCall).not.toHaveProperty('upsertMode');
    expect(delCall).not.toHaveProperty('directWrite');

    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'events',
          writeOperation: 'delete',
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByText('PCollection<Item>')).toBeInTheDocument();

    // Test writeMultipleHierarchies and synchronizeHierarchies on assets
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'assets',
          directWrite: true,
        })}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/^Operation/i), {
      target: { value: 'writeMultipleHierarchies' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ writeOperation: 'writeMultipleHierarchies' })
    );
    fireEvent.change(screen.getByLabelText(/^Operation/i), {
      target: { value: 'synchronizeHierarchies' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ writeOperation: 'synchronizeHierarchies' })
    );

    // Unsupported operation for resourceType falls back to upsert
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'filesMetadata',
          writeOperation: 'delete',
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByText('PCollection<FileMetadata>')).toBeInTheDocument();

    // Files resource: deleteTempFile defaults to checked; unchecking emits false; re-checking deletes key
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'files',
          writeFileBatchSize: '4',
          directWrite: true,
        })}
        onChange={onChange}
      />
    );
    const deleteTempCheckbox = screen.getByLabelText(/Delete temp file after upload/i);
    expect(deleteTempCheckbox).toBeChecked();
    fireEvent.click(deleteTempCheckbox);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ deleteTempFile: false })
    );

    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'files',
          deleteTempFile: false,
          writeFileBatchSize: '4',
          directWrite: true,
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Delete temp file after upload/i)).not.toBeChecked();
    fireEvent.click(screen.getByLabelText(/Delete temp file after upload/i));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ deleteTempFile: expect.anything() })
    );

    // Switch from files to timeseriesMetadata -> cleans up deleteTempFile, writeFileBatchSize, directWrite
    fireEvent.change(screen.getByLabelText(/Resource Type/i, { selector: 'select' }), {
      target: { value: 'timeseriesMetadata' },
    });
    const tsMetaCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Record<
      string,
      unknown
    >;
    expect(tsMetaCall).not.toHaveProperty('deleteTempFile');
    expect(tsMetaCall).not.toHaveProperty('writeFileBatchSize');
    expect(tsMetaCall).not.toHaveProperty('directWrite');

    // Switch from rawRows with writeRawMaxBatchSize to timeseriesPoints with writeTsPointsUpdateFrequency
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'rawRows',
          writeOperation: 'delete',
          writeRawMaxBatchSize: '2000',
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByText('PCollection<RawRow>')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Resource Type/i, { selector: 'select' }), {
      target: { value: 'timeseriesPoints' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ writeRawMaxBatchSize: expect.anything() })
    );

    // Switch from timeseriesPoints with writeTsPointsUpdateFrequency to sequenceRows
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'timeseriesPoints',
          writeTsPointsUpdateFrequency: 'HZ_10',
        })}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/Resource Type/i, { selector: 'select' }), {
      target: { value: 'sequenceRows' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ writeTsPointsUpdateFrequency: expect.anything() })
    );
  });

  it('validates and updates Writer Config and Hints groups', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'files',
          writeShards: '51',
          writeMaxBatchLatency: 'PT0.01S',
          maxRetries: '21',
          writeFileBatchSize: '11',
        })}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('cdf-sink-group-writer'));
    fireEvent.click(screen.getByTestId('cdf-sink-group-hints'));

    expect(screen.getByLabelText(/Run Status/i, { selector: 'select' })).toBeDisabled();
    expect(
      screen.getByText('Write shards must be an integer between 1 and 50')
    ).toBeInTheDocument();
    expect(screen.getByText('Must be > 10ms and < 12h, e.g. PT5S')).toBeInTheDocument();
    expect(screen.getByText('Max retries must be an integer between 1 and 20')).toBeInTheDocument();
    expect(
      screen.getByText('File batch size must be an integer between 1 and 10')
    ).toBeInTheDocument();

    // Set extractionPipelineExtId -> enables Run Status; clearing it deletes both
    fireEvent.change(screen.getByLabelText(/Extraction Pipeline External ID/i), {
      target: { value: 'ep-1' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ extractionPipelineExtId: 'ep-1' })
    );

    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'rawRows',
          extractionPipelineExtId: 'ep-1',
          extractionPipelineRunStatus: 'SEEN',
          writeShards: '10',
          writeMaxBatchLatency: 'PT5S',
          maxRetries: '3',
          writeRawMaxBatchSize: '10001',
        })}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText(/Run Status/i, { selector: 'select' })).not.toBeDisabled();
    expect(
      screen.getByText('Raw max batch size must be an integer between 1 and 10000')
    ).toBeInTheDocument();

    // Clear extractionPipelineExtId -> deletes both extractionPipelineExtId and extractionPipelineRunStatus
    fireEvent.change(screen.getByLabelText(/Extraction Pipeline External ID/i), {
      target: { value: '' },
    });
    const clearEpCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Record<
      string,
      unknown
    >;
    expect(clearEpCall).not.toHaveProperty('extractionPipelineExtId');
    expect(clearEpCall).not.toHaveProperty('extractionPipelineRunStatus');

    // Rerender with timeseriesPoints and valid rawRows batch size
    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'rawRows',
          writeRawMaxBatchSize: '2000',
        })}
        onChange={onChange}
      />
    );
    expect(
      screen.queryByText('Raw max batch size must be an integer between 1 and 10000')
    ).not.toBeInTheDocument();

    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'timeseriesPoints',
          writeMaxBatchLatency: 'PT12H',
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Must be > 10ms and < 12h, e.g. PT5S')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/TS Points Update Frequency/i), {
      target: { value: 'HZ_10' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ writeTsPointsUpdateFrequency: 'HZ_10' })
    );

    // Check enableMetrics in Writer Config
    fireEvent.click(screen.getByLabelText(/Enable metrics/i));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ enableMetrics: true }));
  });

  it('supports system_instructions 4-way fallback and updates on change', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSinkProperties
        node={makeNode({ special_instructions: 'sink-prop-special' })}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('sink-prop-special');

    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          system_instructions: 'sink-prop-sys',
          special_instructions: 'sink-prop-special',
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('sink-prop-sys');

    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode(
          { system_instructions: 'sink-prop-sys' },
          { special_instructions: 'sink-data-special' }
        )}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('sink-data-special');

    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode(
          { system_instructions: 'sink-prop-sys' },
          { system_instructions: 'sink-data-sys', special_instructions: 'sink-data-special' }
        )}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('sink-data-sys');

    fireEvent.change(screen.getByLabelText(/Code Generation Instructions/i), {
      target: { value: 'new sink instructions' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ system_instructions: 'new sink instructions' })
    );
  });

  it('classifies every rendered and emitted property key as safe or reference via classifyKey', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          resourceType: 'files',
        })}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('cdf-sink-group-writer'));
    fireEvent.click(screen.getByTestId('cdf-sink-group-hints'));

    const filesNames = Array.from(container.querySelectorAll('[name]')).map(
      (el) => (el as HTMLInputElement).name
    );

    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          authType: 'apiKey',
          resourceType: 'rawRows',
        })}
        onChange={onChange}
      />
    );
    const rawNames = Array.from(container.querySelectorAll('[name]')).map(
      (el) => (el as HTMLInputElement).name
    );

    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          resourceType: 'timeseriesPoints',
        })}
        onChange={onChange}
      />
    );
    const tsNames = Array.from(container.querySelectorAll('[name]')).map(
      (el) => (el as HTMLInputElement).name
    );

    const allNames = Array.from(new Set([...filesNames, ...rawNames, ...tsNames]));
    expect(allNames.length).toBeGreaterThan(20);
    expect(allNames).not.toContain('tokenUrl');
    expect(allNames).not.toContain('apiKey');
    expect(allNames).not.toContain('clientSecret');
    expect(allNames).not.toContain('authMode');

    for (const key of allNames) {
      expect(['safe', 'reference']).toContain(classifyKey(key));
    }

    const resourceSelect = container.querySelector('select[name="resourceType"]');
    expect(resourceSelect?.querySelectorAll('option')).toHaveLength(13);
  });

  it('validates non-integer strings in integer input fields triggering regex check failure', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'files',
          writeShards: 'abc',
          maxRetries: 'not-a-number',
          writeFileBatchSize: 'xyz',
        })}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId('cdf-sink-group-writer'));
    fireEvent.click(screen.getByTestId('cdf-sink-group-hints'));

    expect(
      screen.getByText('Write shards must be an integer between 1 and 50')
    ).toBeInTheDocument();
    expect(screen.getByText('Max retries must be an integer between 1 and 20')).toBeInTheDocument();
    expect(
      screen.getByText('File batch size must be an integer between 1 and 10')
    ).toBeInTheDocument();

    rerender(
      <CogniteDataFusionSinkProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'rawRows',
          writeRawMaxBatchSize: 'bad-number',
        })}
        onChange={onChange}
      />
    );
    expect(
      screen.getByText('Raw max batch size must be an integer between 1 and 10000')
    ).toBeInTheDocument();
  });
});

