/** @fileoverview Unit tests for PaletteTabBar component.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PaletteTabBar } from './PaletteTabBar';

describe('PaletteTabBar', () => {
  const defaultProps = {
    activeTab: 'SOURCES',
    isPanelOpen: true,
    nodesCount: 5,
    sourcesCount: 12,
    stepsCount: 20,
    sinksCount: 8,
    samplesCount: 4,
    onTabClick: vi.fn(),
  };

  it('renders all four tab buttons with their labels and badge counts', () => {
    render(<PaletteTabBar {...defaultProps} />);

    expect(screen.getByLabelText('Sources Tab')).toBeInTheDocument();
    expect(screen.getByLabelText('Steps Tab')).toBeInTheDocument();
    expect(screen.getByLabelText('Sinks Tab')).toBeInTheDocument();
    expect(screen.getByLabelText('Samples Tab')).toBeInTheDocument();

    expect(screen.getByText('SOURCES')).toBeInTheDocument();
    expect(screen.getByText('STEPS')).toBeInTheDocument();
    expect(screen.getByText('SINKS')).toBeInTheDocument();
    expect(screen.getByText('SAMPLES')).toBeInTheDocument();

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('disables STEPS and SINKS tabs when nodesCount is 0', () => {
    render(<PaletteTabBar {...defaultProps} nodesCount={0} />);

    const stepsTab = screen.getByLabelText('Steps Tab');
    const sinksTab = screen.getByLabelText('Sinks Tab');

    expect(stepsTab).toBeDisabled();
    expect(sinksTab).toBeDisabled();
  });

  it('enables STEPS and SINKS tabs when nodesCount is greater than 0', () => {
    render(<PaletteTabBar {...defaultProps} nodesCount={1} />);

    const stepsTab = screen.getByLabelText('Steps Tab');
    const sinksTab = screen.getByLabelText('Sinks Tab');

    expect(stepsTab).not.toBeDisabled();
    expect(sinksTab).not.toBeDisabled();
  });

  it('fires onTabClick with correct parameters when clicked', () => {
    const onTabClick = vi.fn();
    render(<PaletteTabBar {...defaultProps} onTabClick={onTabClick} nodesCount={1} />);

    fireEvent.click(screen.getByLabelText('Sources Tab'));
    expect(onTabClick).toHaveBeenCalledWith('SOURCES', false);

    fireEvent.click(screen.getByLabelText('Steps Tab'));
    expect(onTabClick).toHaveBeenCalledWith('STEPS', false);

    fireEvent.click(screen.getByLabelText('Sinks Tab'));
    expect(onTabClick).toHaveBeenCalledWith('SINKS', false);

    fireEvent.click(screen.getByLabelText('Samples Tab'));
    expect(onTabClick).toHaveBeenCalledWith('SAMPLES', false);
  });
});
