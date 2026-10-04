/** @fileoverview Unit tests for NodeGroupAccordion component.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NodeGroupAccordion } from './NodeGroupAccordion';
import type { NodeDefinition } from '../../catalog/nodes';

describe('NodeGroupAccordion', () => {
  const mockItems: NodeDefinition[] = [
    {
      label: 'Pub/Sub Source',
      type: 'SOURCE',
      iconName: 'Radio',
      beamTransform: 'PubSubIO',
      badge: 'Streaming',
      description: 'Reads messages from a Google Cloud Pub/Sub topic or subscription.',
      category: 'Messaging Sources',
    },
    {
      label: 'Kafka Source',
      type: 'SOURCE',
      iconName: 'Radio',
      beamTransform: 'KafkaIO',
      badge: 'Streaming',
      description: 'Reads data from an Apache Kafka cluster.',
      category: 'Messaging Sources',
    },
  ];

  const defaultProps = {
    categoryName: 'Messaging Sources',
    items: mockItems,
    isOpen: true,
    groupName: 'palette-sources',
    activeTab: 'SOURCES',
    onToggle: vi.fn(),
    onDragStart: vi.fn(),
    onAddNode: vi.fn(),
  };

  it('renders category name, chevron, and items in the list', () => {
    render(<NodeGroupAccordion {...defaultProps} />);

    expect(screen.getByText('Messaging Sources')).toBeInTheDocument();
    expect(screen.getByText('drag to canvas')).toBeInTheDocument();
    expect(screen.getByText('Pub/Sub Source')).toBeInTheDocument();
    expect(screen.getByText('Kafka Source')).toBeInTheDocument();
  });

  it('reflects open state based on isOpen prop', () => {
    const { container, rerender } = render(<NodeGroupAccordion {...defaultProps} isOpen={true} />);
    const details = container.querySelector('details');
    expect(details).toHaveAttribute('open');

    rerender(<NodeGroupAccordion {...defaultProps} isOpen={false} />);
    expect(details).not.toHaveAttribute('open');
  });

  it('calls onToggle when details toggle event occurs', () => {
    const onToggle = vi.fn();
    const { container } = render(<NodeGroupAccordion {...defaultProps} onToggle={onToggle} />);
    const details = container.querySelector('details')!;

    fireEvent(details, new Event('toggle'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('invokes onAddNode when (+) add button is clicked on an item', () => {
    const onAddNode = vi.fn();
    render(<NodeGroupAccordion {...defaultProps} onAddNode={onAddNode} />);

    const addButton = screen.getByLabelText('Add Pub/Sub Source');
    fireEvent.click(addButton);

    expect(onAddNode).toHaveBeenCalledWith(
      'Pub/Sub Source',
      'SOURCE',
      'Radio',
      'PubSubIO'
    );
  });
});
