/**
 * Legacy Node Migration Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates deterministic inference of `beam_transform` for legacy nodes, idempotency,
 * unknown node handling, and verifies that real sample files migrate cleanly.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { inferBeamTransform, migrateLegacyNodes } from './legacyNodeMigration';

describe('legacyNodeMigration', () => {
  it('infers PubSubIO for legacy SOURCE node with Radio icon', () => {
    const data = {
      label: 'PubSub Connector',
      type: 'SOURCE',
      iconName: 'Radio'
    };
    expect(inferBeamTransform(data)).toBe('PubSubIO');
  });

  it('infers BigQueryIO for legacy SINK node with Database icon', () => {
    const data = {
      label: 'BigQuery',
      type: 'SINK',
      iconName: 'Database'
    };
    expect(inferBeamTransform(data)).toBe('BigQueryIO');
  });

  it('disambiguates MQTT vs PubSub on Radio icon using label', () => {
    expect(inferBeamTransform({ label: 'MQTT Source', type: 'SOURCE', iconName: 'Radio' })).toBe('MqttIO');
    expect(inferBeamTransform({ label: 'PubSub Topic', type: 'SOURCE', iconName: 'Radio' })).toBe('PubSubIO');
  });

  it('disambiguates JdbcIO vs BigQuery on Database icon using label', () => {
    expect(inferBeamTransform({ label: 'JdbcIO Reader', type: 'SOURCE', iconName: 'Database' })).toBe('JdbcIO');
    expect(inferBeamTransform({ label: 'BigQuery Table', type: 'SOURCE', iconName: 'Database' })).toBe('BigQueryIO');
  });

  it('disambiguates Kafka, JMS, and SQS on Cable icon using label', () => {
    expect(inferBeamTransform({ label: 'JMS Queue', type: 'SOURCE', iconName: 'Cable' })).toBe('JmsIO');
    expect(inferBeamTransform({ label: 'SQS Queue', type: 'SOURCE', iconName: 'Cable' })).toBe('SqsIO');
    expect(inferBeamTransform({ label: 'Kafka Stream', type: 'SOURCE', iconName: 'Cable' })).toBe('KafkaIO');
  });

  it('disambiguates Parquet vs Avro on FileCode icon using label', () => {
    expect(inferBeamTransform({ label: 'Parquet Reader', type: 'SOURCE', iconName: 'FileCode' })).toBe('ParquetIO');
    expect(inferBeamTransform({ label: 'Avro Reader', type: 'SOURCE', iconName: 'FileCode' })).toBe('AvroIO');
  });

  it('is strictly idempotent and never overwrites an existing beam_transform', () => {
    const modernNode = {
      label: 'Renamed Node to PubSub',
      type: 'SOURCE',
      iconName: 'Radio',
      beam_transform: 'CustomExistingTransform'
    };
    expect(inferBeamTransform(modernNode)).toBe('CustomExistingTransform');

    const nodeObject = {
      id: 'n1',
      data: modernNode
    };
    const result = migrateLegacyNodes([nodeObject]);
    expect(result[0].data.beam_transform).toBe('CustomExistingTransform');
  });

  it('returns null for genuinely unknown nodes without guessing', () => {
    expect(inferBeamTransform({ label: 'Unknown Operation', type: 'CUSTOM', iconName: 'HelpCircle' })).toBeNull();
    expect(inferBeamTransform(null as any)).toBeNull();
  });

  it('migrates legacy nodes array while logging summary and preserving modern nodes', () => {
    const nodes = [
      { id: '1', data: { label: 'PubSub Connector', type: 'SOURCE', iconName: 'Radio' } },
      { id: '2', data: { label: 'ParDo Step', type: 'STEP', iconName: 'Code', beam_transform: 'ParDo' } },
      { id: '3', data: { label: 'BigQuery', type: 'SINK', iconName: 'Database' } }
    ];

    const migrated = migrateLegacyNodes(nodes);
    expect(migrated[0].data.beam_transform).toBe('PubSubIO');
    expect(migrated[1].data.beam_transform).toBe('ParDo');
    expect(migrated[2].data.beam_transform).toBe('BigQueryIO');
  });

  it('loads real sample file pubsub-to-bigquery.beam and migrates every node deterministically', () => {
    const filePath = path.resolve(__dirname, '../../../resources/samples/pubsub-to-bigquery.beam');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = YAML.parse(content);
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(parsed.nodes.length).toBe(4);

    const migrated = migrateLegacyNodes(parsed.nodes);
    expect(migrated.length).toBe(4);

    // Verify every node now has a valid beam_transform
    const transforms = migrated.map((n: any) => n.data.beam_transform);
    expect(transforms).toEqual(['PubSubIO', 'BigQueryIO', 'ParseMessage', 'LogMessage']);
  });

  it('loads real sample file generate-mock-data.beam and preserves all beam_transforms', () => {
    const filePath = path.resolve(__dirname, '../../../resources/samples/generate-mock-data.beam');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = YAML.parse(content);
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(parsed.nodes.length).toBe(3);

    const migrated = migrateLegacyNodes(parsed.nodes);
    expect(migrated.length).toBe(3);

    const transforms = migrated.map((n: any) => n.data.beam_transform);
    expect(transforms).toEqual(['GenerateSequence', 'ParDo', 'LogMessage']);
  });
});
