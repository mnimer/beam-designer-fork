/**
 * ParseMessage Properties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Comprehensive unit test suite for ParseMessageProperties step component.
 * Validates simple conditions, conditional helper text across decoder types,
 * extreme conditions, failure conditions, and fallback hierarchy.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ParseMessageProperties } from './ParseMessage';

describe('ParseMessageProperties', () => {
  // Simple condition: renders with default values when properties are empty
  it('renders default messageType as JSON and shows JSON helper text', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<ParseMessageProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Message Type')).toBeInTheDocument();
    expect(screen.getByText('Code Generation Instructions')).toBeInTheDocument();

    const select = container.querySelector('#parseMessageTypeSelect') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('JSON');

    // Default JSON helper text
    expect(
      screen.getByText('Parse JSON message payloads and convert them to structured Java Beans, Row, or Map / Dict formats.')
    ).toBeInTheDocument();

    const textarea = container.querySelector('#parseMessageSystemInstructions') as HTMLTextAreaElement;
    expect(textarea).toHaveValue('');
  });

  // Simple condition: renders with supplied properties for Base64
  it('renders Base64 messageType with Base64 helper text and supplied instructions', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {
          messageType: 'Base64' as const,
          system_instructions: 'Decode base64 payload into byte array'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<ParseMessageProperties node={mockNode} onChange={mockOnChange} />);

    const select = container.querySelector('#parseMessageTypeSelect') as HTMLSelectElement;
    expect(select).toHaveValue('Base64');

    expect(
      screen.getByText('Decode Base64 encoded byte payloads into raw binary or UTF-8 text.')
    ).toBeInTheDocument();

    const textarea = container.querySelector('#parseMessageSystemInstructions') as HTMLTextAreaElement;
    expect(textarea).toHaveValue('Decode base64 payload into byte array');
  });

  // Conditional UI: renders String helper text for String messageType
  it('renders String messageType with String helper text', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {
          messageType: 'String' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<ParseMessageProperties node={mockNode} onChange={mockOnChange} />);

    const select = container.querySelector('#parseMessageTypeSelect') as HTMLSelectElement;
    expect(select).toHaveValue('String');

    expect(
      screen.getByText('Decode message payload bytes into UTF-8 Strings.')
    ).toBeInTheDocument();
  });

  // Edge condition: handles unknown messageType with empty helper text
  it('handles unknown messageType gracefully with empty helper text', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {
          messageType: 'UnknownType' as any
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<ParseMessageProperties node={mockNode} onChange={mockOnChange} />);

    // None of the known helper texts should be present when an unknown type is provided
    expect(screen.queryByText(/Parse JSON/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Decode Base64/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Decode message payload bytes/i)).not.toBeInTheDocument();
  });

  // Event handling: changing messageType invokes onChange
  it('calls onChange when messageType select changes', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {
          messageType: 'JSON' as const,
          customProp: 'keepMe'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<ParseMessageProperties node={mockNode} onChange={mockOnChange} />);

    const select = container.querySelector('#parseMessageTypeSelect') as HTMLSelectElement;
    fireEvent.change(select, { target: { name: 'messageType', value: 'Base64' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      messageType: 'Base64',
      customProp: 'keepMe'
    });
  });

  // Event handling: changing system_instructions invokes onChange
  it('calls onChange when system_instructions textarea changes', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {
          messageType: 'String' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<ParseMessageProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = container.querySelector('#parseMessageSystemInstructions') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { name: 'system_instructions', value: 'Parse UTF-8 string' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      messageType: 'String',
      system_instructions: 'Parse UTF-8 string'
    });
  });

  // Extreme / Failure condition: handles missing or undefined properties gracefully
  it('handles missing or undefined properties object without crashing', () => {
    const mockNode = {
      data: {
        label: 'Parse Message'
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<ParseMessageProperties node={mockNode} onChange={mockOnChange} />);

    const select = container.querySelector('#parseMessageTypeSelect') as HTMLSelectElement;
    expect(select).toHaveValue('JSON');

    fireEvent.change(select, { target: { name: 'messageType', value: 'String' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      messageType: 'String'
    });
  });

  // Extreme condition: handles empty and whitespace-only input
  it('handles whitespace-only instructions and empty string inputs', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {
          system_instructions: '   '
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<ParseMessageProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = container.querySelector('#parseMessageSystemInstructions') as HTMLTextAreaElement;
    expect(textarea).toHaveValue('   ');

    fireEvent.change(textarea, { target: { name: 'system_instructions', value: '' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: ''
    }));
  });

  // Instruction hierarchy: verifies fallback precedence
  describe('system_instructions fallback precedence', () => {
    it('prioritizes node.data.system_instructions over other instruction fields', () => {
      const mockNode = {
        data: {
          label: 'Parse Message',
          system_instructions: 'node sys inst',
          special_instructions: 'node spec inst',
          properties: {
            system_instructions: 'prop sys inst',
            special_instructions: 'prop spec inst'
          }
        }
      };
      const { container } = render(<ParseMessageProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#parseMessageSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('node sys inst');
    });

    it('falls back to node.data.special_instructions if node system_instructions is undefined', () => {
      const mockNode = {
        data: {
          label: 'Parse Message',
          special_instructions: 'node spec inst',
          properties: {
            system_instructions: 'prop sys inst',
            special_instructions: 'prop spec inst'
          }
        }
      };
      const { container } = render(<ParseMessageProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#parseMessageSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('node spec inst');
    });

    it('falls back to properties.system_instructions if node-level fields are undefined', () => {
      const mockNode = {
        data: {
          label: 'Parse Message',
          properties: {
            system_instructions: 'prop sys inst',
            special_instructions: 'prop spec inst'
          }
        }
      };
      const { container } = render(<ParseMessageProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#parseMessageSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('prop sys inst');
    });

    it('falls back to properties.special_instructions when other fields are undefined', () => {
      const mockNode = {
        data: {
          label: 'Parse Message',
          properties: {
            special_instructions: 'prop spec inst'
          }
        }
      };
      const { container } = render(<ParseMessageProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#parseMessageSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('prop spec inst');
    });

    it('defaults to empty string when no instructions are defined', () => {
      const mockNode = {
        data: {
          label: 'Parse Message',
          properties: {}
        }
      };
      const { container } = render(<ParseMessageProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#parseMessageSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('');
    });
  });
});
