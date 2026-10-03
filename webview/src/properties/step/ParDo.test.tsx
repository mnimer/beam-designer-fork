/**
 * Unit tests for the ParDo property panel.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Covers the Docs ↗ header link, code generation prompt, system instructions, and the
 * Side Inputs section (F1): empty state, binding list rendering, variable name edits,
 * view type selection, conditional default value fields for SINGLETON, refresh pattern
 * selection, and the conditional update interval for slowly-updating patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ParDoProperties } from './ParDo';
import type { SideInputBinding } from '../../../../src/shared/sideInputs';

const openNodeDocsMock = vi.fn();
vi.mock('../../utils/nodeDocumentation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/nodeDocumentation')>();
  return {
    ...actual,
    openNodeDocs: (url: string) => openNodeDocsMock(url),
  };
});

const SIDE_INPUT_DOCS_URL = 'https://beam.apache.org/documentation/patterns/side-inputs/';

const baseBinding: SideInputBinding = {
  sourceNodeId: 'lookup-1',
  sourceLabel: 'Lookup Table',
  variableName: 'lookupTable',
  viewType: 'SINGLETON',
  hasDefaultValue: false,
  defaultValue: '',
  refreshPattern: 'STATIC',
  updateIntervalSeconds: 3600,
};

describe('ParDoProperties', () => {
  beforeEach(() => {
    openNodeDocsMock.mockReset();
  });

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

  it('renders the header with a Docs ↗ link that opens the Beam side input patterns guide', () => {
    render(
      <ParDoProperties node={{ data: { beam_transform: 'ParDo', properties: {} } }} onChange={vi.fn()} />
    );

    expect(screen.getByText('ParDo Transform (ParDo.of)')).toBeInTheDocument();
    expect(screen.getByText(/with optional PCollectionView side inputs/)).toBeInTheDocument();
    const docsLink = screen.getByRole('button', { name: 'Open ParDo side inputs documentation' });
    expect(docsLink).toHaveTextContent('Docs ↗');
    fireEvent.click(docsLink);
    expect(openNodeDocsMock).toHaveBeenCalledWith(SIDE_INPUT_DOCS_URL);
  });

  it('falls back to built-in header copy and the side inputs guide when no catalog entry matches', () => {
    render(<ParDoProperties node={{ data: { properties: {} } }} onChange={vi.fn()} />);

    expect(screen.getByText('ParDo Transform (ParDo.of)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open ParDo side inputs documentation' }));
    expect(openNodeDocsMock).toHaveBeenCalledWith(SIDE_INPUT_DOCS_URL);
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

  it('prefers node.data.system_instructions over properties fallbacks', () => {
    const mockNode = {
      data: {
        system_instructions: 'From node data',
        properties: { system_instructions: 'From properties' },
      },
    };
    const { container } = render(<ParDoProperties node={mockNode} onChange={vi.fn()} />);
    expect(container.querySelector('#pardoSystemInstructions')).toHaveValue('From node data');
  });

  describe('Side Inputs section', () => {
    it('hides the Side Inputs section when no side inputs are connected', () => {
      render(<ParDoProperties node={{ data: { properties: {} } }} onChange={vi.fn()} />);

      expect(screen.queryByTestId('pardo-side-inputs-section')).not.toBeInTheDocument();
      expect(screen.queryByText(/Side Inputs/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('pardo-side-input-0')).not.toBeInTheDocument();
    });

    it('renders one card per binding with the upstream label and id', () => {
      const node = {
        data: {
          properties: {
            sideInputs: [
              baseBinding,
              { ...baseBinding, sourceNodeId: 'cfg-2', sourceLabel: undefined, variableName: 'config', viewType: 'MAP' },
            ],
          },
        },
      };
      const { container } = render(<ParDoProperties node={node} onChange={vi.fn()} />);

      expect(screen.getByTestId('pardo-side-inputs-section')).toBeInTheDocument();
      expect(screen.getByText('Side Inputs (2)')).toBeInTheDocument();
      expect(screen.getByTestId('pardo-side-input-0')).toBeInTheDocument();
      expect(screen.getByTestId('pardo-side-input-1')).toBeInTheDocument();
      expect(screen.getByText('Lookup Table')).toBeInTheDocument();
      expect(screen.getByTestId('pardoSideInput-0-source')).toHaveTextContent('lookup-1');
      // Falls back to the node id as the title when no label is known (rendered twice: title + id badge)
      expect(screen.getAllByText('cfg-2')).toHaveLength(2);

      expect(container.querySelector('#pardoSideInput-0-variableName')).toHaveValue('lookupTable');
      expect(container.querySelector('#pardoSideInput-1-viewType')).toHaveValue('MAP');
    });

    it('updates variableName and preserves prompt, system instructions, and sibling bindings', () => {
      const onChange = vi.fn();
      const node = {
        data: {
          properties: {
            codeGenerationPrompt: 'Enrich',
            sideInputs: [baseBinding, { ...baseBinding, sourceNodeId: 'cfg-2', variableName: 'config' }],
          },
        },
      };
      const { container } = render(<ParDoProperties node={node} onChange={onChange} />);

      fireEvent.change(container.querySelector('#pardoSideInput-0-variableName')!, { target: { value: 'fxRates' } });

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          codeGenerationPrompt: 'Enrich',
          system_instructions: 'Wrap the generated code in a try/catch, returning all errors to a separate pcollection',
          sideInputs: [
            expect.objectContaining({ sourceNodeId: 'lookup-1', variableName: 'fxRates' }),
            expect.objectContaining({ sourceNodeId: 'cfg-2', variableName: 'config' }),
          ],
        })
      );
    });

    it('offers all five documented view types and propagates a viewType change', () => {
      const onChange = vi.fn();
      const { container } = render(
        <ParDoProperties node={{ data: { properties: { sideInputs: [baseBinding] } } }} onChange={onChange} />
      );

      const select = container.querySelector('#pardoSideInput-0-viewType') as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toEqual(['SINGLETON', 'ITERABLE', 'LIST', 'MAP', 'MULTIMAP']);

      fireEvent.change(select, { target: { value: 'MULTIMAP' } });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ sideInputs: [expect.objectContaining({ viewType: 'MULTIMAP' })] })
      );
    });

    it('shows the default value checkbox only for SINGLETON views', () => {
      const { container, rerender } = render(
        <ParDoProperties node={{ data: { properties: { sideInputs: [baseBinding] } } }} onChange={vi.fn()} />
      );
      expect(container.querySelector('#pardoSideInput-0-hasDefaultValue')).toBeInTheDocument();
      expect(container.querySelector('#pardoSideInput-0-defaultValue')).not.toBeInTheDocument();

      rerender(
        <ParDoProperties
          node={{ data: { properties: { sideInputs: [{ ...baseBinding, viewType: 'LIST', hasDefaultValue: true }] } } }}
          onChange={vi.fn()}
        />
      );
      expect(container.querySelector('#pardoSideInput-0-hasDefaultValue')).not.toBeInTheDocument();
      expect(container.querySelector('#pardoSideInput-0-defaultValue')).not.toBeInTheDocument();
    });

    it('toggles hasDefaultValue and reveals/edits the Default Value field', () => {
      const onChange = vi.fn();
      const { container, rerender } = render(
        <ParDoProperties node={{ data: { properties: { sideInputs: [baseBinding] } } }} onChange={onChange} />
      );

      fireEvent.click(container.querySelector('#pardoSideInput-0-hasDefaultValue')!);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ sideInputs: [expect.objectContaining({ hasDefaultValue: true })] })
      );

      rerender(
        <ParDoProperties
          node={{ data: { properties: { sideInputs: [{ ...baseBinding, hasDefaultValue: true, defaultValue: '0' }] } } }}
          onChange={onChange}
        />
      );
      const defaultField = container.querySelector('#pardoSideInput-0-defaultValue') as HTMLInputElement;
      expect(defaultField).toHaveValue('0');
      fireEvent.change(defaultField, { target: { value: 'unknown' } });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ sideInputs: [expect.objectContaining({ hasDefaultValue: true, defaultValue: 'unknown' })] })
      );
    });

    it('offers the three documented refresh patterns and hides the interval for STATIC', () => {
      const onChange = vi.fn();
      const { container } = render(
        <ParDoProperties node={{ data: { properties: { sideInputs: [baseBinding] } } }} onChange={onChange} />
      );

      const select = container.querySelector('#pardoSideInput-0-refreshPattern') as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.value)).toEqual([
        'STATIC',
        'SLOWLY_UPDATING_GLOBAL_WINDOW',
        'SLOWLY_UPDATING_WINDOWED',
      ]);
      expect(container.querySelector('#pardoSideInput-0-updateIntervalSeconds')).not.toBeInTheDocument();

      fireEvent.change(select, { target: { value: 'SLOWLY_UPDATING_GLOBAL_WINDOW' } });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ sideInputs: [expect.objectContaining({ refreshPattern: 'SLOWLY_UPDATING_GLOBAL_WINDOW' })] })
      );
    });

    it('shows and edits the update interval for slowly-updating patterns, falling back to 3600 on invalid input', () => {
      const onChange = vi.fn();
      const { container } = render(
        <ParDoProperties
          node={{
            data: {
              properties: {
                sideInputs: [{ ...baseBinding, refreshPattern: 'SLOWLY_UPDATING_WINDOWED', updateIntervalSeconds: 300 }],
              },
            },
          }}
          onChange={onChange}
        />
      );

      const interval = container.querySelector('#pardoSideInput-0-updateIntervalSeconds') as HTMLInputElement;
      expect(interval).toHaveValue(300);

      fireEvent.change(interval, { target: { value: '60' } });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ sideInputs: [expect.objectContaining({ updateIntervalSeconds: 60 })] })
      );

      fireEvent.change(interval, { target: { value: '-5' } });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ sideInputs: [expect.objectContaining({ updateIntervalSeconds: 3600 })] })
      );
    });

    it('uses the documented default interval when a slowly-updating binding has no interval persisted', () => {
      const binding: Partial<SideInputBinding> = { ...baseBinding, refreshPattern: 'SLOWLY_UPDATING_GLOBAL_WINDOW' };
      delete binding.updateIntervalSeconds;
      const { container } = render(
        <ParDoProperties node={{ data: { properties: { sideInputs: [binding] } } }} onChange={vi.fn()} />
      );
      expect(container.querySelector('#pardoSideInput-0-updateIntervalSeconds')).toHaveValue(3600);
    });

    it('ignores malformed sideInputs values gracefully and hides the section', () => {
      render(<ParDoProperties node={{ data: { properties: { sideInputs: 'oops' } } }} onChange={vi.fn()} />);
      expect(screen.queryByTestId('pardo-side-inputs-section')).not.toBeInTheDocument();
    });
  });
});
