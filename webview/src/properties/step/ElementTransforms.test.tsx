import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FilterProperties } from './Filter';
import { FlatMapProperties } from './FlatMap';
import { MapProperties } from './Map';

describe('ElementTransforms Placeholders', () => {
  const mockNode = {
    data: {
      label: 'Filter'
    }
  };
  const mockOnChange = vi.fn();

  it('renders FilterProperties correctly', () => {
    render(<FilterProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText(/Filter properties are currently empty/i)).toBeInTheDocument();
  });

  it('renders FlatMapProperties correctly', () => {
    render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText(/FlatMap properties are currently empty/i)).toBeInTheDocument();
  });

  it('renders MapProperties correctly', () => {
    render(<MapProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText(/Map properties are currently empty/i)).toBeInTheDocument();
  });
});
