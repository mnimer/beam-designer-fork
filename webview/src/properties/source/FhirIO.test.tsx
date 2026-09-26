/**
 * Unit tests for FhirIOSourceProperties (`webview/src/properties/source/FhirIO.tsx`).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FhirIOSourceProperties } from './FhirIO';

describe('FhirIOSourceProperties', () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).vscode = {
      postMessage: mockPostMessage
    };
  });

  it('dispatches getHealthcareDatasets on mount and renders Add PubSubIO Source action in readResources mode by default', () => {
    const onChange = vi.fn();
    const onAddPubSubSource = vi.fn();
    render(
      <FhirIOSourceProperties
        node={{
          id: 'fhir-node-1',
          data: {
            properties: {
              fhirStore: 'projects/p/locations/us-central1/datasets/d/fhirStores/f'
            }
          }
        }}
        onChange={onChange}
        onAddPubSubSource={onAddPubSubSource}
      />
    );

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getHealthcareDatasets' })
    );
    expect(
      screen.getByDisplayValue('projects/p/locations/us-central1/datasets/d/fhirStores/f')
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Notification Pub\/Sub Subscription/i)
    ).not.toBeInTheDocument();

    const addPubSubBtn = screen.getByRole('button', { name: /Add PubSubIO Source/i });
    expect(addPubSubBtn).toBeInTheDocument();
    fireEvent.click(addPubSubBtn);
    expect(onAddPubSubSource).toHaveBeenCalledWith('fhir-node-1');
  });

  it('populates healthcareDatasets datalist when healthcareDatasetsLoaded arrives and auto-fills fhirStore prefix', () => {
    const onChange = vi.fn();
    render(<FhirIOSourceProperties node={{ data: { properties: {} } }} onChange={onChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'healthcareDatasetsLoaded',
            datasets: ['projects/med-p/locations/us-central1/datasets/clinical-ds']
          }
        })
      );
    });

    const datasetInput = screen.getByLabelText(/Cloud Healthcare Dataset/i, {
      selector: 'input'
    });
    fireEvent.change(datasetInput, {
      target: {
        name: 'healthcareDataset',
        value: 'projects/med-p/locations/us-central1/datasets/clinical-ds'
      }
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        healthcareDataset: 'projects/med-p/locations/us-central1/datasets/clinical-ds',
        fhirStore: 'projects/med-p/locations/us-central1/datasets/clinical-ds/fhirStores/'
      })
    );
  });

  it('switches conditional UI branches for searchResources, exportResources, deidentify, and getPatientEverything', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FhirIOSourceProperties
        node={{ data: { properties: { readMode: 'searchResources', fhirStore: '' } } }}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText(/FHIR Resource Type/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Search Key Identifier/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Search Query Parameters/i, { selector: 'textarea' })).toBeInTheDocument();

    rerender(
      <FhirIOSourceProperties
        node={{ data: { properties: { readMode: 'exportResources', fhirStore: '', exportUri: '' } } }}
        onChange={onChange}
      />
    );
    const exportInput = screen.getByLabelText(/Export Destination URI/i, { selector: 'input' });
    expect(exportInput).toHaveAttribute('aria-invalid', 'true');

    rerender(
      <FhirIOSourceProperties
        node={{ data: { properties: { readMode: 'deidentify', destinationFhirStore: '' } } }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Destination FHIR Store/i, { selector: 'input' })).toHaveAttribute('aria-invalid', 'true');

    rerender(
      <FhirIOSourceProperties
        node={{ data: { properties: { readMode: 'getPatientEverything' } } }}
        onChange={onChange}
      />
    );
    expect(screen.queryByText(/PatientEverythingParameter/i)).not.toBeInTheDocument();
    rerender(
      <FhirIOSourceProperties
        node={{
          data: {
            hasValidationError: true,
            properties: { readMode: 'searchResources', fhirStore: '' }
          }
        }}
        onChange={onChange}
      />
    );
    expect(
      screen.getByText(/does not accept an upstream connection/i)
    ).toBeInTheDocument();
  });

  it('updates system_instructions when textarea changes', () => {
    const onChange = vi.fn();
    render(<FhirIOSourceProperties node={{ data: { properties: {} } }} onChange={onChange} />);

    const instructionsInput = screen.getByLabelText(/Code Generation Instructions/i, {
      selector: 'textarea'
    });
    fireEvent.change(instructionsInput, {
      target: { name: 'system_instructions', value: 'Route failed reads to BigQuery DLQ' }
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Route failed reads to BigQuery DLQ'
      })
    );
  });
});
