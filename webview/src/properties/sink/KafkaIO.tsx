/**
 * KafkaIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam KafkaIO Streaming Sink nodes.
 * Supports both Java native KafkaIO (KafkaIO.write()) and Python Cross-Language API (WriteToKafka).
 * 
 * Architectural Decisions:
 * - Provides preset suggestions for standard Kafka Serializers (String, ByteArray, Long, Integer, Double, Custom).
 * - Implements interactive InfoTooltip components next to each field label containing official Apache Beam documentation.
 * - Supports producer reliability configurations (acks), Exactly-Once Semantics (EOS) settings, and custom producer properties.
 * - Adheres strictly to the 8pt grid system for spacing and sizing.
 * - Includes a flexible spacer and "Code Generation Instructions" textarea at the bottom for LLM prompt customization.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';

export interface KafkaSerializerPreset {
  label: string;
  className: string;
}

export const KAFKA_SERIALIZER_PRESETS: KafkaSerializerPreset[] = [
  { label: 'String (StringSerializer)', className: 'org.apache.kafka.common.serialization.StringSerializer' },
  { label: 'Byte Array (ByteArraySerializer)', className: 'org.apache.kafka.common.serialization.ByteArraySerializer' },
  { label: 'Long (LongSerializer)', className: 'org.apache.kafka.common.serialization.LongSerializer' },
  { label: 'Integer (IntegerSerializer)', className: 'org.apache.kafka.common.serialization.IntegerSerializer' },
  { label: 'Double (DoubleSerializer)', className: 'org.apache.kafka.common.serialization.DoubleSerializer' },
  { label: 'Custom Class...', className: 'custom' },
];

interface KafkaIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      bootstrapServers?: string;
      topic?: string;
      keySerializer?: string;
      customKeySerializer?: string;
      valueSerializer?: string;
      customValueSerializer?: string;
      acks?: 'all' | '1' | '0';
      producerProperties?: string;
      useEOS?: boolean;
      eosNumPartitions?: string | number;
      eosSinkGroupId?: string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

interface KafkaIOSinkPropertiesProps {
  node: KafkaIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * KafkaIOSinkProperties renders the configuration form for Kafka streaming writes.
 *
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React component.
 */
export const KafkaIOSinkProperties: React.FC<KafkaIOSinkPropertiesProps> = ({ node, onChange }) => {
  // Extract existing properties or fallback to sensible defaults
  const properties = node.data.properties || {};

  const bootstrapServers = properties.bootstrapServers || '';
  const topic = properties.topic || '';
  const keySerializer = properties.keySerializer || 'org.apache.kafka.common.serialization.ByteArraySerializer';
  const customKeySerializer = properties.customKeySerializer || '';
  const valueSerializer = properties.valueSerializer || 'org.apache.kafka.common.serialization.StringSerializer';
  const customValueSerializer = properties.customValueSerializer || '';
  const acks = properties.acks || 'all';
  const producerProperties = properties.producerProperties || '';
  const useEOS = properties.useEOS ?? false;
  const eosNumPartitions = properties.eosNumPartitions ?? '';
  const eosSinkGroupId = properties.eosSinkGroupId || '';

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles generic text, select, and checkbox input changes.
   * 
   * @param e Form change event from input, select, or textarea.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    const newProperties = {
      ...properties,
      [name]: isCheckbox ? checked : value
    };

    onChange(newProperties);
  };

  /**
   * Handles custom system instructions textarea change for LLM prompt overrides.
   * 
   * @param e Form change event from textarea.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newInstructions = e.target.value;
    onChange({
      ...properties,
      system_instructions: newInstructions
    });
  };

  const isKeyPreset = KAFKA_SERIALIZER_PRESETS.some(p => p.className === keySerializer && p.className !== 'custom');
  const selectedKeyPreset = isKeyPreset ? keySerializer : 'custom';
  const customKeyValue = isKeyPreset ? customKeySerializer : (customKeySerializer || (keySerializer !== 'custom' ? keySerializer : ''));

  const isValuePreset = KAFKA_SERIALIZER_PRESETS.some(p => p.className === valueSerializer && p.className !== 'custom');
  const selectedValuePreset = isValuePreset ? valueSerializer : 'custom';
  const customValueValue = isValuePreset ? customValueSerializer : (customValueSerializer || (valueSerializer !== 'custom' ? valueSerializer : ''));

  // Validation states according to Apache Beam KafkaIO documentation
  const isBootstrapServersInvalid = !bootstrapServers.trim();
  const isTopicInvalid = !topic.trim();
  const isCustomKeyInvalid = selectedKeyPreset === 'custom' && !customKeyValue.trim();
  const isCustomValueInvalid = selectedValuePreset === 'custom' && !customValueValue.trim();
  const isEosNumPartitionsInvalid = useEOS && (!eosNumPartitions || Number(eosNumPartitions) <= 0);
  const isEosSinkGroupIdInvalid = useEOS && !eosSinkGroupId.trim();

  /**
   * Handles serializer dropdown changes.
   */
  const handleKeySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      onChange({
        ...properties,
        keySerializer: customKeyValue || 'custom',
        customKeySerializer: customKeyValue
      });
    } else {
      onChange({
        ...properties,
        keySerializer: val,
        customKeySerializer: ''
      });
    }
  };

  const handleCustomKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange({
      ...properties,
      keySerializer: val,
      customKeySerializer: val
    });
  };

  const handleValueSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      onChange({
        ...properties,
        valueSerializer: customValueValue || 'custom',
        customValueSerializer: customValueValue
      });
    } else {
      onChange({
        ...properties,
        valueSerializer: val,
        customValueSerializer: ''
      });
    }
  };

  const handleCustomValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange({
      ...properties,
      valueSerializer: val,
      customValueSerializer: val
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Bootstrap Servers Input (Required) */}
      <PropertyField
        id="kafkaSinkBootstrapServers"
        name="bootstrapServers"
        label="Bootstrap Servers"
        required={true}
        tooltip="A comma-separated list of host:port pairs to establish the initial connection to the Kafka cluster (e.g. localhost:9092 or broker1:9092,broker2:9092). Required."
        value={bootstrapServers}
        invalid={isBootstrapServersInvalid}
        error={isBootstrapServersInvalid ? 'Bootstrap Servers is required.' : null}
        onChange={handleChange}
        placeholder="localhost:9092"
        helperText={
          isBootstrapServersInvalid ? undefined : (
            <span>
              Example: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">localhost:9092</code>
            </span>
          )
        }
      />

      {/* Target Topic Input (Required) */}
      <PropertyField
        id="kafkaSinkTopic"
        name="topic"
        label="Topic"
        required={true}
        tooltip="The target Kafka topic where output records will be published (e.g. output-events). Required."
        value={topic}
        invalid={isTopicInvalid}
        error={isTopicInvalid ? 'Topic is required.' : null}
        onChange={handleChange}
        placeholder="output-topic"
        helperText={
          isTopicInvalid ? undefined : (
            <span>
              Example: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">output-events</code>
            </span>
          )
        }
      />

      {/* Key Serializer (Required) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="kafkaKeySerializer" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Key Serializer</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Class used to serialize the Kafka record key to bytes (e.g. ByteArraySerializer, StringSerializer). Required." />
        </label>
        <select
          id="kafkaKeySerializer"
          name="keySerializerSelect"
          value={selectedKeyPreset}
          onChange={handleKeySelectChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {KAFKA_SERIALIZER_PRESETS.map((preset) => (
            <option key={preset.className} value={preset.className}>
              {preset.label}
            </option>
          ))}
        </select>
        {selectedKeyPreset === 'custom' && (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              name="customKeySerializer"
              required
              aria-required="true"
              aria-invalid={isCustomKeyInvalid}
              value={customKeyValue}
              onChange={handleCustomKeyChange}
              placeholder="com.example.MyCustomKeySerializer"
              className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
                isCustomKeyInvalid
                  ? 'border-red-500/80 focus:border-red-500'
                  : 'border-slate-700 focus:border-blue-500'
              }`}
            />
            {isCustomKeyInvalid && (
              <span className="text-xs text-red-400">Custom Key Serializer class is required.</span>
            )}
          </div>
        )}
      </div>

      {/* Value Serializer (Required) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="kafkaValueSerializer" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Value Serializer</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Class used to serialize the Kafka record payload/value to bytes (e.g. StringSerializer, ByteArraySerializer). Required." />
        </label>
        <select
          id="kafkaValueSerializer"
          name="valueSerializerSelect"
          value={selectedValuePreset}
          onChange={handleValueSelectChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {KAFKA_SERIALIZER_PRESETS.map((preset) => (
            <option key={preset.className} value={preset.className}>
              {preset.label}
            </option>
          ))}
        </select>
        {selectedValuePreset === 'custom' && (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              name="customValueSerializer"
              required
              aria-required="true"
              aria-invalid={isCustomValueInvalid}
              value={customValueValue}
              onChange={handleCustomValueChange}
              placeholder="com.example.MyCustomValueSerializer"
              className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
                isCustomValueInvalid
                  ? 'border-red-500/80 focus:border-red-500'
                  : 'border-slate-700 focus:border-blue-500'
              }`}
            />
            {isCustomValueInvalid && (
              <span className="text-xs text-red-400">Custom Value Serializer class is required.</span>
            )}
          </div>
        )}
      </div>

      {/* Acks Setting */}
      <div className="flex flex-col gap-2">
        <label htmlFor="kafkaSinkAcks" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Acks (Durability)</span>
          <InfoTooltip text="The number of acknowledgments required before considering a write complete ('all'/'-1': full ISR durability, '1': leader ack, '0': fire-and-forget)." />
        </label>
        <select
          id="kafkaSinkAcks"
          name="acks"
          value={acks}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">all (-1) - Highest Durability</option>
          <option value="1">1 - Leader Only</option>
          <option value="0">0 - No Guarantee (Fire & Forget)</option>
        </select>
      </div>

      {/* Exactly-Once Semantics (EOS) */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50 flex flex-col gap-3">
        <label htmlFor="kafkaUseEOS" className="flex items-center gap-2 cursor-pointer">
          <input
            id="kafkaUseEOS"
            type="checkbox"
            name="useEOS"
            checked={useEOS}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <div className="flex items-center">
            <span className="text-sm font-medium text-slate-300">Exactly-Once Semantics (EOS)</span>
            <InfoTooltip text="Provides end-to-end exactly-once publishing by coordinating transactions across Kafka partitions. Requires topic partition count and sink group ID." />
          </div>
        </label>

        {useEOS && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50">
            <div className="flex flex-col gap-1">
              <label htmlFor="kafkaEosNumPartitions" className="flex items-center text-xs font-semibold text-slate-400">
                <span>Num Partitions</span>
                <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
                <InfoTooltip text="Total number of partitions for the destination topic, needed to assign dedicated transactional producers. Required when EOS is enabled." />
              </label>
              <input
                id="kafkaEosNumPartitions"
                type="number"
                name="eosNumPartitions"
                required
                aria-required="true"
                aria-invalid={isEosNumPartitionsInvalid}
                min="1"
                value={eosNumPartitions}
                onChange={handleChange}
                placeholder="e.g. 6"
                className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
                  isEosNumPartitionsInvalid
                    ? 'border-red-500/80 focus:border-red-500'
                    : 'border-slate-700 focus:border-blue-500'
                }`}
              />
              {isEosNumPartitionsInvalid && (
                <span className="text-xs text-red-400 font-normal">Num Partitions (&gt; 0) is required for EOS.</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="kafkaEosSinkGroupId" className="flex items-center text-xs font-semibold text-slate-400">
                <span>Sink Group ID</span>
                <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
                <InfoTooltip text="Unique identifier for the EOS sink group used for tracking transaction coordinates. Required when EOS is enabled." />
              </label>
              <input
                id="kafkaEosSinkGroupId"
                type="text"
                name="eosSinkGroupId"
                required
                aria-required="true"
                aria-invalid={isEosSinkGroupIdInvalid}
                value={eosSinkGroupId}
                onChange={handleChange}
                placeholder="sink-group-1"
                className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
                  isEosSinkGroupIdInvalid
                    ? 'border-red-500/80 focus:border-red-500'
                    : 'border-slate-700 focus:border-blue-500'
                }`}
              />
              {isEosSinkGroupIdInvalid && (
                <span className="text-xs text-red-400 font-normal">Sink Group ID is required for EOS.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Additional Producer Properties */}
      <PropertyField
        id="kafkaProducerProperties"
        name="producerProperties"
        label="Producer Properties"
        tooltip="Additional Kafka producer configuration properties formatted as key=value on separate lines (e.g. compression.type=snappy, retries=3, batch.size=16384)."
        type="textarea"
        value={producerProperties}
        onChange={handleChange}
        placeholder="compression.type=snappy&#10;retries=3&#10;batch.size=16384"
        rows={3}
      />

      {/* Flexible Spacer adhering to grid */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions Section at Bottom */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="kafkaSinkSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions supplied to the LLM when generating code for this Kafka write node."
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for Kafka write code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
