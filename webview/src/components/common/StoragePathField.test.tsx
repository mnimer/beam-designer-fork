/**
 * StoragePathField Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates the shared Cloud Storage path primitive: label/placeholder/value rendering, required
 * validation, bucket discovery IPC, gs:// datalist projection, change propagation, and — most
 * importantly — the regression guard proving the bucket discovery error is NOT gated on path validity.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react, matching the existing common component suites.
 * - Mocks window.vscode.postMessage and drives responses by dispatching real `message` events inside
 *   act(...), exercising the genuine useAssetLoader/useExtensionMessage code path rather than a stub.
 * - The regression test is named explicitly after the defect it guards so a future edit that
 *   reintroduces the gated error fails with a self-describing message.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StoragePathField } from './StoragePathField';

/**
 * Dispatches a storageBucketsLoaded response from the simulated extension host.
 *
 * @param buckets Bucket names to report.
 * @param error Optional discovery error message.
 */
const emitBucketsLoaded = (buckets: string[], error?: string) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          command: 'storageBucketsLoaded',
          buckets,
          ...(error ? { error } : {})
        }
      })
    );
  });
};

describe('StoragePathField', () => {
  let originalVscode: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
    (window as any).vscode = { postMessage: vi.fn() };
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders the label, placeholder, and current value', () => {
    render(
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern."
        value="gs://my-bucket/data/*.csv"
        onChange={vi.fn()}
        placeholder="gs://bucket/data/*.csv"
      />
    );

    expect(screen.getByText('File Pattern / Path (.from)')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('gs://bucket/data/*.csv') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('gs://my-bucket/data/*.csv');
    expect(input.id).toBe('csvSourceFilePattern');
  });

  it('flags aria-invalid and renders the error message when required and empty', () => {
    const { container } = render(
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern."
        value="   "
        onChange={vi.fn()}
        errorMessage="File Pattern is required."
      />
    );

    const input = container.querySelector('#csvSourceFilePattern') as HTMLInputElement;
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('clears the invalid state and error message once a value is present', () => {
    const { container } = render(
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern."
        value="gs://my-bucket/data/*.csv"
        onChange={vi.fn()}
        errorMessage="File Pattern is required."
      />
    );

    const input = container.querySelector('#csvSourceFilePattern') as HTMLInputElement;
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('never flags invalid when required={false}', () => {
    const { container } = render(
      <StoragePathField
        id="optionalPath"
        name="tempDirectory"
        label="Temp Directory"
        tooltip="Optional staging directory."
        value=""
        onChange={vi.fn()}
        required={false}
        errorMessage="Temp Directory is required."
      />
    );

    const input = container.querySelector('#optionalPath') as HTMLInputElement;
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).toHaveAttribute('aria-required', 'false');
    expect(screen.queryByText('Temp Directory is required.')).not.toBeInTheDocument();
  });

  it('posts getStorageBuckets to the extension host on mount', () => {
    render(
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern."
        value=""
        onChange={vi.fn()}
      />
    );

    expect((window as any).vscode.postMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });
  });

  it('renders gs:// datalist suggestions after a storageBucketsLoaded response', () => {
    const { container } = render(
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern."
        value=""
        onChange={vi.fn()}
      />
    );

    emitBucketsLoaded(['lakehouse-data', 'analytics-raw']);

    const input = container.querySelector('#csvSourceFilePattern') as HTMLInputElement;
    const datalistId = input.getAttribute('data-list') || input.getAttribute('list');
    expect(datalistId).toBeTruthy();

    const datalist = document.getElementById(datalistId!);
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);
    expect(datalist?.children[0]).toHaveAttribute('value', 'gs://lakehouse-data/');
    expect(datalist?.children[1]).toHaveAttribute('value', 'gs://analytics-raw/');
  });

  it('passes through bucket names that already carry the gs:// scheme', () => {
    const { container } = render(
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern."
        value=""
        onChange={vi.fn()}
      />
    );

    emitBucketsLoaded(['gs://archive-records', 'lakehouse-data']);

    const input = container.querySelector('#csvSourceFilePattern') as HTMLInputElement;
    const datalist = document.getElementById((input.getAttribute('data-list') || input.getAttribute('list'))!);
    expect(datalist?.children[0]).toHaveAttribute('value', 'gs://archive-records');
    expect(datalist?.children[1]).toHaveAttribute('value', 'gs://lakehouse-data/');
  });

  it('REGRESSION: shows the bucket discovery error even when the path is valid (error is never gated on path validity)', () => {
    const { container } = render(
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern."
        value="gs://my-bucket/data/*.csv"
        onChange={vi.fn()}
        errorMessage="File Pattern is required."
      />
    );

    // The path is valid, so no validation error is present...
    const input = container.querySelector('#csvSourceFilePattern') as HTMLInputElement;
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // ...but a failed `gcloud storage buckets list` must still warn the user.
    emitBucketsLoaded([], 'Google Cloud API error: 403 Forbidden');

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Failed to load Cloud Storage buckets: Google Cloud API error: 403 Forbidden');
    expect(alert).toHaveClass('text-red-400');
  });

  it('honours a custom bucketErrorPrefix', () => {
    render(
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern."
        value="gs://my-bucket/data/*.csv"
        onChange={vi.fn()}
        bucketErrorPrefix="Cloud Storage discovery error"
      />
    );

    emitBucketsLoaded([], 'Permission denied');

    expect(screen.getByRole('alert')).toHaveTextContent('Cloud Storage discovery error: Permission denied');
  });

  it('renders helper text below the input', () => {
    render(
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern."
        value="gs://my-bucket/data/*.csv"
        onChange={vi.fn()}
        helperText="Target file or glob pattern across Cloud Storage, Amazon S3, HDFS, or local storage."
      />
    );

    expect(
      screen.getByText('Target file or glob pattern across Cloud Storage, Amazon S3, HDFS, or local storage.')
    ).toBeInTheDocument();
  });

  it('fires onChange with the typed value', () => {
    // NOTE: the event target is read inside the handler; the input is controlled, so by the time
    // the assertion runs React has already re-rendered the DOM node back to the `value` prop.
    const seen: { name: string; value: string }[] = [];
    const handleChange = vi.fn((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      seen.push({ name: e.target.name, value: e.target.value });
    });

    render(
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern."
        value=""
        onChange={handleChange}
        placeholder="gs://bucket/data/*.csv"
      />
    );

    fireEvent.change(screen.getByPlaceholderText('gs://bucket/data/*.csv'), {
      target: { name: 'filePattern', value: 's3://ml-bucket/train.csv' }
    });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(seen[0]).toEqual({ name: 'filePattern', value: 's3://ml-bucket/train.csv' });
  });
});
