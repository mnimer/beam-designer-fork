/**
 * PropertyForm Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates immutable metadata-based property form resolution, regression resistance against
 * label changes, fallback handling for unknown or missing metadata, and coverage across all
 * registered Beam transforms and IO components.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { PropertyForm, PROPERTY_FORM_REGISTRY, getPropertyFormComponent, loadPropertyForm } from './PropertyForm';
import { migrateLegacyNodes } from '../utils/legacyNodeMigration';
import { getNodeDocumentation } from '../utils/nodeDocumentation';

import { PubSubProperties } from '../properties/source/PubSubIO';
import { BigQuerySourceProperties } from '../properties/source/BigQueryIO';
import { CreateProperties } from '../properties/source/CreateIO';
import { GenerateSequenceProperties } from '../properties/source/GenerateSequence';
import { PeriodicImpulseProperties } from '../properties/source/PeriodicImpulse';
import { TextIOSourceProperties } from '../properties/source/TextIO';
import { FileIOSourceProperties, FileIOReadMatchesProperties } from '../properties/source/FileIO';
import { JdbcIOSourceProperties } from '../properties/source/JdbcIO';
import { KafkaIOSourceProperties } from '../properties/source/KafkaIO';
import { KinesisIOSourceProperties } from '../properties/source/KinesisIO';
import { ParquetIOSourceProperties } from '../properties/source/ParquetIO';
import { AvroIOSourceProperties } from '../properties/source/AvroIO';
import { SnsIOSourceProperties } from '../properties/source/SnsIO';
import { JmsIOSourceProperties } from '../properties/source/JmsIO';
import { SqsIOSourceProperties } from '../properties/source/SqsIO';
import { MqttIOSourceProperties } from '../properties/source/MqttIO';
import { FhirIOSourceProperties } from '../properties/source/FhirIO';
import { HL7v2IOSourceProperties } from '../properties/source/HL7v2IO';
import { DicomIOSourceProperties } from '../properties/source/DicomIO';
import { GoogleAdsIOSourceProperties } from '../properties/source/GoogleAdsIO';
import { RequestResponseIOSourceProperties } from '../properties/source/RequestResponseIO';
import { AmqpIOSourceProperties } from '../properties/source/AmqpIO';
import { RabbitMqIOSourceProperties } from '../properties/source/RabbitMqIO';
import { PulsarIOSourceProperties } from '../properties/source/PulsarIO';
import { SolaceIOSourceProperties } from '../properties/source/SolaceIO';
import { FlinkStreamingImpulseSourceProperties } from '../properties/source/FlinkStreamingImpulseSource';

import { PubSubSinkProperties } from '../properties/sink/PubSubIO';
import { BigQuerySinkProperties } from '../properties/sink/BigQueryIO';
import { TextIOSinkProperties } from '../properties/sink/TextIO';
import { FileIOSinkProperties } from '../properties/sink/FileIO';
import { JdbcIOSinkProperties } from '../properties/sink/JdbcIO';
import { KafkaIOSinkProperties } from '../properties/sink/KafkaIO';
import { KinesisIOSinkProperties } from '../properties/sink/KinesisIO';
import { ParquetIOSinkProperties } from '../properties/sink/ParquetIO';
import { AvroIOSinkProperties } from '../properties/sink/AvroIO';
import { SnsIOSinkProperties } from '../properties/sink/SnsIO';
import { JmsIOSinkProperties } from '../properties/sink/JmsIO';
import { SqsIOSinkProperties } from '../properties/sink/SqsIO';
import { MqttIOSinkProperties } from '../properties/sink/MqttIO';
import { LogMessageProperties } from '../properties/sink/LogMessage';
import { FhirIOSinkProperties } from '../properties/sink/FhirIO';
import { HL7v2IOSinkProperties } from '../properties/sink/HL7v2IO';
import { DicomIOSinkProperties } from '../properties/sink/DicomIO';
import { SplunkIOSinkProperties } from '../properties/sink/SplunkIO';
import { RequestResponseIOSinkProperties } from '../properties/sink/RequestResponseIO';
import { DatadogIOSinkProperties } from '../properties/sink/DatadogIO';
import { AmqpIOSinkProperties } from '../properties/sink/AmqpIO';
import { RabbitMqIOSinkProperties } from '../properties/sink/RabbitMqIO';
import { PulsarIOSinkProperties } from '../properties/sink/PulsarIO';
import { SolaceIOSinkProperties } from '../properties/sink/SolaceIO';

import { WindowingProperties } from '../properties/step/Windowing';
import { ParseMessageProperties } from '../properties/step/ParseMessage';
import { WithTimestampsProperties } from '../properties/step/WithTimestamps';
import { KVMapperProperties } from '../properties/step/KVMapper';
import { FilterProperties } from '../properties/step/Filter';
import { FlatMapProperties } from '../properties/step/FlatMap';
import { MapProperties } from '../properties/step/Map';
import { ParDoProperties } from '../properties/step/ParDo';
import { AggregationProperties } from '../properties/step/Aggregations';
import { OtherProperties } from '../properties/step/Other';

/**
 * Resolves the concrete (eagerly imported) panel component a node dispatches to.
 * Registry entries are code-split lazy wrappers, so identity assertions against the
 * real component must go through `loadPropertyForm`.
 *
 * @param node Node-like object with immutable metadata.
 * @returns The concrete component, or undefined when unregistered.
 */
async function resolvePropertyForm(node: unknown) {
  const entry = getPropertyFormComponent(node);
  return entry ? loadPropertyForm(entry) : undefined;
}

/**
 * Waits until the Suspense placeholder for the lazily-loaded panel has gone away
 * (tolerates the chunk already being cached, in which case it never appears).
 */
const waitForPanelToLoad = () =>
  waitFor(() => expect(screen.queryByTestId('property-form-loading')).not.toBeInTheDocument());

describe('PropertyForm', () => {
  // =========================================================================
  // Core Regression Tests: Immutable Metadata vs User-Editable Label
  // =========================================================================

  it('REGRESSION: renders BigQuery form when label contains a different connector name (e.g. "my PubSub-ish step")', async () => {
    const mockNode = {
      data: {
        label: 'my PubSub-ish step',
        type: 'SINK',
        beam_transform: 'BigQueryIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    // Must render BigQuerySinkProperties (with Table Name placeholder)
    expect(await screen.findByPlaceholderText('my_table')).toBeInTheDocument();
    // Must NOT render PubSub properties
    expect(screen.queryByPlaceholderText('projects/my-project/topics/my-topic')).not.toBeInTheDocument();
  });

  it('REGRESSION: renders PubSub form when label contains a different connector name (e.g. "BigQuery Ingestion")', async () => {
    const mockNode = {
      data: {
        label: 'BigQuery Ingestion',
        type: 'SOURCE',
        beam_transform: 'PubSubIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    // Must render PubSubProperties
    expect(await screen.findByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
    // Must NOT render BigQuery properties
    expect(screen.queryByPlaceholderText('my_table')).not.toBeInTheDocument();
  });

  it('REGRESSION: renders Kafka form when node is renamed away from connector name to a custom label', async () => {
    const mockNode = {
      data: {
        label: 'Custom Ingest Queue #42',
        type: 'SOURCE',
        beam_transform: 'KafkaIO',
        properties: {
          bootstrapServers: 'localhost:9092',
          topics: 'orders'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(await screen.findByLabelText(/Bootstrap Servers/i)).toHaveValue('localhost:9092');
    expect(screen.getByLabelText(/Topic\(s\)/i)).toHaveValue('orders');
  });

  // =========================================================================
  // Unregistered / Missing Metadata Fallback Tests (Fail-Fast)
  // =========================================================================

  it('renders explicit unregistered state when beam_transform is unknown', () => {
    const mockNode = {
      data: {
        label: 'Custom Operator',
        beam_transform: 'NonExistentTransform123',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('No property form registered for type "NonExistentTransform123"')).toBeInTheDocument();
  });

  it('renders explicit unregistered state when metadata is completely missing even if label matches a connector', () => {
    const mockNode = {
      data: {
        label: 'PubSub Source',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    // Must fail fast and NOT dispatch on the label
    expect(screen.getByText('No property form registered for type "unknown"')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('projects/my-project/topics/my-topic')).not.toBeInTheDocument();
  });

  it('renders explicit unregistered state showing node type when beam_transform is missing but type is present', () => {
    const mockNode = {
      data: {
        label: 'Unknown Sink Step',
        type: 'SINK',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('No property form registered for type "SINK"')).toBeInTheDocument();
  });

  it('renders explicit unregistered state when node is null or undefined', () => {
    const mockOnChange = vi.fn();

    render(<PropertyForm node={null} onChange={mockOnChange} />);

    expect(screen.getByText('No property form registered for type "unknown"')).toBeInTheDocument();
  });

  // =========================================================================
  // Metadata Resolution & Lookup Branches
  // =========================================================================

  it('resolves componentType metadata as alternative to beam_transform', async () => {
    const mockNode = {
      data: {
        label: 'Custom Component',
        type: 'STEP',
        componentType: 'ParDo',
        properties: {}
      }
    };
    const Component = await resolvePropertyForm(mockNode);
    expect(Component).toBe(ParDoProperties);

    const mockOnChange = vi.fn();
    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(await screen.findByText('Code Generation Prompt')).toBeInTheDocument();
  });

  describe('getPropertyFormComponent resolution branches', () => {
    it('branch 1: resolves via type-qualified key (${type}:${transform})', async () => {
      const node = { data: { type: 'SOURCE', beam_transform: 'PubSubIO', properties: {} } };
      expect(await resolvePropertyForm(node)).toBe(PubSubProperties);
    });

    it('branch 2: prevents cross-direction fallback when opposite type is registered', () => {
      const node = { data: { type: 'SINK', beam_transform: 'FlinkStreamingImpulseSource', properties: {} } };
      expect(getPropertyFormComponent(node)).toBeUndefined();
    });

    it('branch 3: resolves via direct transform key when no qualified key exists', async () => {
      const node = { data: { type: 'STEP', beam_transform: 'ParDo', properties: {} } };
      expect(await resolvePropertyForm(node)).toBe(ParDoProperties);
    });
  });

  // =========================================================================
  // Dedicated Identity Resolution Table (replaces ~60 individual panel render tests)
  // =========================================================================

  const ROUTING_CASES = [
    // Source IOs
    { type: 'SOURCE', beam_transform: 'PubSubIO', ExpectedComponent: PubSubProperties, name: 'PubSubProperties' },
    { type: 'SOURCE', beam_transform: 'BigQueryIO', ExpectedComponent: BigQuerySourceProperties, name: 'BigQuerySourceProperties' },
    { type: 'SOURCE', beam_transform: 'Create', ExpectedComponent: CreateProperties, name: 'CreateProperties' },
    { type: 'SOURCE', beam_transform: 'GenerateSequence', ExpectedComponent: GenerateSequenceProperties, name: 'GenerateSequenceProperties' },
    { type: 'SOURCE', beam_transform: 'PeriodicImpulse', ExpectedComponent: PeriodicImpulseProperties, name: 'PeriodicImpulseProperties' },
    { type: 'SOURCE', beam_transform: 'TextIO', ExpectedComponent: TextIOSourceProperties, name: 'TextIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'FileIO.match', ExpectedComponent: FileIOSourceProperties, name: 'FileIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'JdbcIO', ExpectedComponent: JdbcIOSourceProperties, name: 'JdbcIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'KafkaIO', ExpectedComponent: KafkaIOSourceProperties, name: 'KafkaIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'KinesisIO', ExpectedComponent: KinesisIOSourceProperties, name: 'KinesisIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'ParquetIO', ExpectedComponent: ParquetIOSourceProperties, name: 'ParquetIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'AvroIO', ExpectedComponent: AvroIOSourceProperties, name: 'AvroIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'SnsIO', ExpectedComponent: SnsIOSourceProperties, name: 'SnsIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'JmsIO', ExpectedComponent: JmsIOSourceProperties, name: 'JmsIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'SqsIO', ExpectedComponent: SqsIOSourceProperties, name: 'SqsIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'MqttIO', ExpectedComponent: MqttIOSourceProperties, name: 'MqttIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'FhirIO', ExpectedComponent: FhirIOSourceProperties, name: 'FhirIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'HL7v2IO', ExpectedComponent: HL7v2IOSourceProperties, name: 'HL7v2IOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'DicomIO', ExpectedComponent: DicomIOSourceProperties, name: 'DicomIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'GoogleAdsIO', ExpectedComponent: GoogleAdsIOSourceProperties, name: 'GoogleAdsIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'RequestResponseIO', ExpectedComponent: RequestResponseIOSourceProperties, name: 'RequestResponseIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'AmqpIO', ExpectedComponent: AmqpIOSourceProperties, name: 'AmqpIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'RabbitMqIO', ExpectedComponent: RabbitMqIOSourceProperties, name: 'RabbitMqIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'PulsarIO', ExpectedComponent: PulsarIOSourceProperties, name: 'PulsarIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'SolaceIO', ExpectedComponent: SolaceIOSourceProperties, name: 'SolaceIOSourceProperties' },
    { type: 'SOURCE', beam_transform: 'FlinkStreamingImpulseSource', ExpectedComponent: FlinkStreamingImpulseSourceProperties, name: 'FlinkStreamingImpulseSourceProperties' },

    // Sink IOs
    { type: 'SINK', beam_transform: 'PubSubIO', ExpectedComponent: PubSubSinkProperties, name: 'PubSubSinkProperties' },
    { type: 'SINK', beam_transform: 'BigQueryIO', ExpectedComponent: BigQuerySinkProperties, name: 'BigQuerySinkProperties' },
    { type: 'SINK', beam_transform: 'TextIO', ExpectedComponent: TextIOSinkProperties, name: 'TextIOSinkProperties' },
    { type: 'SINK', beam_transform: 'FileIO', ExpectedComponent: FileIOSinkProperties, name: 'FileIOSinkProperties' },
    { type: 'SINK', beam_transform: 'JdbcIO', ExpectedComponent: JdbcIOSinkProperties, name: 'JdbcIOSinkProperties' },
    { type: 'SINK', beam_transform: 'KafkaIO', ExpectedComponent: KafkaIOSinkProperties, name: 'KafkaIOSinkProperties' },
    { type: 'SINK', beam_transform: 'KinesisIO', ExpectedComponent: KinesisIOSinkProperties, name: 'KinesisIOSinkProperties' },
    { type: 'SINK', beam_transform: 'ParquetIO', ExpectedComponent: ParquetIOSinkProperties, name: 'ParquetIOSinkProperties' },
    { type: 'SINK', beam_transform: 'AvroIO', ExpectedComponent: AvroIOSinkProperties, name: 'AvroIOSinkProperties' },
    { type: 'SINK', beam_transform: 'SnsIO', ExpectedComponent: SnsIOSinkProperties, name: 'SnsIOSinkProperties' },
    { type: 'SINK', beam_transform: 'JmsIO', ExpectedComponent: JmsIOSinkProperties, name: 'JmsIOSinkProperties' },
    { type: 'SINK', beam_transform: 'SqsIO', ExpectedComponent: SqsIOSinkProperties, name: 'SqsIOSinkProperties' },
    { type: 'SINK', beam_transform: 'MqttIO', ExpectedComponent: MqttIOSinkProperties, name: 'MqttIOSinkProperties' },
    { type: 'SINK', beam_transform: 'LogMessage', ExpectedComponent: LogMessageProperties, name: 'LogMessageProperties' },
    { type: 'SINK', beam_transform: 'FhirIO', ExpectedComponent: FhirIOSinkProperties, name: 'FhirIOSinkProperties' },
    { type: 'SINK', beam_transform: 'HL7v2IO', ExpectedComponent: HL7v2IOSinkProperties, name: 'HL7v2IOSinkProperties' },
    { type: 'SINK', beam_transform: 'DicomIO', ExpectedComponent: DicomIOSinkProperties, name: 'DicomIOSinkProperties' },
    { type: 'SINK', beam_transform: 'SplunkIO', ExpectedComponent: SplunkIOSinkProperties, name: 'SplunkIOSinkProperties' },
    { type: 'SINK', beam_transform: 'RequestResponseIO', ExpectedComponent: RequestResponseIOSinkProperties, name: 'RequestResponseIOSinkProperties' },
    { type: 'SINK', beam_transform: 'DatadogIO', ExpectedComponent: DatadogIOSinkProperties, name: 'DatadogIOSinkProperties' },
    { type: 'SINK', beam_transform: 'AmqpIO', ExpectedComponent: AmqpIOSinkProperties, name: 'AmqpIOSinkProperties' },
    { type: 'SINK', beam_transform: 'RabbitMqIO', ExpectedComponent: RabbitMqIOSinkProperties, name: 'RabbitMqIOSinkProperties' },
    { type: 'SINK', beam_transform: 'PulsarIO', ExpectedComponent: PulsarIOSinkProperties, name: 'PulsarIOSinkProperties' },
    { type: 'SINK', beam_transform: 'SolaceIO', ExpectedComponent: SolaceIOSinkProperties, name: 'SolaceIOSinkProperties' },

    // Step Transforms & Aliases
    { type: 'STEP', beam_transform: 'FileIO.readMatches', ExpectedComponent: FileIOReadMatchesProperties, name: 'FileIOReadMatchesProperties' },
    { type: 'STEP', beam_transform: 'Window', ExpectedComponent: WindowingProperties, name: 'WindowingProperties' },
    { type: 'STEP', beam_transform: 'WindowInto', ExpectedComponent: WindowingProperties, name: 'WindowingProperties' },
    { type: 'STEP', beam_transform: 'ParseMessage', ExpectedComponent: ParseMessageProperties, name: 'ParseMessageProperties' },
    { type: 'STEP', beam_transform: 'WithTimestamps', ExpectedComponent: WithTimestampsProperties, name: 'WithTimestampsProperties' },
    { type: 'STEP', beam_transform: 'KVMapper', ExpectedComponent: KVMapperProperties, name: 'KVMapperProperties' },
    { type: 'STEP', beam_transform: 'Filter', ExpectedComponent: FilterProperties, name: 'FilterProperties' },
    { type: 'STEP', beam_transform: 'FlatMap', ExpectedComponent: FlatMapProperties, name: 'FlatMapProperties' },
    { type: 'STEP', beam_transform: 'Map', ExpectedComponent: MapProperties, name: 'MapProperties' },
    { type: 'STEP', beam_transform: 'ParDo', ExpectedComponent: ParDoProperties, name: 'ParDoProperties' },
    { type: 'STEP', beam_transform: 'Combine', ExpectedComponent: AggregationProperties, name: 'AggregationProperties' },
    { type: 'STEP', beam_transform: 'Flatten', ExpectedComponent: OtherProperties, name: 'OtherProperties' },
    { type: 'STEP', beam_transform: 'Reshuffle', ExpectedComponent: OtherProperties, name: 'OtherProperties' },
  ];

  it.each(ROUTING_CASES)(
    'resolves $type:$beam_transform to $name',
    async ({ type, beam_transform, ExpectedComponent }) => {
      expect(
        await resolvePropertyForm({
          data: { type, beam_transform, properties: {} },
        })
      ).toBe(ExpectedComponent);
    }
  );

  it('does NOT register or resolve unsupported native directions (SOURCE:SplunkIO, SINK:GoogleAdsIO, SOURCE:DatadogIO)', () => {
    expect(PROPERTY_FORM_REGISTRY['SOURCE:SplunkIO']).toBeUndefined();
    expect(PROPERTY_FORM_REGISTRY['SINK:GoogleAdsIO']).toBeUndefined();
    expect(PROPERTY_FORM_REGISTRY['SOURCE:DatadogIO']).toBeUndefined();

    expect(getPropertyFormComponent({ data: { type: 'SOURCE', beam_transform: 'SplunkIO' } })).toBeUndefined();
    expect(getPropertyFormComponent({ data: { type: 'SINK', beam_transform: 'GoogleAdsIO' } })).toBeUndefined();
    expect(getPropertyFormComponent({ data: { type: 'SOURCE', beam_transform: 'DatadogIO' } })).toBeUndefined();

    const { rerender } = render(
      <PropertyForm node={{ data: { type: 'SOURCE', beam_transform: 'SplunkIO' } }} onChange={vi.fn()} />
    );
    expect(screen.getByText('No property form registered for type "SplunkIO"')).toBeInTheDocument();

    rerender(<PropertyForm node={{ data: { type: 'SINK', beam_transform: 'GoogleAdsIO' } }} onChange={vi.fn()} />);
    expect(screen.getByText('No property form registered for type "GoogleAdsIO"')).toBeInTheDocument();

    rerender(<PropertyForm node={{ data: { type: 'SOURCE', beam_transform: 'DatadogIO' } }} onChange={vi.fn()} />);
    expect(screen.getByText('No property form registered for type "DatadogIO"')).toBeInTheDocument();
  });
});

describe('Real Sample Pipelines Acceptance Tests', () => {
  it('loads real resources/samples/pubsub-to-bigquery.beam and asserts every node resolves to a real property form without unregistered warnings', async () => {
    const filePath = path.resolve(__dirname, '../../../resources/samples/pubsub-to-bigquery.beam');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = YAML.parse(content);
    expect(Array.isArray(parsed.nodes)).toBe(true);

    const migratedNodes = migrateLegacyNodes(parsed.nodes);
    expect(migratedNodes.length).toBe(4);

    for (const node of migratedNodes) {
      const mockOnChange = vi.fn();
      const { container } = render(<PropertyForm node={node} onChange={mockOnChange} />);

      // Must NOT render the unregistered fallback
      expect(screen.queryByText(/No property form registered for type/i)).not.toBeInTheDocument();

      // Must render form inputs/controls (real property form) once its chunk has loaded
      await waitFor(() => expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0));
    }
  });

  it('loads real resources/samples/generate-mock-data.beam and asserts every node resolves to a real property form without unregistered warnings', async () => {
    const filePath = path.resolve(__dirname, '../../../resources/samples/generate-mock-data.beam');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = YAML.parse(content);
    expect(Array.isArray(parsed.nodes)).toBe(true);

    const migratedNodes = migrateLegacyNodes(parsed.nodes);
    expect(migratedNodes.length).toBe(3);

    for (const node of migratedNodes) {
      const mockOnChange = vi.fn();
      const { container } = render(<PropertyForm node={node} onChange={mockOnChange} />);

      // Must NOT render the unregistered fallback
      expect(screen.queryByText(/No property form registered for type/i)).not.toBeInTheDocument();

      // Must render form inputs/controls (real property form) once its chunk has loaded
      await waitFor(() => expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0));
    }
  });
});

// =========================================================================
// Messaging & Streaming Connector Dispatch (IO15, IO20, IO49, IO62, IO63)
// =========================================================================

describe('PropertyForm dispatch for messaging & streaming connectors', () => {
  const ALL_CONNECTORS = [
    { transform: 'AmqpIO', label: 'AMQP', task: 'IO15' },
    { transform: 'RabbitMqIO', label: 'RabbitMQ', task: 'IO20' },
    { transform: 'FlinkStreamingImpulseSource', label: 'Flink Streaming Impulse', task: 'IO49' },
    { transform: 'PulsarIO', label: 'Pulsar', task: 'IO62' },
    { transform: 'SolaceIO', label: 'Solace', task: 'IO63' },
  ];

  it.each(ALL_CONNECTORS)('never resolves $transform from a renamed user label alone ($task)', ({ transform }) => {
    // Regression guard for M14: dispatch must ignore the user-editable label.
    const renamedNode = { data: { label: transform, type: 'SOURCE', properties: {} } };
    expect(getPropertyFormComponent(renamedNode)).toBeUndefined();
  });
});

// =========================================================================
// Node Documentation & Docs Link Across Property Panels
// =========================================================================

describe('Node Documentation & Docs Link Across Property Panels', () => {
  it('renders a short description and a single "Docs ↗" link that dispatches openExternal for Source, Step, and Sink panels', async () => {
    const postMessage = vi.fn();
    (window as unknown as { vscode?: { postMessage: typeof postMessage } }).vscode = { postMessage };

    try {
      const sampleNodes = [
        { data: { label: 'PubSub Source', type: 'SOURCE', beam_transform: 'PubSubIO', properties: {} } },
        { data: { label: 'ParDo Step', type: 'STEP', beam_transform: 'ParDo', properties: {} } },
        { data: { label: 'Combine Step', type: 'STEP', beam_transform: 'Combine', properties: {} } },
        { data: { label: 'Flatten Step', type: 'STEP', beam_transform: 'Flatten', properties: {} } },
        { data: { label: 'BigQuery Sink', type: 'SINK', beam_transform: 'BigQueryIO', properties: {} } },
        { data: { label: 'Cloud Bigtable Sink', type: 'SINK', beam_transform: 'CloudBigtable', properties: {} } },
      ];

      for (const { data } of sampleNodes) {
        postMessage.mockClear();
        const doc = getNodeDocumentation({ data });
        expect(doc).toBeDefined();

        const { unmount } = render(<PropertyForm node={{ data }} onChange={vi.fn()} />);
        await waitForPanelToLoad();

        expect(screen.getByText(doc!.description)).toBeInTheDocument();
        const docsButtons = screen.getAllByText('Docs ↗');
        expect(docsButtons).toHaveLength(1);

        fireEvent.click(docsButtons[0]);
        expect(postMessage).toHaveBeenCalledWith({
          command: 'openExternal',
          url: doc!.docsUrl,
        });

        unmount();
      }
    } finally {
      delete (window as unknown as { vscode?: unknown }).vscode;
    }
  });
});

