/**
 * Unit Tests for Pipeline Specification & Property Conformance Evaluator.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the YAML specification parser, human-readable checklist formatter, and
 * the PipelineSpecificationAgent sub-agent under simple, extreme, and failure conditions.
 * Ensures 100% test coverage for pipeline specification auditing.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    parsePipelineSpec,
    formatSpecChecklist,
    evaluatePipelineSpecification
} from '../integration/evaluators/pipeline-spec-evaluator';

describe('Pipeline Specification Evaluator (pipeline-spec-evaluator.ts)', () => {
    describe('parsePipelineSpec', () => {
        it('parses valid pipeline YAML into structured nodes, properties, and configs (simple condition)', () => {
            const yamlContent = `
nodes:
  - id: "node-1"
    type: pipeline
    data:
      label: JDBC Source
      type: SOURCE
      beam_transform: JdbcIO
      properties:
        driverClassName: org.postgresql.Driver
        url: jdbc:postgresql://localhost:5432/mydb
        username: dbuser
        password: dbpassword
        tableName: users_table
        outputParallelization: true
  - id: "node-2"
    type: pipeline
    data:
      label: Transform Step
      type: STEP
      beam_transform: ParDo
      properties:
        codeGenerationPrompt: "Parse JSON payload"
      system_instructions: "Wrap in try-catch and route errors to DLQ"
  - id: "node-3"
    type: pipeline
    data:
      label: Kafka Sink
      type: SINK
      beam_transform: KafkaIO
      properties:
        topic: output-events
        bootstrapServers: localhost:9092
        useEOS: true
edges:
  - id: "e1"
    source: "node-1"
    target: "node-2"
  - id: "e2"
    source: "node-2"
    target: "node-3"
    sourceHandle: "valid"
runtimeVariables:
  - key: JOB_ID
    value: test-job-123
jobConfig:
  runner: DirectRunner
  machineType: n1-standard-1
  minInstances: 1
  maxInstances: 5
pipelineConfig:
  language: Java
  outputFolder: output/test
`;

            const spec = parsePipelineSpec(yamlContent);

            expect(spec.nodes.length).toBe(3);

            // Node 1 (Source)
            expect(spec.nodes[0].id).toBe('node-1');
            expect(spec.nodes[0].label).toBe('JDBC Source');
            expect(spec.nodes[0].type).toBe('SOURCE');
            expect(spec.nodes[0].beamTransform).toBe('JdbcIO');
            expect(spec.nodes[0].properties.driverClassName).toBe('org.postgresql.Driver');
            expect(spec.nodes[0].properties.tableName).toBe('users_table');
            expect(spec.nodes[0].properties.outputParallelization).toBe(true);

            // Node 2 (Step with instructions)
            expect(spec.nodes[1].id).toBe('node-2');
            expect(spec.nodes[1].type).toBe('STEP');
            expect(spec.nodes[1].systemInstructions).toBe('Wrap in try-catch and route errors to DLQ');
            expect(spec.nodes[1].codeGenerationPrompt).toBe('Parse JSON payload');

            // Node 3 (Sink)
            expect(spec.nodes[2].id).toBe('node-3');
            expect(spec.nodes[2].type).toBe('SINK');
            expect(spec.nodes[2].properties.topic).toBe('output-events');
            expect(spec.nodes[2].properties.useEOS).toBe(true);

            // Runtime Variables
            expect(spec.runtimeVariables.length).toBe(1);
            expect(spec.runtimeVariables[0].key).toBe('JOB_ID');
            expect(spec.runtimeVariables[0].value).toBe('test-job-123');

            // Job & Pipeline Configs
            expect(spec.jobConfig.runner).toBe('DirectRunner');
            expect(spec.jobConfig.maxInstances).toBe(5);
            expect(spec.pipelineConfig.language).toBe('Java');

            // Edges
            expect(spec.edges.length).toBe(2);
            expect(spec.edges[1].sourceHandle).toBe('valid');
        });

        it('handles empty string or whitespace-only YAML gracefully (extreme condition)', () => {
            const emptySpec = parsePipelineSpec('');
            expect(emptySpec.nodes).toEqual([]);
            expect(emptySpec.runtimeVariables).toEqual([]);
            expect(emptySpec.jobConfig).toEqual({});
            expect(emptySpec.edges).toEqual([]);

            const whitespaceSpec = parsePipelineSpec('   \n  \t  ');
            expect(whitespaceSpec.nodes).toEqual([]);
        });

        it('handles malformed YAML syntax without throwing (failure condition)', () => {
            const corruptYaml = `::: invalid [yaml mapping :::`;
            const spec = parsePipelineSpec(corruptYaml);
            expect(spec.nodes).toEqual([]);
            expect(spec.runtimeVariables).toEqual([]);
            expect(spec.jobConfig).toEqual({});
            expect(spec.edges).toEqual([]);
        });

        it('handles YAML with non-object root or missing properties safely (extreme condition)', () => {
            const scalarYaml = `just a plain string`;
            const spec = parsePipelineSpec(scalarYaml);
            expect(spec.nodes).toEqual([]);

            const partialYaml = `
nodes:
  - id: "n1"
`;
            const partialSpec = parsePipelineSpec(partialYaml);
            expect(partialSpec.nodes.length).toBe(1);
            expect(partialSpec.nodes[0].id).toBe('n1');
            expect(partialSpec.nodes[0].label).toBe('Unnamed Node');
            expect(partialSpec.nodes[0].properties).toEqual({});
        });
    });

    describe('formatSpecChecklist', () => {
        it('formats structured checklist text with all properties and custom instructions (simple condition)', () => {
            const spec = {
                nodes: [
                    {
                        id: 'n1',
                        label: 'Postgres Reader',
                        type: 'SOURCE' as const,
                        beamTransform: 'JdbcIO',
                        properties: {
                            driverClassName: 'org.postgresql.Driver',
                            url: 'jdbc:postgresql://localhost:5432/mydb'
                        },
                        systemInstructions: 'Log row counts on start',
                        codeGenerationPrompt: 'Generate connection pool'
                    }
                ],
                runtimeVariables: [{ key: 'JOB_ID', value: 'sample-job' }],
                jobConfig: { runner: 'DirectRunner' },
                pipelineConfig: { language: 'Java' },
                edges: [{ source: 'n1', target: 'n2', sourceHandle: 'valid' }]
            };

            const checklist = formatSpecChecklist(spec);

            expect(checklist).toContain('Total Nodes: 1');
            expect(checklist).toContain('[Node 1] ID: "n1" | Label: "Postgres Reader" | Type: SOURCE | Transform: JdbcIO');
            expect(checklist).toContain('driverClassName: "org.postgresql.Driver"');
            expect(checklist).toContain('url: "jdbc:postgresql://localhost:5432/mydb"');
            expect(checklist).toContain('Custom System Instructions: "Log row counts on start"');
            expect(checklist).toContain('Custom Code Generation Prompt: "Generate connection pool"');
            expect(checklist).toContain('Runtime Variables (1):');
            expect(checklist).toContain('JOB_ID: "sample-job"');
            expect(checklist).toContain('Job Configuration:');
            expect(checklist).toContain('runner: "DirectRunner"');
            expect(checklist).toContain('Edges / Connections (1):');
            expect(checklist).toContain('Source "n1" -> Target "n2" [handle: valid]');
        });

        it('formats empty specification checklist cleanly (extreme condition)', () => {
            const emptySpec = {
                nodes: [],
                runtimeVariables: [],
                jobConfig: {},
                pipelineConfig: {},
                edges: []
            };

            const checklist = formatSpecChecklist(emptySpec);
            expect(checklist).toBe('Total Nodes: 0');
        });
    });

    describe('evaluatePipelineSpecification', () => {
        it('passes when generated code faithfully implements all properties (simple condition)', async () => {
            const mockAi: any = {
                models: {
                    generateContent: vi.fn().mockResolvedValue({
                        text: JSON.stringify({
                            passed: true,
                            summary: 'All YAML properties and transform configs are correctly implemented.',
                            findings: []
                        })
                    })
                }
            };

            const yamlContent = `
nodes:
  - id: "1"
    data:
      label: JDBC
      type: SOURCE
      beam_transform: JdbcIO
      properties:
        driverClassName: org.postgresql.Driver
        url: jdbc:postgresql://localhost:5432/mydb
        tableName: users
`;

            const files = [
                {
                    filename: 'Pipeline.java',
                    content: 'JdbcIO.read().withDataSourceConfiguration(JdbcIO.DataSourceConfiguration.create("org.postgresql.Driver", "jdbc:postgresql://localhost:5432/mydb")).withTable("users");'
                }
            ];

            const result = await evaluatePipelineSpecification(mockAi, 'Java', yamlContent, files);

            expect(result.agentName).toBe('PipelineSpecificationAgent');
            expect(result.passed).toBe(true);
            expect(result.findings.length).toBe(0);
            expect(mockAi.models.generateContent).toHaveBeenCalledTimes(1);
        });

        it('flags missing configured properties as CRITICAL findings (failure condition)', async () => {
            const mockAi: any = {
                models: {
                    generateContent: vi.fn().mockResolvedValue({
                        text: JSON.stringify({
                            passed: false,
                            summary: 'Configured tableName property was ignored by generator.',
                            findings: [
                                {
                                    id: 'SPEC-1',
                                    category: 'SPECIFICATION',
                                    severity: 'CRITICAL',
                                    file: 'Pipeline.java',
                                    description: 'Node JDBC configured tableName "users", but code uses empty table placeholder',
                                    rationale: 'Pipeline will fail at runtime due to missing table definition'
                                }
                            ]
                        })
                    })
                }
            };

            const yamlContent = `
nodes:
  - id: "1"
    data:
      label: JDBC
      type: SOURCE
      beam_transform: JdbcIO
      properties:
        tableName: users
`;

            const files = [
                {
                    filename: 'Pipeline.java',
                    content: 'JdbcIO.read().withTable("");'
                }
            ];

            const result = await evaluatePipelineSpecification(mockAi, 'Java', yamlContent, files);

            expect(result.passed).toBe(false);
            expect(result.findings.length).toBe(1);
            expect(result.findings[0].category).toBe('SPECIFICATION');
            expect(result.findings[0].severity).toBe('CRITICAL');
            expect(result.findings[0].description).toContain('tableName "users"');
        });

        it('flags ignored custom system_instructions as MAJOR findings (failure condition)', async () => {
            const mockAi: any = {
                models: {
                    generateContent: vi.fn().mockResolvedValue({
                        text: JSON.stringify({
                            passed: false,
                            summary: 'Custom system instructions for DLQ error branch were ignored.',
                            findings: [
                                {
                                    id: 'SPEC-2',
                                    category: 'SPECIFICATION',
                                    severity: 'MAJOR',
                                    file: 'pipeline.py',
                                    description: 'System instruction "Wrap in try/catch and route errors" was not implemented in ParDo DoFn',
                                    rationale: 'Fails to adhere to user requirement for custom error handling'
                                }
                            ]
                        })
                    })
                }
            };

            const yamlContent = `
nodes:
  - id: "step-1"
    data:
      label: Transformer
      type: STEP
      beam_transform: ParDo
      system_instructions: "Wrap in try/catch and route errors"
`;

            const files = [
                {
                    filename: 'pipeline.py',
                    content: 'class ProcessFn(beam.DoFn):\n    def process(self, element):\n        yield element\n'
                }
            ];

            const result = await evaluatePipelineSpecification(mockAi, 'Python', yamlContent, files);

            expect(result.passed).toBe(false);
            expect(result.findings[0].category).toBe('SPECIFICATION');
            expect(result.findings[0].severity).toBe('MAJOR');
        });

        it('throws error when model returns empty text (extreme condition)', async () => {
            const mockAi: any = {
                models: {
                    generateContent: vi.fn().mockResolvedValue({
                        text: ''
                    })
                }
            };

            await expect(
                evaluatePipelineSpecification(mockAi, 'Python', 'nodes: []', [])
            ).rejects.toThrow('Empty response from PipelineSpecificationAgent');
        });
    });
});
