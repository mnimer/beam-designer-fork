/**
 * CogniteDataFusionSourceProperties Unit Test Suite (IO69)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Coverage target: 100% statements, branches, functions, and lines for
 * webview/src/properties/source/CogniteDataFusion.tsx.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  CogniteDataFusionSourceProperties,
  CDF_DOCS_URL,
} from './CogniteDataFusion';
import { classifyKey, redactPipelineYaml } from '../../../../src/credentialRedaction';

describe('CogniteDataFusionSourceProperties (IO69)', () => {
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
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'events',
          watchForNewItems: true,
          deltaOffset: 'P',
          pollInterval: 'PT',
          pollOffset: 'not-a-duration',
        })}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId('cdf-source-group-reader'));
    expect(screen.getByText('Use an ISO-8601 duration, e.g. PT2H')).toBeInTheDocument();
    expect(
      screen.getByText('Poll interval must be a positive ISO-8601 duration, e.g. PT10S')
    ).toBeInTheDocument();
    expect(screen.getByText('Use an ISO-8601 duration, e.g. PT30S')).toBeInTheDocument();

    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'events',
          watchForNewItems: true,
          deltaOffset: 'P1DT2H3M4.5S',
          pollInterval: 'P1D',
          pollOffset: 'PT5M',
        })}
        onChange={onChange}
      />
    );
    expect(screen.queryByText('Use an ISO-8601 duration, e.g. PT2H')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Poll interval must be a positive ISO-8601 duration, e.g. PT10S')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Use an ISO-8601 duration, e.g. PT30S')).not.toBeInTheDocument();
  });

  it('renders defaults when properties is undefined and does not call onChange on mount', () => {
    const onChange = vi.fn();
    render(<CogniteDataFusionSourceProperties node={makeNode(undefined)} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/CDF Project/i)).toHaveValue('');
    expect(screen.getByText('CDF project is required')).toBeInTheDocument();
    expect(screen.getByText('Client ID is required')).toBeInTheDocument();
    expect(
      screen.getByText('Select the Secret Manager secret holding the client secret')
    ).toBeInTheDocument();
    expect(screen.getByText('Token URL is required (http(s) URL)')).toBeInTheDocument();
    expect(screen.getByText('Resource type is required')).toBeInTheDocument();

    // Request Parameters open by default; Reader Config and Hints closed by default
    expect(screen.getByTestId('cdf-source-group-request')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('cdf-source-group-reader')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('cdf-source-group-hints')).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens external documentation when Docs button is clicked (with and without window.vscode)', () => {
    const onChange = vi.fn();
    render(<CogniteDataFusionSourceProperties node={makeNode({})} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Docs/i }));
    expect(postMessageMock).toHaveBeenCalledWith({
      command: 'openExternal',
      url: CDF_DOCS_URL,
    });

    delete (window as unknown as { vscode?: unknown }).vscode;
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Docs/i }))).not.toThrow();
  });

  it('loads secrets and GCP projects via useAssetLoader and displays discovery errors when valid', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'my-cdf',
          clientId: 'cid',
          clientSecretSecret: 'my-secret',
          authServerUrl: 'https://login.microsoftonline.com/t/oauth2/v2.0/token',
          resourceType: 'assets',
        })}
        onChange={onChange}
      />
    );

    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getSecrets' });
    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getProjects' });

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: [{ id: 'sec-1', name: 'sec-1' }, 'projects/p/secrets/sec-2'],
          },
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'projectsLoaded',
            projects: ['gcp-proj-1', 'gcp-proj-2'],
          },
        })
      );
    });

    const secretOptions = container.querySelectorAll(
      '#cdfSourceClientSecretSecret-secret-options option'
    );
    expect(secretOptions.length).toBe(2);

    const projectOptions = container.querySelectorAll('#cdf-source-secret-project-options option');
    expect(projectOptions.length).toBe(2);

    // Dispatch discovery errors
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'secretsLoaded', secrets: [], error: 'Secrets CLI error' },
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'projectsLoaded', projects: [], error: 'Projects CLI error' },
        })
      );
    });

    expect(screen.getByText('Secrets CLI error')).toBeInTheDocument();
    expect(screen.getByText('Projects CLI error')).toBeInTheDocument();
  });

  it('handles Connection and Authentication field edits, validation, and mutual exclusion', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'cdf-p',
          baseUrl: 'ftp://bad-url',
          clientId: 'cid',
          clientSecretSecret: 'csec',
          azureTenantId: 'bad tenant!',
          authServerUrl: 'not-a-url',
          authScopes: 'scope1',
          secretProject: 'my-gcp-proj',
          secretVersion: 'bad version',
          resourceType: 'events',
        })}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Must be an http(s) URL')).toBeInTheDocument();
    expect(screen.getByText('Invalid tenant id')).toBeInTheDocument();
    expect(screen.getByText('Token URL is required (http(s) URL)')).toBeInTheDocument();
    expect(screen.getByText('Invalid secret version')).toBeInTheDocument();

    // Clearing project deletes key
    fireEvent.change(screen.getByLabelText(/CDF Project/i), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.not.objectContaining({ project: expect.anything() }));

    // Valid azureTenantId populates authServerUrl
    fireEvent.change(screen.getByLabelText(/Azure AD Tenant ID/i), {
      target: { value: 'contoso.onmicrosoft.com' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        azureTenantId: 'contoso.onmicrosoft.com',
        authServerUrl: 'https://login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/token',
      })
    );

    // Invalid azureTenantId does not overwrite authServerUrl
    fireEvent.change(screen.getByLabelText(/Azure AD Tenant ID/i), {
      target: { value: 'another bad tenant!' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        azureTenantId: 'another bad tenant!',
        authServerUrl: 'not-a-url',
      })
    );

    // Switch authType to apiKey -> deletes OIDC keys, keeps secretVersion
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
    expect(apiKeyCall.secretVersion).toBe('bad version');

    // Rerender in apiKey mode with empty apiKeySecret -> shows required error
    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'cdf-p',
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

    // Set apiKeySecret
    fireEvent.change(screen.getByLabelText(/API Key \(Secret Manager\)/i), {
      target: { value: 'my-api-key-sec' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ apiKeySecret: 'my-api-key-sec' })
    );

    // Rerender with apiKeySecret set + secrets discovery error -> shows secretsError
    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'cdf-p',
          authType: 'apiKey',
          apiKeySecret: 'my-api-key-sec',
          resourceType: 'events',
        })}
        onChange={onChange}
      />
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'secretsLoaded', secrets: [], error: 'API key secret lookup failed' },
        })
      );
    });
    expect(screen.getByText('API key secret lookup failed')).toBeInTheDocument();

    // Switch back to clientCredentials -> deletes apiKeySecret
    fireEvent.change(screen.getByLabelText(/^Authentication/i), {
      target: { value: 'clientCredentials' },
    });
    const oidcCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Record<
      string,
      unknown
    >;
    expect(oidcCall.authType).toBe('clientCredentials');
    expect(oidcCall).not.toHaveProperty('apiKeySecret');
  });

  it('handles resourceType changes, readMode, raw fields, and files options', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'files',
          readMode: 'aggregate',
          tempStorageUri: 'http://invalid-scheme',
          forceTempStorage: false,
          readFileBinaryBatchSize: '8',
          filterParameters: 'k=v',
          watchForNewItems: true,
          pollInterval: 'PT10S',
          pollOffset: 'PT30S',
        })}
        onChange={onChange}
      />
    );

    expect(screen.getByText('PCollection<Aggregate>')).toBeInTheDocument();
    expect(screen.getByText('Must be a gs://, s3:// or file:// URI')).toBeInTheDocument();

    // Switching readMode to aggregate deletes streaming keys
    fireEvent.change(screen.getByLabelText(/Read Mode/i), {
      target: { value: 'aggregate' },
    });
    const aggCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Record<
      string,
      unknown
    >;
    expect(aggCall.readMode).toBe('aggregate');
    expect(aggCall).not.toHaveProperty('watchForNewItems');
    expect(aggCall).not.toHaveProperty('pollInterval');
    expect(aggCall).not.toHaveProperty('pollOffset');

    // Switching readMode to items keeps watchForNewItems
    fireEvent.change(screen.getByLabelText(/Read Mode/i), {
      target: { value: 'items' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ readMode: 'items' }));

    // Rerender files with empty tempStorageUri and forceTempStorage=true -> error
    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'files',
          forceTempStorage: true,
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByText('PCollection<FileContainer>')).toBeInTheDocument();
    expect(
      screen.getByText('Force temp storage requires a Temp Storage URI')
    ).toBeInTheDocument();

    // Unchecking forceTempStorage deletes key
    fireEvent.click(screen.getByLabelText(/Always download to temp storage/i));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ forceTempStorage: expect.anything() })
    );

    // Rerender with valid gs:// URI and forceTempStorage=true -> no error
    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'files',
          tempStorageUri: 'gs://my-bucket/temp/',
          forceTempStorage: true,
          readMode: 'aggregate',
          readFileBinaryBatchSize: '4',
          rawDbName: 'db1',
          rawTableName: 'tbl1',
          filterParameters: 'a=1',
          watchForNewItems: true,
          pollInterval: 'PT10S',
          pollOffset: 'PT30S',
        })}
        onChange={onChange}
      />
    );
    expect(screen.queryByText('Must be a gs://, s3:// or file:// URI')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Force temp storage requires a Temp Storage URI')
    ).not.toBeInTheDocument();

    // Change resourceType from files to rawDatabases -> cleans up readMode, files, raw, requestParams, streaming
    fireEvent.change(screen.getByLabelText(/Resource Type/i, { selector: 'select' }), {
      target: { value: 'rawDatabases' },
    });
    const rawDbCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Record<
      string,
      unknown
    >;
    expect(rawDbCall.resourceType).toBe('rawDatabases');
    expect(rawDbCall).not.toHaveProperty('readMode');
    expect(rawDbCall).not.toHaveProperty('tempStorageUri');
    expect(rawDbCall).not.toHaveProperty('forceTempStorage');
    expect(rawDbCall).not.toHaveProperty('readFileBinaryBatchSize');
    expect(rawDbCall).not.toHaveProperty('rawDbName');
    expect(rawDbCall).not.toHaveProperty('rawTableName');
    expect(rawDbCall).not.toHaveProperty('filterParameters');
    expect(rawDbCall).not.toHaveProperty('watchForNewItems');

    // Rerender with rawRows -> shows both rawDbName and rawTableName required errors
    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'rawRows',
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Raw database name is required')).toBeInTheDocument();
    expect(screen.getByText('Raw table name is required')).toBeInTheDocument();

    // Populate rawDbName and rawTableName and switch to rawTables -> keeps rawDbName, deletes rawTableName
    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'rawRows',
          rawDbName: 'my_db',
          rawTableName: 'my_tbl',
        })}
        onChange={onChange}
      />
    );
    expect(screen.queryByText('Raw database name is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Raw table name is required')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Resource Type/i, { selector: 'select' }), {
      target: { value: 'rawTables' },
    });
    const rawTablesCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Record<
      string,
      unknown
    >;
    expect(rawTablesCall.rawDbName).toBe('my_db');
    expect(rawTablesCall).not.toHaveProperty('rawTableName');

    // Change resourceType to assets -> keeps aggregate & streaming support
    fireEvent.change(screen.getByLabelText(/Resource Type/i, { selector: 'select' }), {
      target: { value: 'assets' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ resourceType: 'assets' }));
  });

  it('validates Request Parameters and shows non-blocking warning for timeseriesPoints without item IDs', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'timeseriesPoints',
        })}
        onChange={onChange}
      />
    );

    // Non-blocking warning shown when item IDs and requestJson are empty
    const warning = screen.getByTestId('cdf-source-timeseries-points-warning');
    expect(warning).toHaveTextContent(/Warning: Time series data points normally require item IDs/i);
    // Verify none of the item fields are marked aria-invalid
    expect(screen.getByLabelText(/Item External IDs/i)).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByLabelText(/Item Internal IDs/i)).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByLabelText(/Request JSON/i)).toHaveAttribute('aria-invalid', 'false');

    // Toggle Request Parameters group closed and open
    fireEvent.click(screen.getByTestId('cdf-source-group-request'));
    expect(screen.queryByLabelText(/Filter Parameters/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cdf-source-group-request'));
    expect(screen.getByLabelText(/Filter Parameters/i)).toBeInTheDocument();

    // Invalid filterParameters, metadataFilterParameters, rootParameters, itemInternalIds, requestJson
    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'timeseriesPoints',
          filterParameters: 'invalid_line',
          metadataFilterParameters: 'also_invalid',
          rootParameters: 'bad_root',
          itemInternalIds: '123, abc',
          requestJson: '[1, 2]',
        })}
        onChange={onChange}
      />
    );

    expect(screen.getAllByText('Each line must be key=value')).toHaveLength(3);
    expect(screen.getByText('Internal IDs must be integers')).toBeInTheDocument();
    expect(screen.getByText('Request JSON must be a JSON object')).toBeInTheDocument();

    // Valid JSON object when another request param is set -> mutual exclusion error
    // Test each of the 5 request params triggering hasOtherRequestParams
    for (const paramKey of [
      'filterParameters',
      'metadataFilterParameters',
      'rootParameters',
      'itemExternalIds',
      'itemInternalIds',
    ]) {
      rerender(
        <CogniteDataFusionSourceProperties
          node={makeNode({
            project: 'p',
            clientId: 'c',
            clientSecretSecret: 's',
            authServerUrl: 'https://example.com/token',
            resourceType: 'timeseriesPoints',
            [paramKey]: paramKey === 'itemInternalIds' ? '100, 200' : 'k=v',
            requestJson: '{"filter": {}}',
          })}
          onChange={onChange}
        />
      );
      expect(
        screen.getByText('Request JSON replaces all other request parameters; clear one of them')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('cdf-source-timeseries-points-warning')
      ).not.toBeInTheDocument();
    }

    // Valid requestJson alone -> no error, no warning
    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'timeseriesPoints',
          requestJson: '{"filter": {}}',
        })}
        onChange={onChange}
      />
    );
    expect(screen.queryByText(/Request JSON/)).toBeInTheDocument();
    expect(
      screen.queryByText('Request JSON must be a JSON object')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Request JSON replaces all other request parameters; clear one of them')
    ).not.toBeInTheDocument();
  });

  it('validates and updates Reader Config and Hints groups', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'files',
          deltaReadTable: 'invalid_table_format',
          deltaIdentifier: 'x'.repeat(1000),
          deltaOffset: 'bad-duration',
          watchForNewItems: true,
          pollInterval: 'PT0S',
          pollOffset: 'bad-offset',
          readFirstNResults: '1.5',
          readShardsPerWorker: '11',
          maxRetries: '0',
          readFileBinaryBatchSize: '15',
        })}
        onChange={onChange}
      />
    );

    // Open Reader Config and Hints
    fireEvent.click(screen.getByTestId('cdf-source-group-reader'));
    fireEvent.click(screen.getByTestId('cdf-source-group-hints'));

    expect(screen.getByText('Must be <dbName.tableName>')).toBeInTheDocument();
    expect(screen.getByText('Must be under 1000 characters')).toBeInTheDocument();
    expect(screen.getByText('Use an ISO-8601 duration, e.g. PT2H')).toBeInTheDocument();
    expect(
      screen.getByText('Poll interval must be a positive ISO-8601 duration, e.g. PT10S')
    ).toBeInTheDocument();
    expect(screen.getByText('Use an ISO-8601 duration, e.g. PT30S')).toBeInTheDocument();
    expect(screen.getByText('Must be an integer')).toBeInTheDocument();
    expect(
      screen.getByText('Read shards per worker must be an integer between 1 and 10')
    ).toBeInTheDocument();
    expect(screen.getByText('Max retries must be an integer between 1 and 20')).toBeInTheDocument();
    expect(
      screen.getByText('File binary batch size must be an integer between 1 and 10')
    ).toBeInTheDocument();

    // Check enableMetrics and fullReadOverride
    fireEvent.click(screen.getByLabelText(/Enable metrics/i));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ enableMetrics: true }));

    fireEvent.click(screen.getByLabelText(/Full read override/i));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fullReadOverride: true }));

    // Rerender with valid values for Reader Config & Hints
    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'files',
          deltaReadTable: 'db.tbl',
          deltaIdentifier: 'id-1',
          deltaOffset: 'PT2H',
          watchForNewItems: true,
          pollInterval: 'PT10S',
          pollOffset: 'PT0S',
          readFirstNResults: '-1',
          readShardsPerWorker: '4',
          maxRetries: '3',
          readFileBinaryBatchSize: '8',
        })}
        onChange={onChange}
      />
    );

    expect(screen.queryByText('Must be <dbName.tableName>')).not.toBeInTheDocument();
    expect(screen.queryByText('Must be under 1000 characters')).not.toBeInTheDocument();
    expect(screen.queryByText('Use an ISO-8601 duration, e.g. PT2H')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Poll interval must be a positive ISO-8601 duration, e.g. PT10S')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Use an ISO-8601 duration, e.g. PT30S')).not.toBeInTheDocument();
    expect(screen.queryByText('Must be an integer')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Read shards per worker must be an integer between 1 and 10')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Max retries must be an integer between 1 and 20')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('File binary batch size must be an integer between 1 and 10')
    ).not.toBeInTheDocument();
  });

  it('supports system_instructions 4-way fallback and updates on change', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CogniteDataFusionSourceProperties
        node={makeNode({ special_instructions: 'prop-special' })}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('prop-special');

    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({ system_instructions: 'prop-sys', special_instructions: 'prop-special' })}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('prop-sys');

    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({ system_instructions: 'prop-sys' }, { special_instructions: 'data-special' })}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('data-special');

    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode(
          { system_instructions: 'prop-sys' },
          { system_instructions: 'data-sys', special_instructions: 'data-special' }
        )}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('data-sys');

    fireEvent.change(screen.getByLabelText(/Code Generation Instructions/i), {
      target: { value: 'updated instructions' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ system_instructions: 'updated instructions' })
    );
  });

  it('classifies every rendered and emitted property key as safe or reference via classifyKey', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          resourceType: 'files',
          watchForNewItems: true,
        })}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('cdf-source-group-reader'));
    fireEvent.click(screen.getByTestId('cdf-source-group-hints'));

    const oidcNames = Array.from(container.querySelectorAll('[name]')).map(
      (el) => (el as HTMLInputElement).name
    );

    rerender(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          authType: 'apiKey',
          resourceType: 'rawRows',
        })}
        onChange={onChange}
      />
    );
    const apiKeyNames = Array.from(container.querySelectorAll('[name]')).map(
      (el) => (el as HTMLInputElement).name
    );

    const allNames = Array.from(new Set([...oidcNames, ...apiKeyNames]));
    expect(allNames.length).toBeGreaterThan(25);
    expect(allNames).not.toContain('tokenUrl');
    expect(allNames).not.toContain('apiKey');
    expect(allNames).not.toContain('clientSecret');
    expect(allNames).not.toContain('authMode');

    for (const key of allNames) {
      const classification = classifyKey(key);
      expect(['safe', 'reference']).toContain(classification);
    }

    const resourceSelect = container.querySelector('select[name="resourceType"]');
    expect(resourceSelect?.querySelectorAll('option')).toHaveLength(15);
  });

  it('validates malformed JSON in requestJson triggering catch block', () => {
    const onChange = vi.fn();
    render(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'timeseriesPoints',
          requestJson: '{malformed-json-here',
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Request JSON must be a JSON object')).toBeInTheDocument();
  });

  it('validates non-integer strings in integer input fields triggering regex check failure', () => {
    const onChange = vi.fn();
    render(
      <CogniteDataFusionSourceProperties
        node={makeNode({
          project: 'p',
          clientId: 'c',
          clientSecretSecret: 's',
          authServerUrl: 'https://example.com/token',
          resourceType: 'files',
          readShardsPerWorker: 'abc',
          maxRetries: 'xyz',
          readFileBinaryBatchSize: 'not-int',
        })}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId('cdf-source-group-reader'));
    fireEvent.click(screen.getByTestId('cdf-source-group-hints'));

    expect(
      screen.getByText('Read shards per worker must be an integer between 1 and 10')
    ).toBeInTheDocument();
    expect(screen.getByText('Max retries must be an integer between 1 and 20')).toBeInTheDocument();
    expect(
      screen.getByText('File binary batch size must be an integer between 1 and 10')
    ).toBeInTheDocument();
  });

  it('validates cognitedatafusion.beam integration fixture against redactPipelineYaml and classifyKey', () => {
    const beamPath = path.resolve(
      __dirname,
      '../../../../src/test/integration/cognitedatafusion.beam'
    );
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
