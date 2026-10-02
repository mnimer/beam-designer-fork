/**
 * KafkaIOSinkProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating KafkaIOSinkProperties component functionality,
 * form change callbacks, presets, acks options, EOS configuration, and documentation tooltips.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KafkaIOSinkProperties } from './KafkaIO';

describe('KafkaIOSinkProperties', () => {

  it('populates fields with provided properties and triggers onChange on bootstrapServers and topic change', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          bootstrapServers: 'kafka-cluster:9092',
          topic: 'output-events',
          acks: '1' as const,
          producerProperties: 'compression.type=gzip'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const bootstrapInput = screen.getByLabelText(/Bootstrap Servers/i);
    expect(bootstrapInput).toHaveValue('kafka-cluster:9092');

    const topicInput = screen.getByLabelText(/^Topic/i);
    expect(topicInput).toHaveValue('output-events');

    const acksSelect = screen.getByLabelText(/Acks/i);
    expect(acksSelect).toHaveValue('1');

    // Change topic
    fireEvent.change(topicInput, { target: { name: 'topic', value: 'processed-orders' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'processed-orders'
    }));
  });

  it('selects standard key and value serializers and does not offer Custom Class option or custom class inputs', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          keySerializer: 'org.apache.kafka.common.serialization.ByteArraySerializer',
          valueSerializer: 'org.apache.kafka.common.serialization.StringSerializer'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<KafkaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const keySelect = container.querySelector('#kafkaKeySerializer') as HTMLSelectElement;
    const valueSelect = container.querySelector('#kafkaValueSerializer') as HTMLSelectElement;

    expect(keySelect).toHaveValue('org.apache.kafka.common.serialization.ByteArraySerializer');
    expect(valueSelect).toHaveValue('org.apache.kafka.common.serialization.StringSerializer');

    const keyOptions = Array.from(keySelect.querySelectorAll('option')).map(o => o.textContent);
    expect(keyOptions.some(t => t?.includes('Custom'))).toBe(false);

    expect(container.querySelector('input[name="customKeySerializer"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="customValueSerializer"]')).not.toBeInTheDocument();

    fireEvent.change(keySelect, {
      target: { value: 'org.apache.kafka.common.serialization.LongSerializer' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      keySerializer: 'org.apache.kafka.common.serialization.LongSerializer'
    }));

    fireEvent.change(valueSelect, {
      target: { value: 'org.apache.kafka.common.serialization.ByteArraySerializer' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      valueSerializer: 'org.apache.kafka.common.serialization.ByteArraySerializer'
    }));
  });

  it('toggles EOS configuration inputs when useEOS is enabled', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          useEOS: true,
          eosNumPartitions: '12',
          eosSinkGroupId: 'my-eos-group'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/^Num Partitions/i)).toHaveValue(12);
    expect(screen.getByLabelText(/^Sink Group ID/i)).toHaveValue('my-eos-group');

    const partitionsInput = screen.getByLabelText(/^Num Partitions/i);
    fireEvent.change(partitionsInput, { target: { name: 'eosNumPartitions', value: '16' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      eosNumPartitions: '16'
    }));
  });

  it('updates system_instructions when textarea changes', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = screen.getByPlaceholderText('Enter custom instructions for Kafka write code generation...');
    fireEvent.change(instructionsTextarea, { target: { value: 'Write with custom timestamp metadata' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Write with custom timestamp metadata'
    }));
  });

  it('displays required validation errors when required fields are empty', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          bootstrapServers: '',
          topic: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Bootstrap Servers is required.')).toBeInTheDocument();
    expect(screen.getByText('Topic is required.')).toBeInTheDocument();

    const bootstrapInput = screen.getByPlaceholderText('localhost:9092');
    expect(bootstrapInput).toHaveAttribute('aria-invalid', 'true');
    expect(bootstrapInput).toHaveAttribute('aria-required', 'true');
  });

  it('displays required error for EOS fields when EOS is enabled but partition count or sink group ID is missing', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          bootstrapServers: 'localhost:9092',
          topic: 'my-topic',
          useEOS: true,
          eosNumPartitions: '',
          eosSinkGroupId: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Num Partitions (> 0) is required for EOS.')).toBeInTheDocument();
    expect(screen.getByText('Sink Group ID is required for EOS.')).toBeInTheDocument();
  });
});
