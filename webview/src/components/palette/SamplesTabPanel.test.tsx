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
      content: '{"nodes":[],"edges":[]}',
    },
    {
      id: 'sample-2',
      title: 'PubSub to BigQuery Streaming',
      filename: 'streaming.beam',
      badge: 'Streaming',
      description: 'Reads JSON events from Pub/Sub and writes to BigQuery.',
      content: '{"nodes":[],"edges":[]}',
    },
  ];

  it('renders all sample cards with their titles, filenames, and descriptions', () => {
    render(<SamplesTabPanel samples={mockSamples} searchQuery="" />);

    expect(screen.getByText('Word Count Batch')).toBeInTheDocument();
    expect(screen.getByText('wordcount.beam')).toBeInTheDocument();
    expect(screen.getByText('PubSub to BigQuery Streaming')).toBeInTheDocument();
    expect(screen.getByText('streaming.beam')).toBeInTheDocument();
    expect(screen.getByText('Batch')).toBeInTheDocument();
    expect(screen.getByText('Streaming')).toBeInTheDocument();
  });

  it('renders empty message when samples list is empty', () => {
    render(<SamplesTabPanel samples={[]} searchQuery="nonexistent" />);

    expect(
      screen.getByText(/No sample pipelines matching "nonexistent"/i)
    ).toBeInTheDocument();
  });

  it('triggers onOpenSample when a card is clicked or activated with keyboard', () => {
    const onOpenSample = vi.fn();
    render(<SamplesTabPanel samples={mockSamples} searchQuery="" onOpenSample={onOpenSample} />);

    const card = screen.getByText('Word Count Batch').closest('[role="button"]')!;
    fireEvent.click(card);
    expect(onOpenSample).toHaveBeenCalledWith(mockSamples[0]);

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onOpenSample).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(card, { key: ' ' });
    expect(onOpenSample).toHaveBeenCalledTimes(3);
  });
});
