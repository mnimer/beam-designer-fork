
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PropertyForm } from './PropertyForm';

describe('PropertyForm', () => {
  it('renders PubSubProperties when label contains PubSub', () => {
    const mockNode = {
      data: {
        label: 'PubSub Source',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
  });

  it('renders BigQueryProperties when label contains BigQuery', () => {
    const mockNode = {
      data: {
        label: 'BigQuery Sink',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my_table')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label contains Windowing', () => {
    const mockNode = {
      data: {
        label: 'Windowing Step',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
  });

  it('renders generic message for unknown label', () => {
    const mockNode = {
      data: {
        label: 'Unknown Node',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Nothing to customize')).toBeInTheDocument();
  });
  it('renders ParseMessageProperties when label is Parse Message', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
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

  it('renders appropriate helper text based on messageType property', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {
          messageType: 'Base64' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('Base64')).toBeInTheDocument();
    expect(screen.getByText('Decode Base64 encoded byte payloads into raw binary or UTF-8 text.')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label is Fixed Windows', () => {
    const mockNode = {
      data: {
        label: 'Fixed Windows',
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

  it('renders WindowingProperties when label is Sliding Windows', () => {
    const mockNode = {
      data: {
        label: 'Sliding Windows',
        properties: {
          windowType: 'Sliding Window' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Window Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sliding Window')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label is User Windows', () => {
    const mockNode = {
      data: {
        label: 'User Windows',
        properties: {
          windowType: 'Session Window' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Window Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Session Window')).toBeInTheDocument();
  });

  it('renders LogMessageProperties when label is Log Message', () => {
    const mockNode = {
      data: {
        label: 'Log Message',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Log Level')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Info')).toBeInTheDocument();
  });

  it('renders KVMapperProperties when label is KV Mapper', () => {
    const mockNode = {
      data: {
        label: 'KV Mapper',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Key Property Name')).toBeInTheDocument();
  });

  it('renders FilterProperties when label is Filter', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Compare Target')).toBeInTheDocument();
  });

  it('renders FlatMapProperties when label is FlatMap', () => {
    const mockNode = {
      data: {
        label: 'FlatMap',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Split via')).toBeInTheDocument();
  });

  it('renders MapProperties when label is Map', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Mapping Function / Expression')).toBeInTheDocument();
  });

  it('renders AggregationProperties when label is Approximate Quantiles', () => {
    const mockNode = {
      data: {
        label: 'Approximate Quantiles',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Computes approximate quantiles of the elements in a collection\./i)).toBeInTheDocument();
  });

  it('renders CreateProperties when label is Create', () => {
    const mockNode = {
      data: {
        label: 'Create',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('In-Memory Elements')).toBeInTheDocument();
  });

  it('renders ParDoProperties when label is ParDo', () => {
    const mockNode = {
      data: {
        label: 'ParDo',
        beam_transform: 'ParDo',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Code Generation Prompt')).toBeInTheDocument();
    expect(screen.getByText('System Instructions')).toBeInTheDocument();
  });

  it('renders OtherProperties when label is Flatten', () => {
    const mockNode = {
      data: {
        label: 'Flatten',
        beam_transform: 'Flatten',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Merges multiple PCollection objects of the same type into a single logical PCollection\./i)).toBeInTheDocument();
  });

  it('renders OtherProperties when label is ReShuffle', () => {
    const mockNode = {
      data: {
        label: 'ReShuffle',
        beam_transform: 'Reshuffle',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Redistributes elements across workers by assigning temporary random keys to break fusion and balance load\./i)).toBeInTheDocument();
  });

  it('renders TextIOSourceProperties when type is SOURCE and label is TextIO', () => {
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

  it('renders TextIOSinkProperties when type is SINK and label is TextIO', () => {
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

  it('renders FileIOSourceProperties when label is FileIO and type is SOURCE', () => {
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

  it('renders FileIOReadMatchesProperties when label is FileIO Read Matches', () => {
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

  it('renders FileIOSinkProperties when type is SINK and label is FileIO', () => {
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

  it('renders JdbcIOSourceProperties when type is SOURCE and label is JdbcIO', () => {
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

  it('renders JdbcIOSinkProperties when type is SINK and label is JdbcIO', () => {
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

  it('renders KafkaIOSourceProperties when type is SOURCE and label is Kafka', () => {
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

  it('renders KafkaIOSinkProperties when type is SINK and label is Kafka', () => {
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

  it('renders GenerateSequenceProperties when label or beam_transform is GenerateSequence', () => {
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

  it('renders PeriodicImpulseProperties when label or beam_transform is PeriodicImpulse', () => {
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

  it('renders KinesisIOSourceProperties when label or beam_transform is Kinesis SOURCE', () => {
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

  it('renders KinesisIOSinkProperties when label or beam_transform is Kinesis SINK', () => {
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

  it('renders AvroIOSourceProperties when label or beam_transform is AvroIO with type SOURCE', () => {
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

  it('renders AvroIOSinkProperties when label or beam_transform is AvroIO with type SINK', () => {
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

  it('renders SnsIOSourceProperties when label or beam_transform is SnsIO with type SOURCE', () => {
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

  it('renders SnsIOSinkProperties when label or beam_transform is SnsIO with type SINK', () => {
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

  it('renders JmsIOSourceProperties when label or beam_transform is JmsIO with type SOURCE', () => {
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

  it('renders JmsIOSinkProperties when label or beam_transform is JmsIO with type SINK', () => {
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

  it('renders MqttIOSourceProperties when label or beam_transform is MqttIO with type SOURCE', () => {
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

  it('renders MqttIOSinkProperties when label or beam_transform is MqttIO with type SINK', () => {
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
});


