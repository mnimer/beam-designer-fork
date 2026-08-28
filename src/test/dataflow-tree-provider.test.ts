/**
 * DataFlowTreeProvider Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating DataFlowTreeProvider, DataflowJob categorization,
 * sorting by start time, and sidebar tree hierarchy generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import {
    DataFlowTreeProvider,
    DataItem,
    categorizeJobStatus,
    getJobStartTime,
    type DataflowJob
} from '../extension';

// Mock vscode module
vi.mock('vscode', () => {
    class MockTreeItem {
        public description?: string;
        public tooltip?: any;
        public iconPath?: any;
        public command?: any;
        constructor(
            public label: string,
            public collapsibleState: number = 0
        ) {}
    }

    class MockEventEmitter {
        public fire = vi.fn();
        public event = vi.fn();
    }

    class MockThemeIcon {
        constructor(public id: string, public color?: any) {}
    }

    class MockThemeColor {
        constructor(public id: string) {}
    }

    class MockMarkdownString {
        constructor(public value: string) {}
    }

    return {
        TreeItem: MockTreeItem,
        TreeItemCollapsibleState: {
            None: 0,
            Collapsed: 1,
            Expanded: 2
        },
        EventEmitter: MockEventEmitter,
        ThemeIcon: MockThemeIcon,
        ThemeColor: MockThemeColor,
        MarkdownString: MockMarkdownString,
        workspace: {
            workspaceFolders: [
                {
                    uri: { fsPath: '/workspace' },
                    name: 'workspace'
                }
            ],
            findFiles: vi.fn().mockResolvedValue([])
        },
        Uri: {
            file: (path: string) => ({ fsPath: path, toString: () => path }),
            parse: (url: string) => ({ fsPath: url, toString: () => url })
        },
        commands: {
            registerCommand: vi.fn(),
            executeCommand: vi.fn()
        },
        window: {
            createWebviewPanel: vi.fn(),
            showErrorMessage: vi.fn()
        },
        env: {
            openExternal: vi.fn()
        }
    };
});

describe('Dataflow Job Categorization and Sorting', () => {
    it('categorizes RUNNING, PENDING, and QUEUED states as Running', () => {
        expect(categorizeJobStatus('JOB_STATE_RUNNING')).toBe('Running');
        expect(categorizeJobStatus('Running')).toBe('Running');
        expect(categorizeJobStatus('JOB_STATE_PENDING')).toBe('Running');
        expect(categorizeJobStatus('JOB_STATE_QUEUED')).toBe('Running');
        expect(categorizeJobStatus('JOB_STATE_RESOURCE_CLEANING_UP')).toBe('Running');
    });

    it('categorizes CANCELLED, DRAINED, and STOPPED states as Cancelled', () => {
        expect(categorizeJobStatus('JOB_STATE_CANCELLED')).toBe('Cancelled');
        expect(categorizeJobStatus('JOB_STATE_CANCELED')).toBe('Cancelled');
        expect(categorizeJobStatus('JOB_STATE_DRAINED')).toBe('Cancelled');
        expect(categorizeJobStatus('JOB_STATE_DRAINING')).toBe('Cancelled');
        expect(categorizeJobStatus('JOB_STATE_STOPPED')).toBe('Cancelled');
    });

    it('categorizes DONE, SUCCEEDED, and FAILED states as Completed', () => {
        expect(categorizeJobStatus('JOB_STATE_DONE')).toBe('Completed');
        expect(categorizeJobStatus('Done')).toBe('Completed');
        expect(categorizeJobStatus('JOB_STATE_FAILED')).toBe('Completed');
        expect(categorizeJobStatus('JOB_STATE_UPDATED')).toBe('Completed');
    });

    it('extracts correct timestamp for sorting', () => {
        const jobWithStart: DataflowJob = {
            id: 'job-1',
            name: 'Job 1',
            state: 'JOB_STATE_RUNNING',
            startTime: '2026-08-26T10:00:00Z'
        };
        const jobWithCreation: DataflowJob = {
            id: 'job-2',
            name: 'Job 2',
            state: 'JOB_STATE_DONE',
            creationTime: '2026-08-26T12:00:00Z'
        };
        const jobWithoutTime: DataflowJob = {
            id: 'job-3',
            name: 'Job 3',
            state: 'JOB_STATE_CANCELLED'
        };

        expect(getJobStartTime(jobWithStart)).toBe(new Date('2026-08-26T10:00:00Z').getTime());
        expect(getJobStartTime(jobWithCreation)).toBe(new Date('2026-08-26T12:00:00Z').getTime());
        expect(getJobStartTime(jobWithoutTime)).toBe(0);
    });
});

describe('DataFlowTreeProvider', () => {
    let provider: DataFlowTreeProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new DataFlowTreeProvider();
    });

    it('returns Pipelines and Running Jobs as root items', async () => {
        const rootItems = await provider.getChildren();

        expect(rootItems.length).toBe(2);
        expect(rootItems[0].label).toBe('Pipelines');
        expect(rootItems[0].contextValue).toBe('category-pipelines');
        expect(rootItems[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);

        expect(rootItems[1].label).toBe('Running Jobs');
        expect(rootItems[1].contextValue).toBe('category-running-jobs');
        expect(rootItems[1].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    });

    it('builds job groups ordered as 1: Running, 2: Cancelled, 3: Completed', () => {
        const mockJobs: DataflowJob[] = [
            {
                id: 'job-done-older',
                name: 'Done Older Job',
                state: 'JOB_STATE_DONE',
                creationTime: '2026-08-26T08:00:00Z',
                location: 'us-central1'
            },
            {
                id: 'job-running-newer',
                name: 'Running Newer Job',
                state: 'JOB_STATE_RUNNING',
                creationTime: '2026-08-26T12:00:00Z',
                location: 'us-central1'
            },
            {
                id: 'job-running-older',
                name: 'Running Older Job',
                state: 'JOB_STATE_RUNNING',
                creationTime: '2026-08-26T10:00:00Z',
                location: 'us-central1'
            },
            {
                id: 'job-cancelled',
                name: 'Cancelled Job',
                state: 'JOB_STATE_CANCELLED',
                creationTime: '2026-08-26T09:00:00Z',
                location: 'us-east1'
            },
            {
                id: 'job-done-newer',
                name: 'Done Newer Job',
                state: 'JOB_STATE_DONE',
                creationTime: '2026-08-26T11:00:00Z',
                location: 'us-central1'
            }
        ];

        const groups = provider.buildJobGroups(mockJobs, 'my-gcp-project');

        expect(groups.length).toBe(3);

        // Group 1: Running (2 jobs)
        expect(groups[0].label).toBe('Running (2)');
        expect(groups[0].contextValue).toBe('job-group-running');
        expect(groups[0].children?.length).toBe(2);
        // Sorted newest first: Running Newer Job (12:00) then Running Older Job (10:00)
        expect(groups[0].children?.[0].label).toBe('Running Newer Job');
        expect(groups[0].children?.[1].label).toBe('Running Older Job');

        // Group 2: Cancelled (1 job)
        expect(groups[1].label).toBe('Cancelled (1)');
        expect(groups[1].contextValue).toBe('job-group-cancelled');
        expect(groups[1].children?.length).toBe(1);
        expect(groups[1].children?.[0].label).toBe('Cancelled Job');

        // Group 3: Completed (2 jobs)
        expect(groups[2].label).toBe('Completed (2)');
        expect(groups[2].contextValue).toBe('job-group-completed');
        expect(groups[2].children?.length).toBe(2);
        // Sorted newest first: Done Newer Job (11:00) then Done Older Job (08:00)
        expect(groups[2].children?.[0].label).toBe('Done Newer Job');
        expect(groups[2].children?.[1].label).toBe('Done Older Job');
    });

    it('attaches openJobInConsole command and metadata to job tree items', () => {
        const mockJob: DataflowJob = {
            id: 'job-123',
            name: 'Test Stream Pipeline',
            state: 'JOB_STATE_RUNNING',
            type: 'JOB_TYPE_STREAMING',
            creationTime: '2026-08-26T14:00:00Z',
            location: 'us-central1'
        };

        const groups = provider.buildJobGroups([mockJob], 'project-xyz');
        const runningGroup = groups[0];
        const jobItem = runningGroup.children?.[0];

        expect(jobItem).toBeDefined();
        expect(jobItem?.label).toBe('Test Stream Pipeline');
        expect(jobItem?.contextValue).toBe('dataflow-job');
        expect(jobItem?.command).toEqual({
            command: 'dataflow-pipeline-builder.openJobInConsole',
            title: 'Open Job in Cloud Console',
            arguments: [mockJob, 'project-xyz']
        });
        expect(jobItem?.tooltip).toBeDefined();
    });

    it('returns error tree node when fetchJobs returns an error', async () => {
        vi.spyOn(provider, 'fetchJobs').mockResolvedValue({
            jobs: [],
            error: 'GCP authentication failed'
        });

        const runningJobsCategory = new DataItem(
            'Running Jobs',
            vscode.TreeItemCollapsibleState.Collapsed,
            'category-running-jobs'
        );

        const children = await provider.getChildren(runningJobsCategory);
        expect(children.length).toBe(1);
        expect(children[0].label).toContain('Error: GCP authentication failed');
        expect(children[0].contextValue).toBe('job-error');
    });

    it('returns empty notice when no Dataflow jobs are found', async () => {
        vi.spyOn(provider, 'fetchJobs').mockResolvedValue({
            jobs: []
        });

        const runningJobsCategory = new DataItem(
            'Running Jobs',
            vscode.TreeItemCollapsibleState.Collapsed,
            'category-running-jobs'
        );

        const children = await provider.getChildren(runningJobsCategory);
        expect(children.length).toBe(1);
        expect(children[0].label).toBe('No Dataflow jobs found');
        expect(children[0].contextValue).toBe('job-empty');
    });
});
