
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PropertyPane } from './PropertyPane';

describe('PropertyPane', () => {
  const mockNode = {
    id: '1',
    data: {
      label: 'Test Node',
      iconName: 'Box',
      type: 'STEP',
      properties: {}
    }
  };
  const mockRuntimeVariables = [
    { key: 'VAR1', value: 'val1' },
    { key: 'VAR2', value: 'val2' }
  ];

  it('renders node details, editable name input, and runtime variables', () => {
    const handleLabelChange = vi.fn();
    render(
      <PropertyPane 
        node={mockNode} 
        onChange={vi.fn()} 
        onLabelChange={handleLabelChange} 
        runtimeVariables={mockRuntimeVariables} 
      />
    );

    expect(screen.getByText('STEP')).toBeInTheDocument();
    const nameInput = screen.getByRole('textbox', { name: 'Node Name' }) as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.value).toBe('Test Node');
    expect(screen.getByText('NODE ID: 1')).toBeInTheDocument();
    expect(screen.getByText('$VAR1')).toBeInTheDocument();
    expect(screen.getByText('$VAR2')).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Updated Node Name' } });
    expect(handleLabelChange).toHaveBeenCalledWith('Updated Node Name');
  });

  it('copies variable name to clipboard when copy button is clicked', () => {
    // Mock navigator.clipboard
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      configurable: true
    });

    render(<PropertyPane node={mockNode} onChange={vi.fn()} runtimeVariables={mockRuntimeVariables} />);

    const copyButtons = screen.getAllByTitle('Copy to clipboard');
    fireEvent.click(copyButtons[0]);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('$VAR1');
  });

  it('renders PropertyPane for Create SOURCE node with JSON string elements (e.g. from avro-sink.beam)', async () => {
    const avroSinkSourceNode = {
      id: 'source-1',
      type: 'pipeline',
      data: {
        label: 'Create',
        type: 'SOURCE',
        iconName: 'Box',
        beam_transform: 'Create',
        properties: {
          elements: '["{\\"id\\": 1, \\\"name\\\": \\\"alpha\\\", \\\"score\\\": 99.5}", "{\\"id\\": 2, \\\"name\\\": \\\"beta\\\", \\\"score\\\": 88.0}"]'
        },
        system_instructions: 'In-memory test batch records.'
      }
    };

    render(
      <PropertyPane
        node={avroSinkSourceNode}
        onChange={vi.fn()}
        runtimeVariables={mockRuntimeVariables}
      />
    );

    expect(screen.getByText('SOURCE')).toBeInTheDocument();
    // The Create panel is code-split; wait for its chunk to load.
    expect(await screen.findByText('In-Memory Elements')).toBeInTheDocument();
    const textareas = screen.getAllByPlaceholderText(/Element \d/);
    expect(textareas).toHaveLength(2);
    expect(textareas[0]).toHaveValue('{"id": 1, "name": "alpha", "score": 99.5}');
    expect(textareas[1]).toHaveValue('{"id": 2, "name": "beta", "score": 88.0}');
  });

  it('renders resize handle along left edge and triggers onResizeStart on mousedown', () => {
    const handleResizeStart = vi.fn();
    render(
      <PropertyPane
        node={mockNode}
        onChange={vi.fn()}
        runtimeVariables={mockRuntimeVariables}
        onResizeStart={handleResizeStart}
      />
    );

    const handle = screen.getByTestId('property-pane-resize-handle');
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute('role', 'separator');
    expect(handle).toHaveAttribute('aria-label', 'Resize property panel');

    fireEvent.mouseDown(handle);
    expect(handleResizeStart).toHaveBeenCalledTimes(1);
  });

  it('renders close button when onClose is provided and triggers callback on click', () => {
    const handleClose = vi.fn();
    render(
      <PropertyPane
        node={mockNode}
        onChange={vi.fn()}
        runtimeVariables={mockRuntimeVariables}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByRole('button', { name: 'Close properties' });
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('applies custom width when width prop is provided', () => {
    const { container } = render(
      <PropertyPane
        node={mockNode}
        onChange={vi.fn()}
        runtimeVariables={mockRuntimeVariables}
        width={450}
      />
    );

    const rootPane = container.firstElementChild as HTMLElement;
    expect(rootPane.style.width).toBe('450px');
  });
});
