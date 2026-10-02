/** @fileoverview Provides the sidebar tree view for the DataFlow Explorer.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { findGcloudPath } from '../cli/cliResolver';
import { getGcloudProject } from '../cli/gcloudClient';
import { PIPELINE_SEARCH_EXCLUDE_PATTERN } from '../core/constants';

/**
 * Interface representing a Google Cloud Dataflow job.
 */
export interface DataflowJob {
    id: string;
    name: string;
    state: string;
    location?: string;
    type?: string;
    creationTime?: string;
    startTime?: string;
    stateTime?: string;
}

/**
 * Categorizes a Dataflow job into one of the three standard groups:
 * 'Running' (1st), 'Cancelled' (2nd), or 'Completed' (3rd).
 * 
 * @param state Raw state string from Dataflow API / gcloud CLI.
 * @returns 'Running' | 'Cancelled' | 'Completed'
 */
export function categorizeJobStatus(state: string): 'Running' | 'Cancelled' | 'Completed' {
    const normalized = (state || '').toUpperCase();
    if (normalized.includes('RUNNING') || normalized.includes('PENDING') || normalized.includes('QUEUED') || normalized.includes('RESOURCE_CLEANING_UP')) {
        return 'Running';
    }
    if (normalized.includes('CANCEL') || normalized.includes('DRAIN') || normalized.includes('STOPPED')) {
        return 'Cancelled';
    }
    // Completed includes DONE, COMPLETED, SUCCEEDED, FAILED, etc.
    return 'Completed';
}

/**
 * Extracts a numeric timestamp for sorting Dataflow jobs by start time.
 * 
 * @param job DataflowJob instance.
 * @returns Timestamp in milliseconds.
 */
export function getJobStartTime(job: DataflowJob): number {
    const timeStr = job.startTime || job.creationTime;
    if (!timeStr) return 0;
    const t = new Date(timeStr).getTime();
    return isNaN(t) ? 0 : t;
}

/**
 * DataFlowTreeProvider
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Provides the sidebar tree view for the DataFlow Explorer, including workspace pipeline files
 * and live GCP Dataflow running/completed/cancelled jobs.
 * 
 * Architectural Decisions:
 * - Scans for all *.beam pipeline files across the workspace under the "Pipelines" root category.
 * - Adds a second "Running Jobs" top-level menu node.
 * - When "Running Jobs" is expanded, dynamically queries GCP Dataflow jobs via gcloud CLI.
 * - Groups Dataflow jobs into three ordered categories: 1) Running, 2) Cancelled, 3) Completed.
 * - Sorts jobs within each group by start time in descending order (newest first).
 * - Clicking a job node launches the job details directly in the Google Cloud Console.
 */
export class DataFlowTreeProvider implements vscode.TreeDataProvider<DataItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DataItem | undefined | null | void> = new vscode.EventEmitter<DataItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DataItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private pipelines: DataItem[] = [];

    /**
     * Initializes the DataFlowTreeProvider and schedules an initial workspace scan.
     */
    constructor() {
        this.refresh();
    }

    /**
     * Refreshes the tree provider by rescanning .beam files and notifying VS Code tree view.
     */
    refresh(): void {
        this.scanPipelines();
    }

    /**
     * Scans the workspace for *.beam files and builds the tree hierarchy.
     * M17: Excludes dependency, build, and VCS directories using PIPELINE_SEARCH_EXCLUDE_PATTERN.
     */
    private async scanPipelines() {
        const files = await vscode.workspace.findFiles('**/*.beam', PIPELINE_SEARCH_EXCLUDE_PATTERN);
        this.pipelines = this.buildTree(files);
        this._onDidChangeTreeData.fire();
    }

    /**
     * Builds hierarchical tree nodes from list of .beam file URIs.
     * 
     * @param files List of Uri objects for discovered .beam files.
     * @returns Array of DataItem representing root folders and files.
     */
    public buildTree(files: vscode.Uri[]): DataItem[] {
        const root: DataItem[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const workspacePath = workspaceFolder.uri.fsPath;

        files.forEach(file => {
            const relativePath = path.relative(workspacePath, file.fsPath);
            const parts = relativePath.split(path.sep);

            let currentLevel = root;

            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                let folder = currentLevel.find(item => item.label === part && item.contextValue === 'folder');
                if (!folder) {
                    folder = new DataItem(part, vscode.TreeItemCollapsibleState.Collapsed, 'folder', []);
                    currentLevel.push(folder);
                }
                currentLevel = folder.children!;
            }

            const fileName = parts[parts.length - 1];
            currentLevel.push(new DataItem(fileName, vscode.TreeItemCollapsibleState.None, 'pipeline-edit', undefined, file));
        });

        return root;
    }

    /**
     * Queries GCP Dataflow jobs via the gcloud CLI.
     * 
     * @param projectId Optional GCP project ID override.
     * @returns Promise resolving to an array of DataflowJob objects.
     */
    public async fetchJobs(projectId?: string): Promise<{ jobs: DataflowJob[]; projectId?: string; error?: string }> {
        const targetProject = projectId || (await getGcloudProject());
        const gcloudBin = findGcloudPath();
        const gcloudArgs = ['dataflow', 'jobs', 'list', '--status=all', '--format=json'];

        if (targetProject && targetProject !== 'YOUR_PROJECT_ID') {
            gcloudArgs.push(`--project=${targetProject}`);
        }

        return new Promise((resolve) => {
            execFile(gcloudBin, gcloudArgs, { timeout: 15000, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    const errMsg = error.killed
                        ? 'Request timed out waiting for gcloud CLI response.'
                        : (stderr || error.message);
                    resolve({ jobs: [], projectId: targetProject, error: errMsg });
                    return;
                }
                try {
                    const parsed = JSON.parse(stdout || '[]');
                    const jobs: DataflowJob[] = Array.isArray(parsed) ? parsed : [];
                    resolve({ jobs, projectId: targetProject });
                } catch (e: any) {
                    resolve({ jobs: [], projectId: targetProject, error: `Failed to parse gcloud output: ${e.message}` });
                }
            });
        });
    }

    /**
     * Builds group tree items for Running, Cancelled, and Completed Dataflow jobs.
     * 
     * @param jobs List of Dataflow jobs returned from GCP.
     * @param projectId Active GCP project ID.
     * @returns Array of DataItem representing the 3 status groups.
     */
    public buildJobGroups(jobs: DataflowJob[], projectId?: string): DataItem[] {
        const runningJobs: DataflowJob[] = [];
        const cancelledJobs: DataflowJob[] = [];
        const completedJobs: DataflowJob[] = [];

        // 1. Group each job into Running, Cancelled, or Completed
        for (const job of jobs) {
            const category = categorizeJobStatus(job.state);
            if (category === 'Running') {
                runningJobs.push(job);
            } else if (category === 'Cancelled') {
                cancelledJobs.push(job);
            } else {
                completedJobs.push(job);
            }
        }

        // 2. Sort jobs in each group by start time descending (newest first)
        const sortByStartTime = (a: DataflowJob, b: DataflowJob) => getJobStartTime(b) - getJobStartTime(a);
        runningJobs.sort(sortByStartTime);
        cancelledJobs.sort(sortByStartTime);
        completedJobs.sort(sortByStartTime);

        // 3. Create tree items for individual jobs
        const createJobItem = (job: DataflowJob) => {
            const dateStr = job.startTime || job.creationTime;
            const formattedDate = dateStr ? new Date(dateStr).toLocaleString() : '';
            const description = `${job.state || 'Unknown'}${formattedDate ? ` • ${formattedDate}` : ''}`;

            const item = new DataItem(
                job.name,
                vscode.TreeItemCollapsibleState.None,
                'dataflow-job'
            );
            item.description = description;
            item.tooltip = new vscode.MarkdownString(
                `**${job.name}**\n\n` +
                `- **Job ID:** \`${job.id}\`\n` +
                `- **State:** ${job.state}\n` +
                `- **Type:** ${job.type || 'Batch'}\n` +
                `- **Location:** ${job.location || 'us-central1'}\n` +
                `- **Started:** ${formattedDate || '-'}\n\n` +
                `*Click to open in Google Cloud Console*`
            );

            // Assign status icon
            const normalizedState = (job.state || '').toUpperCase();
            if (normalizedState.includes('RUNNING')) {
                item.iconPath = new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('testing.iconPassed'));
            } else if (normalizedState.includes('PENDING') || normalizedState.includes('QUEUED')) {
                item.iconPath = new vscode.ThemeIcon('clock', new vscode.ThemeColor('testing.iconQueued'));
            } else if (normalizedState.includes('CANCEL') || normalizedState.includes('STOPPED')) {
                item.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('testing.iconSkipped'));
            } else if (normalizedState.includes('FAIL')) {
                item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
            } else {
                item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            }

            // Clicking opens in Google Cloud Console
            item.command = {
                command: 'dataflow-pipeline-builder.openJobInConsole',
                title: 'Open Job in Cloud Console',
                arguments: [job, projectId]
            };

            return item;
        };

        const runningItems = runningJobs.map(createJobItem);
        const cancelledItems = cancelledJobs.map(createJobItem);
        const completedItems = completedJobs.map(createJobItem);

        // 4. Return the 3 groups in strict order: 1) Running, 2) Cancelled, 3) Completed
        const groups: DataItem[] = [
            new DataItem(
                `Running (${runningJobs.length})`,
                runningJobs.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
                'job-group-running',
                runningItems
            ),
            new DataItem(
                `Cancelled (${cancelledJobs.length})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'job-group-cancelled',
                cancelledItems
            ),
            new DataItem(
                `Completed (${completedJobs.length})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'job-group-completed',
                completedItems
            )
        ];

        // Apply icons to the group header nodes
        groups[0].iconPath = new vscode.ThemeIcon('run');
        groups[1].iconPath = new vscode.ThemeIcon('stop-circle');
        groups[2].iconPath = new vscode.ThemeIcon('check-all');

        return groups;
    }

    /**
     * Returns the TreeItem for display in VS Code sidebar.
     * 
     * @param element The tree item element.
     */
    getTreeItem(element: DataItem): vscode.TreeItem {
        return element;
    }

    /**
     * Returns the children for a given tree item or root level.
     * 
     * @param element Optional parent tree item element.
     */
    async getChildren(element?: DataItem): Promise<DataItem[]> {
        // Root Level: Return "Pipelines" and "Running Jobs"
        if (!element) {
            const pipelineChildren = this.pipelines.length > 0
                ? this.pipelines
                : [new DataItem('No pipelines found', vscode.TreeItemCollapsibleState.None, 'empty')];

            const pipelinesCategory = new DataItem(
                'Pipelines',
                vscode.TreeItemCollapsibleState.Expanded,
                'category-pipelines',
                pipelineChildren
            );
            pipelinesCategory.iconPath = new vscode.ThemeIcon('repo');

            const runningJobsCategory = new DataItem(
                'Running Jobs',
                vscode.TreeItemCollapsibleState.Collapsed,
                'category-running-jobs'
            );
            runningJobsCategory.iconPath = new vscode.ThemeIcon('server-process');

            return [pipelinesCategory, runningJobsCategory];
        }

        // Expanded "Pipelines" Category
        if (element.contextValue === 'category-pipelines' || element.label === 'Pipelines') {
            return element.children || [];
        }

        // Expanded Folder inside Pipelines
        if (element.contextValue === 'folder') {
            return element.children || [];
        }

        // Expanded "Running Jobs" Category -> dynamically query GCP
        if (element.contextValue === 'category-running-jobs') {
            const { jobs, projectId, error } = await this.fetchJobs();
            if (error) {
                const errorItem = new DataItem(
                    `Error: ${error}`,
                    vscode.TreeItemCollapsibleState.None,
                    'job-error'
                );
                errorItem.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
                return [errorItem];
            }

            if (jobs.length === 0) {
                const emptyItem = new DataItem(
                    'No Dataflow jobs found',
                    vscode.TreeItemCollapsibleState.None,
                    'job-empty'
                );
                emptyItem.iconPath = new vscode.ThemeIcon('info');
                return [emptyItem];
            }

            return this.buildJobGroups(jobs, projectId);
        }

        // Expanded Job Group (Running, Cancelled, Completed)
        if (element.contextValue?.startsWith('job-group-')) {
            return element.children || [];
        }

        return [];
    }
}

/**
 * DataItem
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Represents individual items (categories, folders, pipeline files, and job nodes) within the DataFlow Explorer tree view.
 * 
 * Architectural Decisions:
 * - Automatically links 'pipeline-edit' nodes to open in the custom editor via vscode.open.
 * - Applies appropriate theme icons for folders and pipeline files.
 */
export class DataItem extends vscode.TreeItem {
    /**
     * Creates a new DataItem tree item.
     * 
     * @param label Display label for the tree item.
     * @param collapsibleState Collapsed, expanded, or none state.
     * @param contextValue Categorical identifier ('category', 'folder', 'pipeline-edit', 'dataflow-job', etc.).
     * @param children Optional nested child tree items.
     * @param resourceUri Optional Uri pointing to the .beam file.
     */
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly children?: DataItem[],
        public readonly resourceUri?: vscode.Uri
    ) {
        super(label, collapsibleState);

        if (contextValue === 'pipeline-edit') {
            this.command = {
                command: 'vscode.openWith',
                title: 'Open Pipeline',
                arguments: [this.resourceUri, 'dataflow-pipeline-builder.beamEditor']
            };
            this.iconPath = new vscode.ThemeIcon('file');
        // NOTE: a 'pipeline-view' branch used to live here, wiring the item to
        // 'dataflow-pipeline-builder.openPipeline'. That command is not registered
        // anywhere in this extension, and no DataItem is ever constructed with the
        // 'pipeline-view' contextValue, so the branch was unreachable code pointing at a
        // command that does not exist. Removed rather than repaired: there is no
        // behaviour to preserve.
        } else if (contextValue === 'folder') {
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}
