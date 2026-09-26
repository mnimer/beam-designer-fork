/**
 * Unit tests for HL7v2IOSinkProperties (`webview/src/properties/sink/HL7v2IO.tsx`).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HL7v2IOSinkProperties } from './HL7v2IO';

describe('HL7v2IOSinkProperties', () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).vscode = {
      postMessage: mockPostMessage
    };
  });

  it('dispatches getHealthcareDatasets and exposes ONLY INGEST (never BATCH_IMPORT per Javadoc)', () => {
    const onChange = vi.fn();
    render(
      <HL7v2IOSinkProperties
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

    const writeMethodSelect = screen.getByLabelText(/Write Method/i) as HTMLSelectElement;
    expect(writeMethodSelect).toHaveValue('INGEST');
    const optionValues = Array.from(writeMethodSelect.options).map((o) => o.value);
    expect(optionValues).toEqual(['INGEST']);
    expect(optionValues).not.toContain('BATCH_IMPORT');
  });

  it('marks hl7v2Store invalid when empty and emits updated hl7v2Store and writeMethod INGEST on change', () => {
    const onChange = vi.fn();
    render(<HL7v2IOSinkProperties node={{ data: { properties: { hl7v2Store: '' } } }} onChange={onChange} />);

    const storeInput = screen.getByLabelText(/Target HL7v2 Store Resource Name/i);
    expect(storeInput).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(storeInput, {
      target: {
        name: 'hl7v2Store',
        value: 'projects/p/locations/us-central1/datasets/d/hl7V2Stores/new-store'
      }
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        hl7v2Store: 'projects/p/locations/us-central1/datasets/d/hl7V2Stores/new-store',
        writeMethod: 'INGEST'
      })
    );
  });
});
