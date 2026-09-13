import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeploymentTab } from './DeploymentTab';

/**
 * Unit tests for DeploymentTab component
 */
describe('DeploymentTab', () => {
  const defaultProps = {
    jobConfig: {
      runner: 'Dataflow',
      machineType: 'n1-standard-1',
      minInstances: 1,
      maxInstances: 5,
      gcsStagingPath: 'gs://my-bucket/staging',
      subnetwork: 'default'
    },
    setJobConfig: vi.fn(),
    runtimeVariables: [{ key: 'JOB_ID', value: 'job-123' }],
    addVariable: vi.fn(),
    updateVariable: vi.fn(),
    deleteVariable: vi.fn(),
    isJobIdValid: vi.fn().mockReturnValue(true),
    onRunNow: vi.fn(),
    subnetworks: [{ name: 'sub-1', region: 'us-central1', network: 'default', value: 'sub-1' }],
    needsRebuild: false
  };

  it('renders RUN NOW button and does NOT render SCHEDULE button', () => {
    render(<DeploymentTab {...defaultProps} />);

    // RUN NOW button should be present
    expect(screen.getByRole('button', { name: /RUN NOW/i })).toBeInTheDocument();

    // SCHEDULE button should NOT be present
    expect(screen.queryByRole('button', { name: /SCHEDULE/i })).not.toBeInTheDocument();
  });

  it('calls onRunNow when RUN NOW button is clicked', () => {
    render(<DeploymentTab {...defaultProps} />);

    const runNowButton = screen.getByRole('button', { name: /RUN NOW/i });
    fireEvent.click(runNowButton);

    expect(defaultProps.onRunNow).toHaveBeenCalledTimes(1);
  });

  it('renders STOP button and calls onStopPipeline when clicked', () => {
    const onStopPipeline = vi.fn();
    render(<DeploymentTab {...defaultProps} onStopPipeline={onStopPipeline} />);

    const stopButton = screen.getByRole('button', { name: /STOP/i });
    expect(stopButton).toBeInTheDocument();
    expect(stopButton.className).toContain('w-1/4');

    fireEvent.click(stopButton);
    expect(onStopPipeline).toHaveBeenCalledTimes(1);
  });
});
