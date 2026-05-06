import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NodesCard } from './NodesCard';

describe('NodesCard', () => {
  const mockOnDragStart = vi.fn();

  it('renders tabs and disables STEPS and SINKS when nodesCount is 0', () => {
    const { rerender } = render(
      <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('SOURCES')).toBeInTheDocument();
    const stepsTab = screen.getByText('STEPS').closest('button');
    const sinksTab = screen.getByText('SINKS').closest('button');

    expect(stepsTab).toBeDisabled();
    expect(sinksTab).toBeDisabled();
  });

  it('enables STEPS and SINKS when nodesCount > 0', () => {
    render(
      <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={1} onDragStart={mockOnDragStart} />
    );

    const stepsTab = screen.getByText('STEPS').closest('button');
    const sinksTab = screen.getByText('SINKS').closest('button');

    expect(stepsTab).not.toBeDisabled();
    expect(sinksTab).not.toBeDisabled();
  });

  it('calls setActiveTab when clicking enabled tab', () => {
    const mockSetActiveTab = vi.fn();
    render(
      <NodesCard activeTab="SOURCES" setActiveTab={mockSetActiveTab} nodesCount={1} onDragStart={mockOnDragStart} />
    );

    fireEvent.click(screen.getByText('STEPS'));
    expect(mockSetActiveTab).toHaveBeenCalledWith('STEPS');
  });

  it('renders sources items when activeTab is SOURCES', () => {
    render(
      <NodesCard activeTab="SOURCES" setActiveTab={vi.fn()} nodesCount={0} onDragStart={mockOnDragStart} />
    );

    expect(screen.getByText('S3')).toBeInTheDocument();
    expect(screen.getByText('GCS')).toBeInTheDocument();
  });
});
