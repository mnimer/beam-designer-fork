/**
 * Aggregations Properties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Comprehensive unit test suite for AggregationProperties step component.
 * Validates simple conditions, extreme conditions, failure conditions,
 * conditional UI for batching steps, and fallback hierarchies.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AggregationProperties } from './Aggregations';

describe('AggregationProperties', () => {
  // Simple condition: renders basic aggregation step with label, known description, and system instructions
  it('renders label, beam description, and system instructions for a standard aggregation step', () => {
    const mockNode = {
      data: {
        label: 'Count',
        properties: {
          system_instructions: 'Count items per key'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<AggregationProperties node={mockNode} onChange={mockOnChange} />);

    // Step label and description should be in document
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Counts the number of elements in a collection.')).toBeInTheDocument();

    // Code generation instructions textarea
    const instructionsTextarea = container.querySelector('#aggSystemInstructions') as HTMLTextAreaElement;
    expect(instructionsTextarea).toBeInTheDocument();
    expect(instructionsTextarea).toHaveValue('Count items per key');

    // Batch size should NOT be rendered for non-batch steps
    expect(container.querySelector('#aggBatchSize')).not.toBeInTheDocument();
  });

  // Edge condition: unknown transform or label falls back to default description
  it('renders fallback description when transform or label is not recognized', () => {
    const mockNode = {
      data: {
        label: 'CustomAggregation',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<AggregationProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('CustomAggregation')).toBeInTheDocument();
    expect(screen.getByText('Aggregation properties are currently empty.')).toBeInTheDocument();
  });

  // Conditional UI: renders batchSize input for batch steps
  it('renders Batch Size input when label is "Group Into Batches"', () => {
    const mockNode = {
      data: {
        label: 'Group Into Batches',
        properties: {
          batchSize: '500'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<AggregationProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Batch Size (.ofSize)')).toBeInTheDocument();
    const batchInput = container.querySelector('#aggBatchSize') as HTMLInputElement;
    expect(batchInput).toBeInTheDocument();
    expect(batchInput).toHaveValue(500);
  });

  it('renders Batch Size input when label is "Batch Elements"', () => {
    const mockNode = {
      data: {
        label: 'Batch Elements',
        properties: {
          batchSize: 100
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<AggregationProperties node={mockNode} onChange={mockOnChange} />);

    const batchInput = container.querySelector('#aggBatchSize') as HTMLInputElement;
    expect(batchInput).toBeInTheDocument();
    expect(batchInput).toHaveValue(100);
  });

  it('renders Batch Size input when beam_transform is "GroupIntoBatches"', () => {
    const mockNode = {
      data: {
        label: 'Custom Label',
        beam_transform: 'GroupIntoBatches',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<AggregationProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('#aggBatchSize')).toBeInTheDocument();
  });

  it('renders Batch Size input when beam_transform is "BatchElements"', () => {
    const mockNode = {
      data: {
        label: 'Custom Label',
        beam_transform: 'BatchElements',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<AggregationProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('#aggBatchSize')).toBeInTheDocument();
  });

  // Event handling: batch size changes propagate via onChange
  it('calls onChange when batchSize input changes', () => {
    const mockNode = {
      data: {
        label: 'Group Into Batches',
        properties: {
          batchSize: '10',
          customField: 'preserved'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<AggregationProperties node={mockNode} onChange={mockOnChange} />);

    const batchInput = container.querySelector('#aggBatchSize') as HTMLInputElement;
    fireEvent.change(batchInput, { target: { name: 'batchSize', value: '250' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      batchSize: '250',
      customField: 'preserved'
    });
  });

  // Event handling: instructions change propagates via onChange
  it('calls onChange when system_instructions textarea changes', () => {
    const mockNode = {
      data: {
        label: 'Sum',
        properties: {
          existingProp: 'test'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<AggregationProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = container.querySelector('#aggSystemInstructions') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Sum integer elements by key' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      existingProp: 'test',
      system_instructions: 'Sum integer elements by key'
    });
  });

  // Extreme / Failure condition: handles missing or undefined properties object without crashing
  it('handles missing or undefined properties gracefully', () => {
    const mockNode = {
      data: {
        label: 'Mean'
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<AggregationProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Mean')).toBeInTheDocument();
    expect(screen.getByText('Computes the arithmetic mean of elements in a collection.')).toBeInTheDocument();

    const textarea = container.querySelector('#aggSystemInstructions') as HTMLTextAreaElement;
    expect(textarea).toHaveValue('');

    // Changing textarea should construct properties cleanly
    fireEvent.change(textarea, { target: { value: 'Compute average' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      system_instructions: 'Compute average'
    });
  });

  // Extreme condition: handles empty and whitespace-only input
  it('handles empty and whitespace-only input for instructions and batchSize', () => {
    const mockNode = {
      data: {
        label: 'Group Into Batches',
        properties: {
          batchSize: '100',
          system_instructions: '   '
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<AggregationProperties node={mockNode} onChange={mockOnChange} />);

    const batchInput = container.querySelector('#aggBatchSize') as HTMLInputElement;
    const textarea = container.querySelector('#aggSystemInstructions') as HTMLTextAreaElement;

    expect(batchInput).toHaveValue(100);
    expect(textarea).toHaveValue('   ');

    fireEvent.change(batchInput, { target: { name: 'batchSize', value: '' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      batchSize: ''
    }));

    fireEvent.change(textarea, { target: { value: '' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: ''
    }));
  });

  // Instruction hierarchy: verifies fallback precedence
  describe('system_instructions fallback precedence', () => {
    it('prioritizes node.data.system_instructions over all other instruction fields', () => {
      const mockNode = {
        data: {
          label: 'Top',
          system_instructions: 'node system instructions',
          special_instructions: 'node special instructions',
          properties: {
            system_instructions: 'prop system instructions',
            special_instructions: 'prop special instructions'
          }
        }
      };
      const { container } = render(<AggregationProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#aggSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('node system instructions');
    });

    it('falls back to node.data.special_instructions if node system_instructions is undefined', () => {
      const mockNode = {
        data: {
          label: 'Top',
          special_instructions: 'node special instructions',
          properties: {
            system_instructions: 'prop system instructions',
            special_instructions: 'prop special instructions'
          }
        }
      };
      const { container } = render(<AggregationProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#aggSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('node special instructions');
    });

    it('falls back to properties.system_instructions if node-level instructions are undefined', () => {
      const mockNode = {
        data: {
          label: 'Top',
          properties: {
            system_instructions: 'prop system instructions',
            special_instructions: 'prop special instructions'
          }
        }
      };
      const { container } = render(<AggregationProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#aggSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('prop system instructions');
    });

    it('falls back to properties.special_instructions if preceding fields are undefined', () => {
      const mockNode = {
        data: {
          label: 'Top',
          properties: {
            special_instructions: 'prop special instructions'
          }
        }
      };
      const { container } = render(<AggregationProperties node={mockNode} onChange={vi.fn()} />);
      const textarea = container.querySelector('#aggSystemInstructions') as HTMLTextAreaElement;
      expect(textarea).toHaveValue('prop special instructions');
    });
  });
});
