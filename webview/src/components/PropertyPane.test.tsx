
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

  it('renders node details and runtime variables', () => {
    render(<PropertyPane node={mockNode} onChange={vi.fn()} runtimeVariables={mockRuntimeVariables} />);

    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByText('NODE ID: 1')).toBeInTheDocument();
    expect(screen.getByText('$VAR1')).toBeInTheDocument();
    expect(screen.getByText('$VAR2')).toBeInTheDocument();
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
