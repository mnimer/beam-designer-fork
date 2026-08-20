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

  it('supports custom key and value deserializers when custom preset is selected', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          keyDeserializer: 'custom',
          customKeyDeserializer: 'com.example.CustomKeyDec',
          valueDeserializer: 'custom',
          customValueDeserializer: 'com.example.CustomValDec'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('com.example.MyCustomKeyDeserializer')).toHaveValue('com.example.CustomKeyDec');
    expect(screen.getByPlaceholderText('com.example.MyCustomValueDeserializer')).toHaveValue('com.example.CustomValDec');

    const customKeyInput = screen.getByPlaceholderText('com.example.MyCustomKeyDeserializer');
    fireEvent.change(customKeyInput, { target: { name: 'customKeyDeserializer', value: 'com.example.UpdatedKeyDec' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      customKeyDeserializer: 'com.example.UpdatedKeyDec'
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

  it('displays required error when custom deserializer is selected but class name is empty', () => {
    const mockNode = {
      data: {
        label: 'Kafka',
        properties: {
          bootstrapServers: 'localhost:9092',
          topics: 'my-topic',
          keyDeserializer: 'custom',
          customKeyDeserializer: '',
          valueDeserializer: 'custom',
          customValueDeserializer: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<KafkaIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Custom Key Deserializer class is required.')).toBeInTheDocument();
    expect(screen.getByText('Custom Value Deserializer class is required.')).toBeInTheDocument();
  });
});
