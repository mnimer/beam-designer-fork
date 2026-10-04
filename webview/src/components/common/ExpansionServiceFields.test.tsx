/**
 * ExpansionServiceFields Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating the shared Python Cross-Language (x-lang) expansion service field group:
 * mode selection, conditional endpoint rendering, required-endpoint validation, custom field naming,
 * and upward event emission.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ExpansionServiceFields } from './ExpansionServiceFields';

describe('ExpansionServiceFields', () => {
  it('renders the mode selector defaulted to auto and hides the endpoint field', () => {
    const onChange = vi.fn();

    render(
      <ExpansionServiceFields transformName="AmqpIO" idPrefix="amqp-source" onChange={onChange} />
    );

    const modeSelect = screen.getByLabelText(/Expansion Service Mode/i);
    expect(modeSelect).toBeInTheDocument();
    expect(modeSelect).toHaveValue('auto');
    expect(screen.queryByLabelText(/Expansion Service Endpoint/i)).not.toBeInTheDocument();
  });

  it('emits the mode change event upward without mutating state internally', () => {
    const onChange = vi.fn();

    render(
      <ExpansionServiceFields transformName="PulsarIO" idPrefix="pulsar-sink" mode="auto" onChange={onChange} />
    );

    const modeSelect = screen.getByLabelText(/Expansion Service Mode/i);
    fireEvent.change(modeSelect, { target: { name: 'expansionServiceMode', value: 'endpoint' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    // Controlled component: value stays 'auto' until the parent passes a new prop.
    expect(modeSelect).toHaveValue('auto');
  });

  it('renders the endpoint field with a validation error when endpoint mode has no value', () => {
    const onChange = vi.fn();

    render(
      <ExpansionServiceFields transformName="SolaceIO" idPrefix="solace-source" mode="endpoint" endpoint="" onChange={onChange} />
    );

    const endpointInput = screen.getByLabelText(/Expansion Service Endpoint/i);
    expect(endpointInput).toBeInTheDocument();
    expect(endpointInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Expansion service endpoint is required.');
  });

  it('treats a whitespace-only endpoint as missing', () => {
    const onChange = vi.fn();

    render(
      <ExpansionServiceFields transformName="RabbitMqIO" idPrefix="rabbit-source" mode="endpoint" endpoint="   " onChange={onChange} />
    );

    expect(screen.getByLabelText(/Expansion Service Endpoint/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears the validation error and emits changes once a valid endpoint is supplied', () => {
    const onChange = vi.fn();

    render(
      <ExpansionServiceFields
        transformName="RabbitMqIO"
        idPrefix="rabbit-sink"
        mode="endpoint"
        endpoint="localhost:8097"
        onChange={onChange}
      />
    );

    const endpointInput = screen.getByLabelText(/Expansion Service Endpoint/i);
    expect(endpointInput).toHaveValue('localhost:8097');
    expect(endpointInput).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.change(endpointInput, { target: { name: 'expansionServiceEndpoint', value: 'expansion.internal:8097' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('honours custom field names, placeholder, and id prefix', () => {
    const onChange = vi.fn();

    render(
      <ExpansionServiceFields
        transformName="AmqpIO"
        idPrefix="amqp-sink"
        mode="endpoint"
        endpoint="host:1234"
        modeName="xlangMode"
        endpointName="xlangEndpoint"
        endpointPlaceholder="expansion-host:8097"
        onChange={onChange}
      />
    );

    const modeSelect = screen.getByLabelText(/Expansion Service Mode/i);
    const endpointInput = screen.getByLabelText(/Expansion Service Endpoint/i);

    expect(modeSelect).toHaveAttribute('id', 'amqp-sink-expansion-mode');
    expect(modeSelect).toHaveAttribute('name', 'xlangMode');
    expect(endpointInput).toHaveAttribute('id', 'amqp-sink-expansion-endpoint');
    expect(endpointInput).toHaveAttribute('name', 'xlangEndpoint');
    expect(endpointInput).toHaveAttribute('placeholder', 'expansion-host:8097');
  });

  it('names the transform in the group tooltip so users know why x-lang is required', () => {
    const onChange = vi.fn();

    render(
      <ExpansionServiceFields transformName="PulsarIO" idPrefix="pulsar-source" onChange={onChange} />
    );

    expect(screen.getByText(/Expansion Service \(Python x-lang\)/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Python has no native PulsarIO transform/i)
    ).toBeInTheDocument();
  });

});
