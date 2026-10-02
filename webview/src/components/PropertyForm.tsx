/**
 * PropertyForm Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Container component dispatching specific node property sheets based on immutable node metadata
 * (beam_transform and/or componentType, qualified by node type) rather than user-editable labels.
 * 
 * Architectural Decisions:
 * - Uses a declarative PROPERTY_FORM_REGISTRY map for fast, immutable metadata dispatch.
 * - Resolves keys using type-qualified keys (`${type}:${transform}`) and direct transform names.
 * - Fails fast: Displays an explicit "No property form registered for type <type>" message if no registry entry matches.
 * - Never inspects or falls back to user-editable display labels, preventing property sheet corruption on node renaming.
 * - Supports Streaming Sources (PubSub, GenerateSequence, PeriodicImpulse, SnsIO, MqttIO, AmqpIO, RabbitMqIO,
 *   PulsarIO, SolaceIO), Streaming Sinks (PubSub, Kafka, SnsIO, MqttIO, AmqpIO, RabbitMqIO, PulsarIO, SolaceIO),
 *   Data Services (FlinkStreamingImpulseSource), Database, File, Aggregations, and Transform steps.
 * - Database and Data Services connector family registered under type-qualified keys (`SOURCE:`/`SINK:`): CassandraIO,
 *   HBaseIO, KuduIO, MongoDbIO, RedisIO, BigTableIO, ClickHouseIO, DatabaseIO, DatastoreIO, DynamoDBIO,
 *   ElasticsearchIO, FirestoreIO, HadoopFormatIO, InfluxDbIO, MongoDbGridFSIO, Neo4jIO, SingleStoreDBIO,
 *   SnowflakeIO, SolrIO, SpannerIO, CdapIO, CosmosIO, DebeziumIO, HCatalogIO, ArrowFlightIO, SparkReceiverIO.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import React from 'react';
import { NodeDocsCard } from './common/NodeDocsCard';
import { hasInlineNodeDocsCard } from '../utils/nodeDocumentation';
import {
  PROPERTY_FORM_REGISTRY,
  type PropertyFormProps,
} from '../catalog/propertyFormRegistry';

export { PROPERTY_FORM_REGISTRY };
export type { PropertyFormProps };

/**
 * Resolves a property form component from the registry using the node's immutable metadata.
 * 
 * Precedence:
 * 1. Type-qualified key: `${nodeType}:${transform}` (e.g. "SOURCE:PubSubIO", "SINK:BigQueryIO")
 * 2. Direct transform key: `${transform}` (e.g. "ParDo", "WindowInto", "ReadFromKafka")
 * 
 * NOTE: Does NOT fall back to label matching under any circumstances, nor does it allow
 * a SOURCE node to fall back to a SINK-only transform (or vice versa).
 * 
 * @param node - React Flow node object
 * @returns Registered React component or undefined if unregistered
 */
export function getPropertyFormComponent(node: any): React.FC<PropertyFormProps> | undefined {
  const transform = node?.data?.beam_transform || node?.data?.componentType || '';
  const nodeType = (node?.data?.type || '').toUpperCase();

  if (!transform) {
    return undefined;
  }

  // 1. Try type-qualified key (e.g. "SOURCE:PubSubIO", "SINK:KafkaIO")
  if (nodeType) {
    const qualifiedKey = `${nodeType}:${transform}`;
    if (PROPERTY_FORM_REGISTRY[qualifiedKey]) {
      return PROPERTY_FORM_REGISTRY[qualifiedKey];
    }
    // Prevent cross-direction fallback when an opposite direction is explicitly registered
    const oppositeType = nodeType === 'SOURCE' ? 'SINK' : nodeType === 'SINK' ? 'SOURCE' : '';
    if (oppositeType && PROPERTY_FORM_REGISTRY[`${oppositeType}:${transform}`]) {
      return undefined;
    }
  }

  // 2. Try direct transform key (e.g. "ParDo", "WindowInto", "ReadFromKafka")
  if (PROPERTY_FORM_REGISTRY[transform]) {
    return PROPERTY_FORM_REGISTRY[transform];
  }

  return undefined;
}

/**
 * Container component that dispatches specific node property sheets based on immutable node metadata.
 * Renders an explicit unregistered message when no matching registry entry is found.
 */
export const PropertyForm: React.FC<PropertyFormProps> = ({
  node,
  onChange,
  onAddKVMapper,
  onAddPubSubSource
}) => {
  const Component = getPropertyFormComponent(node);

  if (!Component) {
    // Fail fast with explicit visible message rather than silent generic form or label fallback
    const rawType = node?.data?.beam_transform || node?.data?.componentType || node?.data?.type || 'unknown';
    return (
      <div className="p-4 text-sm text-[var(--vscode-descriptionForeground,#94a3b8)]">
        No property form registered for type &quot;{rawType}&quot;
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      {!hasInlineNodeDocsCard(node) && <NodeDocsCard node={node} />}
      {/* eslint-disable-next-line react-hooks/static-components */}
      <Component
        node={node}
        onChange={onChange}
        onAddKVMapper={onAddKVMapper}
        onAddPubSubSource={onAddPubSubSource}
      />
    </div>
  );
};
