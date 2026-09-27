/**
 * Data Services connector registration smoke tests (IO68–IO79)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Verifies the palette -> registry -> panel chain for the 24 Community & Cross-Language
 * connector nodes: each palette entry exists under the Data Services category, adding it
 * yields the expected beamTransform, and PropertyForm resolves that transform (qualified by
 * node type) to a registered panel instead of the "No property form registered" fallback.
 * The panels themselves are owned and tested by the per-connector milestones.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NodesCard } from './NodesCard';
import { PropertyForm, PROPERTY_FORM_REGISTRY, getPropertyFormComponent } from './PropertyForm';

const DATA_SERVICES_CONNECTORS: ReadonlyArray<{ label: string; transform: string }> = [
  { label: 'Cloud Bigtable (HBase based)', transform: 'CloudBigtable' },
  { label: 'Cognite Data Fusion', transform: 'CogniteDataFusion' },
  { label: 'KineticaDB', transform: 'KineticaDB' },
  { label: 'TrepWsIO', transform: 'TrepWsIO' },
  { label: 'Cloud SQL', transform: 'CloudSQL' },
  { label: 'MySQL', transform: 'MySQL' },
  { label: 'Pyodbc', transform: 'Pyodbc' },
  { label: 'Tinybird', transform: 'Tinybird' },
  { label: 'MySQL, PostgreSQL, Oracle, SQL Server', transform: 'MySQLPostgreSQLOracleSQLServer' },
];

const SIDES = [
  { type: 'SOURCE', tab: 'SOURCES', category: 'Data Services Sources' },
  { type: 'SINK', tab: 'SINKS', category: 'Data Services Sinks' },
] as const;

describe('Data Services connectors (IO68–IO79) registration', () => {
  for (const side of SIDES) {
    describe(side.type, () => {
      it(`lists all 9 connectors under "${side.category}" and adds them with the right beamTransform`, () => {
        const onAddNode = vi.fn();
        render(
          <NodesCard
            activeTab={side.tab}
            setActiveTab={vi.fn()}
            nodesCount={1}
            hasPubSubSource={false}
            onDragStart={vi.fn()}
            onAddNode={onAddNode}
          />
        );

        const summary = screen.getByText(side.category);
        const group = summary.closest('details') as HTMLElement;
        expect(group).not.toBeNull();

        for (const { label, transform } of DATA_SERVICES_CONNECTORS) {
          onAddNode.mockClear();
          fireEvent.click(within(group).getByLabelText(`Add ${label}`));
          expect(onAddNode).toHaveBeenCalledTimes(1);
          expect(onAddNode.mock.calls[0][0]).toBe(label);
          expect(onAddNode.mock.calls[0][1]).toBe(side.type);
          expect(onAddNode.mock.calls[0][3]).toBe(transform);
        }
      });

      for (const { label, transform } of DATA_SERVICES_CONNECTORS) {
        it(`resolves ${side.type}:${transform} to a registered panel that renders and emits changes`, () => {
          const key = `${side.type}:${transform}`;
          expect(typeof PROPERTY_FORM_REGISTRY[key]).toBe('function');

          const node = { data: { label, type: side.type, beam_transform: transform, properties: { existing: 'kept' } } };
          expect(getPropertyFormComponent(node)).toBe(PROPERTY_FORM_REGISTRY[key]);

          const onChange = vi.fn();
          const { container } = render(<PropertyForm node={node} onChange={onChange} />);

          expect(screen.queryByText(/No property form registered/)).not.toBeInTheDocument();
          const instructions = container.querySelector('textarea[name="system_instructions"]') as HTMLTextAreaElement;
          expect(instructions).not.toBeNull();

          fireEvent.change(instructions, { target: { value: 'use batching' } });
          expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ existing: 'kept', system_instructions: 'use batching' }));
        });
      }
    });
  }
});
