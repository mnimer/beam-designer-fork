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
import { getPropertyFormComponent } from './PropertyForm';
import { CloudBigtableSourceProperties } from '../properties/source/CloudBigtable';
import { CogniteDataFusionSourceProperties } from '../properties/source/CogniteDataFusion';
import { KineticaDBSourceProperties } from '../properties/source/KineticaDB';
import { TrepWsIOSourceProperties } from '../properties/source/TrepWsIO';
import { CloudSQLSourceProperties } from '../properties/source/CloudSQL';
import { MySQLSourceProperties } from '../properties/source/MySQL';
import { PyodbcSourceProperties } from '../properties/source/Pyodbc';
import { TinybirdSourceProperties } from '../properties/source/Tinybird';
import { MySQLPostgreSQLOracleSQLServerSourceProperties } from '../properties/source/MySQLPostgreSQLOracleSQLServer';
import { CloudBigtableSinkProperties } from '../properties/sink/CloudBigtable';
import { CogniteDataFusionSinkProperties } from '../properties/sink/CogniteDataFusion';
import { KineticaDBSinkProperties } from '../properties/sink/KineticaDB';
import { TrepWsIOSinkProperties } from '../properties/sink/TrepWsIO';
import { CloudSQLSinkProperties } from '../properties/sink/CloudSQL';
import { MySQLSinkProperties } from '../properties/sink/MySQL';
import { PyodbcSinkProperties } from '../properties/sink/Pyodbc';
import { TinybirdSinkProperties } from '../properties/sink/Tinybird';
import { MySQLPostgreSQLOracleSQLServerSinkProperties } from '../properties/sink/MySQLPostgreSQLOracleSQLServer';

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

const DATA_SERVICES_ROUTING_CASES = [
  { type: 'SOURCE', transform: 'CloudBigtable', ExpectedComponent: CloudBigtableSourceProperties, name: 'CloudBigtableSourceProperties' },
  { type: 'SOURCE', transform: 'CogniteDataFusion', ExpectedComponent: CogniteDataFusionSourceProperties, name: 'CogniteDataFusionSourceProperties' },
  { type: 'SOURCE', transform: 'KineticaDB', ExpectedComponent: KineticaDBSourceProperties, name: 'KineticaDBSourceProperties' },
  { type: 'SOURCE', transform: 'TrepWsIO', ExpectedComponent: TrepWsIOSourceProperties, name: 'TrepWsIOSourceProperties' },
  { type: 'SOURCE', transform: 'CloudSQL', ExpectedComponent: CloudSQLSourceProperties, name: 'CloudSQLSourceProperties' },
  { type: 'SOURCE', transform: 'MySQL', ExpectedComponent: MySQLSourceProperties, name: 'MySQLSourceProperties' },
  { type: 'SOURCE', transform: 'Pyodbc', ExpectedComponent: PyodbcSourceProperties, name: 'PyodbcSourceProperties' },
  { type: 'SOURCE', transform: 'Tinybird', ExpectedComponent: TinybirdSourceProperties, name: 'TinybirdSourceProperties' },
  { type: 'SOURCE', transform: 'MySQLPostgreSQLOracleSQLServer', ExpectedComponent: MySQLPostgreSQLOracleSQLServerSourceProperties, name: 'MySQLPostgreSQLOracleSQLServerSourceProperties' },
  { type: 'SINK', transform: 'CloudBigtable', ExpectedComponent: CloudBigtableSinkProperties, name: 'CloudBigtableSinkProperties' },
  { type: 'SINK', transform: 'CogniteDataFusion', ExpectedComponent: CogniteDataFusionSinkProperties, name: 'CogniteDataFusionSinkProperties' },
  { type: 'SINK', transform: 'KineticaDB', ExpectedComponent: KineticaDBSinkProperties, name: 'KineticaDBSinkProperties' },
  { type: 'SINK', transform: 'TrepWsIO', ExpectedComponent: TrepWsIOSinkProperties, name: 'TrepWsIOSinkProperties' },
  { type: 'SINK', transform: 'CloudSQL', ExpectedComponent: CloudSQLSinkProperties, name: 'CloudSQLSinkProperties' },
  { type: 'SINK', transform: 'MySQL', ExpectedComponent: MySQLSinkProperties, name: 'MySQLSinkProperties' },
  { type: 'SINK', transform: 'Pyodbc', ExpectedComponent: PyodbcSinkProperties, name: 'PyodbcSinkProperties' },
  { type: 'SINK', transform: 'Tinybird', ExpectedComponent: TinybirdSinkProperties, name: 'TinybirdSinkProperties' },
  { type: 'SINK', transform: 'MySQLPostgreSQLOracleSQLServer', ExpectedComponent: MySQLPostgreSQLOracleSQLServerSinkProperties, name: 'MySQLPostgreSQLOracleSQLServerSinkProperties' },
];

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
      }, 15000);
    });
  }

  it.each(DATA_SERVICES_ROUTING_CASES)(
    'resolves $type:$transform to $name',
    ({ type, transform, ExpectedComponent }) => {
      expect(
        getPropertyFormComponent({
          data: { type, beam_transform: transform, properties: {} },
        })
      ).toBe(ExpectedComponent);
    }
  );
});
