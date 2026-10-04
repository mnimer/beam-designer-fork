/**
 * ExpansionServiceFields Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Shared Python Cross-Language (x-lang) expansion service configuration block for Beam connectors
 * that have no native Python SDK transform and must call the Java implementation through a Beam
 * expansion service (e.g. AmqpIO, RabbitMqIO, PulsarIO, SolaceIO).
 * 
 * Architectural Decisions:
 * - Extracted after four connectors (IO15, IO20, IO62, IO63) independently reproduced the same
 *   markup, repeating the A4 "DRY violation across 41 forms" finding recorded in TASK.md. One shared
 *   primitive keeps the x-lang group visually and behaviourally identical across every connector.
 * - Pure presentational component: receives the current mode/endpoint as props and emits the native
 *   change event upward ("props in, events up"). It owns no form state.
 * - Reuses PropertyField and InfoTooltip so the verbatim Tailwind class strings, 8pt grid spacing,
 *   and accessible ARIA attributes match the rest of the property panels.
 * - Endpoint validation is intentionally rendered here rather than duplicated by each caller, so the
 *   "required when mode is endpoint" rule can never drift between connectors.
 */

import React from 'react';
import { Cpu } from 'lucide-react';
import { InfoTooltip } from '../InfoTooltip';
import { PropertyField } from './PropertyField';

export type ExpansionServiceMode = 'auto' | 'endpoint';

/**
 * Props for the {@link ExpansionServiceFields} component.
 */
export interface ExpansionServiceFieldsProps {
  /** Currently selected expansion service mode. Defaults to 'auto'. */
  mode?: ExpansionServiceMode | string;
  /** Endpoint (host:port) of an already-running expansion service. */
  endpoint?: string;
  /**
   * Beam transform name used in the tooltip copy (e.g. 'AmqpIO'). Explains to the user *why*
   * the x-lang group exists for this particular connector.
   */
  transformName: string;
  /** Prefix used to generate stable element ids (e.g. 'amqp-source'). */
  idPrefix: string;
  /** Form field name bound to the mode select. Defaults to 'expansionServiceMode'. */
  modeName?: string;
  /** Form field name bound to the endpoint input. Defaults to 'expansionServiceEndpoint'. */
  endpointName?: string;
  /** Placeholder shown in the endpoint input. Defaults to 'localhost:8097'. */
  endpointPlaceholder?: string;
  /** Shared change handler dispatched for both the select and the endpoint input. */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Renders the "Expansion Service (Python x-lang)" configuration group.
 * 
 * @param props Mode/endpoint values, naming metadata, and the upward change handler.
 * @returns React component rendering the mode selector and (conditionally) the endpoint field.
 */
export const ExpansionServiceFields: React.FC<ExpansionServiceFieldsProps> = ({
  mode = 'auto',
  endpoint = '',
  transformName,
  idPrefix,
  modeName = 'expansionServiceMode',
  endpointName = 'expansionServiceEndpoint',
  endpointPlaceholder = 'localhost:8097',
  onChange
}) => {
  const modeId = `${idPrefix}-expansion-mode`;
  const endpointId = `${idPrefix}-expansion-endpoint`;

  // NOTE: The endpoint is only meaningful (and only required) when the user opts out of the
  // auto-started Java expansion service. In 'auto' mode Beam boots the service from the connector
  // jar, so an empty endpoint is the correct, valid state.
  const isEndpointMode = mode === 'endpoint';
  const isEndpointMissing = isEndpointMode && !endpoint.trim();

  return (
    <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
      <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
        <Cpu size={12} className="text-blue-400" />
        <span>Expansion Service (Python x-lang)</span>
        <InfoTooltip
          text={`Python has no native ${transformName} transform and requires a Beam Cross-Language (x-lang) transform backed by the Java expansion service (apache_beam.transforms.external).`}
          position="auto"
        />
      </span>

      {/* Expansion Service Mode */}
      <div className="flex flex-col gap-2">
        <label htmlFor={modeId} className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Expansion Service Mode</span>
          <InfoTooltip
            text="Auto-start lets Beam boot the Java expansion service from the connector jar. Choose an existing endpoint when you run a long-lived expansion service (recommended for production and for pinning connector versions)."
            position="auto"
          />
        </label>
        <select
          id={modeId}
          name={modeName}
          value={mode}
          onChange={onChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="auto">Auto-start Java Expansion Service (Default)</option>
          <option value="endpoint">Existing Expansion Service Endpoint</option>
        </select>
      </div>

      {/* Endpoint (only when connecting to an already-running service) */}
      {isEndpointMode && (
        <PropertyField
          id={endpointId}
          name={endpointName}
          label="Expansion Service Endpoint"
          tooltip={`host:port of the running Beam expansion service that exposes the Java ${transformName} transform to the Python SDK.`}
          required="Expansion service endpoint is required when connecting to an existing service."
          aria-required="true"
          aria-invalid={isEndpointMissing}
          value={endpoint}
          onChange={onChange}
          placeholder={endpointPlaceholder}
          invalid={isEndpointMissing}
          error={isEndpointMissing ? 'Expansion service endpoint is required.' : null}
          mono={true}
        />
      )}
    </div>
  );
};
