/**
 * PulsarConnectionFields Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating PulsarConnectionFields component functionality,
 * client and admin URL rendering, protocol helper pills,
 * and upward event callbacks.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PulsarConnectionFields } from './PulsarConnectionFields';

describe('PulsarConnectionFields', () => {
  it('renders client and admin URL inputs with protocol buttons', () => {
    const mockOnChange = vi.fn();
    const mockApplyClientProtocol = vi.fn();
    const mockApplyAdminProtocol = vi.fn();

    render(
      <PulsarConnectionFields
        idPrefix="pulsar-test"
        clientUrl="pulsar://localhost:6650"
        adminUrl="http://localhost:8080"
        onChange={mockOnChange}
        onApplyClientProtocol={mockApplyClientProtocol}
        onApplyAdminProtocol={mockApplyAdminProtocol}
      />
    );

    const clientInput = screen.getByLabelText(/Pulsar Client Service URL/i);
    expect(clientInput).toHaveValue('pulsar://localhost:6650');

    const adminInput = screen.getByPlaceholderText('http://localhost:8080');
    expect(adminInput).toHaveValue('http://localhost:8080');

    // Test protocol pills
    const sslButton = screen.getByTitle('Set pulsar+ssl:// scheme');
    fireEvent.click(sslButton);
    expect(mockApplyClientProtocol).toHaveBeenCalledWith('pulsar+ssl://');

    const pulsarButton = screen.getByTitle('Set pulsar:// scheme');
    fireEvent.click(pulsarButton);
    expect(mockApplyClientProtocol).toHaveBeenCalledWith('pulsar://');

    const httpsButton = screen.getByTitle('Set https:// scheme');
    fireEvent.click(httpsButton);
    expect(mockApplyAdminProtocol).toHaveBeenCalledWith('https://');

    const httpButton = screen.getByTitle('Set http:// scheme');
    fireEvent.click(httpButton);
    expect(mockApplyAdminProtocol).toHaveBeenCalledWith('http://');
  });

  it('renders required validation error and aria-invalid when clientUrl is empty', () => {
    const mockOnChange = vi.fn();

    render(
      <PulsarConnectionFields
        idPrefix="pulsar-test"
        clientUrl=""
        onChange={mockOnChange}
        onApplyClientProtocol={vi.fn()}
        onApplyAdminProtocol={vi.fn()}
      />
    );

    const clientInput = screen.getByLabelText(/Pulsar Client Service URL/i);
    expect(clientInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Pulsar Client Service URL is required.')).toBeInTheDocument();
  });

  it('hides admin URL field and protocol buttons when showAdminUrl is false', () => {
    render(
      <PulsarConnectionFields
        idPrefix="pulsar-test"
        clientUrl="pulsar://localhost:6650"
        adminUrl="http://localhost:8080"
        showAdminUrl={false}
        onChange={vi.fn()}
        onApplyClientProtocol={vi.fn()}
        onApplyAdminProtocol={vi.fn()}
      />
    );

    const clientInput = screen.getByLabelText(/Pulsar Client Service URL/i);
    expect(clientInput).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('http://localhost:8080')).not.toBeInTheDocument();
    expect(screen.queryByText(/Web Admin URL \(Optional\)/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle('Set http:// scheme')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Set https:// scheme')).not.toBeInTheDocument();
  });
});
