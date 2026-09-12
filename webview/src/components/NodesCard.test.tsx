/**
 * Unit Tests for NodesCard Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates the vertical palette navigation, step/sink enablement based on node count,
 * search filtering, category rendering, theming classes, and VS Code state persistence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NodesCard } from './NodesCard';

describe('NodesCard', () => {
  const mockOnDragStart = vi.fn();
  const mockOnAddNode = vi.fn();

  it('renders vertical menu tabs and disables STEPS and SINKS when nodesCount is 0', () => {
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
    const sourcesTab = screen.getByLabelText('Sources Tab');
    const stepsTab = screen.getByLabelText('Steps Tab');
    const sinksTab = screen.getByLabelText('Sinks Tab');

    expect(sourcesTab).toBeInTheDocument();
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

  it('toggles tab to null when clicking already active tab', () => {
    const mockSetActiveTab = vi.fn();
    render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={mockSetActiveTab}
        nodesCount={1}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
      />
    );

    fireEvent.click(screen.getByLabelText('Sources Tab'));
    expect(mockSetActiveTab).toHaveBeenCalledWith(null);
  });

  it('toggles panel open/closed when close button is clicked', () => {
    const mockOnToggleOpen = vi.fn();
    const mockSetActiveTab = vi.fn();
    render(
      <NodesCard
        activeTab="SOURCES"
        setActiveTab={mockSetActiveTab}
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
    expect(mockSetActiveTab).toHaveBeenCalledWith(null);
  });

  it('does not render panel when activeTab is null', () => {
    render(
      <NodesCard
        activeTab={null}
        setActiveTab={vi.fn()}
        nodesCount={1}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
      />
    );

    expect(screen.queryByRole('button', { name: /Close panel/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Streaming Sources')).not.toBeInTheDocument();
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
    expect(screen.getByText('MQTT')).toBeInTheDocument();
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
    expect(screen.getByText('MQTT')).toBeInTheDocument();
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

  it('renders SAMPLES tab as enabled even when nodesCount is 0', () => {
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

    const samplesTab = screen.getByLabelText('Samples Tab');
    expect(samplesTab).toBeInTheDocument();
    expect(samplesTab).not.toBeDisabled();
    expect(screen.getByText('SAMPLES')).toBeInTheDocument();
  });

  it('applies yellow/amber theme highlight to SAMPLES tab when active', () => {
    render(
      <NodesCard
        activeTab="SAMPLES"
        setActiveTab={vi.fn()}
        nodesCount={0}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        isOpen={true}
      />
    );

    const samplesTab = screen.getByLabelText('Samples Tab');
    expect(samplesTab).toHaveClass('border-amber-500/90');
    expect(samplesTab).toHaveClass('text-amber-400');
  });

  it('renders sample items when activeTab is SAMPLES and handles click & keypress', () => {
    const mockOnOpenSample = vi.fn();
    const customSamples = [
      {
        id: 'sample-1',
        filename: 'custom-sample.beam',
        title: 'Custom Sample Title',
        description: 'Test custom sample description',
        badge: 'Java',
        content: 'content: test'
      }
    ];

    render(
      <NodesCard
        activeTab="SAMPLES"
        setActiveTab={vi.fn()}
        nodesCount={0}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        onAddNode={mockOnAddNode}
        samples={customSamples}
        onOpenSample={mockOnOpenSample}
      />
    );

    expect(screen.getByText(/SAMPLES \(/i)).toBeInTheDocument();
    expect(screen.getByText('Custom Sample Title')).toBeInTheDocument();
    expect(screen.getByText('custom-sample.beam')).toBeInTheDocument();
    expect(screen.getByText('Test custom sample description')).toBeInTheDocument();
    expect(screen.getByText('Java')).toBeInTheDocument();

    // Click sample
    fireEvent.click(screen.getByText('Custom Sample Title'));
    expect(mockOnOpenSample).toHaveBeenCalledWith(customSamples[0]);

    // Keydown Enter on sample
    const sampleCard = screen.getByTitle('Click to open Custom Sample Title (custom-sample.beam) as a new file tab');
    fireEvent.keyDown(sampleCard, { key: 'Enter' });
    expect(mockOnOpenSample).toHaveBeenCalledTimes(2);
  });

  it('filters sample items using search input in SAMPLES tab', () => {
    const customSamples = [
      {
        id: 'sample-1',
        filename: 'generate-mock.beam',
        title: 'Generate Mock Data',
        description: 'Generates test records',
        badge: 'Java',
        content: ''
      },
      {
        id: 'sample-2',
        filename: 'pubsub-to-bigquery.beam',
        title: 'PubSub to BigQuery',
        description: 'Streams data to BQ',
        badge: 'Python',
        content: ''
      }
    ];

    render(
      <NodesCard
        activeTab="SAMPLES"
        setActiveTab={vi.fn()}
        nodesCount={0}
        hasPubSubSource={false}
        onDragStart={mockOnDragStart}
        onAddNode={mockOnAddNode}
        samples={customSamples}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search samples...');
    fireEvent.change(searchInput, { target: { value: 'BigQuery' } });

    expect(screen.getByText('PubSub to BigQuery')).toBeInTheDocument();
    expect(screen.queryByText('Generate Mock Data')).not.toBeInTheDocument();
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

    const outerContainer = container.firstElementChild;
    expect(outerContainer).toHaveClass('left-3');
    expect(outerContainer).toHaveClass('top-3');
  });

  describe('VS Code State & Group Persistence', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      const localStorageMock = {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value.toString();
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: vi.fn(() => {
          mockStorage = {};
        }),
      };
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
        configurable: true,
      });
      delete (window as any).vscode;
    });

    it('persists group state changes to vscode.setState when available', () => {
      const mockSetState = vi.fn();
      const mockGetState = vi.fn().mockReturnValue({ customProp: 'hello' });
      (window as any).vscode = {
        getState: mockGetState,
        setState: mockSetState,
      };

      const { container } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} hasPubSubSource={false} onDragStart={mockOnDragStart} />
      );

      const streamingDetails = container.querySelector('details');
      expect(streamingDetails).toBeInTheDocument();

      // Trigger toggle event
      if (streamingDetails) {
        streamingDetails.open = false;
        fireEvent(streamingDetails, new Event('toggle'));
      }

      expect(mockSetState).toHaveBeenCalledWith(
        expect.objectContaining({
          customProp: 'hello',
          nodePaletteGroups: expect.objectContaining({
            sources_streaming_sources: false,
          }),
        })
      );
    });

    it('persists group state changes to localStorage', () => {
      const { container } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} hasPubSubSource={false} onDragStart={mockOnDragStart} />
      );

      const streamingDetails = container.querySelector('details');
      if (streamingDetails) {
        streamingDetails.open = false;
        fireEvent(streamingDetails, new Event('toggle'));
      }

      const stored = localStorage.getItem('beam_node_groups_state');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.sources_streaming_sources).toBe(false);
    });

    it('restores group state from vscode.getState when opening', () => {
      (window as any).vscode = {
        getState: () => ({
          nodePaletteGroups: {
            sources_streaming_sources: false,
            sources_database_sources: true,
          },
        }),
        setState: vi.fn(),
      };

      const { container } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} hasPubSubSource={false} onDragStart={mockOnDragStart} />
      );

      const detailsList = container.querySelectorAll('details');
      // sources_streaming_sources is first details
      expect(detailsList[0].open).toBe(false);
      // sources_database_sources is second details
      expect(detailsList[1].open).toBe(true);
    });

    it('renders Kinesis in Streaming Sources and Streaming Sinks tabs', () => {
      const { rerender } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      expect(screen.getByText('Kinesis')).toBeInTheDocument();
      expect(screen.getByText('Streaming Sources')).toBeInTheDocument();

      rerender(
        <NodesCard activeTab="SINKS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      expect(screen.getByText('Kinesis')).toBeInTheDocument();
      expect(screen.getByText('Streaming Sinks')).toBeInTheDocument();
    });

    it('renders AvroIO in SOURCES under File Sources and in SINKS under File Sinks', () => {
      const { rerender } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} hasPubSubSource={false} onDragStart={mockOnDragStart} />
      );

      expect(screen.getByText('AvroIO')).toBeInTheDocument();
      expect(screen.getByText('Read records from Avro files')).toBeInTheDocument();

      rerender(
        <NodesCard activeTab="SINKS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
      );

      expect(screen.getByText('AvroIO')).toBeInTheDocument();
      expect(screen.getByText('Write records to Avro files')).toBeInTheDocument();
    });

    it('collapses other groups when a user opens/expands a group in a panel', () => {
      const { container } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} hasPubSubSource={false} onDragStart={mockOnDragStart} />
      );

      const detailsList = container.querySelectorAll('details');
      expect(detailsList.length).toBeGreaterThan(1);

      // By default, the first group (Streaming Sources) is open, second (Database Sources) is closed
      expect(detailsList[0].open).toBe(true);
      expect(detailsList[1].open).toBe(false);

      // Expand the second group (Database Sources)
      detailsList[1].open = true;
      fireEvent(detailsList[1], new Event('toggle'));

      // The second group should now be open, and the first group must be collapsed
      expect(detailsList[1].open).toBe(true);
      expect(detailsList[0].open).toBe(false);
    });
  });
});

