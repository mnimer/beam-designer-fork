
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PipelineNode } from './PipelineNode';

// Mock React Flow handles
vi.mock('reactflow', () => ({
  Handle: ({ type, position, id }: any) => <div data-testid={`handle-${type}-${position}${id ? `-${id}` : ''}`} />,
  Position: {
    Left: 'left',
    Right: 'right'
  },
  useReactFlow: () => ({
    setNodes: vi.fn()
  })
}));

describe('PipelineNode', () => {
  const mockData = {
    label: 'Test Node',
    type: 'SOURCE',
    iconName: 'Radio'
  };

  it('renders label and type', () => {
    render(<PipelineNode id="node-1" data={mockData} />);

    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByText('SOURCE')).toBeInTheDocument();
  });

  it('renders target handle if not source', () => {
    const stepData = { ...mockData, type: 'STEP' };
    render(<PipelineNode id="node-1" data={stepData} />);

    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
  });

  it('does not render target handle if source', () => {
    render(<PipelineNode id="node-1" data={mockData} />);

    expect(screen.queryByTestId('handle-target-left')).not.toBeInTheDocument();
  });

  it('renders source handle for source node', () => {
    render(<PipelineNode id="node-1" data={mockData} />); // mockData is SOURCE

    expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
  });

  it('renders two source handles for regular step node', () => {
    const stepData = { ...mockData, type: 'STEP', label: 'Regular Step' };
    render(<PipelineNode id="node-1" data={stepData} />);

    expect(screen.getByTestId('handle-source-right-valid')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-right-error')).toBeInTheDocument();
  });

  it('renders target handle and no source handle for Log Message sink node', () => {
    const logSinkData = { ...mockData, type: 'SINK', label: 'Log Message' };
    render(<PipelineNode id="node-1" data={logSinkData} />);

    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
    expect(screen.queryByTestId('handle-source-right')).not.toBeInTheDocument();
    expect(screen.queryByTestId('handle-source-right-valid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('handle-source-right-error')).not.toBeInTheDocument();
  });

  it('does not render source handle if sink', () => {
    const sinkData = { ...mockData, type: 'SINK' };
    render(<PipelineNode id="node-1" data={sinkData} />);

    expect(screen.queryByTestId('handle-source-right')).not.toBeInTheDocument();
    expect(screen.queryByTestId('handle-source-right-valid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('handle-source-right-error')).not.toBeInTheDocument();
  });

  it('opens text input on label double-click and commits on Enter', () => {
    const handleLabelChange = vi.fn();
    const dataWithHandler = {
      ...mockData,
      onLabelChange: handleLabelChange
    };

    render(<PipelineNode id="node-1" data={dataWithHandler} />);

    const labelSpan = screen.getByText('Test Node');
    fireEvent.doubleClick(labelSpan);

    const input = screen.getByRole('textbox', { name: 'Edit node label' }) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Test Node');

    fireEvent.change(input, { target: { value: 'Renamed Node' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleLabelChange).toHaveBeenCalledWith('node-1', 'Renamed Node');
    expect(screen.queryByRole('textbox', { name: 'Edit node label' })).not.toBeInTheDocument();
  });

  it('cancels edit on Escape key and retains original label', () => {
    const handleLabelChange = vi.fn();
    const dataWithHandler = {
      ...mockData,
      onLabelChange: handleLabelChange
    };

    render(<PipelineNode id="node-1" data={dataWithHandler} />);

    const labelSpan = screen.getByText('Test Node');
    fireEvent.doubleClick(labelSpan);

    const input = screen.getByRole('textbox', { name: 'Edit node label' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed Node' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(handleLabelChange).not.toHaveBeenCalled();
    expect(screen.getByText('Test Node')).toBeInTheDocument();
  });

  it('commits edit on blur', () => {
    const handleLabelChange = vi.fn();
    const dataWithHandler = {
      ...mockData,
      onLabelChange: handleLabelChange
    };

    render(<PipelineNode id="node-1" data={dataWithHandler} />);

    const labelSpan = screen.getByText('Test Node');
    fireEvent.doubleClick(labelSpan);

    const input = screen.getByRole('textbox', { name: 'Edit node label' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Blurred Node' } });
    fireEvent.blur(input);

    expect(handleLabelChange).toHaveBeenCalledWith('node-1', 'Blurred Node');
  });

  it('opens text input when rename button is clicked', () => {
    const handleLabelChange = vi.fn();
    const dataWithHandler = {
      ...mockData,
      onLabelChange: handleLabelChange
    };

    render(<PipelineNode id="node-1" data={dataWithHandler} />);

    const renameButton = screen.getByRole('button', { name: 'Rename node' });
    fireEvent.click(renameButton);

    const input = screen.getByRole('textbox', { name: 'Edit node label' }) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Test Node');
  });

  it('renders green border for SOURCE, blue border for STEP, and red border for SINK', () => {
    const { rerender } = render(<PipelineNode id="node-src" data={{ ...mockData, type: 'SOURCE' }} />);
    const srcNode = screen.getByTestId('pipeline-node-node-src');
    expect(srcNode).toHaveClass('border-emerald-500/60');

    rerender(<PipelineNode id="node-step" data={{ ...mockData, type: 'STEP' }} />);
    const stepNode = screen.getByTestId('pipeline-node-node-step');
    expect(stepNode).toHaveClass('border-blue-500/40');

    rerender(<PipelineNode id="node-sink" data={{ ...mockData, type: 'SINK' }} />);
    const sinkNode = screen.getByTestId('pipeline-node-node-sink');
    expect(sinkNode).toHaveClass('border-rose-500/60');
  });

  it('renders themed ring and border when selected', () => {
    const { rerender } = render(<PipelineNode id="node-src" data={{ ...mockData, type: 'SOURCE' }} selected={true} />);
    const srcNode = screen.getByTestId('pipeline-node-node-src');
    expect(srcNode).toHaveClass('border-emerald-500');
    expect(srcNode).toHaveClass('ring-2');

    rerender(<PipelineNode id="node-sink" data={{ ...mockData, type: 'SINK' }} selected={true} />);
    const sinkNode = screen.getByTestId('pipeline-node-node-sink');
    expect(sinkNode).toHaveClass('border-rose-500');
    expect(sinkNode).toHaveClass('ring-2');
  });
});
