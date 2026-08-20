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
  it('renders default fields with documentation tooltips and placeholders', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Bootstrap Servers/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Topic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Key Serializer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Value Serializer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Acks/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Exactly-Once Semantics \(EOS\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Producer Properties/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

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

  it('supports custom key and value serializers when custom preset is selected', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          keySerializer: 'custom',
          customKeySerializer: 'com.example.CustomKeySer',
          valueSerializer: 'custom',
          customValueSerializer: 'com.example.CustomValSer'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('com.example.MyCustomKeySerializer')).toHaveValue('com.example.CustomKeySer');
    expect(screen.getByPlaceholderText('com.example.MyCustomValueSerializer')).toHaveValue('com.example.CustomValSer');

    const customValueInput = screen.getByPlaceholderText('com.example.MyCustomValueSerializer');
    fireEvent.change(customValueInput, { target: { name: 'customValueSerializer', value: 'com.example.UpdatedValSer' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      customValueSerializer: 'com.example.UpdatedValSer'
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

  it('displays required error when custom serializer is selected but class name is empty', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          bootstrapServers: 'localhost:9092',
          topic: 'my-topic',
          keySerializer: 'custom',
          customKeySerializer: '',
          valueSerializer: 'custom',
          customValueSerializer: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Custom Key Serializer class is required.')).toBeInTheDocument();
    expect(screen.getByText('Custom Value Serializer class is required.')).toBeInTheDocument();
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
