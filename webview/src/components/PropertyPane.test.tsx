
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
});
