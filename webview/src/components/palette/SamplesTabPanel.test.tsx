/** @fileoverview Unit tests for SamplesTabPanel component.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SamplesTabPanel } from './SamplesTabPanel';
import type { SamplePipeline } from '../../catalog/samples';

describe('SamplesTabPanel', () => {
  const mockSamples: SamplePipeline[] = [
    {
      id: 'sample-1',
      title: 'Word Count Batch',
      filename: 'wordcount.beam',
      badge: 'Batch',
      description: 'Classic Apache Beam word count batch pipeline example.',
      nodesCount: 5,
      readmeContent: '# Word Count Batch\n\n## Overview\nCounts word frequencies from input text.\n\n## Pipeline Architecture & Data Flow\nReads lines, splits words, counts occurrences.\n\n## Pipeline Nodes & Transforms\nDuplicate table.',
      content: '{"nodes":[],"edges":[]}',
    },
    {
      id: 'sample-2',
      title: 'PubSub to BigQuery Streaming',
      filename: 'streaming.beam',
      badge: 'Streaming',
      description: 'Reads JSON events from Pub/Sub and writes to BigQuery.',
      nodesCount: 4,
      content: '{"nodes":[],"edges":[]}',
    },
  ];

  it('renders all sample cards with their titles, filenames, descriptions, Info and New File buttons', () => {
    render(<SamplesTabPanel samples={mockSamples} searchQuery="" />);

    expect(screen.getByText('Word Count Batch')).toBeInTheDocument();
    expect(screen.getByText('wordcount.beam')).toBeInTheDocument();
    expect(screen.getByText('PubSub to BigQuery Streaming')).toBeInTheDocument();
    expect(screen.getByText('streaming.beam')).toBeInTheDocument();
    expect(screen.getByText('5 nodes')).toBeInTheDocument();
    expect(screen.getByText('4 nodes')).toBeInTheDocument();
    expect(screen.getByTestId('sample-info-btn-sample-1')).toBeInTheDocument();
    expect(screen.getByTestId('sample-new-file-btn-sample-1')).toBeInTheDocument();
    expect(screen.getByTestId('sample-info-btn-sample-2')).toBeInTheDocument();
    expect(screen.getByTestId('sample-new-file-btn-sample-2')).toBeInTheDocument();
    expect(screen.queryByText('Open sample')).not.toBeInTheDocument();
  });

  it('renders empty message when samples list is empty', () => {
    render(<SamplesTabPanel samples={[]} searchQuery="nonexistent" />);

    expect(
      screen.getByText(/No sample pipelines matching "nonexistent"/i)
    ).toBeInTheDocument();
  });

  it('triggers onOpenSample when New File button is clicked', () => {
    const onOpenSample = vi.fn();
    render(<SamplesTabPanel samples={mockSamples} searchQuery="" onOpenSample={onOpenSample} />);

    fireEvent.click(screen.getByTestId('sample-new-file-btn-sample-1'));
    expect(onOpenSample).toHaveBeenCalledWith(mockSamples[0]);
  });

  it('opens the SampleInfoModal README dialog when Info button is clicked, keeps Pipeline Architecture & Data Flow, omits Pipeline Nodes & Transforms, and closes it', () => {
    const onOpenSample = vi.fn();
    render(<SamplesTabPanel samples={mockSamples} searchQuery="" onOpenSample={onOpenSample} />);

    fireEvent.click(screen.getByTestId('sample-info-btn-sample-1'));

    expect(screen.getByTestId('sample-info-modal')).toBeInTheDocument();
    expect(screen.getByText('Counts word frequencies from input text.')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Architecture & Data Flow')).toBeInTheDocument();
    expect(screen.queryByText('Pipeline Nodes & Transforms')).not.toBeInTheDocument();
    expect(onOpenSample).not.toHaveBeenCalled();

    // Clicking "New File" inside the Info modal triggers onOpenSample and closes modal
    fireEvent.click(screen.getByTestId('sample-info-modal-new-file'));
    expect(onOpenSample).toHaveBeenCalledWith(mockSamples[0]);
    expect(screen.queryByTestId('sample-info-modal')).not.toBeInTheDocument();
  });
});
