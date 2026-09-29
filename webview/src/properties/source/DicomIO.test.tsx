/**
 * Unit tests for DicomIOSourceProperties (`webview/src/properties/source/DicomIO.tsx`).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DicomIOSourceProperties, parseHealthcareDatasetPath } from './DicomIO';

describe('DicomIOSourceProperties', () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).vscode = {
      postMessage: mockPostMessage
    };
  });

  it('parses Cloud Healthcare dataset paths accurately via parseHealthcareDatasetPath', () => {
    expect(
      parseHealthcareDatasetPath('projects/med-proj/locations/us-central1/datasets/rad-ds')
    ).toEqual({
      projectId: 'med-proj',
      region: 'us-central1',
      datasetId: 'rad-ds'
    });
    expect(parseHealthcareDatasetPath('invalid-path')).toBeNull();
  });

  it('dispatches getHealthcareDatasets on mount, renders Add PubSubIO Source in readStudyMetadata mode, and auto-fills projectId/region/datasetId', () => {
    const onChange = vi.fn();
    const onAddPubSubSource = vi.fn();
    render(
      <DicomIOSourceProperties
        node={{ id: 'dicom-node-1', data: { properties: {} } }}
        onChange={onChange}
        onAddPubSubSource={onAddPubSubSource}
      />
    );

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getHealthcareDatasets' })
    );
    expect(
      screen.queryByLabelText(/Notification Pub\/Sub Subscription/i)
    ).not.toBeInTheDocument();

    const addPubSubBtn = screen.getByRole('button', { name: /Add PubSubIO Source/i });
    expect(addPubSubBtn).toBeInTheDocument();
    fireEvent.click(addPubSubBtn);
    expect(onAddPubSubSource).toHaveBeenCalledWith('dicom-node-1');

    const datasetInput = screen.getByLabelText(/Cloud Healthcare Dataset/i, {
      selector: 'input'
    });
    fireEvent.change(datasetInput, {
      target: {
        name: 'healthcareDataset',
        value: 'projects/imaging-p/locations/europe-west4/datasets/dicom-ds'
      }
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        healthcareDataset: 'projects/imaging-p/locations/europe-west4/datasets/dicom-ds',
        projectId: 'imaging-p',
        region: 'europe-west4',
        datasetId: 'dicom-ds'
      })
    );
  });

  it('renders QIDO-RS searchType, params, and invalid upstream error banner when readMode is dicomSearch', () => {
    const onChange = vi.fn();
    render(
      <DicomIOSourceProperties
        node={{
          data: {
            hasValidationError: true,
            properties: {
              readMode: 'dicomSearch',
              projectId: 'p',
              region: 'us-central1',
              datasetId: 'd',
              dicomStoreId: 's',
              searchType: 'series'
            }
          }
        }}
        onChange={onChange}
      />
    );

    const searchTypeSelect = screen.getByLabelText(/QIDO Search Level/i);
    expect(searchTypeSelect).toHaveValue('series');
    expect(screen.getByLabelText(/QIDO Filter Parameters/i)).toBeInTheDocument();
    expect(screen.getByText(/does not accept an upstream connection/i)).toBeInTheDocument();

    fireEvent.change(searchTypeSelect, {
      target: { name: 'searchType', value: 'instances' }
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ searchType: 'instances' })
    );
  });
});
