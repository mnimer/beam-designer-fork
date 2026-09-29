/**
 * Unit tests for DicomIOSinkProperties (`webview/src/properties/sink/DicomIO.tsx`).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DicomIOSinkProperties } from './DicomIO';

describe('DicomIOSinkProperties', () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).vscode = {
      postMessage: mockPostMessage
    };
  });

  it('dispatches getHealthcareDatasets and renders UploadToDicomStore destination_dict and input_type fields', () => {
    const onChange = vi.fn();
    render(
      <DicomIOSinkProperties
        node={{
          data: {
            properties: {
              projectId: 'med-p',
              region: 'us-central1',
              datasetId: 'imaging-ds',
              dicomStoreId: 'ct-store',
              inputType: 'bytes'
            }
          }
        }}
        onChange={onChange}
      />
    );

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getHealthcareDatasets' })
    );

    const inputTypeSelect = screen.getByLabelText(/Input Payload Type/i) as HTMLSelectElement;
    expect(inputTypeSelect).toHaveValue('bytes');
    const optionValues = Array.from(inputTypeSelect.options).map((o) => o.value);
    expect(optionValues).toEqual(['bytes', 'fileio']);

    fireEvent.change(inputTypeSelect, {
      target: { name: 'inputType', value: 'fileio' }
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ inputType: 'fileio' }));
  });

  it('auto-fills destination_dict projectId, region, and datasetId when a healthcareDataset is selected', () => {
    const onChange = vi.fn();
    render(<DicomIOSinkProperties node={{ data: { properties: {} } }} onChange={onChange} />);

    const datasetInput = screen.getByLabelText(/Cloud Healthcare Dataset/i, {
      selector: 'input'
    });
    fireEvent.change(datasetInput, {
      target: {
        name: 'healthcareDataset',
        value: 'projects/rad-proj/locations/us-east4/datasets/rad-dataset'
      }
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        healthcareDataset: 'projects/rad-proj/locations/us-east4/datasets/rad-dataset',
        projectId: 'rad-proj',
        region: 'us-east4',
        datasetId: 'rad-dataset'
      })
    );
  });
});
