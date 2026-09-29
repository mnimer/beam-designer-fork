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
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { PropertyForm, PROPERTY_FORM_REGISTRY, getPropertyFormComponent } from './PropertyForm';
import { migrateLegacyNodes } from '../utils/legacyNodeMigration';

describe('PropertyForm', () => {
  // =========================================================================
  // Core Regression Tests: Immutable Metadata vs User-Editable Label
  // =========================================================================

  it('REGRESSION: renders BigQuery form when label contains a different connector name (e.g. "my PubSub-ish step")', () => {
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
    expect(screen.getByPlaceholderText('my_table')).toBeInTheDocument();
    // Must NOT render PubSub properties
    expect(screen.queryByPlaceholderText('projects/my-project/topics/my-topic')).not.toBeInTheDocument();
  });

  it('REGRESSION: renders PubSub form when label contains a different connector name (e.g. "BigQuery Ingestion")', () => {
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
    expect(screen.getByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
    // Must NOT render BigQuery properties
    expect(screen.queryByPlaceholderText('my_table')).not.toBeInTheDocument();
  });

  it('REGRESSION: renders Kafka form when node is renamed away from connector name to a custom label', () => {
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

    expect(screen.getByLabelText(/Bootstrap Servers/i)).toHaveValue('localhost:9092');
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
  // Registry Resolution Tests
  // =========================================================================

  it('resolves all keys in PROPERTY_FORM_REGISTRY to valid React components', () => {
    const keys = Object.keys(PROPERTY_FORM_REGISTRY);
    expect(keys.length).toBeGreaterThan(30);

    for (const key of keys) {
      const Component = PROPERTY_FORM_REGISTRY[key];
      expect(typeof Component).toBe('function');
    }
  });

  it('resolves componentType metadata as alternative to beam_transform', () => {
    const mockNode = {
      data: {
        label: 'Custom Component',
        type: 'STEP',
        componentType: 'ParDo',
        properties: {}
      }
    };
    const Component = getPropertyFormComponent(mockNode);
    expect(Component).toBeDefined();

    const mockOnChange = vi.fn();
    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText('Code Generation Prompt')).toBeInTheDocument();
  });

  // =========================================================================
  // Source IO Property Forms
  // =========================================================================

  it('renders PubSubProperties when type is SOURCE and beam_transform is PubSubIO', () => {
    const mockNode = {
      data: {
        label: 'PubSub Source',
        type: 'SOURCE',
        beam_transform: 'PubSubIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
  });

  it('renders BigQuerySourceProperties when type is SOURCE and beam_transform is BigQueryIO', () => {
    const mockNode = {
      data: {
        label: 'BigQuery Source',
        type: 'SOURCE',
        beam_transform: 'BigQueryIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-project:my_dataset.my_table')).toBeInTheDocument();
  });

  it('renders CreateProperties when beam_transform is Create', () => {
    const mockNode = {
      data: {
        label: 'Create',
        type: 'SOURCE',
        beam_transform: 'Create',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('In-Memory Elements')).toBeInTheDocument();
  });

  it('renders GenerateSequenceProperties when beam_transform is GenerateSequence', () => {
    const mockNode = {
      data: {
        label: 'Generate Sequence',
        type: 'SOURCE',
        beam_transform: 'GenerateSequence',
        properties: {
          sequenceMode: 'bounded' as const,
          start: 0,
          stop: 100
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Sequence Mode/i, { selector: 'select' })).toHaveValue('bounded');
    expect(screen.getByLabelText(/Start Index/i, { selector: 'input' })).toHaveValue(0);
    expect(screen.getByLabelText(/Stop Index/i, { selector: 'input' })).toHaveValue(100);
  });

  it('renders PeriodicImpulseProperties when beam_transform is PeriodicImpulse', () => {
    const mockNode = {
      data: {
        label: 'Periodic Impulse',
        type: 'SOURCE',
        beam_transform: 'PeriodicImpulse',
        properties: {
          intervalSeconds: 10,
          startMode: 'now' as const,
          stopMode: 'never' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Emission Interval/i, { selector: 'input' })).toHaveValue(10);
    expect(screen.getByLabelText(/Start Time/i, { selector: 'select' })).toHaveValue('now');
    expect(screen.getByLabelText(/Stop Condition/i, { selector: 'select' })).toHaveValue('never');
  });

  it('renders TextIOSourceProperties when type is SOURCE and beam_transform is TextIO', () => {
    const mockNode = {
      data: {
        label: 'TextIO',
        type: 'SOURCE',
        beam_transform: 'TextIO',
        properties: {
          filePattern: 'gs://input/*.txt'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/File Pattern \/ Path \(\.from\)/i)).toHaveValue('gs://input/*.txt');
  });

  it('renders FileIOSourceProperties when beam_transform is FileIO.match', () => {
    const mockNode = {
      data: {
        label: 'FileIO Match',
        type: 'SOURCE',
        beam_transform: 'FileIO.match',
        properties: {
          filePattern: 'gs://input/*.csv'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/File Pattern/i)).toHaveValue('gs://input/*.csv');
    expect(screen.getByText(/Continuously \(Stream Watch\)/i)).toBeInTheDocument();
  });

  it('renders JdbcIOSourceProperties when type is SOURCE and beam_transform is JdbcIO', () => {
    const mockNode = {
      data: {
        label: 'JdbcIO',
        type: 'SOURCE',
        beam_transform: 'JdbcIO',
        properties: {
          url: 'jdbc:postgresql://localhost:5432/mydb',
          query: 'SELECT 1'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/JDBC Connection URL/i)).toHaveValue('jdbc:postgresql://localhost:5432/mydb');
    expect(screen.getByLabelText(/SQL Statement/i)).toHaveValue('SELECT 1');
  });

  it('renders KafkaIOSourceProperties when type is SOURCE and beam_transform is KafkaIO', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        type: 'SOURCE',
        beam_transform: 'KafkaIO',
        properties: {
          bootstrapServers: 'localhost:9092',
          topics: 'input-topic'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Bootstrap Servers/i)).toHaveValue('localhost:9092');
    expect(screen.getByLabelText(/Topic\(s\)/i)).toHaveValue('input-topic');
  });

  it('renders KinesisIOSourceProperties when type is SOURCE and beam_transform is KinesisIO', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        type: 'SOURCE',
        beam_transform: 'KinesisIO',
        properties: {
          streamName: 'input-stream'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Initial Position/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Watermark Policy/i)).toBeInTheDocument();
  });

  it('renders ParquetIOSourceProperties when type is SOURCE and beam_transform is ParquetIO', () => {
    const mockNode = {
      data: {
        label: 'ParquetIO',
        type: 'SOURCE',
        beam_transform: 'ParquetIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/File Pattern \/ Path \(\.from\)/i)).toBeInTheDocument();
  });

  it('renders AvroIOSourceProperties when type is SOURCE and beam_transform is AvroIO', () => {
    const mockNode = {
      data: {
        label: 'AvroIO',
        type: 'SOURCE',
        beam_transform: 'AvroIO',
        properties: {
          filePattern: 'gs://bucket/data/*.avro'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#avroFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('gs://bucket/data/*.avro');
  });

  it('renders SnsIOSourceProperties when type is SOURCE and beam_transform is SnsIO', () => {
    const mockNode = {
      data: {
        label: 'SNS',
        type: 'SOURCE',
        beam_transform: 'SnsIO',
        properties: {
          topicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('arn:aws:sns:us-east-1:123456789012:my-topic')).toHaveValue('arn:aws:sns:us-east-1:123456789012:test-topic');
    expect(screen.getByPlaceholderText('https://sqs.us-east-1.amazonaws.com/123456789012/my-queue')).toHaveValue('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue');
  });

  it('renders JmsIOSourceProperties when type is SOURCE and beam_transform is JmsIO', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        type: 'SOURCE',
        beam_transform: 'JmsIO',
        properties: {
          destinationType: 'queue',
          queue: 'inbound.orders'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    const destInput = container.querySelector('#jmsDestinationName') as HTMLInputElement;
    expect(destInput).toBeInTheDocument();
    expect(destInput).toHaveValue('inbound.orders');
  });

  it('renders SqsIOSourceProperties when type is SOURCE and beam_transform is SqsIO', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        type: 'SOURCE',
        beam_transform: 'SqsIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('https://sqs.us-east-1.amazonaws.com/123456789012/my-queue')).toBeInTheDocument();
  });

  it('renders MqttIOSourceProperties when type is SOURCE and beam_transform is MqttIO', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        type: 'SOURCE',
        beam_transform: 'MqttIO',
        properties: {
          serverUri: 'tcp://broker.hivemq.com:1883',
          topic: 'devices/+/telemetry'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Broker Server URI/i)).toHaveValue('tcp://broker.hivemq.com:1883');
    expect(screen.getByLabelText(/Subscription Topic \/ Filter/i)).toHaveValue('devices/+/telemetry');
  });

  // =========================================================================
  // Sink IO Property Forms
  // =========================================================================

  it('renders PubSubSinkProperties when type is SINK and beam_transform is PubSubIO', () => {
    const mockNode = {
      data: {
        label: 'PubSub Sink',
        type: 'SINK',
        beam_transform: 'PubSubIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
  });

  it('renders BigQuerySinkProperties when type is SINK and beam_transform is BigQueryIO', () => {
    const mockNode = {
      data: {
        label: 'BigQuery Sink',
        type: 'SINK',
        beam_transform: 'BigQueryIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my_table')).toBeInTheDocument();
  });

  it('renders TextIOSinkProperties when type is SINK and beam_transform is TextIO', () => {
    const mockNode = {
      data: {
        label: 'TextIO',
        type: 'SINK',
        beam_transform: 'TextIO',
        properties: {
          to: 'gs://output/results'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Destination File Prefix \(\.to\)/i)).toHaveValue('gs://output/results');
  });

  it('renders FileIOSinkProperties when type is SINK and beam_transform is FileIO', () => {
    const mockNode = {
      data: {
        label: 'FileIO',
        type: 'SINK',
        beam_transform: 'FileIO',
        properties: {
          to: 'gs://output/files/'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Destination Directory \(\.to\)/i)).toHaveValue('gs://output/files/');
  });

  it('renders JdbcIOSinkProperties when type is SINK and beam_transform is JdbcIO', () => {
    const mockNode = {
      data: {
        label: 'JdbcIO',
        type: 'SINK',
        beam_transform: 'JdbcIO',
        properties: {
          url: 'jdbc:postgresql://localhost:5432/mydb',
          statement: 'INSERT INTO tbl VALUES (?)'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('#jdbcSinkUrl')).toHaveValue('jdbc:postgresql://localhost:5432/mydb');
    expect(container.querySelector('#jdbcSinkStatement')).toHaveValue('INSERT INTO tbl VALUES (?)');
  });

  it('renders KafkaIOSinkProperties when type is SINK and beam_transform is KafkaIO', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        type: 'SINK',
        beam_transform: 'KafkaIO',
        properties: {
          bootstrapServers: 'broker1:9092',
          topic: 'output-topic'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Bootstrap Servers/i)).toHaveValue('broker1:9092');
    expect(screen.getByLabelText(/^Topic/i)).toHaveValue('output-topic');
  });

  it('renders KinesisIOSinkProperties when type is SINK and beam_transform is KinesisIO', () => {
    const mockNode = {
      data: {
        label: 'Kinesis',
        type: 'SINK',
        beam_transform: 'KinesisIO',
        properties: {
          streamName: 'output-stream'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Partition Key Source/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Serialization Format/i)).toBeInTheDocument();
  });

  it('renders ParquetIOSinkProperties when type is SINK and beam_transform is ParquetIO', () => {
    const mockNode = {
      data: {
        label: 'ParquetIO',
        type: 'SINK',
        beam_transform: 'ParquetIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Destination Directory \/ Prefix \(\.to\)/i)).toBeInTheDocument();
  });

  it('renders AvroIOSinkProperties when type is SINK and beam_transform is AvroIO', () => {
    const mockNode = {
      data: {
        label: 'AvroIO',
        type: 'SINK',
        beam_transform: 'AvroIO',
        properties: {
          to: 'gs://bucket/output/records',
          suffix: '.avro'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#avroSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('gs://bucket/output/records');
  });

  it('renders SnsIOSinkProperties when type is SINK and beam_transform is SnsIO', () => {
    const mockNode = {
      data: {
        label: 'SNS',
        type: 'SINK',
        beam_transform: 'SnsIO',
        properties: {
          topicArn: 'arn:aws:sns:us-east-1:123456789012:sink-topic',
          subject: 'Test Notification'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('arn:aws:sns:us-east-1:123456789012:my-topic')).toHaveValue('arn:aws:sns:us-east-1:123456789012:sink-topic');
    expect(screen.getByPlaceholderText('e.g. Pipeline Notification')).toHaveValue('Test Notification');
  });

  it('renders JmsIOSinkProperties when type is SINK and beam_transform is JmsIO', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        type: 'SINK',
        beam_transform: 'JmsIO',
        properties: {
          destinationType: 'topic',
          topic: 'outbound.notifications'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    const destInput = container.querySelector('#jmsSinkDestinationName') as HTMLInputElement;
    expect(destInput).toBeInTheDocument();
    expect(destInput).toHaveValue('outbound.notifications');
  });

  it('renders SqsIOSinkProperties when type is SINK and beam_transform is SqsIO', () => {
    const mockNode = {
      data: {
        label: 'SQS',
        type: 'SINK',
        beam_transform: 'SqsIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('https://sqs.us-east-1.amazonaws.com/123456789012/my-queue')).toBeInTheDocument();
  });

  it('renders MqttIOSinkProperties when type is SINK and beam_transform is MqttIO', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        type: 'SINK',
        beam_transform: 'MqttIO',
        properties: {
          serverUri: 'tcp://broker.hivemq.com:1883',
          topic: 'commands/device1'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Broker Server URI/i)).toHaveValue('tcp://broker.hivemq.com:1883');
    expect(screen.getByLabelText(/Publish Topic/i)).toHaveValue('commands/device1');
    expect(screen.getByLabelText(/Retain Messages/i)).toBeInTheDocument();
  });

  it('renders LogMessageProperties when beam_transform is LogMessage', () => {
    const mockNode = {
      data: {
        label: 'Log Message',
        type: 'SINK',
        beam_transform: 'LogMessage',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Log Level')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Info')).toBeInTheDocument();
  });

  // =========================================================================
  // Step Transforms
  // =========================================================================

  it('renders FileIOReadMatchesProperties when beam_transform is FileIO.readMatches', () => {
    const mockNode = {
      data: {
        label: 'FileIO Read Matches',
        type: 'STEP',
        beam_transform: 'FileIO.readMatches',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/PCollection<FileIO\.ReadableFile>/i)).toBeInTheDocument();
  });

  it('renders WindowingProperties when beam_transform is Window', () => {
    const mockNode = {
      data: {
        label: 'Window Step',
        type: 'STEP',
        beam_transform: 'Window',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
  });

  it('renders WindowingProperties when beam_transform is WindowInto', () => {
    const mockNode = {
      data: {
        label: 'Fixed Windows',
        type: 'STEP',
        beam_transform: 'WindowInto',
        properties: {
          windowType: 'Fixed Window' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Window Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fixed Window')).toBeInTheDocument();
  });

  it('renders ParseMessageProperties when beam_transform is ParseMessage', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        type: 'STEP',
        beam_transform: 'ParseMessage',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Message Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('JSON')).toBeInTheDocument();
    expect(screen.getByText('Parse JSON message payloads and convert them to structured Java Beans, Row, or Map / Dict formats.')).toBeInTheDocument();
    expect(screen.getByText('Code Generation Instructions')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText('Enter code generation instructions for message parsing...');
    fireEvent.change(textarea, { target: { name: 'system_instructions', value: 'Parse custom field' } });
    expect(mockOnChange).toHaveBeenCalledWith({ system_instructions: 'Parse custom field' });
  });

  it('renders WithTimestampsProperties when beam_transform is WithTimestamps', () => {
    const mockNode = {
      data: {
        label: 'Add Timestamp',
        type: 'STEP',
        beam_transform: 'WithTimestamps',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Timestamp Source')).toBeInTheDocument();
  });

  it('renders KVMapperProperties when beam_transform is KVMapper', () => {
    const mockNode = {
      data: {
        label: 'KV Mapper',
        type: 'STEP',
        beam_transform: 'KVMapper',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Key Property Name')).toBeInTheDocument();
  });

  it('renders FilterProperties when beam_transform is Filter', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        type: 'STEP',
        beam_transform: 'Filter',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Compare Target')).toBeInTheDocument();
  });

  it('renders FlatMapProperties when beam_transform is FlatMap', () => {
    const mockNode = {
      data: {
        label: 'FlatMap',
        type: 'STEP',
        beam_transform: 'FlatMap',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Split via')).toBeInTheDocument();
  });

  it('renders MapProperties when beam_transform is Map', () => {
    const mockNode = {
      data: {
        label: 'Map',
        type: 'STEP',
        beam_transform: 'Map',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Mapping Function / Expression')).toBeInTheDocument();
    expect(screen.getByText('Output Data Type')).toBeInTheDocument();
  });

  it('renders ParDoProperties when beam_transform is ParDo', () => {
    const mockNode = {
      data: {
        label: 'ParDo',
        type: 'STEP',
        beam_transform: 'ParDo',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Code Generation Prompt')).toBeInTheDocument();
    expect(screen.getByText('System Instructions')).toBeInTheDocument();
  });

  it('renders AggregationProperties when beam_transform is an aggregation (e.g. Combine)', () => {
    const mockNode = {
      data: {
        label: 'Combine',
        type: 'STEP',
        beam_transform: 'Combine',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Combines elements in a collection using a global combine function\./i)).toBeInTheDocument();
  });

  it('renders OtherProperties when beam_transform is Flatten', () => {
    const mockNode = {
      data: {
        label: 'Flatten Step',
        type: 'STEP',
        beam_transform: 'Flatten',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Merges multiple PCollection objects of the same type into a single logical PCollection\./i)).toBeInTheDocument();
  });

  it('renders OtherProperties when beam_transform is Reshuffle', () => {
    const mockNode = {
      data: {
        label: 'ReShuffle Step',
        type: 'STEP',
        beam_transform: 'Reshuffle',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Redistributes elements across workers by assigning temporary random keys to break fusion and balance load\./i)).toBeInTheDocument();
  });

  // =========================================================================
  // Healthcare, SaaS & Observability Connectors (M1-M3)
  // =========================================================================

  it('renders FhirIOSourceProperties when type is SOURCE and beam_transform is FhirIO', () => {
    const mockNode = {
      data: {
        label: 'FhirIO Source',
        type: 'SOURCE',
        beam_transform: 'FhirIO',
        properties: {
          readMode: 'searchResources',
          fhirStore: 'projects/p1/locations/us-central1/datasets/d1/fhirStores/fs1'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

  it('renders FhirIOSinkProperties when type is SINK and beam_transform is FhirIO', () => {
    const mockNode = {
      data: {
        label: 'FhirIO Sink',
        type: 'SINK',
        beam_transform: 'FhirIO',
        properties: {
          writeMethod: 'EXECUTE_BUNDLE',
          fhirStore: 'projects/p1/locations/us-central1/datasets/d1/fhirStores/fs1'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

  it('renders HL7v2IOSourceProperties when type is SOURCE and beam_transform is HL7v2IO', () => {
    const mockNode = {
      data: {
        label: 'HL7v2IO Source',
        type: 'SOURCE',
        beam_transform: 'HL7v2IO',
        properties: {
          readMode: 'readWithFilter',
          hl7v2Store: 'projects/p1/locations/us-central1/datasets/d1/hl7V2Stores/s1'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

  it('renders HL7v2IOSinkProperties when type is SINK and beam_transform is HL7v2IO', () => {
    const mockNode = {
      data: {
        label: 'HL7v2IO Sink',
        type: 'SINK',
        beam_transform: 'HL7v2IO',
        properties: {
          hl7v2Store: 'projects/p1/locations/us-central1/datasets/d1/hl7V2Stores/s1'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

  it('renders DicomIOSourceProperties when type is SOURCE and beam_transform is DicomIO', () => {
    const mockNode = {
      data: {
        label: 'DicomIO Source',
        type: 'SOURCE',
        beam_transform: 'DicomIO',
        properties: {
          readMode: 'dicomSearch',
          searchType: 'studies'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

  it('renders DicomIOSinkProperties when type is SINK and beam_transform is DicomIO', () => {
    const mockNode = {
      data: {
        label: 'DicomIO Sink',
        type: 'SINK',
        beam_transform: 'DicomIO',
        properties: {
          inputType: 'bytes',
          dicomStoreId: 'dicom-store-1'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

  it('renders SplunkIOSinkProperties when type is SINK and beam_transform is SplunkIO', () => {
    const mockNode = {
      data: {
        label: 'SplunkIO Sink',
        type: 'SINK',
        beam_transform: 'SplunkIO',
        properties: {
          url: 'https://splunk-hec.example.com:8088'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

  it('renders GoogleAdsIOSourceProperties when type is SOURCE and beam_transform is GoogleAdsIO', () => {
    const mockNode = {
      data: {
        label: 'GoogleAdsIO Source',
        type: 'SOURCE',
        beam_transform: 'GoogleAdsIO',
        properties: {
          customerId: '1234567890',
          query: 'SELECT campaign.id FROM campaign'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

  it('renders RequestResponseIOSourceProperties when type is SOURCE and beam_transform is RequestResponseIO', () => {
    const mockNode = {
      data: {
        label: 'Web APIs Source',
        type: 'SOURCE',
        beam_transform: 'RequestResponseIO',
        properties: {
          endpointUrl: 'https://api.example.com/v1/items',
          httpMethod: 'GET'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

  it('renders RequestResponseIOSinkProperties when type is SINK and beam_transform is RequestResponseIO', () => {
    const mockNode = {
      data: {
        label: 'Web APIs Sink',
        type: 'SINK',
        beam_transform: 'RequestResponseIO',
        properties: {
          endpointUrl: 'https://api.example.com/v1/ingest',
          httpMethod: 'POST'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

  it('renders DatadogIOSinkProperties when type is SINK and beam_transform is DatadogIO', () => {
    const mockNode = {
      data: {
        label: 'DatadogIO Sink',
        type: 'SINK',
        beam_transform: 'DatadogIO',
        properties: {
          url: 'https://http-intake.logs.datadoghq.com'
        }
      }
    };
    const mockOnChange = vi.fn();
    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);
    expect(screen.queryByText(/No property form registered/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
  });

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
  it('loads real resources/samples/pubsub-to-bigquery.beam and asserts every node resolves to a real property form without unregistered warnings', () => {
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

      // Must render form inputs/controls (real property form)
      expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
    }
  });

  it('loads real resources/samples/generate-mock-data.beam and asserts every node resolves to a real property form without unregistered warnings', () => {
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

      // Must render form inputs/controls (real property form)
      expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
    }
  });
});

// =========================================================================
// Messaging & Streaming Connector Dispatch (IO15, IO20, IO49, IO62, IO63)
// =========================================================================

/**
 * NOTE: These tests guard the registry wiring for the messaging/streaming connector batch.
 * They assert dispatch by immutable metadata only (type + beam_transform) and deliberately avoid
 * asserting on connector-specific field labels, so that panel refactors cannot silently break the
 * registration contract (or vice versa).
 */
describe('PropertyForm dispatch for messaging & streaming connectors', () => {
  const ALL_CONNECTORS = [
    { transform: 'AmqpIO', label: 'AMQP', task: 'IO15' },
    { transform: 'RabbitMqIO', label: 'RabbitMQ', task: 'IO20' },
    { transform: 'FlinkStreamingImpulseSource', label: 'Flink Streaming Impulse', task: 'IO49' },
    { transform: 'PulsarIO', label: 'Pulsar', task: 'IO62' },
    { transform: 'SolaceIO', label: 'Solace', task: 'IO63' }
  ];

  const BIDIRECTIONAL_CONNECTORS = [
    { transform: 'AmqpIO', label: 'AMQP', task: 'IO15' },
    { transform: 'RabbitMqIO', label: 'RabbitMQ', task: 'IO20' },
    { transform: 'PulsarIO', label: 'Pulsar', task: 'IO62' },
    { transform: 'SolaceIO', label: 'Solace', task: 'IO63' }
  ];

  it.each(BIDIRECTIONAL_CONNECTORS)('registers SOURCE:$transform and SINK:$transform ($task)', ({ transform }) => {
    expect(PROPERTY_FORM_REGISTRY[`SOURCE:${transform}`]).toBeDefined();
    expect(PROPERTY_FORM_REGISTRY[`SINK:${transform}`]).toBeDefined();
    // Source and sink must resolve to distinct components, never the same panel.
    expect(PROPERTY_FORM_REGISTRY[`SOURCE:${transform}`]).not.toBe(PROPERTY_FORM_REGISTRY[`SINK:${transform}`]);
  });

  it('registers SOURCE:FlinkStreamingImpulseSource without a sink panel (IO49 - source only)', () => {
    expect(PROPERTY_FORM_REGISTRY['SOURCE:FlinkStreamingImpulseSource']).toBeDefined();
    expect(PROPERTY_FORM_REGISTRY['SINK:FlinkStreamingImpulseSource']).toBeUndefined();
  });

  it.each(BIDIRECTIONAL_CONNECTORS)('resolves $transform by node metadata for both directions ($task)', ({ transform, label }) => {
    const sourceNode = { data: { label, type: 'SOURCE', beam_transform: transform, properties: {} } };
    const sinkNode = { data: { label, type: 'SINK', beam_transform: transform, properties: {} } };

    expect(getPropertyFormComponent(sourceNode)).toBe(PROPERTY_FORM_REGISTRY[`SOURCE:${transform}`]);
    expect(getPropertyFormComponent(sinkNode)).toBe(PROPERTY_FORM_REGISTRY[`SINK:${transform}`]);
  });

  it('resolves FlinkStreamingImpulseSource by node metadata for SOURCE only (IO49)', () => {
    const sourceNode = { data: { label: 'Flink Streaming Impulse', type: 'SOURCE', beam_transform: 'FlinkStreamingImpulseSource', properties: {} } };
    expect(getPropertyFormComponent(sourceNode)).toBe(PROPERTY_FORM_REGISTRY['SOURCE:FlinkStreamingImpulseSource']);
  });

  it.each(ALL_CONNECTORS)('renders a real $transform source panel, not the unregistered fallback ($task)', ({ transform, label }) => {
    const mockNode = { data: { label, type: 'SOURCE', beam_transform: transform, properties: {} } };
    const mockOnChange = vi.fn();

    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.queryByText(/No property form registered for type/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
    // Every connector panel must expose the LLM prompt override contract.
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it.each(BIDIRECTIONAL_CONNECTORS)('renders a real $transform sink panel, not the unregistered fallback ($task)', ({ transform, label }) => {
    const mockNode = { data: { label, type: 'SINK', beam_transform: transform, properties: {} } };
    const mockOnChange = vi.fn();

    const { container } = render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.queryByText(/No property form registered for type/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('input, select, textarea').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it.each(ALL_CONNECTORS)('never resolves $transform from a renamed user label alone ($task)', ({ transform }) => {
    // Regression guard for M14: dispatch must ignore the user-editable label.
    const renamedNode = { data: { label: transform, type: 'SOURCE', properties: {} } };
    expect(getPropertyFormComponent(renamedNode)).toBeUndefined();
  });
});

// =========================================================================
// Node Documentation & Docs Link Across All Property Panels
// =========================================================================

import { SOURCE_NODES, STEP_NODES, SINK_NODES } from './NodesCard';
import { getNodeDocumentation } from '../utils/nodeDocumentation';

describe('Node Documentation & Docs Link Across All Property Panels', () => {
  it('resolves documentation metadata (title, description, docsUrl) and a valid property form for every SOURCE_NODES, STEP_NODES, and SINK_NODES entry', () => {
    const allPaletteNodes = [
      ...SOURCE_NODES,
      ...STEP_NODES,
      ...SINK_NODES,
    ];

    for (const item of allPaletteNodes) {
      const node = {
        data: {
          label: item.label,
          type: item.type,
          beam_transform: item.beamTransform,
          properties: {},
        },
      };

      const Component = getPropertyFormComponent(node);
      expect(Component, `Expected property form for ${item.type}:${item.beamTransform}`).toBeDefined();

      const doc = getNodeDocumentation(node);
      expect(doc, `Expected documentation metadata for ${item.type}:${item.beamTransform}`).toBeDefined();
      expect(doc!.title.trim().length).toBeGreaterThan(0);
      expect(doc!.description.trim().length).toBeGreaterThan(10);
      expect(doc!.docsUrl).toMatch(/^https:\/\//);
    }
  });

  it('resolves documentation metadata for every key in PROPERTY_FORM_REGISTRY', () => {
    for (const key of Object.keys(PROPERTY_FORM_REGISTRY)) {
      const parts = key.split(':');
      const node =
        parts.length === 2
          ? { data: { type: parts[0], beam_transform: parts[1], properties: {} } }
          : { data: { beam_transform: key, properties: {} } };

      const doc = getNodeDocumentation(node);
      expect(doc, `Expected documentation metadata for registry key "${key}"`).toBeDefined();
      expect(doc!.title.trim().length).toBeGreaterThan(0);
      expect(doc!.description.trim().length).toBeGreaterThan(10);
      expect(doc!.docsUrl).toMatch(/^https:\/\//);
    }
  });

  it('renders a short description and a single "Docs ↗" link that dispatches openExternal for Source, Step, and Sink panels', () => {
    const postMessage = vi.fn();
    (window as unknown as { vscode?: { postMessage: typeof postMessage } }).vscode = { postMessage };

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
  });
});

