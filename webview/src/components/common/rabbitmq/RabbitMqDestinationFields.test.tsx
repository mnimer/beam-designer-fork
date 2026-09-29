/**
 * RabbitMqDestinationFields Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating RabbitMqDestinationFields:
 * - Queue mode rendering, queueDeclare toggle, and validation error on empty queue
 * - Exchange mode rendering, exchangeDeclare toggle, exchangeType dropdown, routingKey, and validation error on empty exchange
 * - Mode radio button toggling and upward change event emission
 * - Parameterised field naming (consumeMode vs publishMode) and custom legend/labels (Message Routing Key for publish)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RabbitMqDestinationFields } from './RabbitMqDestinationFields';

describe('RabbitMqDestinationFields', () => {
  it('renders queue mode fields and validates required queue name', () => {
    const onChange = vi.fn();
    render(
      <RabbitMqDestinationFields
        idPrefix="rabbitmq-source"
        mode="queue"
        modeFieldName="consumeMode"
        queue=""
        queueDeclare={false}
        onChange={onChange}
      />
    );

    const queueRadio = screen.getByLabelText(/^Queue$/i);
    expect(queueRadio).toBeChecked();
    expect(screen.getByLabelText(/^Exchange$/i)).not.toBeChecked();

    const queueInput = screen.getByLabelText(/Queue Name/i);
    expect(queueInput).toBeInTheDocument();
    expect(queueInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Queue name is required.')).toBeInTheDocument();

    const queueDeclareCheckbox = screen.getByLabelText(/Declare Queue if Not Exists/i);
    expect(queueDeclareCheckbox).not.toBeChecked();

    // Verify exchange fields are not rendered in queue mode
    expect(screen.queryByLabelText(/Exchange Name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Auto-declare Exchange/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Exchange Type/i)).not.toBeInTheDocument();
  });

  it('emits onChange when queue name or queueDeclare are changed', () => {
    const onChange = vi.fn();
    render(
      <RabbitMqDestinationFields
        idPrefix="rabbitmq-source"
        mode="queue"
        modeFieldName="consumeMode"
        queue="orders.incoming"
        queueDeclare={false}
        onChange={onChange}
      />
    );

    const queueInput = screen.getByLabelText(/Queue Name/i);
    expect(queueInput).toHaveAttribute('aria-invalid', 'false');
    fireEvent.change(queueInput, { target: { name: 'queue', value: 'orders.priority' } });
    expect(onChange).toHaveBeenCalledTimes(1);

    const queueDeclareCheckbox = screen.getByLabelText(/Declare Queue if Not Exists/i);
    fireEvent.click(queueDeclareCheckbox);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('renders exchange mode fields with auto-declare exchange checked by default and validates required exchange name', () => {
    const onChange = vi.fn();
    render(
      <RabbitMqDestinationFields
        idPrefix="rabbitmq-sink"
        mode="exchange"
        modeFieldName="publishMode"
        legendTitle="Publish Destination"
        exchange=""
        exchangeType="topic"
        routingKey=""
        onChange={onChange}
      />
    );

    expect(screen.getByText('Publish Destination')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Exchange$/i)).toBeChecked();

    const exchangeInput = screen.getByLabelText(/Exchange Name/i);
    expect(exchangeInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Exchange name is required.')).toBeInTheDocument();

    // Auto-declare exchange checkbox should be rendered and checked by default
    const exchangeDeclareCheckbox = screen.getByLabelText(/Auto-declare Exchange/i);
    expect(exchangeDeclareCheckbox).toBeInTheDocument();
    expect(exchangeDeclareCheckbox).toBeChecked();

    const exchangeTypeSelect = screen.getByLabelText(/Exchange Type/i);
    expect(exchangeTypeSelect).toHaveValue('topic');

    // Routing key label defaults to Message Routing Key in publishMode
    expect(screen.getByLabelText(/Message Routing Key/i)).toBeInTheDocument();

    // Queue fields are omitted
    expect(screen.queryByLabelText(/Queue Name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Declare Queue if Not Exists/i)).not.toBeInTheDocument();
  });

  it('emits onChange when exchange fields and auto-declare toggle are edited', () => {
    const onChange = vi.fn();
    render(
      <RabbitMqDestinationFields
        idPrefix="rabbitmq-sink"
        mode="exchange"
        modeFieldName="publishMode"
        exchange="orders.processed"
        exchangeDeclare={true}
        exchangeType="direct"
        routingKey="orders.eu"
        routingKeyLabel="Message Routing Key"
        onChange={onChange}
      />
    );

    const exchangeInput = screen.getByLabelText(/Exchange Name/i);
    fireEvent.change(exchangeInput, { target: { name: 'exchange', value: 'orders.topic' } });
    expect(onChange).toHaveBeenCalledTimes(1);

    const exchangeDeclareCheckbox = screen.getByLabelText(/Auto-declare Exchange/i);
    fireEvent.click(exchangeDeclareCheckbox);
    expect(onChange).toHaveBeenCalledTimes(2);

    const exchangeTypeSelect = screen.getByLabelText(/Exchange Type/i);
    fireEvent.change(exchangeTypeSelect, { target: { name: 'exchangeType', value: 'topic' } });
    expect(onChange).toHaveBeenCalledTimes(3);

    const routingKeyInput = screen.getByLabelText(/Message Routing Key/i);
    fireEvent.change(routingKeyInput, { target: { name: 'routingKey', value: 'orders.us' } });
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it('renders exchangeDeclare as unchecked when exchangeDeclare is false', () => {
    const onChange = vi.fn();
    render(
      <RabbitMqDestinationFields
        idPrefix="rabbitmq-source"
        mode="exchange"
        modeFieldName="consumeMode"
        exchange="orders.pre-existing"
        exchangeDeclare={false}
        onChange={onChange}
      />
    );

    const exchangeDeclareCheckbox = screen.getByLabelText(/Auto-declare Exchange/i);
    expect(exchangeDeclareCheckbox).not.toBeChecked();
  });

  it('emits onChange when mode radio buttons are selected', () => {
    const onChange = vi.fn();
    render(
      <RabbitMqDestinationFields
        idPrefix="rabbitmq-source"
        mode="queue"
        modeFieldName="consumeMode"
        queue="orders"
        onChange={onChange}
      />
    );

    const exchangeRadio = screen.getByLabelText(/^Exchange$/i);
    fireEvent.click(exchangeRadio);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
