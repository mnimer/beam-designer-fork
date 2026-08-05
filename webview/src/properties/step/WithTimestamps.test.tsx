import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WithTimestampsProperties, generateTimestampSystemInstruction } from './WithTimestamps';
import { PropertyForm } from '../../components/PropertyForm';

describe('WithTimestampsProperties', () => {
  it('renders default Current Time option without Property Name input', () => {
    const mockNode = {
      data: {
        label: 'Add Timestamp',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<WithTimestampsProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Timestamp Source')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Current Time')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. event_timestamp')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Attach current system time to each element.')).toBeInTheDocument();
  });

  it('shows Property Name input and updates system instructions when Message Property is selected', () => {
    const mockNode = {
      data: {
        label: 'Add Timestamp',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<WithTimestampsProperties node={mockNode} onChange={mockOnChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Message Property' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      timestampType: 'Message Property',
      propertyName: '',
      system_instructions: 'Extract timestamp from message field.'
    });
  });

  it('updates system instructions when propertyName changes', () => {
    const mockNode = {
      data: {
        label: 'Add Timestamp',
        properties: {
          timestampType: 'Message Property' as const,
          propertyName: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<WithTimestampsProperties node={mockNode} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText('e.g. event_timestamp');
    fireEvent.change(input, { target: { value: 'created_at' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      timestampType: 'Message Property',
      propertyName: 'created_at',
      system_instructions: "Extract timestamp from message field 'created_at'."
    });
  });

  it('shows Property Name input and updates system instructions for Header Property', () => {
    const mockNode = {
      data: {
        label: 'Add Timestamp',
        properties: {
          timestampType: 'Header Property' as const,
          propertyName: 'publish_time'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<WithTimestampsProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('publish_time')).toBeInTheDocument();
    expect(screen.getByDisplayValue("Extract timestamp from message header 'publish_time'.")).toBeInTheDocument();
  });

  it('renders WithTimestampsProperties via PropertyForm for Add Timestamp node', () => {
    const mockNode = {
      data: {
        label: 'Add Timestamp',
        beam_transform: 'WithTimestamps',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Timestamp Source')).toBeInTheDocument();
  });
});

describe('generateTimestampSystemInstruction', () => {
  it('generates correct instructions for each option', () => {
    expect(generateTimestampSystemInstruction('Current Time', '')).toBe('Attach current system time to each element.');
    expect(generateTimestampSystemInstruction('Message Property', '')).toBe('Extract timestamp from message field.');
    expect(generateTimestampSystemInstruction('Message Property', 'event_date')).toBe("Extract timestamp from message field 'event_date'.");
    expect(generateTimestampSystemInstruction('Header Property', 'pub_time')).toBe("Extract timestamp from message header 'pub_time'.");
  });
});
