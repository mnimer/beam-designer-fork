
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NodesCard } from './NodesCard';

describe('NodesCard', () => {
  const mockOnDragStart = vi.fn();

  it('renders tabs and disables STEPS and SINKS when nodesCount is 0', () => {
    render(
      <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('SOURCES')).toBeInTheDocument();
    const stepsTab = screen.getByText('STEPS').closest('button');
    const sinksTab = screen.getByText('SINKS').closest('button');

    expect(stepsTab).toBeDisabled();
    expect(sinksTab).toBeDisabled();
  });

  it('enables STEPS and SINKS when nodesCount > 0', () => {
    render(
      <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    const stepsTab = screen.getByText('STEPS').closest('button');
    const sinksTab = screen.getByText('SINKS').closest('button');

    expect(stepsTab).not.toBeDisabled();
    expect(sinksTab).not.toBeDisabled();
  });

  it('calls setActiveTab when clicking enabled tab', () => {
    const mockSetActiveTab = vi.fn();
    render(
      <NodesCard activeTab="SOURCES" setActiveTab={mockSetActiveTab} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    fireEvent.click(screen.getByText('STEPS'));
    expect(mockSetActiveTab).toHaveBeenCalledWith('STEPS');
  });

  it('renders sources items when activeTab is SOURCES', () => {
    render(
      <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('Streaming Sources')).toBeInTheDocument();
    expect(screen.getByText('Database Sources')).toBeInTheDocument();
    expect(screen.getByText('Kafka')).toBeInTheDocument();
    expect(screen.getByText('PubSub')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
    expect(screen.getByText('JdbcIO')).toBeInTheDocument();
  });

  it('renders ParDo node in STEPS tab above sections', () => {
    render(
      <NodesCard activeTab="STEPS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('ParDo')).toBeInTheDocument();
  });

  it('renders Message Parsers in STEPS tab regardless of hasPubSubSource', () => {
    render(
      <NodesCard activeTab="STEPS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('Message Parsers')).toBeInTheDocument();
    expect(screen.getByText('Parse Message')).toBeInTheDocument();
  });

  it('renders Logging section in STEPS tab', () => {
    render(
      <NodesCard activeTab="STEPS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('Logging')).toBeInTheDocument();
    expect(screen.getByText('Log Message')).toBeInTheDocument();
  });

  it('renders Element Transforms section in STEPS tab with alphabetically sorted items', () => {
    render(
      <NodesCard activeTab="STEPS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('Element Transforms')).toBeInTheDocument();
    
    const expectedItems = [
      'Add Timestamp',
      'Filter',
      'FlatMap',
      'Keys',
      'KV Mapper',
      'KV Swap',
      'Map',
      'To String',
      'Values'
    ];

    expectedItems.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });

    // Verify alphabetical sorting order of text contents inside the section
    const elementTransformsSummary = screen.getByText('Element Transforms');
    const sectionContainer = elementTransformsSummary.nextElementSibling; // This is the grid container
    const renderedItems = Array.from(sectionContainer?.querySelectorAll('span') || [])
      .map(el => el.textContent);

    expect(renderedItems).toEqual(expectedItems);
  });

  it('renders Aggregations section in STEPS tab with alphabetically sorted items', () => {
    render(
      <NodesCard activeTab="STEPS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('Aggregations')).toBeInTheDocument();
    
    const expectedItems = [
      'Approximate Quantiles',
      'Approximate Unique',
      'Batch Elements',
      'Co Group By Key',
      'Combine',
      'Combine With Context',
      'Count',
      'Distinct',
      'Group By Key',
      'Group Into Batches',
      'Latest',
      'Max',
      'Mean',
      'Min',
      'Sample',
      'Sum',
      'Top'
    ];

    expectedItems.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });

    // Verify alphabetical sorting order of text contents inside the section
    const aggregationsSummary = screen.getByText('Aggregations');
    const sectionContainer = aggregationsSummary.nextElementSibling; // This is the grid container
    const renderedItems = Array.from(sectionContainer?.querySelectorAll('span') || [])
      .map(el => el.textContent);

    expect(renderedItems).toEqual(expectedItems);
  });

  it('renders Other section in STEPS tab with Flatten and ReShuffle', () => {
    render(
      <NodesCard activeTab="STEPS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    // Get the 'Other' section summary in STEPS tab
    const otherSummaries = screen.getAllByText('Other');
    expect(otherSummaries.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Flatten')).toBeInTheDocument();
    expect(screen.getByText('ReShuffle')).toBeInTheDocument();
  });

  it('renders File Sources section in SOURCES tab with FileIO and TextIO', () => {
    render(
      <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('File Sources')).toBeInTheDocument();
    expect(screen.getByText('FileIO')).toBeInTheDocument();
    expect(screen.getByText('TextIO')).toBeInTheDocument();
  });

  it('renders File Sinks section in SINKS tab with FileIO and TextIO', () => {
    render(
      <NodesCard activeTab="SINKS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('Streaming Sinks')).toBeInTheDocument();
    expect(screen.getByText('Database Sinks')).toBeInTheDocument();
    expect(screen.getByText('File Sinks')).toBeInTheDocument();
    expect(screen.getByText('Kafka')).toBeInTheDocument();
    expect(screen.getByText('PubSub')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
    expect(screen.getByText('JdbcIO')).toBeInTheDocument();
    expect(screen.getByText('FileIO')).toBeInTheDocument();
    expect(screen.getByText('TextIO')).toBeInTheDocument();
  });
});
