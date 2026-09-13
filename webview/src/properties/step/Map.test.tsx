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
  it('renders mappingFunction, outputType, static description, and system instructions', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          mappingFunction: 'element -> element.toUpperCase()',
          outputType: 'String',
          system_instructions: 'Convert input string to upper case'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    // Check labels and inputs
    expect(screen.getByText('Mapping Function / Expression')).toBeInTheDocument();
    expect(screen.getByText('Output Type Descriptor')).toBeInTheDocument();
    expect(screen.getByText('Code Generation Instructions')).toBeInTheDocument();

    const funcInput = container.querySelector('#mapFunctionInput') as HTMLInputElement;
    const typeInput = container.querySelector('#mapOutputTypeInput') as HTMLInputElement;
    const instructionsTextarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;

    expect(funcInput).toHaveValue('element -> element.toUpperCase()');
    expect(typeInput).toHaveValue('String');
    expect(instructionsTextarea).toHaveValue('Convert input string to upper case');

    // Informational description text
    expect(
      screen.getByText('Apply a 1-to-1 transformation mapping function to each input element.')
    ).toBeInTheDocument();
  });

  // Event handling: mapping function change propagates via onChange
  it('calls onChange when mappingFunction changes', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          mappingFunction: 'element -> element',
          outputType: 'Integer'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const funcInput = container.querySelector('#mapFunctionInput') as HTMLInputElement;
    fireEvent.change(funcInput, { target: { name: 'mappingFunction', value: 'element -> element * 2' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      mappingFunction: 'element -> element * 2',
      outputType: 'Integer'
    });
  });

  // Event handling: output type change propagates via onChange
  it('calls onChange when outputType changes', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          mappingFunction: 'element -> element.length()',
          outputType: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const typeInput = container.querySelector('#mapOutputTypeInput') as HTMLInputElement;
    fireEvent.change(typeInput, { target: { name: 'outputType', value: 'KV<String, Integer>' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      mappingFunction: 'element -> element.length()',
      outputType: 'KV<String, Integer>'
    });
  });

  // Event handling: system instructions change propagates via onChange
  it('calls onChange when system_instructions changes', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          mappingFunction: 'element -> element',
          system_instructions: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Transform records to DTOs' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      mappingFunction: 'element -> element',
      system_instructions: 'Transform records to DTOs'
    });
  });

  // Extreme / Failure condition: handles missing or undefined properties gracefully
  it('handles missing or undefined properties object without crashing', () => {
    const mockNode = {
      data: {
        label: 'Map'
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const funcInput = container.querySelector('#mapFunctionInput') as HTMLInputElement;
    const typeInput = container.querySelector('#mapOutputTypeInput') as HTMLInputElement;
    const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;

    expect(funcInput).toHaveValue('');
    expect(typeInput).toHaveValue('');
    expect(textarea).toHaveValue('');

    // Editing field on initially undefined properties builds the object correctly
    fireEvent.change(funcInput, { target: { name: 'mappingFunction', value: 'elem -> elem' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      mappingFunction: 'elem -> elem'
    });
  });

  // Extreme condition: handles empty and whitespace-only input
  it('handles empty and whitespace-only strings across all inputs', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          mappingFunction: '   ',
          outputType: '   ',
          system_instructions: '   '
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const funcInput = container.querySelector('#mapFunctionInput') as HTMLInputElement;
    const typeInput = container.querySelector('#mapOutputTypeInput') as HTMLInputElement;
    const textarea = container.querySelector('#mapSystemInstructions') as HTMLTextAreaElement;

    expect(funcInput).toHaveValue('   ');
    expect(typeInput).toHaveValue('   ');
    expect(textarea).toHaveValue('   ');

    fireEvent.change(funcInput, { target: { name: 'mappingFunction', value: '' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ mappingFunction: '' }));

    fireEvent.change(typeInput, { target: { name: 'outputType', value: '' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ outputType: '' }));

    fireEvent.change(textarea, { target: { value: '' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ system_instructions: '' }));
  });

  // Extreme condition: preserves other existing properties
  it('preserves unrelated node properties when modifying map fields', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {
          mappingFunction: 'oldFunc',
          customKey1: 123,
          customKey2: { nested: true }
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MapProperties node={mockNode} onChange={mockOnChange} />);

    const typeInput = container.querySelector('#mapOutputTypeInput') as HTMLInputElement;
    fireEvent.change(typeInput, { target: { name: 'outputType', value: 'String' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      mappingFunction: 'oldFunc',
      customKey1: 123,
      customKey2: { nested: true },
      outputType: 'String'
    });
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
