/**
 * CloudBigtable Sink Properties Unit Tests (IO68)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CloudBigtableSinkProperties } from './CloudBigtable';
import { classifyKey } from '../../../../src/credentialRedaction';

const CLOUD_BIGTABLE_DOCS_URL = 'https://cloud.google.com/bigtable/docs/hbase-dataflow-java';

const CLOUD_BIGTABLE_SINK_PROPERTY_KEYS = [
  'projectId',
  'instanceId',
  'appProfileId',
  'credentialsSecret',
  'writeMode',
  'tableId',
  'bulkMutationFlowControl',
  'configuration',
  'system_instructions',
] as const;

const CLOUD_BIGTABLE_SINK_CONFIG_KEY_OPTIONS: readonly string[] = [
  'google.bigtable.endpoint.host',
  'google.bigtable.endpoint.port',
  'google.bigtable.emulator.endpoint.host',
  'google.bigtable.universe.domain',
  'google.bigtable.custom.user.agent',
  'google.bigtable.grpc.retry.enable',
  'google.bigtable.grpc.retry.codes',
  'google.bigtable.grpc.retry.initial.elapsed.backoff.ms',
  'google.bigtable.grpc.retry.max.elapsed.backoff.ms',
  'google.bigtable.grpc.channel.count',
  'google.bigtable.rpc.timeout.ms',
  'google.bigtable.rpc.attempt.timeout.ms',
  'google.bigtable.enable.client.side.metrics',
  'google.bigtable.bulk.max.request.size.bytes',
  'google.bigtable.bulk.max.row.key.count',
  'google.bigtable.bulk.autoflush.ms',
  'google.bigtable.buffered.mutator.max.inflight.rpcs',
  'google.bigtable.buffered.mutator.max.memory',
  'google.bigtable.buffered.mutator.throttling.enable',
  'google.bigtable.buffered.mutator.throttling.threshold.ms',
  'google.bigtable.mutate.rpc.timeout.ms',
  'google.bigtable.mutate.rpc.attempt.timeout.ms',
  'google.bigtable.alllow.no.timestamp.retries',
];

describe('CloudBigtableSinkProperties (IO68)', () => {
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
    id: 'cbt-snk-1',
    data: {
      label: 'Write Bigtable',
      type: 'SINK',
      beam_transform: 'CloudBigtable',
      ...(properties !== undefined ? { properties } : {}),
      ...extraData,
    },
  });

  const validProps = {
    projectId: 'archive-gcp-project',
    instanceId: 'archive-instance',
    tableId: 'user-events-archive',
  };

  it('classifies every emitted property key as safe or reference (never secret)', () => {
    for (const key of CLOUD_BIGTABLE_SINK_PROPERTY_KEYS) {
      const classification = classifyKey(key);
      expect(['safe', 'reference']).toContain(classification);
      expect(classification).not.toBe('secret');
    }
    expect(classifyKey('credentialsSecret')).toBe('reference');
  });

  it('never renders a password input or plaintext credential control', () => {
    const { container } = render(<CloudBigtableSinkProperties node={makeNode(validProps)} onChange={vi.fn()} />);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('[name="password"]')).toBeNull();
  });

  it('opens the connector documentation via openExternal when Docs ↗ is clicked (and handles missing vscode)', () => {
    render(<CloudBigtableSinkProperties node={makeNode(validProps)} onChange={vi.fn()} />);
    postMessageMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /Docs ↗/i }));
    expect(postMessageMock).toHaveBeenCalledWith({
      command: 'openExternal',
      url: CLOUD_BIGTABLE_DOCS_URL,
    });

    delete vscodeWindow.vscode;
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Docs ↗/i }))).not.toThrow();
  });

  it('renders with undefined properties, defaults writeMode to singleTable, and shows required errors', () => {
    render(<CloudBigtableSinkProperties node={makeNode(undefined)} onChange={vi.fn()} />);

    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('Write Target')).toBeInTheDocument();
    expect(screen.getByText('Write Tuning')).toBeInTheDocument();
    expect(screen.getByText('Advanced Connection Settings')).toBeInTheDocument();

    const writeModeSelect = document.getElementById('cbtSinkWriteMode') as HTMLSelectElement;
    expect(writeModeSelect.value).toBe('singleTable');

    const flowCheckbox = document.getElementById('cbtSinkBulkMutationFlowControl') as HTMLInputElement;
    expect(flowCheckbox.checked).toBe(false);

    const alerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts).toContain('Project ID is required');
    expect(alerts).toContain('Instance ID is required');
    expect(alerts).toContain('Table ID is required');
  });

  it('requests discovery assets on mount and populates datalists on response', () => {
    render(<CloudBigtableSinkProperties node={makeNode(validProps)} onChange={vi.fn()} />);

    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getProjects' });
    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getBigtableInstances' });
    expect(postMessageMock).toHaveBeenCalledWith({ command: 'getSecrets' });
    expect(postMessageMock).toHaveBeenCalledWith({
      command: 'getBigtableTables',
      instance: 'projects/archive-gcp-project/instances/archive-instance',
    });

    dispatchMessage({ command: 'projectsLoaded', projects: ['p-1'] });
    dispatchMessage({ command: 'bigtableInstancesLoaded', bigtableInstances: ['i-1'] });
    dispatchMessage({ command: 'bigtableTablesLoaded', bigtableTables: ['t-1'] });
    dispatchMessage({ command: 'secretsLoaded', secrets: ['s-1'] });

    const optionValues = (id: string) =>
      Array.from(document.querySelectorAll(`#${id} option`)).map((o) => o.getAttribute('value'));

    expect(optionValues('cbtSinkProjectOptions')).toEqual(['p-1']);
    expect(optionValues('cbtSinkInstanceOptions')).toEqual(['i-1']);
    expect(optionValues('cbtSinkTableOptions')).toEqual(['t-1']);
    expect(optionValues('cbtSinkCredentialsSecret-secret-options')).toEqual(['s-1']);
  });

  it('surfaces discovery errors when field validation passes and gives validation errors precedence', () => {
    const { rerender } = render(<CloudBigtableSinkProperties node={makeNode(validProps)} onChange={vi.fn()} />);

    dispatchMessage({ command: 'projectsLoaded', projects: [], error: 'projects err' });
    dispatchMessage({ command: 'bigtableInstancesLoaded', bigtableInstances: [], error: 'instances err' });
    dispatchMessage({ command: 'bigtableTablesLoaded', bigtableTables: [], error: 'tables err' });

    const alerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts).toContain('projects err');
    expect(alerts).toContain('instances err');
    expect(alerts).toContain('tables err');

    rerender(<CloudBigtableSinkProperties node={makeNode({ ...validProps, instanceId: '' })} onChange={vi.fn()} />);
    const updatedAlerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(updatedAlerts).toContain('Instance ID is required');
    expect(updatedAlerts).not.toContain('instances err');
  });

  it('handles tablesInstanceParam short-ID branch and invalid-instance branch', () => {
    postMessageMock.mockClear();
    const { unmount } = render(
      <CloudBigtableSinkProperties
        node={makeNode({ projectId: 'INVALID', instanceId: 'archive-instance', tableId: 't1' })}
        onChange={vi.fn()}
      />
    );
    expect(postMessageMock).toHaveBeenCalledWith({
      command: 'getBigtableTables',
      instance: 'archive-instance',
    });
    unmount();

    postMessageMock.mockClear();
    render(
      <CloudBigtableSinkProperties
        node={makeNode({ projectId: 'archive-gcp-project', instanceId: '1bad', tableId: 't1' })}
        onChange={vi.fn()}
      />
    );
    expect(postMessageMock).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'getBigtableTables' }));
  });

  it('validates format rules for projectId, instanceId, tableId (regex and max length), and appProfileId', () => {
    const { rerender } = render(
      <CloudBigtableSinkProperties
        node={makeNode({
          projectId: 'Bad_Project',
          instanceId: '1bad',
          tableId: '.bad',
          appProfileId: '-bad',
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
      <CloudBigtableSinkProperties
        node={makeNode({
          ...validProps,
          tableId: 't'.repeat(51),
          appProfileId: 'valid_profile',
        })}
        onChange={vi.fn()}
      />
    );
    alerts = screen.getAllByRole('alert').map((el) => el.textContent);
    expect(alerts).toEqual(['Table ID must be at most 50 characters']);
  });

  it('deletes tableId and hides the Table ID input when writeMode switches to multipleTables, and restores on singleTable', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CloudBigtableSinkProperties
        node={makeNode({ ...validProps, writeMode: 'singleTable' })}
        onChange={onChange}
      />
    );

    fireEvent.change(document.getElementById('cbtSinkWriteMode') as HTMLSelectElement, {
      target: { name: 'writeMode', value: 'multipleTables' },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0][0];
    expect(emitted.writeMode).toBe('multipleTables');
    expect(emitted).not.toHaveProperty('tableId');

    postMessageMock.mockClear();
    rerender(<CloudBigtableSinkProperties node={makeNode(emitted)} onChange={onChange} />);
    expect(document.getElementById('cbtSinkTableId')).toBeNull();
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(postMessageMock).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'getBigtableTables' }));

    onChange.mockClear();
    fireEvent.change(document.getElementById('cbtSinkWriteMode') as HTMLSelectElement, {
      target: { name: 'writeMode', value: 'singleTable' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ writeMode: 'singleTable' }));
  });

  it('propagates text, secret, and checkbox changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CloudBigtableSinkProperties node={makeNode(validProps)} onChange={onChange} />);

    const textChanges: Array<[string, string, string]> = [
      ['cbtSinkProjectId', 'projectId', 'proj-2'],
      ['cbtSinkInstanceId', 'instanceId', 'inst-2'],
      ['cbtSinkAppProfileId', 'appProfileId', 'prof-2'],
      ['cbtSinkCredentialsSecret', 'credentialsSecret', 'secret-2'],
      ['cbtSinkTableId', 'tableId', 'table-2'],
    ];

    for (const [id, key, val] of textChanges) {
      onChange.mockClear();
      fireEvent.change(document.getElementById(id) as HTMLInputElement, {
        target: { name: key, value: val },
      });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ [key]: val }));
    }

    onChange.mockClear();
    const checkbox = document.getElementById('cbtSinkBulkMutationFlowControl') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bulkMutationFlowControl: true }));

    rerender(
      <CloudBigtableSinkProperties
        node={makeNode({ ...validProps, bulkMutationFlowControl: true })}
        onChange={onChange}
      />
    );
    expect((document.getElementById('cbtSinkBulkMutationFlowControl') as HTMLInputElement).checked).toBe(true);
    onChange.mockClear();
    fireEvent.click(document.getElementById('cbtSinkBulkMutationFlowControl') as HTMLInputElement);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bulkMutationFlowControl: false }));
  });

  it('manages configuration entries and validates sink-specific reserved keys', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CloudBigtableSinkProperties
        node={makeNode({ ...validProps, configuration: 'not-an-array' })}
        onChange={onChange}
      />
    );

    const datalistOpts = Array.from(document.querySelectorAll('#cbtSnkConfigKeyOptions option')).map((o) =>
      o.getAttribute('value')
    );
    expect(datalistOpts).toEqual([...CLOUD_BIGTABLE_SINK_CONFIG_KEY_OPTIONS]);
    expect(datalistOpts).toContain('google.bigtable.bulk.max.row.key.count');
    expect(datalistOpts).toContain('google.bigtable.alllow.no.timestamp.retries');
    expect(datalistOpts.some((k) => k?.startsWith('google.bigtable.auth.'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Add configuration entry/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: [{ key: '', value: '' }],
      })
    );

    // Edit & remove with 2 rows
    rerender(
      <CloudBigtableSinkProperties
        node={makeNode({
          ...validProps,
          configuration: [
            { key: 'google.bigtable.bulk.max.row.key.count', value: '100' },
            { key: 'google.bigtable.bulk.autoflush.ms', value: '500' },
          ],
        })}
        onChange={onChange}
      />
    );

    onChange.mockClear();
    fireEvent.change(document.getElementById('cbtSnkConfigKey-0') as HTMLInputElement, {
      target: { value: 'google.bigtable.mutate.rpc.timeout.ms' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: [
          { key: 'google.bigtable.mutate.rpc.timeout.ms', value: '100' },
          { key: 'google.bigtable.bulk.autoflush.ms', value: '500' },
        ],
      })
    );

    onChange.mockClear();
    fireEvent.change(document.getElementById('cbtSnkConfigValue-1') as HTMLInputElement, {
      target: { value: '1000' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: [
          { key: 'google.bigtable.bulk.max.row.key.count', value: '100' },
          { key: 'google.bigtable.bulk.autoflush.ms', value: '1000' },
        ],
      })
    );

    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Remove configuration entry 1' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: [{ key: 'google.bigtable.bulk.autoflush.ms', value: '500' }],
      })
    );

    // Remove last row deletes configuration
    rerender(
      <CloudBigtableSinkProperties
        node={makeNode({
          ...validProps,
          configuration: [{ key: 'google.bigtable.bulk.autoflush.ms', value: '500' }],
        })}
        onChange={onChange}
      />
    );
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Remove configuration entry 1' }));
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('configuration');

    // Row validation rules including sink-reserved bulk mutation flow control key
    rerender(
      <CloudBigtableSinkProperties
        node={makeNode({
          ...validProps,
          configuration: [
            { key: '', value: '' },
            { key: '', value: '1' },
            { key: 'google.bigtable.auth.service.account.email', value: 'a@b.c' },
            { key: 'google.bigtable.enable.bulk.mutation.flow.control', value: 'true' },
            { key: 'google.bigtable.bulk.autoflush.ms', value: '100' },
            { key: 'google.bigtable.bulk.autoflush.ms', value: '200' },
            { key: 'google.bigtable.bulk.max.row.key.count', value: '' },
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
      <CloudBigtableSinkProperties
        node={makeNode(validProps, { system_instructions: 'node-sys' })}
        onChange={onChange}
      />
    );
    const textarea = () => document.getElementById('cbtSinkSystemInstructions') as HTMLTextAreaElement;
    expect(textarea().value).toBe('node-sys');

    rerender(
      <CloudBigtableSinkProperties
        node={makeNode(validProps, { special_instructions: 'node-spec' })}
        onChange={onChange}
      />
    );
    expect(textarea().value).toBe('node-spec');

    rerender(
      <CloudBigtableSinkProperties
        node={makeNode({ ...validProps, system_instructions: 'prop-sys' })}
        onChange={onChange}
      />
    );
    expect(textarea().value).toBe('prop-sys');

    rerender(
      <CloudBigtableSinkProperties
        node={makeNode({ ...validProps, special_instructions: 'prop-spec' })}
        onChange={onChange}
      />
    );
    expect(textarea().value).toBe('prop-spec');

    fireEvent.change(textarea(), { target: { value: 'custom write instructions' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'custom write instructions',
      })
    );
  });
});
