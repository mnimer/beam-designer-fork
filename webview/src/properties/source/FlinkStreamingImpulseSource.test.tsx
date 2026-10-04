/**
 * FlinkStreamingImpulseSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating FlinkStreamingImpulseSourceProperties component functionality,
 * form change callbacks, interval validation, unbounded derived status, Flink master helpers,
 * pipeline option demarcation, credential pruning assertions,
 * and system_instructions fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlinkStreamingImpulseSourceProperties } from './FlinkStreamingImpulseSource';

describe('FlinkStreamingImpulseSourceProperties', () => {
  const originalPostMessage = (window as any).vscode?.postMessage;

  beforeEach(() => {
    (window as any).vscode = {
      postMessage: vi.fn()
    };
  });

  afterEach(() => {
    if (originalPostMessage) {
      (window as any).vscode.postMessage = originalPostMessage;
    } else {
      delete (window as any).vscode;
    }
  });

  it('renders default fields with documentation tooltips, pipeline option demarcation, and no auth controls', () => {
    const mockNode = {
      data: {
        label: 'Flink Impulse Source',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<FlinkStreamingImpulseSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Emission Interval \(ms\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message Count \(0 = Unbounded\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Flink JobManager Master \(--flink_master\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Pipeline-Level Option \(--flink_master in FlinkRunnerOptions\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();

    // Default interval should be 500
    const intervalInput = screen.getByLabelText(/Emission Interval \(ms\)/i);
    expect(intervalInput).toHaveValue(500);

    // Derived unbounded indicator
    expect(screen.getByText(/Unbounded Stream \(Continuous\)/i)).toBeInTheDocument();

    // Runner callout
    expect(screen.getByText(/FlinkRunner Requirement \(Python Only\)/i)).toBeInTheDocument();

    // Verify pruned auth controls are absent
    expect(screen.queryByText(/JobManager Authentication/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/GCP Secret Manager Secret/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/JobManager REST API Token/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Direct Token/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Secret Manager/i)).not.toBeInTheDocument();
  });

  it('populates fields with provided properties and triggers onChange on intervalMs and messageCount changes', () => {
    const mockNode = {
      data: {
        label: 'Flink Impulse Source',
        properties: {
          intervalMs: 1000,
          messageCount: 50,
          flinkMaster: 'localhost:8081'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<FlinkStreamingImpulseSourceProperties node={mockNode} onChange={mockOnChange} />);

    const intervalInput = screen.getByLabelText(/Emission Interval \(ms\)/i);
    expect(intervalInput).toHaveValue(1000);

    const countInput = screen.getByLabelText(/Message Count \(0 = Unbounded\)/i);
    expect(countInput).toHaveValue(50);

    // Derived bounded indicator
    expect(screen.getByText(/Bounded Stream \(50 impulses\)/i)).toBeInTheDocument();

    fireEvent.change(intervalInput, { target: { name: 'intervalMs', value: '250' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      intervalMs: '250'
    }));

    fireEvent.change(countInput, { target: { name: 'messageCount', value: '100' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      messageCount: '100'
    }));
  });

  it('validates invalid intervalMs (non-positive or empty)', () => {
    const mockNode = {
      data: {
        label: 'Flink Impulse Source',
        properties: {
          intervalMs: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<FlinkStreamingImpulseSourceProperties node={mockNode} onChange={mockOnChange} />);

    const intervalInput = screen.getByLabelText(/Emission Interval \(ms\)/i);
    expect(intervalInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Emission interval is required/i)).toBeInTheDocument();

    // Negative interval
    const mockNodeNegative = {
      data: {
        label: 'Flink Impulse Source',
        properties: {
          intervalMs: -10
        }
      }
    };
    const { unmount } = render(<FlinkStreamingImpulseSourceProperties node={mockNodeNegative} onChange={mockOnChange} />);
    expect(screen.getByText(/Emission interval must be a positive integer in milliseconds/i)).toBeInTheDocument();
    unmount();
  });

  it('validates negative message count', () => {
    const mockNode = {
      data: {
        label: 'Flink Impulse Source',
        properties: {
          messageCount: -5
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<FlinkStreamingImpulseSourceProperties node={mockNode} onChange={mockOnChange} />);

    const countInput = screen.getByLabelText(/Message Count \(0 = Unbounded\)/i);
    expect(countInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Message count must be a non-negative integer/i)).toBeInTheDocument();
  });

  it('applies quick helper pills to flinkMaster endpoint', () => {
    const mockNode = {
      data: {
        label: 'Flink Impulse Source',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<FlinkStreamingImpulseSourceProperties node={mockNode} onChange={mockOnChange} />);

    const autoBtn = screen.getByTitle(/Set to \[auto\] for local MiniCluster/i);
    fireEvent.click(autoBtn);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      flinkMaster: '[auto]'
    }));

    const localhostBtn = screen.getByTitle('Set to localhost:8081');
    fireEvent.click(localhostBtn);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      flinkMaster: 'localhost:8081'
    }));
  });

  it('updates system_instructions on textarea change', () => {
    const mockOnChange = vi.fn();
    const node = {
      data: {
        label: 'Flink Impulse Source',
        properties: {}
      }
    };
    render(<FlinkStreamingImpulseSourceProperties node={node} onChange={mockOnChange} />);
    const textarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(textarea, { target: { value: 'Updated prompt instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated prompt instructions'
    }));
  });

  it('renders without throwing when given minimal properties', () => {
    const mockNode = {
      data: {
        label: 'Flink Impulse Source',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    expect(() => {
      render(<FlinkStreamingImpulseSourceProperties node={mockNode} onChange={mockOnChange} />);
    }).not.toThrow();
  });
});
