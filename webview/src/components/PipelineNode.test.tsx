
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

  it('renders label and type with correct color styling for SOURCE', () => {
    const { container } = render(<PipelineNode id="node-1" data={mockData} />);

    expect(screen.getByText('Test Node')).toBeInTheDocument();
    const typeElement = screen.getByText('SOURCE');
    expect(typeElement).toBeInTheDocument();
    expect(typeElement).toHaveClass('text-emerald-400');
    expect(container.firstChild).toHaveClass('border-emerald-500');
  });

  it('renders correct border and text color for STEP', () => {
    const stepData = { ...mockData, type: 'STEP' };
    const { container } = render(<PipelineNode id="node-1" data={stepData} />);

    const typeElement = screen.getByText('STEP');
    expect(typeElement).toHaveClass('text-blue-400');
    expect(container.firstChild).toHaveClass('border-blue-500');
  });

  it('renders correct border and text color for SINK', () => {
    const sinkData = { ...mockData, type: 'SINK' };
    const { container } = render(<PipelineNode id="node-1" data={sinkData} />);

    const typeElement = screen.getByText('SINK');
    expect(typeElement).toHaveClass('text-red-400');
    expect(container.firstChild).toHaveClass('border-red-500');
  });

  it('renders selected styling for SOURCE, STEP, and SINK nodes', () => {
    const { container: sourceContainer } = render(<PipelineNode id="node-1" data={mockData} selected={true} />);
    expect(sourceContainer.firstChild).toHaveClass('border-emerald-400');
    expect(sourceContainer.firstChild).toHaveClass('ring-2');

    const { container: stepContainer } = render(<PipelineNode id="node-2" data={{ ...mockData, type: 'STEP' }} selected={true} />);
    expect(stepContainer.firstChild).toHaveClass('border-blue-400');
    expect(stepContainer.firstChild).toHaveClass('ring-2');

    const { container: sinkContainer } = render(<PipelineNode id="node-3" data={{ ...mockData, type: 'SINK' }} selected={true} />);
    expect(sinkContainer.firstChild).toHaveClass('border-red-400');
    expect(sinkContainer.firstChild).toHaveClass('ring-2');
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

  it('renders target handle for FhirIO source in readResources mode so upstream PubSubIO can connect', () => {
    render(
      <PipelineNode
        id="fhir-1"
        data={{
          ...mockData,
          label: 'FhirIO',
          beam_transform: 'FhirIO',
          properties: { readMode: 'readResources' }
        }}
      />
    );

    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
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

  it('renders pulsing crimson border and AlertCircle badge when hasCycle is true', () => {
    const cycleData = {
      ...mockData,
      type: 'STEP',
      hasCycle: true,
      validationError: 'Cyclic dependency detected: Step 1 -> Step 2 -> Step 1',
    };
    render(<PipelineNode id="node-cycle" data={cycleData} />);
    const node = screen.getByTestId('pipeline-node-node-cycle');
    expect(node).toHaveClass('border-rose-500');
    expect(node).toHaveClass('animate-pulse');

    const badge = screen.getByTestId('cycle-error-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', 'Cyclic dependency detected: Step 1 -> Step 2 -> Step 1');
  });

  it('renders dashed amber border and AlertTriangle badge when isOrphan is true', () => {
    const orphanData = {
      ...mockData,
      type: 'STEP',
      isOrphan: true,
      validationWarning: 'Orphan step: node is not connected to the pipeline',
    };
    render(<PipelineNode id="node-orphan" data={orphanData} />);
    const node = screen.getByTestId('pipeline-node-node-orphan');
    expect(node).toHaveClass('border-amber-500');
    expect(node).toHaveClass('border-dashed');

    const badge = screen.getByTestId('orphan-warning-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', 'Orphan step: node is not connected to the pipeline');
  });

  it('renders red dashed outline and retains target handle when FhirIO hasValidationError in searchResources mode', () => {
    const errorData = {
      ...mockData,
      label: 'FhirIO',
      type: 'SOURCE',
      beam_transform: 'FhirIO',
      properties: { readMode: 'searchResources' },
      hasValidationError: true,
      validationError: 'FhirIO.searchResources() does not accept an upstream connection.',
    };
    render(<PipelineNode id="node-fhir-err" data={errorData} selected={true} />);
    const node = screen.getByTestId('pipeline-node-node-fhir-err');
    expect(node).toHaveClass('border-red-500');
    expect(node).toHaveClass('border-dashed');
    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
    expect(screen.getByTestId('cycle-error-badge')).toHaveAttribute(
      'title',
      'FhirIO.searchResources() does not accept an upstream connection.'
    );
  });

  it('renders target handle for DicomIO in readStudyMetadata mode and red dashed outline when hasValidationError in dicomSearch mode', () => {
    const { rerender } = render(
      <PipelineNode
        id="node-dicom"
        data={{
          ...mockData,
          label: 'DicomIO',
          type: 'SOURCE',
          beam_transform: 'DicomIO',
          properties: { readMode: 'readStudyMetadata' },
        }}
      />
    );
    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();

    rerender(
      <PipelineNode
        id="node-dicom"
        data={{
          ...mockData,
          label: 'DicomIO',
          type: 'SOURCE',
          beam_transform: 'DicomIO',
          properties: { readMode: 'dicomSearch' },
          hasValidationError: true,
          validationError: 'DicomIO.dicomSearch() does not accept an upstream connection.',
        }}
        selected={true}
      />
    );
    const node = screen.getByTestId('pipeline-node-node-dicom');
    expect(node).toHaveClass('border-red-500');
    expect(node).toHaveClass('border-dashed');
    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
  });
});


