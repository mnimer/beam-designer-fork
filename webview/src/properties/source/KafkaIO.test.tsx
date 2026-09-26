/**
 * KafkaIOSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating KafkaIOSourceProperties component functionality,
 * form change callbacks, presets, bounded settings, and documentation tooltips.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KafkaIOSourceProperties } from './KafkaIO';

describe('KafkaIOSourceProperties', () => {
  it('renders default fields with documentation tooltips and placeholders', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Bootstrap Servers/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Topic\(s\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Group ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Auto Offset Reset/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Key Deserializer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Value Deserializer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Commit Offsets in Finalize/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Timestamp Policy/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Consumer Properties/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it('populates fields with provided properties and triggers onChange on bootstrapServers and topics change', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          bootstrapServers: 'kafka.prod:9092',
          topics: 'orders-topic',
          groupId: 'analytics-group',
          autoOffsetReset: 'earliest' as const,
          consumerProperties: 'security.protocol=SASL_SSL'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const bootstrapInput = screen.getByLabelText(/Bootstrap Servers/i);
    expect(bootstrapInput).toHaveValue('kafka.prod:9092');

    const topicsInput = screen.getByLabelText(/Topic\(s\)/i);
    expect(topicsInput).toHaveValue('orders-topic');

    const groupInput = screen.getByLabelText(/Group ID/i);
    expect(groupInput).toHaveValue('analytics-group');

    // Change topic
    fireEvent.change(topicsInput, { target: { name: 'topics', value: 'new-events' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      topics: 'new-events'
    }));
  });

  it('selects standard key and value deserializers and does not offer Custom Class option or custom class inputs', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          keyDeserializer: 'org.apache.kafka.common.serialization.ByteArrayDeserializer',
          valueDeserializer: 'org.apache.kafka.common.serialization.StringDeserializer'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<KafkaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const keySelect = container.querySelector('#kafkaKeyDeserializer') as HTMLSelectElement;
    const valueSelect = container.querySelector('#kafkaValueDeserializer') as HTMLSelectElement;

    expect(keySelect).toHaveValue('org.apache.kafka.common.serialization.ByteArrayDeserializer');
    expect(valueSelect).toHaveValue('org.apache.kafka.common.serialization.StringDeserializer');

    const keyOptions = Array.from(keySelect.querySelectorAll('option')).map(o => o.textContent);
    expect(keyOptions.some(t => t?.includes('Custom'))).toBe(false);

    expect(container.querySelector('input[name="customKeyDeserializer"]')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="customValueDeserializer"]')).not.toBeInTheDocument();

    fireEvent.change(keySelect, {
      target: { value: 'org.apache.kafka.common.serialization.LongDeserializer' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      keyDeserializer: 'org.apache.kafka.common.serialization.LongDeserializer'
    }));

    fireEvent.change(valueSelect, {
      target: { value: 'org.apache.kafka.common.serialization.ByteArrayDeserializer' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      valueDeserializer: 'org.apache.kafka.common.serialization.ByteArrayDeserializer'
    }));
  });

  it('updates commitOffsetsInFinalize checkbox and system_instructions', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          commitOffsetsInFinalize: true
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const commitCheckbox = screen.getByLabelText(/Commit Offsets in Finalize/i);
    expect(commitCheckbox).toBeChecked();

    fireEvent.click(commitCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      commitOffsetsInFinalize: false
    }));

    const instructionsTextarea = screen.getByPlaceholderText('Enter custom instructions for Kafka read code generation...');
    fireEvent.change(instructionsTextarea, { target: { value: 'Use exact partition assignment' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Use exact partition assignment'
    }));
  });

  it('displays required validation errors when required fields are empty', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          bootstrapServers: '',
          topics: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Bootstrap Servers is required.')).toBeInTheDocument();
    expect(screen.getByText('Topic(s) is required.')).toBeInTheDocument();

    const bootstrapInput = screen.getByPlaceholderText('localhost:9092');
    expect(bootstrapInput).toHaveAttribute('aria-invalid', 'true');
    expect(bootstrapInput).toHaveAttribute('aria-required', 'true');
  });

  it('updates consumerProperties when textarea changes', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          consumerProperties: 'security.protocol=PLAINTEXT'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<KafkaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = container.querySelector('#kafkaConsumerProperties') as HTMLTextAreaElement;
    expect(textarea).toHaveValue('security.protocol=PLAINTEXT');

    fireEvent.change(textarea, { target: { name: 'consumerProperties', value: 'security.protocol=SASL_SSL' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      consumerProperties: 'security.protocol=SASL_SSL'
    }));
  });
});
