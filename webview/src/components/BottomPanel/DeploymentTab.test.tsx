import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeploymentTab, type LogEntry } from './DeploymentTab';

/**
 * Unit tests for DeploymentTab component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates the new 2-panel Deployment Tab layout, Execution Sandbox, log streaming,
 * GCP Console link, secret masking, and execution control buttons.
 */
describe('DeploymentTab', () => {
  const defaultProps = {
    jobConfig: {
      runner: 'Dataflow',
      machineType: 'n1-standard-1',
      minInstances: 1,
      maxInstances: 5,
      gcsStagingPath: 'gs://my-bucket/staging',
      subnetwork: 'default',
      jobId: '2026-09-12_12_34_56-123456789',
      region: 'us-central1',
      projectId: 'my-test-project'
    },
    setJobConfig: vi.fn(),
    runtimeVariables: [
      { key: 'JOB_ID', value: 'job-123' },
      { key: 'API_SECRET_KEY', value: 'secret-12345' }
    ],
    addVariable: vi.fn(),
    updateVariable: vi.fn(),
    deleteVariable: vi.fn(),
    isJobIdValid: vi.fn().mockReturnValue(true),
    onRunNow: vi.fn(),
    onStopPipeline: vi.fn(),
    subnetworks: [{ name: 'sub-1', region: 'us-central1', network: 'default', value: 'sub-1' }],
    needsRebuild: false,
    pipelineLogs: [
      { id: '1', text: '[INFO] Pipeline starting...', stream: 'stdout', timestamp: '12:00:00' } as LogEntry,
      { id: '2', text: '[ERROR] Something failed', stream: 'stderr', timestamp: '12:00:01' } as LogEntry
    ],
    pipelineStatus: 'idle' as const,
    runnerCommand: 'python pipeline.py --runner=DataflowRunner',
    onClearLogs: vi.fn(),
    onOpenConsole: vi.fn(),
    projectId: 'my-test-project'
  };

  it('renders RUN PIPELINE button and does NOT render SCHEDULE button', () => {
    render(<DeploymentTab {...defaultProps} />);

    // RUN PIPELINE button should be present
    expect(screen.getByRole('button', { name: /RUN PIPELINE/i })).toBeInTheDocument();

    // SCHEDULE button should NOT be present
    expect(screen.queryByRole('button', { name: /SCHEDULE/i })).not.toBeInTheDocument();
  });

  it('calls onRunNow when RUN PIPELINE button is clicked', () => {
    render(<DeploymentTab {...defaultProps} />);

    const runButton = screen.getByRole('button', { name: /RUN PIPELINE/i });
    fireEvent.click(runButton);

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

  it('renders Execution Sandbox with runner command and logs', () => {
    render(<DeploymentTab {...defaultProps} />);

    expect(screen.getByText(/EXECUTION SANDBOX/i)).toBeInTheDocument();
    expect(screen.getByText(/RUNNER COMMAND/i)).toBeInTheDocument();
    expect(screen.getByText(/python pipeline\.py --runner=DataflowRunner/i)).toBeInTheDocument();
    expect(screen.getByText(/\[INFO\] Pipeline starting\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/\[ERROR\] Something failed/i)).toBeInTheDocument();
  });

  it('renders GCP Cloud Console link when jobId is present', () => {
    render(<DeploymentTab {...defaultProps} />);

    const consoleButton = screen.getByRole('button', { name: /Open in GCP Console/i });
    expect(consoleButton).toBeInTheDocument();

    fireEvent.click(consoleButton);
    expect(defaultProps.onOpenConsole).toHaveBeenCalledWith(
      expect.stringContaining('https://console.cloud.google.com/dataflow/jobs/us-central1/2026-09-12_12_34_56-123456789?project=my-test-project')
    );
  });

  it('toggles secret visibility on eye icon click', () => {
    render(<DeploymentTab {...defaultProps} />);

    const secretInput = screen.getByDisplayValue('secret-12345');
    expect(secretInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByTitle(/Show secret value/i);
    fireEvent.click(toggleButton);

    expect(secretInput).toHaveAttribute('type', 'text');
  });

  it('calls onClearLogs when Clear button is clicked', () => {
    render(<DeploymentTab {...defaultProps} />);

    const clearButton = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearButton);

    expect(defaultProps.onClearLogs).toHaveBeenCalledTimes(1);
  });
});
