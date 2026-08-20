/**
 * InfoTooltip Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates the rendering, accessibility attributes, and hover/focus
 * behaviors of the InfoTooltip component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InfoTooltip } from './InfoTooltip';

describe('InfoTooltip', () => {
  it('renders info icon and does not show popup initially', () => {
    render(<InfoTooltip text="Kafka bootstrap server documentation" />);
    
    const trigger = screen.getByRole('tooltip', { name: 'Kafka bootstrap server documentation' });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByText('Kafka bootstrap server documentation')).not.toBeInTheDocument();
  });

  it('shows tooltip popup on mouse enter and hides on mouse leave', () => {
    render(<InfoTooltip text="Topic documentation explanation" />);
    
    const trigger = screen.getByRole('tooltip', { name: 'Topic documentation explanation' });
    
    // Trigger mouse enter
    fireEvent.mouseEnter(trigger);
    expect(screen.getByText('Topic documentation explanation')).toBeInTheDocument();
    
    // Trigger mouse leave
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText('Topic documentation explanation')).not.toBeInTheDocument();
  });

  it('shows tooltip popup on keyboard focus and hides on blur', () => {
    render(<InfoTooltip text="Auto offset reset explanation" position="bottom" />);
    
    const trigger = screen.getByRole('tooltip', { name: 'Auto offset reset explanation' });
    
    // Trigger focus
    fireEvent.focus(trigger);
    expect(screen.getByText('Auto offset reset explanation')).toBeInTheDocument();
    
    // Trigger blur
    fireEvent.blur(trigger);
    expect(screen.queryByText('Auto offset reset explanation')).not.toBeInTheDocument();
  });
});
