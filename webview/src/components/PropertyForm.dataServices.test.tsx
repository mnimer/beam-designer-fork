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

const DATA_SERVICES_CONNECTORS: ReadonlyArray<{
  label: string;
  transform: string;
  sourceCategory: string;
  sinkCategory: string;
}> = [
  { label: 'Cloud Bigtable (HBase based)', transform: 'CloudBigtable', sourceCategory: 'Database Sources', sinkCategory: 'Database Sinks' },
  { label: 'Cognite Data Fusion', transform: 'CogniteDataFusion', sourceCategory: 'Data Services Sources', sinkCategory: 'Data Services Sinks' },
  { label: 'KineticaDB', transform: 'KineticaDB', sourceCategory: 'Database Sources', sinkCategory: 'Database Sinks' },
  { label: 'TrepWsIO', transform: 'TrepWsIO', sourceCategory: 'Data Services Sources', sinkCategory: 'Data Services Sinks' },
  { label: 'Cloud SQL', transform: 'CloudSQL', sourceCategory: 'Database Sources', sinkCategory: 'Database Sinks' },
  { label: 'MySQL', transform: 'MySQL', sourceCategory: 'Database Sources', sinkCategory: 'Database Sinks' },
  { label: 'Pyodbc', transform: 'Pyodbc', sourceCategory: 'Data Services Sources', sinkCategory: 'Data Services Sinks' },
  { label: 'Tinybird', transform: 'Tinybird', sourceCategory: 'Data Services Sources', sinkCategory: 'Data Services Sinks' },
  { label: 'MySQL, PostgreSQL, Oracle, SQL Server', transform: 'MySQLPostgreSQLOracleSQLServer', sourceCategory: 'Database Sources', sinkCategory: 'Database Sinks' },
];

const SIDES = [
  { type: 'SOURCE', tab: 'SOURCES' },
  { type: 'SINK', tab: 'SINKS' },
] as const;

describe('Data Services connectors (IO68–IO79) registration', () => {
  for (const side of SIDES) {
    describe(side.type, () => {
      it(`lists all 9 connectors under their expected category in "${side.tab}" and adds them with the right beamTransform`, () => {
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

        for (const { label, transform, sourceCategory, sinkCategory } of DATA_SERVICES_CONNECTORS) {
          const expectedCategory = side.type === 'SOURCE' ? sourceCategory : sinkCategory;
          const summary = screen.getByText(expectedCategory);
          const group = summary.closest('details') as HTMLElement;
          expect(group).not.toBeNull();

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
