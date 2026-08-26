
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NodesCard } from './NodesCard';

describe('NodesCard', () => {
  const mockOnDragStart = vi.fn();
  const mockOnAddNode = vi.fn();

  it('renders tabs and disables STEPS and SINKS when nodesCount is 0', () => {
    render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={vi.fn()}
        nodesCount={0}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        onAddNode={mockOnAddNode}
      />
    );

    expect(screen.getByText('SOURCES')).toBeInTheDocument();
    const stepsTab = screen.getByLabelText('Steps Tab');
    const sinksTab = screen.getByLabelText('Sinks Tab');

    expect(stepsTab).toBeDisabled();
    expect(sinksTab).toBeDisabled();
  });

  it('enables STEPS and SINKS when nodesCount > 0', () => {
    render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={vi.fn()}
        nodesCount={1}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        onAddNode={mockOnAddNode}
      />
    );

    const stepsTab = screen.getByLabelText('Steps Tab');
    const sinksTab = screen.getByLabelText('Sinks Tab');

    expect(stepsTab).not.toBeDisabled();
    expect(sinksTab).not.toBeDisabled();
  });

  it('calls setActiveTab when clicking enabled tab', () => {
    const mockSetActiveTab = vi.fn();
    render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={mockSetActiveTab}
        nodesCount={1}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        onAddNode={mockOnAddNode}
      />
    );

    fireEvent.click(screen.getByLabelText('Steps Tab'));
    expect(mockSetActiveTab).toHaveBeenCalledWith('STEPS');
  });

  it('toggles panel open/closed when close button is clicked', () => {
    const mockOnToggleOpen = vi.fn();
    render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={vi.fn()}
        nodesCount={0}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        onAddNode={mockOnAddNode}
        isOpen={true}
        onToggleOpen={mockOnToggleOpen}
      />
    );

    const closeButton = screen.getByRole('button', { name: /Close panel/i });
    fireEvent.click(closeButton);

    expect(mockOnToggleOpen).toHaveBeenCalledWith(false);
  });

  it('filters components using search input', () => {
    render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={vi.fn()}
        nodesCount={0}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        onAddNode={mockOnAddNode}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search sources...');
    fireEvent.change(searchInput, { target: { value: 'Kafka' } });

    expect(screen.getByText('Kafka')).toBeInTheDocument();
    expect(screen.queryByText('BigQuery')).not.toBeInTheDocument();
  });

  it('renders sources items when activeTab is SOURCES', () => {
    render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={vi.fn()}
        nodesCount={0}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        onAddNode={mockOnAddNode}
      />
    );

    expect(screen.getByText(/SOURCES \(/i)).toBeInTheDocument();
    expect(screen.getByText('Streaming Sources')).toBeInTheDocument();
    expect(screen.getByText('Database Sources')).toBeInTheDocument();
    expect(screen.getByText('File Sources')).toBeInTheDocument();
    expect(screen.getByText('Kafka')).toBeInTheDocument();
    expect(screen.getByText('PubSub')).toBeInTheDocument();
    expect(screen.getByText('Generate Sequence')).toBeInTheDocument();
    expect(screen.getByText('Periodic Impulse')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
    expect(screen.getByText('JdbcIO')).toBeInTheDocument();
    expect(screen.getByText('FileIO')).toBeInTheDocument();
    expect(screen.getByText('TextIO')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('renders STEPS categories and items', () => {
    render(
      <NodesCard
        activeTab="STEPS"
        setActiveTab={vi.fn()}
        nodesCount={1}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        onAddNode={mockOnAddNode}
      />
    );

    expect(screen.getByText(/STEPS & TRANSFORMS \(/i)).toBeInTheDocument();
    expect(screen.getByText('Core Transforms')).toBeInTheDocument();
    expect(screen.getByText('Message Parsers')).toBeInTheDocument();
    expect(screen.getByText('Element Transforms')).toBeInTheDocument();
    expect(screen.getByText('Aggregations')).toBeInTheDocument();
    expect(screen.getByText('Windows')).toBeInTheDocument();

    expect(screen.getByText('ParDo')).toBeInTheDocument();
    expect(screen.getByText('Parse Message')).toBeInTheDocument();
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Window')).toBeInTheDocument();
    expect(screen.getByText('Flatten')).toBeInTheDocument();
    expect(screen.getByText('ReShuffle')).toBeInTheDocument();
  });

  it('renders SINKS categories and items', () => {
    render(
      <NodesCard
        activeTab="SINKS"
        setActiveTab={vi.fn()}
        nodesCount={1}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        onAddNode={mockOnAddNode}
      />
    );

    expect(screen.getByText(/SINKS \(/i)).toBeInTheDocument();
    expect(screen.getByText('Streaming Sinks')).toBeInTheDocument();
    expect(screen.getByText('Database Sinks')).toBeInTheDocument();
    expect(screen.getByText('File Sinks')).toBeInTheDocument();
    expect(screen.getByText('Logging Sinks')).toBeInTheDocument();

    expect(screen.getByText('Kafka')).toBeInTheDocument();
    expect(screen.getByText('PubSub')).toBeInTheDocument();
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
    expect(screen.getByText('JdbcIO')).toBeInTheDocument();
    expect(screen.getByText('FileIO')).toBeInTheDocument();
    expect(screen.getByText('TextIO')).toBeInTheDocument();
    expect(screen.getByText('Log Message')).toBeInTheDocument();
  });

  it('applies green theme highlight to SOURCES tab when active', () => {
    render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={vi.fn()}
        nodesCount={0}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        isOpen={true}
      />
    );

    const sourcesTab = screen.getByLabelText('Sources Tab');
    expect(sourcesTab).toHaveClass('border-emerald-500/90');
    expect(sourcesTab).toHaveClass('text-emerald-400');
  });

  it('applies blue theme highlight to STEPS tab when active', () => {
    render(
      <NodesCard
        activeTab="STEPS"
        setActiveTab={vi.fn()}
        nodesCount={1}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        isOpen={true}
      />
    );

    const stepsTab = screen.getByLabelText('Steps Tab');
    expect(stepsTab).toHaveClass('border-blue-500/90');
    expect(stepsTab).toHaveClass('text-blue-400');
  });

  it('applies red theme highlight to SINKS tab when active', () => {
    render(
      <NodesCard
        activeTab="SINKS"
        setActiveTab={vi.fn()}
        nodesCount={1}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        isOpen={true}
      />
    );

    const sinksTab = screen.getByLabelText('Sinks Tab');
    expect(sinksTab).toHaveClass('border-rose-500/90');
    expect(sinksTab).toHaveClass('text-rose-400');
  });

  it('renders category groups closed by default and expands on search', () => {
    const { container } = render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={vi.fn()}
        nodesCount={0}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        isOpen={true}
      />
    );

    // Verify all details elements are not open by default
    const detailsElements = container.querySelectorAll('details');
    expect(detailsElements.length).toBeGreaterThan(0);
    detailsElements.forEach(details => {
      expect(details.hasAttribute('open')).toBe(false);
    });

    // Enter search query
    const searchInput = screen.getByPlaceholderText('Search sources...');
    fireEvent.change(searchInput, { target: { value: 'Kafka' } });

    // Details element containing search result should now have open attribute
    const openDetailsElements = container.querySelectorAll('details[open]');
    expect(openDetailsElements.length).toBeGreaterThan(0);
  });

  it('renders menu container with top padding and zero gap to panel', () => {
    const { container } = render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={vi.fn()}
        nodesCount={0}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        isOpen={true}
      />
    );

    // Outer wrapper has left-3 top-3
    const outerContainer = container.firstElementChild;
    expect(outerContainer).toHaveClass('left-3');
    expect(outerContainer).toHaveClass('top-3');

    // Panel has ml-0
    const panel = outerContainer?.children[1];
    expect(panel).toHaveClass('ml-0');
  });
});

