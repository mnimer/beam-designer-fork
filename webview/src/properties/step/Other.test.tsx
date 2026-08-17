import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText(/Flatten properties are currently empty\. Merges multiple PCollection objects of the same type into a single logical PCollection\./i)).toBeInTheDocument();
  });

  it('renders ReShuffle description correctly', () => {
    const mockNode: any = {
      data: {
        label: 'ReShuffle',
        beam_transform: 'Reshuffle'
      }
    };

    render(<OtherProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText(/ReShuffle properties are currently empty\. Redistributes elements across workers by assigning temporary random keys to break fusion and balance load\./i)).toBeInTheDocument();
  });

  it('renders fallback description for unknown other node', () => {
    const mockNode: any = {
      data: {
        label: 'CustomOther'
      }
    };

    render(<OtherProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText(/CustomOther properties are currently empty\. Transform properties are currently empty\./i)).toBeInTheDocument();
  });
});
