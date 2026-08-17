import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ParDoProperties } from './ParDo';

describe('ParDoProperties', () => {
  it('renders Code Generation Prompt textarea, hint note, and default system instructions', () => {
    const mockNode = {
      data: {
        label: 'ParDo',
        beam_transform: 'ParDo',
        properties: {},
      },
    };
    const mockOnChange = vi.fn();

    render(<ParDoProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Code Generation Prompt')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter instructions for code generation...')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Note: Write instructions that cover what should happen to the incoming messages and what the output format should be.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('System Instructions')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('Wrap the generated code in a try/catch, returning all errors to a separate pcollection')
    ).toBeInTheDocument();
  });

  it('handles prompt changes and triggers onChange callback', () => {
    const mockNode = {
      data: {
        label: 'ParDo',
        properties: {
          codeGenerationPrompt: 'Initial prompt',
        },
      },
    };
    const mockOnChange = vi.fn();

    render(<ParDoProperties node={mockNode} onChange={mockOnChange} />);

    const promptTextarea = screen.getByPlaceholderText('Enter instructions for code generation...');
    fireEvent.change(promptTextarea, { target: { value: 'Updated custom prompt' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      codeGenerationPrompt: 'Updated custom prompt',
      system_instructions: 'Wrap the generated code in a try/catch, returning all errors to a separate pcollection',
    });
  });

  it('handles system instructions changes and triggers onChange callback', () => {
    const mockNode = {
      data: {
        label: 'ParDo',
        properties: {
          codeGenerationPrompt: 'My prompt',
        },
      },
    };
    const mockOnChange = vi.fn();

    render(<ParDoProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = screen.getByDisplayValue(
      'Wrap the generated code in a try/catch, returning all errors to a separate pcollection'
    );
    fireEvent.change(instructionsTextarea, { target: { value: 'Custom instructions' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      codeGenerationPrompt: 'My prompt',
      system_instructions: 'Custom instructions',
    });
  });
});
