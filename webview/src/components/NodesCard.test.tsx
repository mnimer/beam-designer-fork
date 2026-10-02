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
    expect(screen.getByText('JMS')).toBeInTheDocument();
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
    expect(screen.getByText('JMS')).toBeInTheDocument();
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

    it('renders AvroIO, TikaIO, and Iceberg in SOURCES under File Sources and in SINKS under File Sinks', () => {
      const { rerender } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} hasPubSubSource={false} onDragStart={mockOnDragStart} />
      );

      expect(screen.getByText('AvroIO')).toBeInTheDocument();
      expect(screen.getByText('TikaIO')).toBeInTheDocument();
      expect(screen.getAllByText('Iceberg').length).toBeGreaterThan(0);
      expect(screen.getByText('Read records from Avro files')).toBeInTheDocument();
      expect(screen.getByText('File Sources')).toBeInTheDocument();

      rerender(
        <NodesCard activeTab="SINKS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} />
      );

      expect(screen.getByText('AvroIO')).toBeInTheDocument();
      expect(screen.getByText('TikaIO')).toBeInTheDocument();
      expect(screen.getAllByText('Iceberg').length).toBeGreaterThan(0);
      expect(screen.getByText('Write records to Avro files')).toBeInTheDocument();
      expect(screen.getByText('File Sinks')).toBeInTheDocument();
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

    it('constrains tab panels to 90% height with a scrollable container inside', () => {
      const { container, rerender } = render(
        <NodesCard
          activeTab="SOURCES"
          setActiveTab={vi.fn()}
          nodesCount={1}
          hasPubSubSource={false}
          onDragStart={mockOnDragStart}
          isOpen={true}
        />
      );

      const outerContainer = container.firstElementChild as HTMLElement;
      expect(outerContainer).toHaveClass('h-full');

      const slideOutPanel = outerContainer.children[1] as HTMLElement;
      expect(slideOutPanel).toHaveClass('h-[90%]');
      expect(slideOutPanel).toHaveClass('max-h-[90%]');
      expect(slideOutPanel).toHaveClass('overflow-hidden');

      const scrollContainer = slideOutPanel.children[2] as HTMLElement;
      expect(scrollContainer).toHaveClass('flex-1');
      expect(scrollContainer).toHaveClass('min-h-0');
      expect(scrollContainer).toHaveClass('overflow-y-auto');

      rerender(
        <NodesCard
          activeTab="SAMPLES"
          setActiveTab={vi.fn()}
          nodesCount={1}
          hasPubSubSource={false}
          onDragStart={mockOnDragStart}
          isOpen={true}
        />
      );

      const samplesSlideOutPanel = outerContainer.children[1] as HTMLElement;
      expect(samplesSlideOutPanel).toHaveClass('h-[90%]');
      expect(samplesSlideOutPanel).toHaveClass('max-h-[90%]');

      const samplesScrollContainer = samplesSlideOutPanel.children[2] as HTMLElement;
      expect(samplesScrollContainer).toHaveClass('flex-1');
      expect(samplesScrollContainer).toHaveClass('min-h-0');
      expect(samplesScrollContainer).toHaveClass('overflow-y-auto');
    });

    it('sorts items in each category list alphabetically across SOURCES, STEPS, and SINKS', () => {
      const { container, rerender } = render(
        <NodesCard
          activeTab="SOURCES"
          setActiveTab={vi.fn()}
          nodesCount={1}
          hasPubSubSource={false}
          onDragStart={mockOnDragStart}
        />
      );

      const assertDetailsListsSorted = () => {
        const detailsList = container.querySelectorAll('details');
        expect(detailsList.length).toBeGreaterThan(0);
        detailsList.forEach((details) => {
          const itemNodes = details.querySelectorAll('[draggable="true"]');
          const labels = Array.from(itemNodes).map(
            (node) => node.getAttribute('aria-label')?.replace(/^Add /, '') || ''
          );
          const sortedLabels = [...labels].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
          );
          expect(labels).toEqual(sortedLabels);
        });
      };

      assertDetailsListsSorted();

      rerender(
        <NodesCard
          activeTab="STEPS"
          setActiveTab={vi.fn()}
          nodesCount={1}
          hasPubSubSource={false}
          onDragStart={mockOnDragStart}
        />
      );
      assertDetailsListsSorted();

      rerender(
        <NodesCard
          activeTab="SINKS"
          setActiveTab={vi.fn()}
          nodesCount={1}
          hasPubSubSource={false}
          onDragStart={mockOnDragStart}
        />
      );
      assertDetailsListsSorted();
    });

    it('sorts sample items alphabetically by title in the SAMPLES tab', () => {
      const unsortedSamples = [
        {
          id: 'sample-z',
          filename: 'z-pipeline.beam',
          title: 'Zebra Pipeline',
          description: 'Z description',
          badge: 'Python',
          content: ''
        },
        {
          id: 'sample-a',
          filename: 'a-pipeline.beam',
          title: 'Alpha Pipeline',
          description: 'A description',
          badge: 'Java',
          content: ''
        },
        {
          id: 'sample-m',
          filename: 'm-pipeline.beam',
          title: 'Metrics Pipeline',
          description: 'M description',
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
          samples={unsortedSamples}
        />
      );

      const sampleButtons = screen.getAllByTitle(/Click to open .* as a new file tab/i);
      const renderedTitles = sampleButtons.map((el) => el.getAttribute('title') || '');
      expect(renderedTitles[0]).toContain('Alpha Pipeline');
      expect(renderedTitles[1]).toContain('Metrics Pipeline');
      expect(renderedTitles[2]).toContain('Zebra Pipeline');
    });

    it('renders Healthcare, SaaS & Observability native Source and Sink nodes and omits unsupported directions', () => {
      const { rerender } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      // Categories in SOURCES
      expect(screen.getByText('Streaming Sources')).toBeInTheDocument();
      expect(screen.getByText('Database Sources')).toBeInTheDocument();
      expect(screen.getByText('Data Services Sources')).toBeInTheDocument();

      // Native Source nodes
      expect(screen.getByText('FhirIO')).toBeInTheDocument();
      expect(screen.getByText('HL7v2IO')).toBeInTheDocument();
      expect(screen.getByText('DicomIO')).toBeInTheDocument();
      expect(screen.getByText('GoogleAdsIO')).toBeInTheDocument();
      expect(screen.getByText('Web APIs (RequestResponseIO)')).toBeInTheDocument();

      // Unsupported Source directions must NOT appear in SOURCES
      expect(screen.queryByText('SplunkIO')).not.toBeInTheDocument();
      expect(screen.queryByText('DatadogIO')).not.toBeInTheDocument();

      // Switch to SINKS tab
      rerender(
        <NodesCard activeTab="SINKS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      // Categories in SINKS
      expect(screen.getByText('Streaming Sinks')).toBeInTheDocument();
      expect(screen.getByText('Data Services Sinks')).toBeInTheDocument();
      expect(screen.getByText('Logging Sinks')).toBeInTheDocument();

      // Native Sink nodes
      expect(screen.getByText('FhirIO')).toBeInTheDocument();
      expect(screen.getByText('HL7v2IO')).toBeInTheDocument();
      expect(screen.getByText('DicomIO')).toBeInTheDocument();
      expect(screen.getByText('Web APIs (RequestResponseIO)')).toBeInTheDocument();
      expect(screen.getByText('SplunkIO')).toBeInTheDocument();
      expect(screen.getByText('DatadogIO')).toBeInTheDocument();

      // Unsupported Sink direction must NOT appear in SINKS
      expect(screen.queryByText('GoogleAdsIO')).not.toBeInTheDocument();
    });
  });

  // =======================================================================
  // Messaging & Streaming Connector Palette (IO15, IO20, IO49, IO62, IO63)
  // =======================================================================
  describe('Messaging & Streaming connector palette entries', () => {
    const STREAMING_CONNECTORS = [
      { label: 'AMQP', sourceDescription: 'Consume streaming messages from AMQP 1.0 broker addresses', sinkDescription: 'Publish messages to AMQP 1.0 broker address' },
      { label: 'RabbitMQ', sourceDescription: 'Consume streaming messages from RabbitMQ queue or exchange', sinkDescription: 'Publish messages to RabbitMQ queue or exchange' },
      { label: 'Pulsar', sourceDescription: 'Consume streaming messages from Apache Pulsar topic', sinkDescription: 'Publish messages to Apache Pulsar topic' },
      { label: 'Solace', sourceDescription: 'Consume streaming messages from Solace queue or topic', sinkDescription: 'Publish messages to Solace topic or queue' }
    ];

    it.each(STREAMING_CONNECTORS)('renders $label in Streaming Sources and Streaming Sinks', ({ label, sourceDescription, sinkDescription }) => {
      const { rerender } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(sourceDescription)).toBeInTheDocument();
      expect(screen.getByText('Streaming Sources')).toBeInTheDocument();

      rerender(
        <NodesCard activeTab="SINKS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(sinkDescription)).toBeInTheDocument();
      expect(screen.getByText('Streaming Sinks')).toBeInTheDocument();
    });

    it('renders Flink Streaming Impulse under Data Services Sources rather than Streaming', () => {
      // NOTE: FlinkStreamingImpulseSource is Python-only and Flink-runner-only, so it is deliberately
      // categorised under Data Services instead of the runner-agnostic Streaming categories.
      // There is no native Beam writer support, so it only exists as a source.
      const { rerender } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      expect(screen.getByText('Data Services Sources')).toBeInTheDocument();
      expect(screen.getByText('Generate synthetic impulses on the Flink runner (Python)')).toBeInTheDocument();

      rerender(
        <NodesCard activeTab="SINKS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      expect(screen.getByText('Data Services Sinks')).toBeInTheDocument();
      expect(screen.queryByText('Configure Flink runner egress adapter for impulse pipelines (Python)')).not.toBeInTheDocument();
    });

    it('keeps the new connector nodes discoverable through palette search', () => {
      render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'pulsar' } });

      expect(screen.getByText('Pulsar')).toBeInTheDocument();
      expect(screen.queryByText('RabbitMQ')).not.toBeInTheDocument();
    });

    it('groups Cloud Bigtable, Cloud SQL, Cosmos DB, KineticaDB, MySQL, and Multi-DB under Database Sources/Sinks and Hadoop Format & HCatalog under File Sources/Sinks', () => {
      const { rerender } = render(
        <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      const dbSourcesGroup = screen.getByText('Database Sources').closest('details') as HTMLElement;
      expect(dbSourcesGroup).not.toBeNull();
      for (const label of [
        'Cloud Bigtable (HBase based)',
        'Cloud SQL',
        'Cosmos DB',
        'KineticaDB',
        'MySQL',
        'MySQL, PostgreSQL, Oracle, SQL Server',
      ]) {
        expect(dbSourcesGroup.querySelector(`[aria-label="Add ${label}"]`)).not.toBeNull();
      }

      const fileSourcesGroup = screen.getByText('File Sources').closest('details') as HTMLElement;
      expect(fileSourcesGroup).not.toBeNull();
      for (const label of ['Hadoop Format', 'HCatalog']) {
        expect(fileSourcesGroup.querySelector(`[aria-label="Add ${label}"]`)).not.toBeNull();
      }

      rerender(
        <NodesCard activeTab="SINKS" setActiveTab={vi.fn()} nodesCount={1} hasPubSubSource={false} onDragStart={mockOnDragStart} onAddNode={mockOnAddNode} />
      );

      const dbSinksGroup = screen.getByText('Database Sinks').closest('details') as HTMLElement;
      expect(dbSinksGroup).not.toBeNull();
      for (const label of [
        'Cloud Bigtable (HBase based)',
        'Cloud SQL',
        'KineticaDB',
        'MySQL',
        'MySQL, PostgreSQL, Oracle, SQL Server',
      ]) {
        expect(dbSinksGroup.querySelector(`[aria-label="Add ${label}"]`)).not.toBeNull();
      }

      const fileSinksGroup = screen.getByText('File Sinks').closest('details') as HTMLElement;
      expect(fileSinksGroup).not.toBeNull();
      for (const label of ['Hadoop Format', 'HCatalog']) {
        expect(fileSinksGroup.querySelector(`[aria-label="Add ${label}"]`)).not.toBeNull();
      }
    });
  });
});



