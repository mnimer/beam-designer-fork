/**
 * KafkaIOSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam KafkaIO Streaming Source nodes.
 * Supports both Java native KafkaIO (KafkaIO.read()) and Python Cross-Language API (ReadFromKafka).
 * 
 * Architectural Decisions:
 * - Provides preset suggestions for standard Kafka Deserializers (String, ByteArray, Long, Integer, Double, Custom).
 * - Implements interactive InfoTooltip components next to each field label containing official Apache Beam documentation.
 * - Supports single or multi-topic subscriptions, consumer group IDs, auto offset reset strategies, and commit offset in finalize.
 * - Supports bounded read limits (maxNumRecords, maxReadTime) for testing and hybrid batch/streaming execution.
 * - Supports custom multiline consumer config overrides (e.g. security.protocol, sasl.mechanism).
 * - Includes a flexible spacer and "Code Generation Instructions" textarea at the bottom for LLM prompt customization.
 * - Strictly follows the 8pt grid system for spacing and sizing.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';

export interface KafkaDeserializerPreset {
  label: string;
  className: string;
}

export const KAFKA_DESERIALIZER_PRESETS: KafkaDeserializerPreset[] = [
  { label: 'String (StringDeserializer)', className: 'org.apache.kafka.common.serialization.StringDeserializer' },
  { label: 'Byte Array (ByteArrayDeserializer)', className: 'org.apache.kafka.common.serialization.ByteArrayDeserializer' },
  { label: 'Long (LongDeserializer)', className: 'org.apache.kafka.common.serialization.LongDeserializer' },
  { label: 'Integer (IntegerDeserializer)', className: 'org.apache.kafka.common.serialization.IntegerDeserializer' },
  { label: 'Double (DoubleDeserializer)', className: 'org.apache.kafka.common.serialization.DoubleDeserializer' },
  { label: 'Custom Class...', className: 'custom' },
];

interface KafkaIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      bootstrapServers?: string;
      topics?: string;
      groupId?: string;
      autoOffsetReset?: 'latest' | 'earliest' | 'none';
      keyDeserializer?: string;
      customKeyDeserializer?: string;
      valueDeserializer?: string;
      customValueDeserializer?: string;
      commitOffsetsInFinalize?: boolean;
      timestampPolicy?: string;
      maxNumRecords?: string | number;
      maxReadTime?: string | number;
      consumerProperties?: string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

interface KafkaIOSourcePropertiesProps {
  node: KafkaIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * KafkaIOSourceProperties renders the configuration form for Kafka streaming reads.
 *
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React component.
 */
export const KafkaIOSourceProperties: React.FC<KafkaIOSourcePropertiesProps> = ({ node, onChange }) => {
  // Extract existing properties or fallback to sensible defaults
  const properties = node.data.properties || {};

  const bootstrapServers = properties.bootstrapServers || '';
  const topics = properties.topics || '';
  const groupId = properties.groupId || '';
  const autoOffsetReset = properties.autoOffsetReset || 'latest';
  const keyDeserializer = properties.keyDeserializer || 'org.apache.kafka.common.serialization.ByteArrayDeserializer';
  const customKeyDeserializer = properties.customKeyDeserializer || '';
  const valueDeserializer = properties.valueDeserializer || 'org.apache.kafka.common.serialization.StringDeserializer';
  const customValueDeserializer = properties.customValueDeserializer || '';
  const commitOffsetsInFinalize = properties.commitOffsetsInFinalize ?? true;
  const timestampPolicy = properties.timestampPolicy || 'ProcessingTime';
  const maxNumRecords = properties.maxNumRecords ?? '';
  const maxReadTime = properties.maxReadTime ?? '';
  const consumerProperties = properties.consumerProperties || '';

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

  const isKeyPreset = KAFKA_DESERIALIZER_PRESETS.some(p => p.className === keyDeserializer && p.className !== 'custom');
  const selectedKeyPreset = isKeyPreset ? keyDeserializer : 'custom';
  const customKeyValue = isKeyPreset ? customKeyDeserializer : (customKeyDeserializer || (keyDeserializer !== 'custom' ? keyDeserializer : ''));

  const isValuePreset = KAFKA_DESERIALIZER_PRESETS.some(p => p.className === valueDeserializer && p.className !== 'custom');
  const selectedValuePreset = isValuePreset ? valueDeserializer : 'custom';
  const customValueValue = isValuePreset ? customValueDeserializer : (customValueDeserializer || (valueDeserializer !== 'custom' ? valueDeserializer : ''));

  // Validation states according to Apache Beam KafkaIO documentation
  const isBootstrapServersInvalid = !bootstrapServers.trim();
  const isTopicsInvalid = !topics.trim();
  const isCustomKeyInvalid = selectedKeyPreset === 'custom' && !customKeyValue.trim();
  const isCustomValueInvalid = selectedValuePreset === 'custom' && !customValueValue.trim();

  /**
   * Handles deserializer dropdown changes.
   */
  const handleKeySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      onChange({
        ...properties,
        keyDeserializer: customKeyValue || 'custom',
        customKeyDeserializer: customKeyValue
      });
    } else {
      onChange({
        ...properties,
        keyDeserializer: val,
        customKeyDeserializer: ''
      });
    }
  };

  const handleCustomKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange({
      ...properties,
      keyDeserializer: val,
      customKeyDeserializer: val
    });
  };

  const handleValueSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      onChange({
        ...properties,
        valueDeserializer: customValueValue || 'custom',
        customValueDeserializer: customValueValue
      });
    } else {
      onChange({
        ...properties,
        valueDeserializer: val,
        customValueDeserializer: ''
      });
    }
  };

  const handleCustomValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange({
      ...properties,
      valueDeserializer: val,
      customValueDeserializer: val
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Bootstrap Servers Input (Required) */}
      <PropertyField
        id="kafkaBootstrapServers"
        name="bootstrapServers"
        label="Bootstrap Servers"
        required={true}
        tooltip="A comma-separated list of host:port pairs to establish the initial connection to the Kafka cluster (e.g. localhost:9092 or broker1:9092,broker2:9092). Required."
        value={bootstrapServers}
        invalid={isBootstrapServersInvalid}
        error={isBootstrapServersInvalid ? 'Bootstrap Servers is required.' : null}
        helperText={!isBootstrapServersInvalid ? <span>Example: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">localhost:9092</code></span> : null}
        placeholder="localhost:9092"
        onChange={handleChange}
        mono={true}
      />

      {/* Topics Input (Required) */}
      <PropertyField
        id="kafkaTopics"
        name="topics"
        label="Topic(s)"
        required={true}
        tooltip="Comma-separated list of Kafka topic names to consume from (e.g. events or topic1,topic2). Required."
        value={topics}
        invalid={isTopicsInvalid}
        error={isTopicsInvalid ? 'Topic(s) is required.' : null}
        helperText={!isTopicsInvalid ? <span>Example: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">input-topic</code></span> : null}
        placeholder="input-topic"
        onChange={handleChange}
        mono={true}
      />

      {/* Consumer Group ID on its own line */}
      <PropertyField
        id="kafkaGroupId"
        name="groupId"
        label="Consumer Group ID"
        tooltip="A unique string identifying the consumer group this stream belongs to. Used by Kafka for offset tracking and partition assignment."
        value={groupId}
        onChange={handleChange}
        placeholder="beam-consumer-group"
        mono={true}
      />

      {/* Auto Offset Reset on its own line */}
      <div className="flex flex-col gap-2">
        <label htmlFor="kafkaAutoOffsetReset" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Auto Offset Reset</span>
          <InfoTooltip text="Position where the consumer should start reading when no initial offset exists or if current offset is invalid (latest = tail of log, earliest = start of log)." />
        </label>
        <select
          id="kafkaAutoOffsetReset"
          name="autoOffsetReset"
          value={autoOffsetReset}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="latest">latest (Read latest incoming messages)</option>
          <option value="earliest">earliest (Read from start of log)</option>
          <option value="none">none (Throw error if no offset found)</option>
        </select>
      </div>

      {/* Key Deserializer (Required) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="kafkaKeyDeserializer" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Key Deserializer</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Class used to deserialize the Kafka record key into an object (e.g. ByteArrayDeserializer, StringDeserializer). Required." />
        </label>
        <select
          id="kafkaKeyDeserializer"
          name="keyDeserializerSelect"
          value={selectedKeyPreset}
          onChange={handleKeySelectChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {KAFKA_DESERIALIZER_PRESETS.map((preset) => (
            <option key={preset.className} value={preset.className}>
              {preset.label}
            </option>
          ))}
        </select>
        {selectedKeyPreset === 'custom' && (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              name="customKeyDeserializer"
              required
              aria-required="true"
              aria-invalid={isCustomKeyInvalid}
              value={customKeyValue}
              onChange={handleCustomKeyChange}
              placeholder="com.example.MyCustomKeyDeserializer"
              className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
                isCustomKeyInvalid
                  ? 'border-red-500/80 focus:border-red-500'
                  : 'border-slate-700 focus:border-blue-500'
              }`}
            />
            {isCustomKeyInvalid && (
              <span className="text-xs text-red-400">Custom Key Deserializer class is required.</span>
            )}
          </div>
        )}
      </div>

      {/* Value Deserializer (Required) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="kafkaValueDeserializer" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Value Deserializer</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Class used to deserialize the Kafka record payload/value into an object (e.g. StringDeserializer, ByteArrayDeserializer). Required." />
        </label>
        <select
          id="kafkaValueDeserializer"
          name="valueDeserializerSelect"
          value={selectedValuePreset}
          onChange={handleValueSelectChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {KAFKA_DESERIALIZER_PRESETS.map((preset) => (
            <option key={preset.className} value={preset.className}>
              {preset.label}
            </option>
          ))}
        </select>
        {selectedValuePreset === 'custom' && (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              name="customValueDeserializer"
              required
              aria-required="true"
              aria-invalid={isCustomValueInvalid}
              value={customValueValue}
              onChange={handleCustomValueChange}
              placeholder="com.example.MyCustomValueDeserializer"
              className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
                isCustomValueInvalid
                  ? 'border-red-500/80 focus:border-red-500'
                  : 'border-slate-700 focus:border-blue-500'
              }`}
            />
            {isCustomValueInvalid && (
              <span className="text-xs text-red-400">Custom Value Deserializer class is required.</span>
            )}
          </div>
        )}
      </div>

      {/* Commit Offsets in Finalize Checkbox */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="kafkaCommitOffsets" className="flex items-center gap-2 cursor-pointer">
          <input
            id="kafkaCommitOffsets"
            type="checkbox"
            name="commitOffsetsInFinalize"
            checked={commitOffsetsInFinalize}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <div className="flex items-center">
            <span className="text-sm font-medium text-slate-300">Commit Offsets in Finalize</span>
            <InfoTooltip text="Automatically commits consumer offsets to Kafka after pipeline checkpoints/bundles finalize, guaranteeing at-least-once processing." />
          </div>
        </label>
      </div>

      {/* Timestamp Policy & Bounded Limits */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="kafkaTimestampPolicy" className="flex items-center text-xs font-semibold text-slate-400">
            <span>Timestamp Policy</span>
            <InfoTooltip text="Determines how event timestamps and watermarks are assigned (ProcessingTime, CreateTime, or LogAppendTime)." />
          </label>
          <select
            id="kafkaTimestampPolicy"
            name="timestampPolicy"
            value={timestampPolicy}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="ProcessingTime">Processing Time (Default)</option>
            <option value="CreateTime">Record Create Time</option>
            <option value="LogAppendTime">Log Append Time</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="kafkaMaxNumRecords" className="flex items-center text-xs font-semibold text-slate-400">
            <span>Max Records</span>
            <InfoTooltip text="Bounds the read to a maximum number of records before stopping. Useful for testing or batch runs." />
          </label>
          <input
            id="kafkaMaxNumRecords"
            type="number"
            name="maxNumRecords"
            min="1"
            value={maxNumRecords}
            onChange={handleChange}
            placeholder="e.g. 10000"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="kafkaMaxReadTime" className="flex items-center text-xs font-semibold text-slate-400">
            <span>Max Read Time (s)</span>
            <InfoTooltip text="Bounds the read to a maximum duration in seconds. Useful for bounded streaming executions." />
          </label>
          <input
            id="kafkaMaxReadTime"
            type="number"
            name="maxReadTime"
            min="1"
            value={maxReadTime}
            onChange={handleChange}
            placeholder="e.g. 60"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Additional Consumer Properties */}
      <PropertyField
        id="kafkaConsumerProperties"
        name="consumerProperties"
        label="Consumer Properties"
        tooltip="Additional Kafka consumer configuration options formatted as key=value on each line (e.g. security.protocol=SASL_SSL or fetch.min.bytes=1024)."
        type="textarea"
        value={consumerProperties}
        onChange={handleChange}
        placeholder={`security.protocol=SASL_SSL\nsasl.mechanism=PLAIN`}
        rows={3}
        mono={true}
      />

      {/* Flexible Spacer adhering to grid */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions Section at Bottom */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="kafkaSourceSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions supplied to the LLM when generating code for this Kafka read node."
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for Kafka read code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
