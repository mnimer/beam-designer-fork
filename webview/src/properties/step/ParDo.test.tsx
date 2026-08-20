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

    const { container } = render(<ParDoProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Code Generation Prompt')).toBeInTheDocument();
    expect(container.querySelector('#pardoPrompt')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Note: Write instructions that cover what should happen to the incoming messages and what the output format should be.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText('System Instructions')).toBeInTheDocument();
    expect(
      container.querySelector('#pardoSystemInstructions')
    ).toHaveValue('Wrap the generated code in a try/catch, returning all errors to a separate pcollection');
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

    const { container } = render(<ParDoProperties node={mockNode} onChange={mockOnChange} />);

    const promptTextarea = container.querySelector('#pardoPrompt') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'Updated custom prompt' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      codeGenerationPrompt: 'Updated custom prompt',
      system_instructions: 'Wrap the generated code in a try/catch, returning all errors to a separate pcollection',
    }));
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

    const { container } = render(<ParDoProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#pardoSystemInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, { target: { value: 'Custom instructions' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      codeGenerationPrompt: 'My prompt',
      system_instructions: 'Custom instructions',
    }));
  });
});
