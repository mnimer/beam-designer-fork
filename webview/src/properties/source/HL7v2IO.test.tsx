/**
 * Unit tests for HL7v2IOSourceProperties (`webview/src/properties/source/HL7v2IO.tsx`).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HL7v2IOSourceProperties } from './HL7v2IO';

describe('HL7v2IOSourceProperties', () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).vscode = {
      postMessage: mockPostMessage
    };
  });

  it('dispatches getHealthcareDatasets on mount and renders bounded ListHL7v2Messages mode by default', () => {
    const onChange = vi.fn();
    render(
      <HL7v2IOSourceProperties
        node={{
          data: {
            properties: {
              hl7v2Store: 'projects/p/locations/us-central1/datasets/d/hl7V2Stores/s'
            }
          }
        }}
        onChange={onChange}
      />
    );

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getHealthcareDatasets' })
    );
    expect(
      screen.getByDisplayValue('projects/p/locations/us-central1/datasets/d/hl7V2Stores/s')
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Initial Split Duration/i)).toBeInTheDocument();
  });

  it('renders filter input when readWithFilter is selected and pubsubSubscription when getAll is selected', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <HL7v2IOSourceProperties
        node={{
          data: {
            properties: {
              readMode: 'readWithFilter',
              hl7v2Store: 'projects/p/locations/us-central1/datasets/d/hl7V2Stores/s',
              filter: ''
            }
          }
        }}
        onChange={onChange}
      />
    );

    const filterInput = screen.getByLabelText(/Message Filter Expression/i);
    expect(filterInput).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(filterInput, {
      target: { name: 'filter', value: 'messageType = "ADT"' }
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'messageType = "ADT"' })
    );

    rerender(
      <HL7v2IOSourceProperties
        node={{
          data: {
            properties: {
              readMode: 'getAll',
              pubsubSubscription: 'projects/p/subscriptions/hl7-sub'
            }
          }
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByLabelText(/Notification Pub\/Sub Subscription/i)).toHaveValue(
      'projects/p/subscriptions/hl7-sub'
    );
  });

  it('auto-fills hl7v2Store prefix when a discovered healthcareDataset is selected', () => {
    const onChange = vi.fn();
    render(<HL7v2IOSourceProperties node={{ data: { properties: {} } }} onChange={onChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'healthcareDatasetsLoaded',
            datasets: ['projects/med-p/locations/us-central1/datasets/hl7-ds']
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
        value: 'projects/med-p/locations/us-central1/datasets/hl7-ds'
      }
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        healthcareDataset: 'projects/med-p/locations/us-central1/datasets/hl7-ds',
        hl7v2Store: 'projects/med-p/locations/us-central1/datasets/hl7-ds/hl7V2Stores/'
      })
    );
  });
});
