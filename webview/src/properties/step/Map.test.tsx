/**
 * Map Properties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Comprehensive unit test suite for MapProperties step component.
 * Validates simple conditions, extreme conditions, failure conditions,
 * input modifications, and instruction fallback hierarchy.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MapProperties } from './Map';

describe('MapProperties', () => {
  // Simple condition: renders all input fields with supplied properties
  it('renders outputType select, static description, and system instructions', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          outputType: 'String',
          system_instructions: 'Convert input string to upper case'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    // Check labels and inputs
    expect(screen.getByText('Output Data Type')).toBeInTheDocument();
    expect(screen.getByText('Code Generation Instructions')).toBeInTheDocument();

    const typeSelect = container.querySelector('#mapOutputTypeSelect') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;

    expect(typeSelect).toHaveValue('String');
    expect(instructionsTextarea).toHaveValue('Convert input string to upper case');

    // Informational description text
    // NOTE: the hint deliberately stops at the one-line summary. An earlier design dropped the
    // Mapping Function field and had the hint say the generator wrote it; that was reverted.
    expect(
      screen.getByText('Apply a 1-to-1 transformation to each input element.')
    ).toBeInTheDocument();
  });

  // Event handling: selecting an output type calls onChange with new outputType and preserves other properties
  it('calls onChange when outputType changes and preserves other properties', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          outputType: 'String',
          customKey1: 123,
          customKey2: { nested: true }
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const typeSelect = container.querySelector('#mapOutputTypeSelect') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { name: 'outputType', value: 'TableRow' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      outputType: 'TableRow',
      customKey1: 123,
      customKey2: { nested: true }
    });
  });

  // Event handling: system instructions change propagates via onChange
  it('calls onChange when system_instructions changes', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          outputType: 'Integer',
          system_instructions: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Transform records to DTOs' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      outputType: 'Integer',
      system_instructions: 'Transform records to DTOs'
    });
  });

  // Edge condition: custom class not in static list still renders as selected option (prevents silent data loss)
  it('renders custom class outputType not in static list as selected option to prevent silent data loss', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          outputType: 'ProcessedItemRecord'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const typeSelect = container.querySelector('#mapOutputTypeSelect') as HTMLSelectElement;
    expect(typeSelect).toBeInTheDocument();
    expect(typeSelect.value).toBe('ProcessedItemRecord');

    const options = Array.from(typeSelect.options);
    expect(options[0].value).toBe('');
    expect(options[0].textContent).toBe('Select output type…');
    expect(options[1].value).toBe('ProcessedItemRecord');
    expect(options[1].textContent).toBe('ProcessedItemRecord (custom)');
  });

  // Edge condition: handles empty or absent properties without crashing and renders placeholder selected
  it('renders placeholder option selected and does not crash when properties are empty or absent', () => {
    const mockNode = {
      data: {
        label: 'Map'
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const typeSelect = container.querySelector('#mapOutputTypeSelect') as HTMLSelectElement;
    const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;

    expect(typeSelect).toBeInTheDocument();
    expect(typeSelect.value).toBe('');
    expect(textarea).toHaveValue('');

    // Changing selection on initially absent properties builds the object correctly
    fireEvent.change(typeSelect, { target: { name: 'outputType', value: 'String' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      outputType: 'String'
    });
  });

  // Normal condition: the mapping expression is the node's specification, so it must
  // render, show its worked example, and round-trip through onChange.
  it('renders the mapping function field with a worked example and persists edits', () => {
    const mockOnChange = vi.fn();
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          mappingFunction: 'line -> line.toUpperCase()',
          outputType: 'String'
        }
      }
    };
    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Mapping Function / Expression')).toBeInTheDocument();

    const input = container.querySelector('#mapFunctionInput') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('line -> line.toUpperCase()');
    expect(input.placeholder).toBe('e.g. element -> element.toUpperCase()');

    fireEvent.change(input, { target: { name: 'mappingFunction', value: 'x -> x.trim()' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      mappingFunction: 'x -> x.trim()',
      outputType: 'String'
    });
  });

  // Extreme condition: handles empty and whitespace-only strings
  it('handles empty and whitespace-only strings across inputs', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          outputType: '',
          system_instructions: '   '
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const typeSelect = container.querySelector('#mapOutputTypeSelect') as HTMLSelectElement;
    const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;

    expect(typeSelect).toHaveValue('');
    expect(textarea).toHaveValue('   ');

    fireEvent.change(typeSelect, { target: { name: 'outputType', value: 'Double' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ outputType: 'Double' }));

    fireEvent.change(textarea, { target: { value: '' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ system_instructions: '' }));
  });

  // Instruction hierarchy: verifies fallback precedence
  describe('system_instructions fallback precedence', () => {
    it('prioritizes node.data.system_instructions over other instruction fields', () => {
      const mockNode = {
        data: {
          label: 'Map',
          system_instructions: 'node sys inst',
          special_instructions: 'node spec inst',
          properties: {
            system_instructions: 'prop sys inst',
            special_instructions: 'prop spec inst'
          }
        }
      };
      const { container } = render(<MapProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('node sys inst');
    });

    it('falls back to node.data.special_instructions if node system_instructions is undefined', () => {
      const mockNode = {
        data: {
          label: 'Map',
          special_instructions: 'node spec inst',
          properties: {
            system_instructions: 'prop sys inst',
            special_instructions: 'prop spec inst'
          }
        }
      };
      const { container } = render(<MapProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('node spec inst');
    });

    it('falls back to properties.system_instructions if node-level fields are undefined', () => {
      const mockNode = {
        data: {
          label: 'Map',
          properties: {
            system_instructions: 'prop sys inst',
            special_instructions: 'prop spec inst'
          }
        }
      };
      const { container } = render(<MapProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('prop sys inst');
    });

    it('falls back to properties.special_instructions when other fields are undefined', () => {
      const mockNode = {
        data: {
          label: 'Map',
          properties: {
            special_instructions: 'prop spec inst'
          }
        }
      };
      const { container } = render(<MapProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('prop spec inst');
    });

    it('defaults to empty string when no instructions are defined', () => {
      const mockNode = {
        data: {
          label: 'Map',
          properties: {}
        }
      };
      const { container } = render(<MapProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('');
    });
  });
});
