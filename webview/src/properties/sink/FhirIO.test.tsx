/**
 * Unit tests for FhirIOSinkProperties (`webview/src/properties/sink/FhirIO.tsx`).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FhirIOSinkProperties } from './FhirIO';

describe('FhirIOSinkProperties', () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).vscode = {
      postMessage: mockPostMessage
    };
  });

  it('renders EXECUTE_BUNDLE mode by default and dispatches getHealthcareDatasets', () => {
    const onChange = vi.fn();
    render(
      <FhirIOSinkProperties
        node={{
          data: {
            properties: {
              fhirStore: 'projects/p/locations/us-central1/datasets/d/fhirStores/f'
            }
          }
        }}
        onChange={onChange}
      />
    );

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getHealthcareDatasets' })
    );
    expect(screen.getByLabelText(/Write Method/i, { selector: 'select' })).toHaveValue('EXECUTE_BUNDLE');
    expect(screen.queryByLabelText(/GCS Dead-Letter Path/i, { selector: 'input' })).not.toBeInTheDocument();
  });

  it('renders IMPORT fields (gcsTempPath, gcsDeadLetterPath, contentStructure) when writeMethod is IMPORT', () => {
    const onChange = vi.fn();
    render(
      <FhirIOSinkProperties
        node={{
          data: {
            properties: {
              writeMethod: 'IMPORT',
              fhirStore: 'projects/p/locations/us-central1/datasets/d/fhirStores/f',
              gcsTempPath: 'gs://bucket/temp',
              gcsDeadLetterPath: '',
              contentStructure: 'RESOURCE'
            }
          }
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText(/GCS Temporary Staging Path/i, { selector: 'input' })).toHaveValue('gs://bucket/temp');
    const dlqInput = screen.getByLabelText(/GCS Dead-Letter Path/i, { selector: 'input' });
    expect(dlqInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Content Structure/i, { selector: 'select' })).toHaveValue('RESOURCE');

    fireEvent.change(dlqInput, {
      target: { name: 'gcsDeadLetterPath', value: 'gs://bucket/dlq' }
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ gcsDeadLetterPath: 'gs://bucket/dlq' })
    );
  });

  it('surfaces healthcareDatasetsLoaded error message inline', () => {
    const onChange = vi.fn();
    render(<FhirIOSinkProperties node={{ data: { properties: {} } }} onChange={onChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'healthcareDatasetsLoaded',
            datasets: [],
            error: 'Failed to list Healthcare datasets: PERMISSION_DENIED'
          }
        })
      );
    });

    expect(
      screen.getByText('Failed to list Healthcare datasets: PERMISSION_DENIED')
    ).toBeInTheDocument();
  });
});
