/**
 * JmsIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam JmsIO Streaming Sink nodes
 * (e.g., JmsIO.<T>write() in Java, WriteToJms in Python).
 * 
 * Architectural Decisions:
 * - Provides preset selections for popular JMS providers (ActiveMQ, ActiveMQ Artemis, Qpid AMQP, IBM MQ, Solace, Custom).
 * - Enforces mutual exclusivity between Queue and Topic destinations: In Apache Beam JmsIO, exactly one
 *   destination type (withQueue or withTopic) must be specified.
 * - Integrates extension callbacks to Google Cloud CLI (gcloud) for discovering:
 *   1. Secret Manager secrets (getSecrets / secretsLoaded) for secure password reference.
 *   2. Compute Engine VM instances (getComputeInstances / computeInstancesLoaded) for auto-populating broker endpoints.
 * - Supports authentication mode selection: Google Cloud Secret Manager (passwordSecret) or Plaintext password (with cleartext warning).
 * - Resolves initial authentication mode with backward compatibility for legacy saved pipelines.
 * - Supports RetryConfiguration options (maxRetries, initialRetryDelay) for robust production publishing.
 * - Supports custom ValueMapper specification for converting pipeline elements to javax.jms.Message instances.
 * - Includes Code Generation Instructions textarea for Gemini LLM prompt customization.
 * - Strictly follows the 8pt grid system (multiples of 8px) and VS Code theme variables.
 */

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerAuthFields } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { resolveAuthMode, JMS_AUTH_OPTIONS } from '../source/JmsIO';
import type { JmsAuthMode } from '../source/JmsIO';

export interface JmsProviderPreset {
  label: string;
  factoryClass: string;
  defaultUrl: string;
}

export const JMS_PROVIDER_PRESETS: JmsProviderPreset[] = [
  {
    label: 'Apache ActiveMQ',
    factoryClass: 'org.apache.activemq.ActiveMQConnectionFactory',
    defaultUrl: 'tcp://localhost:61616'
  },
  {
    label: 'Apache ActiveMQ Artemis',
    factoryClass: 'org.apache.activemq.artemis.jms.client.ActiveMQConnectionFactory',
    defaultUrl: 'tcp://localhost:61616'
  },
  {
    label: 'Apache Qpid AMQP 1.0',
    factoryClass: 'org.apache.qpid.jms.JmsConnectionFactory',
    defaultUrl: 'amqp://localhost:5672'
  },
  {
    label: 'IBM MQ',
    factoryClass: 'com.ibm.mq.jms.MQConnectionFactory',
    defaultUrl: 'localhost(1414)'
  },
  {
    label: 'Solace PubSub+',
    factoryClass: 'com.solacesystems.jms.SolConnectionFactory',
    defaultUrl: 'tcp://localhost:55555'
  },
  {
    label: 'Custom ConnectionFactory...',
    factoryClass: 'custom',
    defaultUrl: ''
  }
];

export interface ComputeInstanceInfo {
  name: string;
  zone: string;
  internalIp: string;
  externalIp: string;
  status: string;
}

interface JmsIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      connectionFactory?: string;
      customConnectionFactory?: string;
      brokerUrl?: string;
      destinationType?: 'queue' | 'topic';
      queue?: string;
      topic?: string;
      authMode?: JmsAuthMode;
      username?: string;
      password?: string;
      passwordSecret?: string;
      maxRetries?: string | number;
      initialRetryDelay?: string | number;
      valueMapper?: string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      [key: string]: any;
    };
  };
}

interface JmsIOSinkPropertiesProps {
  node: JmsIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * JmsIOSinkProperties renders the property panel for configuring JMS message publishing.
 * 
 * @param props Component properties containing the active node and onChange handler.
 * @returns React functional component.
 */
export const JmsIOSinkProperties: React.FC<JmsIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const connectionFactory = properties.connectionFactory || 'org.apache.activemq.ActiveMQConnectionFactory';
  const customConnectionFactory = properties.customConnectionFactory || '';
  const brokerUrl = properties.brokerUrl ?? 'tcp://localhost:61616';
  const destinationType = properties.destinationType || (properties.topic ? 'topic' : 'queue');
  const queue = properties.queue || '';
  const topic = properties.topic || '';
  const authMode = resolveAuthMode(properties.authMode, properties.password);
  const username = properties.username || '';
  const password = properties.password || '';
  const passwordSecret = properties.passwordSecret || '';
  const maxRetries = properties.maxRetries ?? '';
  const initialRetryDelay = properties.initialRetryDelay ?? '';
  const valueMapper = properties.valueMapper || '';

  // NOTE: Request Secret Manager secrets via useAssetLoader
  const { items: secrets } = useAssetLoader<SecretItem | string>('secrets');
  const [computeInstances, setComputeInstances] = useState<ComputeInstanceInfo[]>([]);

  // NOTE: Listen for gcloud responses from the VS Code extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message && message.command === 'computeInstancesLoaded') {
        setComputeInstances(message.instances || []);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request available Secret Manager secrets and Compute Engine instances from extension
    const vscode = (window as any).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'getComputeInstances' });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // System instructions text with fallbacks
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    properties.codeGenerationPrompt ??
    '';

  // Validation rules according to Beam JmsIO requirements
  const isConnectionFactoryInvalid = !connectionFactory.trim() || (connectionFactory === 'custom' && !customConnectionFactory.trim());
  const isDestinationInvalid = destinationType === 'queue' ? !queue.trim() : !topic.trim();

  // Preset match helper
  const isPreset = JMS_PROVIDER_PRESETS.some(p => p.factoryClass === connectionFactory && p.factoryClass !== 'custom');
  const selectedPreset = isPreset ? connectionFactory : 'custom';

  /**
   * Handles generic text, select, and checkbox input changes.
   * 
   * @param e Form change event.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    const newProperties = {
      ...properties,
      [name]: isCheckbox ? checked : value
    };

    // Mode switching and credential property synchronization
    if (name === 'authMode') {
      if (value === 'secretManager') {
        delete newProperties.password;
      } else if (value === 'plaintext') {
        delete newProperties.passwordSecret;
      }
    } else if (name === 'passwordSecret') {
      delete newProperties.password;
      if (!newProperties.authMode) {
        newProperties.authMode = 'secretManager';
      }
    } else if (name === 'password') {
      delete newProperties.passwordSecret;
      if (!newProperties.authMode) {
        newProperties.authMode = 'plaintext';
      }
    }

    onChange(newProperties);
  };

  /**
   * Handles switching the JMS provider preset. Automatically populates standard ConnectionFactory
   * class and suggested broker URL.
   * 
   * @param e Select change event.
   */
  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedClass = e.target.value;
    const matchedPreset = JMS_PROVIDER_PRESETS.find(p => p.factoryClass === selectedClass);

    if (selectedClass === 'custom') {
      onChange({
        ...properties,
        connectionFactory: customConnectionFactory || 'custom',
        customConnectionFactory: customConnectionFactory
      });
    } else if (matchedPreset) {
      onChange({
        ...properties,
        connectionFactory: matchedPreset.factoryClass,
        customConnectionFactory: '',
        brokerUrl: matchedPreset.defaultUrl
      });
    }
  };

  /**
   * Handles custom ConnectionFactory class input change.
   * 
   * @param e Input change event.
   */
  const handleCustomFactoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange({
      ...properties,
      connectionFactory: val,
      customConnectionFactory: val
    });
  };

  /**
   * Handles switching destination type between Queue and Topic, ensuring mutual exclusivity.
   * 
   * @param newType Either 'queue' or 'topic'.
   */
  const handleDestinationTypeChange = (newType: 'queue' | 'topic') => {
    const newProperties = {
      ...properties,
      destinationType: newType
    };

    // NOTE: In Apache Beam JmsIO, withQueue and withTopic are mutually exclusive
    if (newType === 'queue') {
      delete newProperties.topic;
      if (!newProperties.queue && topic) {
        newProperties.queue = topic;
      }
    } else {
      delete newProperties.queue;
      if (!newProperties.topic && queue) {
        newProperties.topic = queue;
      }
    }

    onChange(newProperties);
  };

  /**
   * Handles destination name input change for active destination type.
   * 
   * @param e Input change event.
   */
  const handleDestinationNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const newProperties = {
      ...properties,
      destinationType: destinationType,
      [destinationType]: val
    };

    // Clean up opposing destination to guarantee mutual exclusivity in emitted YAML
    if (destinationType === 'queue') {
      delete newProperties.topic;
    } else {
      delete newProperties.queue;
    }

    onChange(newProperties);
  };

  /**
   * Handles quick insertion of a Compute Engine VM instance IP address into brokerUrl.
   * 
   * @param ip Internal IP address of the VM instance.
   */
  const handleSelectInstanceIp = (ip: string) => {
    if (!ip) return;
    const port = brokerUrl.includes(':') ? brokerUrl.split(':').pop() : '61616';
    const prefix = brokerUrl.startsWith('amqp://') ? 'amqp://' : 'tcp://';
    onChange({
      ...properties,
      brokerUrl: `${prefix}${ip}:${port}`
    });
  };

  /**
   * Handles system instructions textarea change for LLM prompt customization.
   * 
   * @param e Textarea change event.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-xs">
      {/* Provider Preset & Connection Factory */}
      <div className="flex flex-col gap-1">
        <label htmlFor="jmsSinkProviderPreset" className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5">
          <span>JMS Provider Preset</span>
          <InfoTooltip text="Select a standard JMS provider to automatically configure its ConnectionFactory and default URL, or select Custom to provide your own class." />
        </label>
        <select
          id="jmsSinkProviderPreset"
          name="jmsSinkProviderPreset"
          value={selectedPreset}
          onChange={handlePresetChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] focus:border-[var(--vscode-focusBorder,#3b82f6)] text-sm focus:outline-none"
        >
          {JMS_PROVIDER_PRESETS.map(preset => (
            <option key={preset.factoryClass} value={preset.factoryClass}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* Custom Connection Factory input if Custom preset selected */}
      {selectedPreset === 'custom' && (
        <div className="flex flex-col gap-1">
          <label htmlFor="jmsSinkCustomFactory" className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5">
            <span>ConnectionFactory Class</span>
            <span className="text-red-400 font-bold" title="ConnectionFactory is required">*</span>
            <InfoTooltip text="Fully qualified Java class name of javax.jms.ConnectionFactory (e.g. org.apache.activemq.ActiveMQConnectionFactory)." />
          </label>
          <input
            id="jmsSinkCustomFactory"
            type="text"
            name="customConnectionFactory"
            value={customConnectionFactory}
            onChange={handleCustomFactoryChange}
            placeholder="com.example.jms.CustomConnectionFactory"
            className={`bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border text-sm font-mono focus:outline-none ${
              isConnectionFactoryInvalid ? 'border-red-500/80 focus:border-red-500' : 'border-[var(--vscode-border)] focus:border-[var(--vscode-focusBorder,#3b82f6)]'
            }`}
          />
        </div>
      )}

      {/* Broker URL */}
      <div className="flex flex-col gap-1">
        <label htmlFor="jmsSinkBrokerUrl" className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5">
          <span>Broker URL</span>
          <InfoTooltip text="Connection URL for the JMS broker (e.g. tcp://localhost:61616 or amqp://localhost:5672). You can also select an IP from your Compute Engine instances." />
        </label>
        <input
          id="jmsSinkBrokerUrl"
          type="text"
          name="brokerUrl"
          value={brokerUrl}
          onChange={handleChange}
          placeholder="tcp://localhost:61616"
          list="sink-compute-instance-ips"
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] focus:border-[var(--vscode-focusBorder,#3b82f6)] text-sm font-mono focus:outline-none"
        />
        <datalist id="sink-compute-instance-ips">
          {computeInstances.map(inst => (
            <option key={inst.name} value={`tcp://${inst.internalIp || inst.externalIp}:61616`}>
              {inst.name} ({inst.zone})
            </option>
          ))}
        </datalist>

        {/* Compute Engine Instance Helper if instances discovered */}
        {computeInstances.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1 text-[11px] text-[var(--vscode-text-muted)]">
            <span className="font-semibold text-[var(--vscode-text-secondary,#c9d1d9)]">GCP Instances:</span>
            {computeInstances.slice(0, 3).map(inst => (
              <button
                key={inst.name}
                type="button"
                onClick={() => handleSelectInstanceIp(inst.internalIp || inst.externalIp)}
                className="bg-[var(--vscode-button-secondary)] hover:bg-[var(--vscode-hover)] text-[var(--vscode-highlight,#58a6ff)] px-1.5 py-0.5 rounded transition-colors text-xs"
                title={`Use ${inst.name} (${inst.internalIp || inst.externalIp})`}
              >
                {inst.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Destination Selection: Queue vs Topic */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5">
          <span>Destination Type</span>
          <InfoTooltip text="Apache Beam JmsIO writes to either a JMS Queue (point-to-point) or Topic (publish-subscribe). Exactly one must be specified." />
        </span>
        <div className="grid grid-cols-2 gap-2 bg-[var(--vscode-subcard-bg)] p-1 rounded border border-[var(--vscode-border)]">
          <button
            type="button"
            onClick={() => handleDestinationTypeChange('queue')}
            className={`py-1.5 px-3 rounded text-xs font-semibold transition-colors ${
              destinationType === 'queue'
                ? 'bg-blue-600 text-white shadow'
                : 'text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] hover:bg-[var(--vscode-hover)]'
            }`}
          >
            Queue (Point-to-Point)
          </button>
          <button
            type="button"
            onClick={() => handleDestinationTypeChange('topic')}
            className={`py-1.5 px-3 rounded text-xs font-semibold transition-colors ${
              destinationType === 'topic'
                ? 'bg-blue-600 text-white shadow'
                : 'text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] hover:bg-[var(--vscode-hover)]'
            }`}
          >
            Topic (Pub/Sub)
          </button>
        </div>
      </div>

      {/* Destination Name Input */}
      <div className="flex flex-col gap-1">
        <label htmlFor="jmsSinkDestinationName" className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5">
          <span>{destinationType === 'queue' ? 'Queue Name' : 'Topic Name'}</span>
          <span className="text-red-400 font-bold" title="Destination name is required">*</span>
          <InfoTooltip text={`Name of the JMS ${destinationType} to publish messages to.`} />
        </label>
        <input
          id="jmsSinkDestinationName"
          type="text"
          value={destinationType === 'queue' ? queue : topic}
          onChange={handleDestinationNameChange}
          placeholder={destinationType === 'queue' ? 'orders.processed' : 'events.broadcast'}
          className={`bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border text-sm font-mono focus:outline-none ${
            isDestinationInvalid ? 'border-red-500/80 focus:border-red-500' : 'border-[var(--vscode-border)] focus:border-[var(--vscode-focusBorder,#3b82f6)]'
          }`}
        />
        {isDestinationInvalid && (
          <span className="text-[11px] text-red-400">
            A {destinationType} name is required for JmsIO.write().
          </span>
        )}
      </div>

      {/* Authentication */}
      <div className="border-t border-[var(--vscode-border)] pt-4 flex flex-col gap-3">
        <PropertyField
          id="jmsSinkUsername"
          name="username"
          label="Username"
          tooltip="Optional username for authenticating to the JMS broker."
          value={username}
          onChange={handleChange}
          placeholder="admin"
          mono={true}
        />

        <SecretManagerAuthFields
          idPrefix="jmsSink"
          datalistId="jms-sink-secrets-list"
          authMode={authMode}
          authOptions={JMS_AUTH_OPTIONS}
          secretName={passwordSecret}
          secretNameId="jmsSinkPasswordSecret"
          secretNameName="passwordSecret"
          secretPlaceholder="jms-broker-password"
          secrets={secrets}
          serviceName="JMS"
          onChange={handleChange}
        />

        {authMode === 'plaintext' && (
          <div className="flex flex-col gap-1">
            <PropertyField
              id="jmsSinkPassword"
              type="password"
              name="password"
              label="Password"
              tooltip="Optional password for authenticating to the JMS broker."
              value={password}
              onChange={handleChange}
              placeholder="••••••••"
              mono={false}
            />
            <p className="text-xs text-amber-400 mt-1" role="alert">
              Warning: Password will be saved in cleartext inside the .beam file and should not be committed to source control.
            </p>
          </div>
        )}
      </div>

      {/* Reliability & Mapping */}
      <div className="border-t border-[var(--vscode-border)] pt-4 flex flex-col gap-3">
        <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">Reliability & Mapping (Optional)</span>

        <div className="grid grid-cols-2 gap-2">
          {/* Max Retries */}
          <div className="flex flex-col gap-1">
            <label htmlFor="jmsMaxRetries" className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5">
              <span>Max Retries</span>
              <InfoTooltip text="Maximum retry attempts on send failures (withRetryConfiguration)." />
            </label>
            <input
              id="jmsMaxRetries"
              type="number"
              name="maxRetries"
              value={maxRetries}
              onChange={handleChange}
              placeholder="Default"
              min="0"
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] focus:border-[var(--vscode-focusBorder,#3b82f6)] text-sm font-mono focus:outline-none"
            />
          </div>

          {/* Initial Retry Delay */}
          <div className="flex flex-col gap-1">
            <label htmlFor="jmsInitialRetryDelay" className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5">
              <span>Retry Delay (ms)</span>
              <InfoTooltip text="Initial backoff duration in milliseconds between retries." />
            </label>
            <input
              id="jmsInitialRetryDelay"
              type="number"
              name="initialRetryDelay"
              value={initialRetryDelay}
              onChange={handleChange}
              placeholder="Default"
              min="0"
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] focus:border-[var(--vscode-focusBorder,#3b82f6)] text-sm font-mono focus:outline-none"
            />
          </div>
        </div>

        {/* Custom ValueMapper */}
        <div className="flex flex-col gap-1">
          <label htmlFor="jmsValueMapper" className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5">
            <span>Value Mapper</span>
            <InfoTooltip text="Custom function or class mapping pipeline elements to javax.jms.Message (withValueMapper). Defaults to TextMessage." />
          </label>
          <input
            id="jmsValueMapper"
            type="text"
            name="valueMapper"
            value={valueMapper}
            onChange={handleChange}
            placeholder="e.g. (element, session) -> session.createTextMessage(element)"
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] focus:border-[var(--vscode-focusBorder,#3b82f6)] text-sm font-mono focus:outline-none"
          />
        </div>
      </div>

      {/* Code Generation Instructions Spacer and Section */}
      <div className="flex-1 min-h-[16px]" />

      <div className="flex flex-col gap-1 pt-2 border-t border-[var(--vscode-border)]">
        <label htmlFor="jmsSinkSystemInstructions" className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5">
          <span>Code Generation Instructions</span>
          <InfoTooltip text="Special instructions passed to the AI code generator specifically for this JMS Sink node (e.g. custom message formatting, correlation ID headers)." />
        </label>
        <textarea
          id="jmsSinkSystemInstructions"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Set JMSCorrelationID header from element ID before publishing"
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] focus:border-[var(--vscode-focusBorder,#3b82f6)] text-sm font-mono focus:outline-none resize-y"
        />
      </div>
    </div>
  );
};
