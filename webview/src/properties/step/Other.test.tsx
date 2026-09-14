/**
 * Other Properties Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit test suite for OtherProperties transform steps (Flatten, Reshuffle).
 * Validates descriptions, PropertyField instructions textarea change events,
 * edge conditions, and missing property fallbacks.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OtherProperties } from './Other';

describe('OtherProperties', () => {
  const mockOnChange = vi.fn();

  it('renders Flatten description correctly', () => {
    const mockNode: any = {
      data: {
        label: 'Flatten',
        beam_transform: 'Flatten'
      }
    };

    render(<OtherProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText('Flatten')).toBeInTheDocument();
    expect(screen.getByText(/Merges multiple PCollection objects of the same type/i)).toBeInTheDocument();
  });

  it('renders ReShuffle description correctly', () => {
    const mockNode: any = {
      data: {
        label: 'ReShuffle',
        beam_transform: 'Reshuffle'
      }
    };

    render(<OtherProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText('ReShuffle')).toBeInTheDocument();
    expect(screen.getByText(/Redistributes elements across workers by assigning temporary random keys/i)).toBeInTheDocument();
  });

  it('renders fallback description for unknown other node', () => {
    const mockNode: any = {
      data: {
        label: 'CustomOther'
      }
    };

    render(<OtherProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText('CustomOther')).toBeInTheDocument();
    expect(screen.getByText(/Transform properties are currently empty\./i)).toBeInTheDocument();
  });

  it('renders Code Generation Instructions and handles changes via PropertyField', () => {
    const onChange = vi.fn();
    const mockNode: any = {
      data: {
        label: 'Flatten',
        properties: {
          system_instructions: 'Merge two input streams'
        }
      }
    };

    const { container } = render(<OtherProperties node={mockNode} onChange={onChange} />);
    const textarea = container.querySelector('#otherSystemInstructions') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('Merge two input streams');

    fireEvent.change(textarea, { target: { value: 'Updated instruction' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated instruction'
    }));
  });

  it('handles empty properties gracefully without crashing', () => {
    const onChange = vi.fn();
    const mockNode: any = {
      data: {
        label: 'Flatten'
      }
    };

    const { container } = render(<OtherProperties node={mockNode} onChange={onChange} />);
    const textarea = container.querySelector('#otherSystemInstructions') as HTMLTextAreaElement;
    expect(textarea).toHaveValue('');

    fireEvent.change(textarea, { target: { value: 'Initial instruction' } });
    expect(onChange).toHaveBeenCalledWith({
      system_instructions: 'Initial instruction'
    });
  });
});
