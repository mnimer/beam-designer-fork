/**
 * CloudBigtable Source Properties Unit Tests (IO68)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CloudBigtableSourceProperties } from './CloudBigtable';
import { classifyKey } from '../../../../src/credentialRedaction';

const CLOUD_BIGTABLE_DOCS_URL = 'https://cloud.google.com/bigtable/docs/hbase-dataflow-java';

const CLOUD_BIGTABLE_SOURCE_PROPERTY_KEYS = [
  'projectId',
  'instanceId',
  'tableId',
  'appProfileId',
  'credentialsSecret',
  'rowPrefix',
  'startRow',
  'stopRow',
  'columnFamilies',
  'columns',
  'maxVersions',
  'timeRangeMin',
  'timeRangeMax',
  'rowFilter',
  'configuration',
  'system_instructions',
] as const;

const CLOUD_BIGTABLE_SOURCE_CONFIG_KEY_OPTIONS: readonly string[] = [
  'google.bigtable.endpoint.host',
  'google.bigtable.endpoint.port',
  'google.bigtable.emulator.endpoint.host',
  'google.bigtable.universe.domain',
  'google.bigtable.custom.user.agent',
  'google.bigtable.grpc.retry.enable',
  'google.bigtable.grpc.retry.codes',
  'google.bigtable.grpc.retry.deadlineexceeded.enable',
  'google.bigtable.grpc.retry.initial.elapsed.backoff.ms',
  'google.bigtable.grpc.retry.max.elapsed.backoff.ms',
  'google.bigtable.grpc.read.partial.row.timeout.ms',
  'google.bigtable.grpc.retry.max.scan.timeout.retries',
  'google.bigtable.grpc.read.streaming.buffer.size',
  'google.bigtable.grpc.channel.count',
  'google.bigtable.rpc.timeout.ms',
  'google.bigtable.rpc.attempt.timeout.ms',
  'google.bigtable.read.rpc.timeout.ms',
  'google.bigtable.read.rpc.attempt.timeout.ms',
  'google.bigtable.enable.client.side.metrics',
];

describe('CloudBigtableSourceProperties (IO68)', () => {
  let postMessageMock: ReturnType<typeof vi.fn>;
  const vscodeWindow = window as unknown as { vscode?: { postMessage: typeof postMessageMock } };

  beforeEach(() => {
    postMessageMock = vi.fn();
    vscodeWindow.vscode = { postMessage: postMessageMock };
  });

  afterEach(() => {
    delete vscodeWindow.vscode;
    vi.clearAllMocks();
  });

  const dispatchMessage = (data: Record<string, unknown>) => {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data }));
    });
  };

  const makeNode = (properties?: Record<string, unknown>, extraData: Record<string, unknown> = {}) => ({
    id: 'cbt-src-1',
    data: {
      label: 'Read Bigtable',
      type: 'SOURCE',
      beam_transform: 'CloudBigtable',
      ...(properties !== undefined ? { properties } : {}),
      ...extraData,
    },
  });

  const validProps = {
    projectId: 'my-gcp-project',
    instanceId: 'events-instance',
    tableId: 'user-events',
  };

  it('classifies every emitted property key as safe or reference (never secret)', () => {
    for (const key of CLOUD_BIGTABLE_SOURCE_PROPERTY_KEYS) {
      const classification = classifyKey(key);
      expect(['safe', 'reference']).toContain(classification);
      expect(classification).not.toBe('secret');
    }
    expect(classifyKey('credentialsSecret')).toBe('reference');
  });

  it('never renders a password input or plaintext credential control', () => {
    const { container } = render(<CloudBigtableSourceProperties node={makeNode(validProps)} onChange={vi.fn()} />);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('[name="password"]')).toBeNull();
  });

  it('opens the connector documentation via openExternal when Docs ↗ is clicked (and handles missing vscode)', () => {
    render(<CloudBigtableSourceProperties node={makeNode(validProps)} onChange={vi.fn()} />);
    postMessageMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /Docs ↗/i }));
    expect(postMessageMock).toHaveBeenCalledWith({
      command: 'openExternal',
      url: CLOUD_BIGTABLE_DOCS_URL,
    });

    delete vscodeWindow.vscode;
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Docs ↗/i }))).not.toThrow();
  });

  it('renders with undefined properties and shows required errors for Project, Instance, and Table', () => {
    render(<CloudBigtableSourceProperties node={makeNode(undefined)} onChange={vi.fn()} />);

    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('Row Range & Scan')).toBeInTheDocument();
    expect(screen.getByText('Advanced Connection Settings')).toBeInTheDocument();

    const alerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts).toContain('Project ID is required');
    expect(alerts).toContain('Instance ID is required');
    expect(alerts).toContain('Table ID is required');

    const sysInstr = document.getElementById('cbtSourceSystemInstructions') as HTMLTextAreaElement;
    expect(sysInstr.value).toBe('');
  });

  it('renders valid connection properties with no validation alerts and requests discovery assets', () => {
    render(<CloudBigtableSourceProperties node={makeNode(validProps)} onChange={vi.fn()} />);

    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getProjects' });
    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getBigtableInstances' });
    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getSecrets' });
    expect(postMessageMock).toHaveBeenCalledWith({
      command: 'getBigtableTables',
      instance: 'projects/my-gcp-project/instances/events-instance',
    });
  });

  it('populates datalists when projectsLoaded, bigtableInstancesLoaded, bigtableTablesLoaded, and secretsLoaded arrive', () => {
    render(<CloudBigtableSourceProperties node={makeNode(validProps)} onChange={vi.fn()} />);

    dispatchMessage({ command: 'projectsLoaded', projects: ['proj-alpha', 'proj-beta'] });
    dispatchMessage({ command: 'bigtableInstancesLoaded', bigtableInstances: ['inst-1', 'inst-2'] });
    dispatchMessage({ command: 'bigtableTablesLoaded', bigtableTables: ['tbl-orders', 'tbl-events'] });
    dispatchMessage({ command: 'secretsLoaded', secrets: ['bt-sa-secret'] });

    const optionValues = (id: string) =>
      Array.from(document.querySelectorAll(`#${id} option`)).map((o) => o.getAttribute('value'));

    expect(optionValues('cbtSourceProjectOptions')).toEqual(['proj-alpha', 'proj-beta']);
    expect(optionValues('cbtSourceInstanceOptions')).toEqual(['inst-1', 'inst-2']);
    expect(optionValues('cbtSourceTableOptions')).toEqual(['tbl-orders', 'tbl-events']);
    expect(optionValues('cbtSourceCredentialsSecret-secret-options')).toEqual(['bt-sa-secret']);
  });

  it('surfaces discovery errors when field validation passes, and lets validation error win over discovery error', () => {
    const { rerender } = render(<CloudBigtableSourceProperties node={makeNode(validProps)} onChange={vi.fn()} />);

    dispatchMessage({ command: 'projectsLoaded', projects: [], error: 'gcloud projects failed' });
    dispatchMessage({ command: 'bigtableInstancesLoaded', bigtableInstances: [], error: 'gcloud instances failed' });
    dispatchMessage({ command: 'bigtableTablesLoaded', bigtableTables: [], error: 'gcloud tables failed' });

    const alerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts).toContain('gcloud projects failed');
    expect(alerts).toContain('gcloud instances failed');
    expect(alerts).toContain('gcloud tables failed');

    rerender(<CloudBigtableSourceProperties node={makeNode({ ...validProps, projectId: '' })} onChange={vi.fn()} />);
    const updatedAlerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(updatedAlerts).toContain('Project ID is required');
    expect(updatedAlerts).not.toContain('gcloud projects failed');
  });

  it('handles tablesInstanceParam for short instance ID (when project invalid), domain-scoped project, and invalid instance', () => {
    postMessageMock.mockClear();
    const { unmount } = render(
      <CloudBigtableSourceProperties
        node={makeNode({ projectId: 'BAD_PROJECT', instanceId: 'events-instance', tableId: 't1' })}
        onChange={vi.fn()}
      />
    );
    expect(postMessageMock).toHaveBeenCalledWith({
      command: 'getBigtableTables',
      instance: 'events-instance',
    });
    unmount();

    postMessageMock.mockClear();
    const { unmount: unmount2 } = render(
      <CloudBigtableSourceProperties
        node={makeNode({ projectId: 'example.com:my-project', instanceId: 'events-instance', tableId: 't1' })}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(postMessageMock).toHaveBeenCalledWith({
      command: 'getBigtableTables',
      instance: 'projects/example.com:my-project/instances/events-instance',
    });
    unmount2();

    postMessageMock.mockClear();
    render(
      <CloudBigtableSourceProperties
        node={makeNode({ projectId: 'my-gcp-project', instanceId: '1bad', tableId: 't1' })}
        onChange={vi.fn()}
      />
    );
    expect(postMessageMock).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'getBigtableTables' }));
  });

  it('validates format rules for projectId, instanceId, tableId (regex and max length), and appProfileId', () => {
    const { rerender } = render(
      <CloudBigtableSourceProperties
        node={makeNode({
          projectId: 'Bad_Project',
          instanceId: '1bad-instance',
          tableId: '-bad-table',
          appProfileId: '.bad-profile',
        })}
        onChange={vi.fn()}
      />
    );

    let alerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts).toContain('Invalid project ID (6–30 lowercase letters, digits or hyphens; must start with a letter)');
    expect(alerts).toContain(
      'Invalid instance ID (lowercase letters, digits and hyphens; must start with a letter and end with a letter or digit)'
    );
    expect(alerts).toContain('Invalid table ID (letters, digits, _ - . ; must not start with - or .)');
    expect(alerts).toContain('Invalid app profile ID (letters, digits, _ - . ; must not start with - or .)');

    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({
          ...validProps,
          tableId: 'a'.repeat(51),
          appProfileId: 'batch-analytics_1',
        })}
        onChange={vi.fn()}
      />
    );
    alerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts).toEqual(['Table ID must be at most 50 characters']);
  });

  it('propagates changes for all connection and scan fields while preserving existing properties', () => {
    const onChange = vi.fn();
    render(
      <CloudBigtableSourceProperties
        node={makeNode({ ...validProps, preservedKey: 'keep-me' })}
        onChange={onChange}
      />
    );

    const fieldChanges: Array<[string, string, string]> = [
      ['cbtSourceProjectId', 'projectId', 'new-project-1'],
      ['cbtSourceInstanceId', 'instanceId', 'new-instance-1'],
      ['cbtSourceTableId', 'tableId', 'new-table-1'],
      ['cbtSourceAppProfileId', 'appProfileId', 'app-prof-1'],
      ['cbtSourceCredentialsSecret', 'credentialsSecret', 'my-bt-secret'],
      ['cbtSourceRowPrefix', 'rowPrefix', 'prefix#'],
      ['cbtSourceStartRow', 'startRow', 'row-001'],
      ['cbtSourceStopRow', 'stopRow', 'row-999'],
      ['cbtSourceColumnFamilies', 'columnFamilies', 'cf1, cf2'],
      ['cbtSourceColumns', 'columns', 'cf1:colA, cf2:colB'],
      ['cbtSourceMaxVersions', 'maxVersions', '3'],
      ['cbtSourceTimeRangeMin', 'timeRangeMin', '1000'],
      ['cbtSourceTimeRangeMax', 'timeRangeMax', '2000'],
      ['cbtSourceRowFilter', 'rowFilter', 'FirstKeyOnlyFilter'],
    ];

    for (const [id, key, val] of fieldChanges) {
      onChange.mockClear();
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
      fireEvent.change(el, { target: { name: key, value: val } });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          preservedKey: 'keep-me',
          [key]: val,
        })
      );
      for (const emittedKey of Object.keys(onChange.mock.calls[0][0])) {
        if (emittedKey !== 'preservedKey') {
          expect(['safe', 'reference']).toContain(classifyKey(emittedKey));
        }
      }
    }
  });

  it('validates rowPrefix conflicts with startRow and stopRow, and startRow/stopRow sort order', () => {
    const { rerender } = render(
      <CloudBigtableSourceProperties
        node={makeNode({ ...validProps, rowPrefix: 'user#', startRow: 'a' })}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Row Key Prefix cannot be combined with Start Row / Stop Row');

    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({ ...validProps, rowPrefix: 'user#', stopRow: 'z' })}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Row Key Prefix cannot be combined with Start Row / Stop Row');

    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({ ...validProps, startRow: 'm', stopRow: 'a' })}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Stop Row must sort after Start Row');

    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({ ...validProps, startRow: 'm', stopRow: 'm' })}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Stop Row must sort after Start Row');

    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({ ...validProps, startRow: 'a', stopRow: 'm' })}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('validates columnFamilies, columns, maxVersions, and timeRangeMin / timeRangeMax', () => {
    const { rerender } = render(
      <CloudBigtableSourceProperties
        node={makeNode({
          ...validProps,
          columnFamilies: 'cf1, cf2',
          columns: 'cf1:q1, cf2:q2',
          maxVersions: '2',
          timeRangeMin: '100',
          timeRangeMax: '200',
        })}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);

    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({
          ...validProps,
          columnFamilies: 'cf1,,cf2',
          columns: 'cf1_no_colon',
          maxVersions: '0',
          timeRangeMin: '-1',
          timeRangeMax: 'abc',
        })}
        onChange={vi.fn()}
      />
    );
    const alerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts).toContain('Enter comma-separated column family names (no ":" or spaces)');
    expect(alerts).toContain('Enter comma-separated family:qualifier pairs');
    expect(alerts).toContain('Max Versions must be a positive integer');
    expect(alerts.filter((a) => a === 'Timestamp must be a non-negative integer (epoch milliseconds)')).toHaveLength(2);

    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({
          ...validProps,
          columnFamilies: 'cf:bad',
          timeRangeMin: '200',
          timeRangeMax: '100',
        })}
        onChange={vi.fn()}
      />
    );
    const alerts2 = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts2).toContain('Enter comma-separated column family names (no ":" or spaces)');
    expect(alerts2).toContain('Max Timestamp must not be smaller than Min Timestamp');
  });

  it('manages configuration entries (add, edit, remove, and non-array fallback) and validates all row rules', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CloudBigtableSourceProperties
        node={makeNode({ ...validProps, configuration: 'legacy-non-array' })}
        onChange={onChange}
      />
    );

    expect(document.getElementById('cbtSrcConfigKey-0')).toBeNull();
    const datalistOpts = Array.from(document.querySelectorAll('#cbtSrcConfigKeyOptions option')).map((o) =>
      o.getAttribute('value')
    );
    expect(datalistOpts).toEqual([...CLOUD_BIGTABLE_SOURCE_CONFIG_KEY_OPTIONS]);
    expect(datalistOpts.some((k) => k?.startsWith('google.bigtable.auth.'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Add configuration entry/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: [{ key: '', value: '' }],
      })
    );

    // Fresh empty row shows no error
    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({ ...validProps, configuration: [{ key: '', value: '' }] })}
        onChange={onChange}
      />
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);

    // Edit key & value across 2 rows
    onChange.mockClear();
    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({
          ...validProps,
          configuration: [
            { key: 'google.bigtable.rpc.timeout.ms', value: '60000' },
            { key: 'google.bigtable.grpc.channel.count', value: '4' },
          ],
        })}
        onChange={onChange}
      />
    );
    fireEvent.change(document.getElementById('cbtSrcConfigKey-0') as HTMLInputElement, {
      target: { value: 'google.bigtable.read.rpc.timeout.ms' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: [
          { key: 'google.bigtable.read.rpc.timeout.ms', value: '60000' },
          { key: 'google.bigtable.grpc.channel.count', value: '4' },
        ],
      })
    );

    onChange.mockClear();
    fireEvent.change(document.getElementById('cbtSrcConfigValue-1') as HTMLInputElement, {
      target: { value: '8' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: [
          { key: 'google.bigtable.rpc.timeout.ms', value: '60000' },
          { key: 'google.bigtable.grpc.channel.count', value: '8' },
        ],
      })
    );

    // Remove 1 of 2 rows -> keeps remaining array
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Remove configuration entry 1' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: [{ key: 'google.bigtable.grpc.channel.count', value: '4' }],
      })
    );

    // Remove only row -> deletes configuration key
    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({
          ...validProps,
          configuration: [{ key: 'google.bigtable.grpc.channel.count', value: '4' }],
        })}
        onChange={onChange}
      />
    );
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Remove configuration entry 1' }));
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('configuration');

    // Row validation rules: missing key, auth key, reserved key, duplicate key, missing value
    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({
          ...validProps,
          configuration: [
            { key: '', value: '100' },
            { key: 'google.bigtable.auth.json.value', value: '{}' },
            { key: 'google.bigtable.project.id', value: 'p' },
            { key: 'google.bigtable.rpc.timeout.ms', value: '1000' },
            { key: 'google.bigtable.rpc.timeout.ms', value: '2000' },
            { key: 'google.bigtable.grpc.channel.count', value: '' },
          ],
        })}
        onChange={onChange}
      />
    );
    const rowAlerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(rowAlerts).toEqual([
      'Key is required',
      'Credential settings are not allowed here. Use the Service Account Key Secret field (or leave empty for Application Default Credentials).',
      'Set this with the dedicated field above',
      'Duplicate key',
      'Value is required',
    ]);
  });

  it('resolves system_instructions fallback chain and emits updates', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CloudBigtableSourceProperties
        node={makeNode(validProps, { system_instructions: 'node-sys' })}
        onChange={onChange}
      />
    );
    const textarea = () => document.getElementById('cbtSourceSystemInstructions') as HTMLTextAreaElement;
    expect(textarea().value).toBe('node-sys');

    rerender(
      <CloudBigtableSourceProperties
        node={makeNode(validProps, { special_instructions: 'node-spec' })}
        onChange={onChange}
      />
    );
    expect(textarea().value).toBe('node-spec');

    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({ ...validProps, system_instructions: 'prop-sys' })}
        onChange={onChange}
      />
    );
    expect(textarea().value).toBe('prop-sys');

    rerender(
      <CloudBigtableSourceProperties
        node={makeNode({ ...validProps, special_instructions: 'prop-spec' })}
        onChange={onChange}
      />
    );
    expect(textarea().value).toBe('prop-spec');

    fireEvent.change(textarea(), { target: { value: 'custom scan instructions' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'custom scan instructions',
      })
    );
  });
});
