
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SidebarItem } from './SidebarItem';

describe('SidebarItem', () => {
  it('renders label and icon', () => {
    render(<SidebarItem label="PubSub" type="SOURCE" iconName="Radio" onDragStart={vi.fn()} />);

    expect(screen.getByText('PubSub')).toBeInTheDocument();
  });

  it('calls onDragStart when dragged', () => {
    const mockOnDragStart = vi.fn();
    render(<SidebarItem label="PubSub" type="SOURCE" iconName="Radio" onDragStart={mockOnDragStart} />);

    const item = screen.getByText('PubSub').closest('div');
    
    if (!item) {
      throw new Error('Item not found');
    }

    fireEvent.dragStart(item);

    expect(mockOnDragStart).toHaveBeenCalled();
    // Verify arguments
    expect(mockOnDragStart).toHaveBeenCalledWith(
      expect.any(Object),
      'pipeline',
      'PubSub',
      'SOURCE',
      'Radio'
    );
  });
});
