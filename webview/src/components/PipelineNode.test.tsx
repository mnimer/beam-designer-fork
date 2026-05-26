
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PipelineNode } from './PipelineNode';

// Mock React Flow handles
vi.mock('reactflow', () => ({
  Handle: ({ type, position, id }: any) => <div data-testid={`handle-${type}-${position}${id ? `-${id}` : ''}`} />,
  Position: {
    Left: 'left',
    Right: 'right'
  }
}));

describe('PipelineNode', () => {
  const mockData = {
    label: 'Test Node',
    type: 'SOURCE',
    iconName: 'Radio'
  };

  it('renders label and type', () => {
    render(<PipelineNode data={mockData} />);

    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByText('SOURCE')).toBeInTheDocument();
  });

  it('renders target handle if not source', () => {
    const stepData = { ...mockData, type: 'STEP' };
    render(<PipelineNode data={stepData} />);

    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
  });

  it('does not render target handle if source', () => {
    render(<PipelineNode data={mockData} />);

    expect(screen.queryByTestId('handle-target-left')).not.toBeInTheDocument();
  });

  it('renders source handle for source node', () => {
    render(<PipelineNode data={mockData} />); // mockData is SOURCE

    expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
  });

  it('renders two source handles for regular step node', () => {
    const stepData = { ...mockData, type: 'STEP', label: 'Regular Step' };
    render(<PipelineNode data={stepData} />);

    expect(screen.getByTestId('handle-source-right-valid')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-right-error')).toBeInTheDocument();
  });

  it('renders only one valid source handle for Log Message step node', () => {
    const logStepData = { ...mockData, type: 'STEP', label: 'Log Message' };
    render(<PipelineNode data={logStepData} />);

    expect(screen.getByTestId('handle-source-right-valid')).toBeInTheDocument();
    expect(screen.queryByTestId('handle-source-right-error')).not.toBeInTheDocument();
  });

  it('does not render source handle if sink', () => {
    const sinkData = { ...mockData, type: 'SINK' };
    render(<PipelineNode data={sinkData} />);

    expect(screen.queryByTestId('handle-source-right')).not.toBeInTheDocument();
    expect(screen.queryByTestId('handle-source-right-valid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('handle-source-right-error')).not.toBeInTheDocument();
  });
});
