
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
    expect(screen.getByText('Batch Sources')).toBeInTheDocument();
    expect(screen.getByText('PubSub')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
  });

  it('renders PubSub Messages in STEPS tab when hasPubSubSource is true', () => {
    render(
      <NodesCard activeTab="STEPS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={true} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('PubSub Messages')).toBeInTheDocument();
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
});
