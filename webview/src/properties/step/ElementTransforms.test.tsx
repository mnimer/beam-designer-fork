import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FilterProperties } from './Filter';
import { FlatMapProperties } from './FlatMap';
import { MapProperties } from './Map';

describe('ElementTransforms Placeholders', () => {
  const mockNode: any = {
    data: {
      label: 'Filter'
    }
  };
  const mockOnChange = vi.fn();

  it('renders FilterProperties correctly', () => {
    render(<FilterProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText('Compare Target')).toBeInTheDocument();
  });

  it('renders FlatMapProperties correctly', () => {
    render(<FlatMapProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText('Split via')).toBeInTheDocument();
  });

  it('renders MapProperties correctly', () => {
    render(<MapProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText('Mapping Function / Expression')).toBeInTheDocument();
  });
});
