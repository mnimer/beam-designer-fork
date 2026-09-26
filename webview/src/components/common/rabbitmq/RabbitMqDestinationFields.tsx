/**
 * RabbitMqDestinationFields Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Shared destination configuration block for RabbitMQ source and sink transforms, providing
 * mutually exclusive selection between direct Queue consumption/publishing and Exchange routing.
 * 
 * Architectural Decisions:
 * - Extracted from RabbitMqIOSourceProperties and RabbitMqIOSinkProperties to enforce DRY standards
 *   and keep property panel sizes well under the repository threshold.
 * - Pure presentational component ("props in, events up"): owns no internal form state, accepting
 *   current values and emitting standard React change events upward to the parent panel.
 * - Mutually exclusive mode selector ('queue' vs 'exchange') dynamically toggles target fields and
 *   enforces required validation on whichever mode is currently active.
 * - Supports exchange auto-declaration toggle (withExchange overloads for declaring vs existing exchanges).
 * - Parameterized mode field name ('consumeMode' | 'publishMode'), legends, labels, and tooltips
 *   to cleanly support both source and sink semantics while keeping verbatim Tailwind classes and DOM structure.
 */

import React from 'react';
import { Layers } from 'lucide-react';
import { InfoTooltip } from '../../InfoTooltip';
import { PropertyField } from '../PropertyField';

export type RabbitMqDestinationMode = 'queue' | 'exchange';
export type RabbitMqExchangeType = 'direct' | 'fanout' | 'topic' | 'headers';

export interface RabbitMqDestinationFieldsProps {
  /** Prefix for stable element IDs, e.g. 'rabbitmq-source' or 'rabbitmq-sink'. */
  idPrefix: string;
  /** Active destination mode: 'queue' or 'exchange'. */
  mode: RabbitMqDestinationMode | string;
  /** Form property name bound to the radio buttons. Defaults to 'consumeMode'. */
  modeFieldName?: 'consumeMode' | 'publishMode' | string;
  /** Legend title displayed at the top of the group. Defaults to 'Consumption Target'. */
  legendTitle?: string;
  /** Tooltip copy describing the destination group. */
  legendTooltip?: string;
  /** Queue name value. */
  queue?: string;
  /** Queue declaration boolean flag (.withQueueDeclare). */
  queueDeclare?: boolean;
  /** Label for the queue input field. Defaults to 'Queue Name'. */
  queueLabel?: string;
  /** Tooltip copy for the queue input field. */
  queueTooltip?: string;
  /** Tooltip copy for the queue declaration checkbox. */
  queueDeclareTooltip?: string;
  /** Explanatory help text beneath the queue declaration checkbox. */
  queueDeclareHelpText?: React.ReactNode;
  /** Exchange name value. */
  exchange?: string;
  /** Exchange auto-declaration boolean flag. Defaults to true. */
  exchangeDeclare?: boolean;
  /** Exchange type: 'direct', 'fanout', 'topic', or 'headers'. Defaults to 'direct'. */
  exchangeType?: RabbitMqExchangeType | string;
  /** Tooltip copy for the exchange name input field. */
  exchangeTooltip?: string;
  /** Placeholder for the exchange name input field. */
  exchangePlaceholder?: string;
  /** Routing key binding / message routing key. */
  routingKey?: string;
  /** Label for routing key field. Defaults to 'Routing Key' (or 'Message Routing Key' for sink). */
  routingKeyLabel?: string;
  /** Tooltip copy for the routing key input field. */
  routingKeyTooltip?: string;
  /** Placeholder for routing key input field. */
  routingKeyPlaceholder?: string;
  /** Change event handler dispatched for all inputs, radios, and selects. */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Renders the mutually-exclusive Queue vs Exchange destination block for RabbitMQ.
 * 
 * @param props Active values, parameterised labels/tooltips, and the upward change event handler.
 * @returns React functional component.
 */
export const RabbitMqDestinationFields: React.FC<RabbitMqDestinationFieldsProps> = ({
  idPrefix,
  mode = 'queue',
  modeFieldName = 'consumeMode',
  legendTitle = 'Consumption Target',
  legendTooltip = 'Specify how RabbitMqIO consumes messages: either directly from a Queue (.withQueue(name)) or bound to an Exchange (.withExchange(name, type, routingKey)).',
  queue = '',
  queueDeclare = false,
  queueLabel = 'Queue Name',
  queueTooltip = 'Name of the RabbitMQ queue to target.',
  queueDeclareTooltip = 'Automatically declares the specified queue on the broker if it does not already exist.',
  queueDeclareHelpText,
  exchange = '',
  exchangeDeclare = true,
  exchangeType = 'direct',
  exchangeTooltip = 'Name of the RabbitMQ exchange to target.',
  exchangePlaceholder = 'e.g. amq.topic',
  routingKey = '',
  routingKeyLabel,
  routingKeyTooltip,
  routingKeyPlaceholder = 'e.g. orders.*',
  onChange
}) => {
  const isPublishMode = modeFieldName === 'publishMode';
  const modeKebab = isPublishMode ? 'publish-mode' : 'consume-mode';
  const queueRadioId = `${idPrefix}-${modeKebab}-queue`;
  const exchangeRadioId = `${idPrefix}-${modeKebab}-exchange`;

  const queueId = `${idPrefix}-queue`;
  const queueDeclareId = `${idPrefix}-queue-declare`;
  const exchangeId = `${idPrefix}-exchange`;
  const exchangeDeclareId = `${idPrefix}-exchange-declare`;
  const exchangeTypeId = `${idPrefix}-exchange-type`;
  const routingKeyId = `${idPrefix}-routing-key`;

  const resolvedRoutingKeyLabel = routingKeyLabel || (isPublishMode ? 'Message Routing Key' : 'Routing Key');
  const resolvedRoutingKeyTooltip =
    routingKeyTooltip ||
    (isPublishMode
      ? 'Routing key attached to published RabbitMqMessage objects in generated code (RabbitMqIO.write() sets routing keys per-message).'
      : 'Routing key or binding pattern for message routing.');

  const isQueueMissing = mode === 'queue' && !queue.trim();
  const isExchangeMissing = mode === 'exchange' && !exchange.trim();
  const isExchangeDeclare = exchangeDeclare ?? true;

  return (
    <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
          <Layers size={12} className="text-blue-400" />
          <span>{legendTitle}</span>
          <InfoTooltip text={legendTooltip} position="auto" />
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
            <input
              id={queueRadioId}
              type="radio"
              name={modeFieldName}
              value="queue"
              checked={mode === 'queue'}
              onChange={onChange}
              className="accent-blue-500"
            />
            <span>Queue</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
            <input
              id={exchangeRadioId}
              type="radio"
              name={modeFieldName}
              value="exchange"
              checked={mode === 'exchange'}
              onChange={onChange}
              className="accent-blue-500"
            />
            <span>Exchange</span>
          </label>
        </div>
      </div>

      {mode === 'queue' ? (
        <div className="flex flex-col gap-2">
          <PropertyField
            id={queueId}
            name="queue"
            label={queueLabel}
            required="Queue name is required."
            tooltip={queueTooltip}
            aria-required="true"
            aria-invalid={isQueueMissing}
            value={queue}
            onChange={onChange}
            placeholder="e.g. orders.incoming"
            invalid={isQueueMissing}
            error={isQueueMissing ? 'Queue name is required.' : null}
            mono={true}
          />

          <div className="p-2.5 rounded bg-[#252836]/40 border border-slate-700/60">
            <label htmlFor={queueDeclareId} className="flex items-start gap-2.5 cursor-pointer">
              <input
                id={queueDeclareId}
                type="checkbox"
                name="queueDeclare"
                checked={queueDeclare}
                onChange={onChange}
                className="mt-0.5 accent-blue-500 rounded"
              />
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center text-xs font-bold text-white gap-1">
                  <span>Declare Queue if Not Exists</span>
                  <InfoTooltip text={queueDeclareTooltip} position="auto" />
                </span>
                <p className="text-xs text-slate-400">
                  {queueDeclareHelpText || (
                    <>
                      Calls <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded font-mono">.withQueueDeclare(true)</code> to ensure queue presence.
                    </>
                  )}
                </p>
              </div>
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <PropertyField
            id={exchangeId}
            name="exchange"
            label="Exchange Name"
            required="Exchange name is required."
            tooltip={exchangeTooltip}
            aria-required="true"
            aria-invalid={isExchangeMissing}
            value={exchange}
            onChange={onChange}
            placeholder={exchangePlaceholder}
            invalid={isExchangeMissing}
            error={isExchangeMissing ? 'Exchange name is required.' : null}
            mono={true}
          />

          <div className="p-2.5 rounded bg-[#252836]/40 border border-slate-700/60">
            <label htmlFor={exchangeDeclareId} className="flex items-start gap-2.5 cursor-pointer">
              <input
                id={exchangeDeclareId}
                type="checkbox"
                name="exchangeDeclare"
                checked={isExchangeDeclare}
                onChange={onChange}
                className="mt-0.5 accent-blue-500 rounded"
              />
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center text-xs font-bold text-white gap-1">
                  <span>Auto-declare Exchange</span>
                  <InfoTooltip
                    text="Declare exchange on broker if it does not exist. Uncheck when connecting to a pre-existing durable exchange to avoid declaration conflicts."
                    position="auto"
                  />
                </span>
                <p className="text-xs text-slate-400">
                  Declare exchange on broker if it does not exist. Uncheck when connecting to a pre-existing durable exchange to avoid declaration conflicts.
                </p>
              </div>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={exchangeTypeId} className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
              <span>Exchange Type</span>
              <InfoTooltip
                text="Type of the RabbitMQ exchange: direct (exact routing key match), fanout (broadcast to all bound queues), topic (wildcard routing pattern), or headers."
                position="auto"
              />
            </label>
            <select
              id={exchangeTypeId}
              name="exchangeType"
              value={exchangeType}
              onChange={onChange}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="direct">direct</option>
              <option value="fanout">fanout</option>
              <option value="topic">topic</option>
              <option value="headers">headers</option>
            </select>
          </div>

          <PropertyField
            id={routingKeyId}
            name="routingKey"
            label={resolvedRoutingKeyLabel}
            tooltip={resolvedRoutingKeyTooltip}
            value={routingKey}
            onChange={onChange}
            placeholder={routingKeyPlaceholder}
            mono={true}
          />
        </div>
      )}
    </div>
  );
};
