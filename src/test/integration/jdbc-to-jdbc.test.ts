import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest } from './codegen-runner';

const JDBC_TO_JDBC_YAML = `nodes:
  - id: "1787155309978"
    type: pipeline
    position:
      x: 80
      y: 150
    data:
      label: JDBC
      type: SOURCE
      iconName: Database
      beam_transform: JdbcIO
      properties:
        driverClassName: org.postgresql.Driver
        url: jdbc:postgresql://localhost:5432/mydb
        username: dbuser123
        password: dbpswrd123
        outputParallelization: true
        selectType: table
        tableName: myUsers
    width: 180
    height: 62
    selected: false
    dragging: false
    positionAbsolute:
      x: 267.7052489905787
      y: 205.3061911170929
  - id: "1787155323019"
    type: pipeline
    position:
      x: 680
      y: 150
    data:
      label: JDBC
      type: SINK
      iconName: Database
      beam_transform: JdbcIO
      properties:
        driverClassName: com.mysql.cj.jdbc.Driver
        url: jdbc:mysql://localhost:3306/mydb
        username: username
        password: pwd
        table: mikes_users
        autosharding: true
        selectType: statement
        statement: INSERT INTO myUsers2 (id, name, email) VALUES (?, ?)
    width: 180
    height: 62
    selected: false
    dragging: false
    positionAbsolute:
      x: 820.2664872139974
      y: 186.25235531628533
  - id: "1787161834646"
    type: pipeline
    position:
      x: 379.5
      y: 150
    data:
      label: ParDo
      type: STEP
      iconName: Code
      beam_transform: ParDo
    width: 180
    height: 62
    selected: false
    positionAbsolute:
      x: 379.5
      y: 150
    dragging: false
edges:
  - id: e-1787155309978-1787161834646
    source: "1787155309978"
    target: "1787161834646"
  - source: "1787161834646"
    sourceHandle: valid
    target: "1787155323019"
    targetHandle: null
    id: reactflow__edge-1787161834646valid-1787155323019
runtimeVariables:
  - key: JOB_ID
    value: jdbc-reader
jobConfig:
  runner: DirectRunner
  machineType: n1-standard-1
  minInstances: 1
  maxInstances: 10
  gcsStagingPath: ""
  network: ""
  subnetwork: ""
pipelineConfig:
  language: Java
  outputFolder: test/jdbcio-examples/jdbc-reader
  needsRebuild: false
`;

describe('JDBC to JDBC Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'JDBC-to-JDBC (Java)',
            yamlContent: JDBC_TO_JDBC_YAML,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'JDBC-to-JDBC (Python)',
            yamlContent: JDBC_TO_JDBC_YAML,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

export async function runJdbcToJdbcTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'JDBC-to-JDBC Pipeline',
        yamlContent: JDBC_TO_JDBC_YAML,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('JDBC to JDBC pipeline test failed');
    }
}
