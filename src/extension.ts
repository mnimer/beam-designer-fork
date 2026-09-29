import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFile, ExecFileException, spawn, ChildProcess } from 'child_process';
import YAML from 'yaml';
import { handleRegenerateCode } from './codeGeneration';
import {
    MANIFEST_FILENAME,
    GenerationManifest,
    FolderOwnership,
    parseManifest,
    classifyFolder,
    planCleanup,
    resolveDeletablePath,
    buildManifest,
    sha256,
} from './generationManifest';
import {
    buildWebviewHtml,
    getNonce,
    WebviewHtmlOptions,
} from './webviewHtml';

export {
    buildWebviewHtml,
    getNonce,
    WebviewHtmlOptions,
};

/**
 * Apache Beam Designer Extension Main Entry Point
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Activates the VS Code extension for Apache Beam pipeline visual authoring.
 * Registers tree view providers, custom editor providers, commands, and IPC handlers
 * between the VS Code extension host and the webview designer canvas.
 * 
 * Architectural Decisions:
 * - Uses CustomTextEditorProvider (BeamEditorProvider) for two-way synchronization of .beam files.
 * - Bridges gcloud and bq CLI commands for real-time asset discovery (BigQuery datasets/tables,
 *   Pub/Sub topics/subscriptions, VPC networks/subnets, Cloud Storage buckets).
 * - Executes AI code generation via Google GenAI SDK (@google/genai).
 * - Provides non-blocking asynchronous IPC message dispatch to webview.
 * 
 * @param context The extension context provided by VS Code
 */
let designerOutputChannel: vscode.OutputChannel | undefined;

/**
 * View type of the custom Beam pipeline editor.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * MUST stay in sync with `contributes.customEditors[0].viewType` in package.json and with
 * the `onCustomEditor:` activation event. Centralised here because a typo in any one of
 * the call sites fails silently -- VS Code simply opens the file in the plain text editor
 * instead of the designer, with no error.
 */
export const BEAM_EDITOR_VIEW_TYPE = 'dataflow-pipeline-builder.beamEditor';

/**
 * Generates initial starter pipeline document content serialized in YAML format.
 * Ensures that newly created .beam pipeline files are byte-consistent with
 * pipelines saved from the designer.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * @returns YAML-serialized starter pipeline content
 */
export function getInitialPipelineContent(): string {
    // NOTE: key order and key set deliberately mirror the webview's `PipelineState`
    // (webview/src/hooks/usePipelinePersistence.ts), which serializes with a plain
    // YAML.stringify. Matching both means a brand new pipeline is structurally
    // indistinguishable from one that has been saved once -- which is the entire point
    // of this fix. `runtimeVariables` in particular is part of every saved document;
    // the loader tolerates its absence by defaulting to [], but omitting it here would
    // leave new files subtly different from saved ones.
    return YAML.stringify({
        nodes: [],
        edges: [],
        runtimeVariables: [],
        jobConfig: {
            runner: 'DirectRunner',
            machineType: 'n1-standard-1',
            minInstances: 1,
            maxInstances: 10,
            gcsStagingPath: '',
            network: '',
            subnetwork: ''
        },
        pipelineConfig: {
            language: 'Python',
            outputFolder: '',
            needsRebuild: false
        }
    });
}

/**
 * Default ignore patterns for .dockerignore and .gcloudignore files.
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Prevents sensitive logs (including gemini.log with raw prompt text),
 * build targets, dependencies, and environment artifacts from leaking to Cloud Build / Docker.
 */
export const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
    '.git',
    '.venv',
    // NOTE: `run_directrunner.sh` creates the virtualenv as `venv` (no leading dot), so the
    // dot-prefixed entry above does not match it. Both spellings are listed because the
    // script probes for `venv` first and `.venv` second, and a user may have either.
    // Without these, a ~4000-file virtualenv is uploaded to Cloud Build and Docker.
    'venv',
    'env',
    'node_modules',
    '__pycache__',
    'target/',
    '*.beam',
    '*.tf',
    '*.log',
    'gemini.log',
];

/**
 * Directory names to exclude when scanning workspace files for pipeline definitions.
 * Combines directory patterns from DEFAULT_IGNORE_PATTERNS with standard build output directories.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */
export const PIPELINE_SEARCH_EXCLUDE_DIRS: readonly string[] = [
    ...DEFAULT_IGNORE_PATTERNS
        .filter(p => !p.startsWith('*') && !p.endsWith('.beam') && !p.endsWith('.tf') && !p.endsWith('.log'))
        .map(p => p.replace(/\/$/, '')),
    'dist',
    'build',
    'out'
];

/**
 * Glob pattern for excluding dependency, build, and VCS directories when scanning
 * workspace files for .beam pipelines.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */
export const PIPELINE_SEARCH_EXCLUDE_PATTERN: string = `{${PIPELINE_SEARCH_EXCLUDE_DIRS.map(dir => `**/${dir}/**`).join(',')}}`;

/**
 * Directory names to skip when listing the files of a generated pipeline project
 * for display in the Source Code tab.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * The Source Code tab is meant to show the ~10 files the generator produced. Running the
 * pipeline once creates a virtualenv (`venv`, created by the generated run_directrunner.sh)
 * or a Maven `target/` directory, either of which adds thousands of entries and makes the
 * tab unusable.
 *
 * NOTE: the walker independently skips every dot-prefixed entry, which already covers
 * `.venv`, `.git` and friends. This list therefore exists for the directories that do NOT
 * start with a dot -- `venv` being the one that actually caused the reported bug. The
 * dot-prefixed names are still included so the list stays correct on its own terms if the
 * walker's dot rule is ever relaxed.
 */
export const GENERATED_FILE_LIST_EXCLUDE_DIRS: readonly string[] = PIPELINE_SEARCH_EXCLUDE_DIRS;

export function activate(context: vscode.ExtensionContext) {
    console.log('Apache Beam Pipeline Builder is now active!');
    designerOutputChannel = vscode.window.createOutputChannel('Dataflow Designer');
    context.subscriptions.push(designerOutputChannel);
    designerOutputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Apache Beam Designer initialized.`);

    const treeDataProvider = new DataFlowTreeProvider();
    vscode.window.registerTreeDataProvider('dataflowExplorer', treeDataProvider);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            BEAM_EDITOR_VIEW_TYPE,
            new BeamEditorProvider(context),
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.openWithDesigner', async (uri?: vscode.Uri) => {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (targetUri) {
                await vscode.commands.executeCommand('vscode.openWith', targetUri, 'dataflow-pipeline-builder.beamEditor');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.createNewPipeline', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            let defaultUri: vscode.Uri | undefined;
            if (workspaceFolder) {
                let candidateName = 'pipeline.beam';
                let counter = 1;
                while (fs.existsSync(path.join(workspaceFolder, candidateName))) {
                    candidateName = `pipeline-${counter}.beam`;
                    counter++;
                }
                defaultUri = vscode.Uri.file(path.join(workspaceFolder, candidateName));
            }

            const fileUri = await vscode.window.showSaveDialog({
                defaultUri,
                title: 'Create New Apache Beam Pipeline',
                filters: { 'Beam Pipeline': ['beam'] }
            });

            if (!fileUri) {
                return; // User cancelled
            }

            const initialContent = getInitialPipelineContent();

            fs.writeFileSync(fileUri.fsPath, initialContent, 'utf-8');
            treeDataProvider.refresh();
            await vscode.commands.executeCommand('vscode.openWith', fileUri, BEAM_EDITOR_VIEW_TYPE);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.refreshPipelines', () => {
            treeDataProvider.refresh();
        })
    );

    /*
     * `DataFlow: Show Editor` opens a pipeline in the custom editor.
     *
     * FIXME(history): this used to dispatch to 'dataflow-pipeline-builder.openPipeline',
     * which is never registered anywhere in this extension. The command is advertised in
     * the Command Palette, so invoking it always failed with "command not found". It now
     * resolves a real .beam file and opens it through the same `vscode.openWith` path the
     * tree view uses.
     */
    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.showEditor', async () => {
            // Prefer whatever the user is already looking at.
            const activeUri = vscode.window.activeTextEditor?.document.uri;
            if (activeUri?.fsPath.endsWith('.beam')) {
                await vscode.commands.executeCommand('vscode.openWith', activeUri, BEAM_EDITOR_VIEW_TYPE);
                return;
            }

            // Otherwise look for pipelines in the workspace, honouring the same exclude
            // pattern the tree view uses so we do not surface files from node_modules.
            const files = await vscode.workspace.findFiles('**/*.beam', PIPELINE_SEARCH_EXCLUDE_PATTERN);
            if (files.length === 0) {
                vscode.window.showInformationMessage(
                    'No .beam pipelines found in this workspace. Use "Beam: New Pipeline" to create one.'
                );
                return;
            }

            if (files.length === 1) {
                await vscode.commands.executeCommand('vscode.openWith', files[0], BEAM_EDITOR_VIEW_TYPE);
                return;
            }

            // More than one candidate: let the user choose rather than guessing.
            const picked = await vscode.window.showQuickPick(
                files.map(f => ({
                    label: path.basename(f.fsPath),
                    description: vscode.workspace.asRelativePath(f),
                    uri: f,
                })),
                { title: 'Open Beam Pipeline', placeHolder: 'Select a pipeline to open' }
            );
            if (picked) {
                await vscode.commands.executeCommand('vscode.openWith', picked.uri, BEAM_EDITOR_VIEW_TYPE);
            }
        })
    );

    // Refresh tree view on file rename or move
    context.subscriptions.push(
        vscode.workspace.onDidRenameFiles(_e => {
            treeDataProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.openJobInConsole', async (job: any, project?: string) => {
            if (!job || !job.id) return;
            const loc = job.location || 'us-central1';
            let proj = project;
            if (!proj || proj === 'YOUR_PROJECT_ID') {
                proj = await getGcloudProject();
            }
            const url = `https://console.cloud.google.com/dataflow/jobs/${loc}/${job.id}${proj ? `?project=${proj}` : ''}`;
            vscode.env.openExternal(vscode.Uri.parse(url));
        })
    );
}

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
     * 
     * Author: Mike Nimer <mikenimer@google.com>
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

export function deactivate() { }

/**
 * Scans a JSON string in a single forward pass to locate the character offset
 * where the last complete file object in the `files` array ends (its closing `}` character).
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Accurately tracks string literals, backslash escape sequences, and structural
 * brace/bracket nesting so that `{` and `}` characters inside source code string
 * values (such as Python dict literals or Java class/method bodies) are never
 * misidentified as structural JSON delimiters.
 * 
 * @param jsonText Cleaned JSON text (without markdown code fences)
 * @returns 0-based character index of the closing `}` of the last complete file object
 *          in `files`, or -1 if no complete file object is found.
 */
export function findLastCompleteFileEndOffset(jsonText: string): number {
    if (!jsonText) {
        return -1;
    }

    let inString = false;
    let escaped = false;
    let braceDepth = 0;
    let bracketDepth = 0;

    let sawFilesKey = false;
    let sawColonAfterFiles = false;
    let inFilesArray = false;
    let filesBracketDepth = -1;

    let trackingKey = false;
    let currentKey = '';
    let lastCompleteElementEnd = -1;

    for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];

        // Section 1: Inside String Literal
        if (inString) {
            if (escaped) {
                // NOTE: Backslash escape sequence consumed.
                escaped = false;
                if (trackingKey) {
                    currentKey += char;
                }
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                // String literal ended
                inString = false;
                if (trackingKey) {
                    trackingKey = false;
                    if (currentKey === 'files') {
                        sawFilesKey = true;
                    }
                }
            } else if (trackingKey) {
                currentKey += char;
            }
            continue;
        }

        // Section 2: Entering String Literal
        if (char === '"') {
            inString = true;
            escaped = false;
            // Only track key contents when directly inside root object
            if (!inFilesArray && braceDepth === 1 && bracketDepth === 0) {
                trackingKey = true;
                currentKey = '';
            } else {
                trackingKey = false;
            }
            continue;
        }

        // Section 3: State machine for detecting entry into the root "files" array
        if (!inFilesArray) {
            if (sawFilesKey) {
                if (char === ':') {
                    sawColonAfterFiles = true;
                    sawFilesKey = false;
                    continue;
                } else if (!/\s/.test(char)) {
                    sawFilesKey = false;
                }
            }
            if (sawColonAfterFiles) {
                if (char === '[') {
                    sawColonAfterFiles = false;
                    inFilesArray = true;
                    bracketDepth++;
                    filesBracketDepth = bracketDepth;
                    continue;
                } else if (!/\s/.test(char)) {
                    sawColonAfterFiles = false;
                }
            }
        }

        // Section 4: Structural delimiter tracking outside strings
        if (char === '{') {
            braceDepth++;
        } else if (char === '}') {
            braceDepth--;
            // If we are directly inside the files array (bracketDepth === filesBracketDepth)
            // and braceDepth returns to 1, a top-level file object in `files` has just closed.
            if (inFilesArray && bracketDepth === filesBracketDepth && braceDepth === 1) {
                lastCompleteElementEnd = i;
            }
        } else if (char === '[') {
            bracketDepth++;
        } else if (char === ']') {
            if (inFilesArray && bracketDepth === filesBracketDepth) {
                inFilesArray = false;
                filesBracketDepth = -1;
            }
            bracketDepth--;
        }
    }

    return lastCompleteElementEnd;
}

/**
 * Safely parses JSON response string from Gemini model.
 * Handles markdown code fences and automatically repairs truncated JSON responses by
 * salvaging all completely generated file objects from the 'files' array in a single
 * forward pass.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * @param rawText Raw output text from Gemini model.
 * @returns Parsed JSON object containing generated files array.
 */
export function parseOrRepairJson(rawText: string): any {
    if (!rawText || !rawText.trim()) {
        throw new Error("Empty response from Gemini model.");
    }

    // Strip markdown code fences if model wrapped response in ```json ... ```
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();

    try {
        return JSON.parse(cleaned);
    } catch (firstErr) {
        console.warn('[parseOrRepairJson] Standard JSON.parse failed on response. Attempting repair for truncated output...', firstErr);

        // Single forward pass to find where the last complete file object in 'files' ends
        const lastCompleteOffset = findLastCompleteFileEndOffset(cleaned);
        if (lastCompleteOffset > 0) {
            // Substring up to the closing '}' of the last complete file object,
            // then close the 'files' array (']') and root object ('}')
            const candidate = cleaned.substring(0, lastCompleteOffset + 1).trim() + ']}';
            try {
                const parsed = JSON.parse(candidate);
                if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) {
                    console.log(`[parseOrRepairJson] Successfully repaired truncated JSON response and salvaged ${parsed.files.length} file(s).`);
                    return parsed;
                }
            } catch (_) {
                // If candidate parsing fails, fall through to rethrow original error
            }
        }

        // If structural repair could not salvage any completed file objects, rethrow original syntax error
        throw firstErr;
    }
}

/**
 * Searches process.env.PATH for an executable binary.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param executable The name of the binary to search for
 * @returns The resolved absolute path if found as a regular file on PATH; otherwise undefined
 */
export function findExecutableInPath(executable: string): string | undefined {
    const envPath = process.env.PATH;
    if (!envPath) {
        return undefined;
    }
    const dirs = envPath.split(path.delimiter);
    const extensions = process.platform === 'win32' ? ['.cmd', '.bat', '.exe', ''] : [''];
    for (const dir of dirs) {
        if (!dir) {
            continue;
        }
        for (const ext of extensions) {
            const candidate = path.join(dir, `${executable}${ext}`);
            try {
                if (fs.existsSync(candidate)) {
                    const stat = fs.statSync(candidate);
                    if (stat.isFile()) {
                        return candidate;
                    }
                }
            } catch {
                // Ignore filesystem read/stat errors
            }
        }
    }
    return undefined;
}

/**
 * Resolves the path to a CLI executable across supported platforms and installation modes.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Resolution order:
 * 1. User configuration setting `dataflowDesigner.gcloudPath` (for gcloud or sibling tools bq/gsutil)
 * 2. System PATH environment lookup via findExecutableInPath
 * 3. Platform standard candidate directories (Homebrew, /usr/local/bin, /usr/bin, user home)
 * 
 * @param cli CLI command name ('gcloud' | 'bq' | 'gsutil' | 'aws' | string)
 * @returns The resolved absolute path to the binary, or undefined if not found
 */
export function resolveCli(cli: 'gcloud' | 'bq' | 'gsutil' | 'aws' | string): string | undefined {
    // 1. Consult user configuration setting if explicitly set
    const configuredGcloud = vscode.workspace.getConfiguration('dataflowDesigner')?.get<string>('gcloudPath')?.trim();
    if (cli === 'gcloud') {
        if (configuredGcloud) {
            return configuredGcloud;
        }
    } else if (configuredGcloud && (cli === 'bq' || cli === 'gsutil')) {
        // Look for sibling CLI tool in the same directory as configured gcloud binary
        const dir = path.dirname(configuredGcloud);
        const extensions = process.platform === 'win32' ? ['.cmd', '.bat', '.exe', ''] : [''];
        for (const ext of extensions) {
            const candidate = path.join(dir, `${cli}${ext}`);
            try {
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    return candidate;
                }
            } catch {
                // Ignore filesystem read/stat errors
            }
        }
    }

    // 2. Consult system PATH lookup
    const pathCandidate = findExecutableInPath(cli);
    if (pathCandidate) {
        return pathCandidate;
    }

    // 3. Fallback to generic candidate directories
    const candidateDirs: string[] = [];
    if (cli === 'gcloud' || cli === 'bq' || cli === 'gsutil') {
        if (process.env.HOME) {
            candidateDirs.push(path.join(process.env.HOME, 'Development/libraries/google-cloud-sdk/bin'));
            candidateDirs.push(path.join(process.env.HOME, 'google-cloud-sdk/bin'));
        }
    } else if (cli === 'aws') {
        if (process.env.HOME) {
            candidateDirs.push(path.join(process.env.HOME, '.local/bin'));
        }
    }
    candidateDirs.push('/opt/homebrew/bin');
    candidateDirs.push('/usr/local/bin');
    candidateDirs.push('/usr/bin');

    const extensions = process.platform === 'win32' ? ['.cmd', '.bat', '.exe', ''] : [''];
    for (const dir of candidateDirs) {
        for (const ext of extensions) {
            const candidate = path.join(dir, `${cli}${ext}`);
            try {
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    return candidate;
                }
            } catch {
                // Ignore filesystem read/stat errors
            }
        }
    }

    return undefined;
}

/**
 * Resolves the path to the Google Cloud SDK (gcloud) executable.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Resolution order:
 * 1. User configuration setting `dataflowDesigner.gcloudPath`
 * 2. System PATH environment lookup
 * 3. Generic standard installation locations
 * 4. Fallback executable name 'gcloud'
 * 
 * @returns The resolved path or command name for the gcloud binary
 */
export function findGcloudPath(): string {
    return resolveCli('gcloud') || 'gcloud';
}

export interface SecretManagerItem {
    name: string;
    id: string;
    fullName: string;
    value: string;
}

/**
 * Extracts the short secret ID from a Secret Manager fully-qualified resource path or secret name.
 * Handles paths like "projects/123/secrets/my-secret", names with trailing slashes, or simple IDs.
 * 
 * @param fullName Full resource path (e.g. projects/.../secrets/my-secret) or secret name
 * @returns The short secret ID without project path prefix
 */
export function toShortSecretId(fullName?: string | null): string {
    if (!fullName) {
        return '';
    }
    // NOTE: Strip any trailing slashes to properly parse paths such as 'projects/.../secrets/my-secret/'
    const trimmed = fullName.trim().replace(/\/+$/, '');
    if (!trimmed) {
        return '';
    }
    const parts = trimmed.split('/');
    return parts[parts.length - 1] || '';
}

/**
 * Maps already-parsed `gcloud secrets list --format=json` output into normalized
 * SecretManagerItem objects.
 *
 * Guarantees short secret IDs reach the webview: `name`, `id` and `value` all carry the
 * short ID, and only `fullName` retains the fully-qualified resource path. Any consumer
 * therefore reads a usable ID whichever field it happens to pick (finding M1/M20).
 *
 * NOTE: This is deliberately separate from parseSecretManagerOutput. The generic
 * `listAssets` helper has already JSON.parse'd the CLI output by the time it calls its
 * mapper, so it needs the mapping over parsed JSON. Keeping one shared implementation
 * means the logic covered by src/test/secrets.test.ts is the logic that actually runs --
 * an inline duplicate here would recreate exactly the M1 failure mode of a correct,
 * tested code path that never executes.
 *
 * @param json Parsed JSON from `gcloud secrets list --format=json`
 * @returns Array of SecretManagerItem objects containing short IDs and full resource names
 */
export function mapSecretManagerItems(json: any): SecretManagerItem[] {
    if (!Array.isArray(json)) {
        return [];
    }
    return json.map((s: any) => {
        const rawName = s?.name || '';
        const shortName = toShortSecretId(rawName) || rawName;
        return {
            name: shortName,
            id: shortName,
            fullName: rawName,
            value: shortName
        };
    });
}

/**
 * Parses raw JSON output from `gcloud secrets list --format=json` into normalized
 * SecretManagerItem objects. Thin wrapper over mapSecretManagerItems for callers that
 * hold the raw stdout string rather than parsed JSON.
 *
 * @param stdout JSON string from gcloud secrets list command
 * @returns Array of SecretManagerItem objects containing short IDs and full resource names
 */
export function parseSecretManagerOutput(stdout: string): SecretManagerItem[] {
    return mapSecretManagerItems(JSON.parse(stdout));
}

/**
 * Returns the last non-empty '/'-separated segment of a resource name
 * (e.g. `projects/p/instances/i` -> `i`), or '' for non-strings.
 *
 * @param value Resource name from gcloud JSON output
 * @returns The trailing path segment
 */
function lastPathSegment(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }
    const parts = value.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
}

/**
 * Maps `gcloud bigtable instances list --format=json` to short instance IDs.
 *
 * @param json Parsed gcloud JSON output
 * @returns Short Bigtable instance IDs
 */
export function mapBigtableInstances(json: any): string[] {
    return Array.isArray(json) ? json.map((i: any) => lastPathSegment(i?.name)).filter(Boolean) : [];
}

/**
 * Maps `gcloud bigtable instances tables list --format=json` to short table IDs.
 *
 * @param json Parsed gcloud JSON output
 * @returns Short Bigtable table IDs
 */
export function mapBigtableTables(json: any): string[] {
    return Array.isArray(json) ? json.map((t: any) => lastPathSegment(t?.name)).filter(Boolean) : [];
}

/**
 * Maps `gcloud sql instances list --format=json` to instance connection names
 * (`project:region:instance`), which is what the Cloud SQL connectors expect.
 * Falls back to composing the name from project/region/name when connectionName is absent.
 *
 * @param json Parsed gcloud JSON output
 * @returns Cloud SQL instance connection names
 */
export function mapSqlInstances(json: any): string[] {
    if (!Array.isArray(json)) {
        return [];
    }
    return json.map((i: any) => {
        if (typeof i?.connectionName === 'string' && i.connectionName) {
            return i.connectionName;
        }
        return i?.project && i?.region && i?.name ? `${i.project}:${i.region}:${i.name}` : '';
    }).filter(Boolean);
}

/**
 * Maps `gcloud sql databases list --format=json` to database names.
 *
 * @param json Parsed gcloud JSON output
 * @returns Database names
 */
export function mapSqlDatabases(json: any): string[] {
    return Array.isArray(json) ? json.map((d: any) => d?.name).filter(Boolean) : [];
}

/**
 * Maps `gcloud projects list --format=json` to project IDs.
 *
 * @param json Parsed gcloud JSON output
 * @returns Project IDs
 */
export function mapProjects(json: any): string[] {
    return Array.isArray(json) ? json.map((p: any) => p?.projectId).filter(Boolean) : [];
}

/**
 * Parses a Bigtable instance identifier sent from the webview. Accepts a short
 * instance ID or `projects/{project}/instances/{instance}`. The charset is strict
 * (no ',' so a caller cannot smuggle a multi-instance list into `--instances=`),
 * while length is left to the API to validate.
 *
 * @param raw Value of `message.instance`
 * @returns `{ instance, project? }`, or null when missing or invalid
 */
export function parseBigtableInstanceParam(raw: unknown): { instance: string; project?: string } | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const v = raw.trim();
    const full = /^projects\/([a-z0-9.:-]+)\/instances\/([a-z][a-z0-9-]*)$/i.exec(v);
    if (full) {
        return { project: full[1], instance: full[2] };
    }
    return /^[a-z][a-z0-9-]*$/i.test(v) ? { instance: v } : null;
}

/**
 * Parses a Cloud SQL instance identifier sent from the webview. Accepts a bare
 * instance name or an instance connection name `[domain:]project:region:instance`.
 *
 * @param raw Value of `message.instance`
 * @returns `{ instance, project? }`, or null when missing or invalid
 */
export function parseSqlInstanceParam(raw: unknown): { instance: string; project?: string } | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const m = /^(?:([a-z0-9.:-]+):([a-z0-9-]+):)?([a-z][a-z0-9-]*)$/i.exec(raw.trim());
    if (!m) {
        return null;
    }
    return m[1] ? { project: m[1], instance: m[3] } : { instance: m[3] };
}

/**
 * Generic helper to discover cloud assets by executing a CLI command, parsing JSON,
 * and dispatching results or actionable error messages to the webview.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * @param cli The CLI command to execute ('gcloud', 'bq', 'aws', etc.)
 * @param args Arguments to pass to the CLI command
 * @param map Mapping function to transform parsed JSON items into the target asset type
 * @param responseCommand The command name of the IPC message dispatched to the webview
 * @param key The payload key name containing the array of items (e.g. 'topics', 'datasets')
 * @param postMessage Message posting callback to the webview
 * @param extraFields Optional extractor for additional fields from JSON to include in the message
 */
export async function listAssets<T>(
    cli: string,
    args: string[],
    map: (json: any) => T[],
    responseCommand: string,
    key: string,
    postMessage?: (message: any) => any,
    extraFields?: (json: any) => Record<string, any>
): Promise<void> {
    const resolvedCli = resolveCli(cli);
    if (!resolvedCli) {
        const notFoundErr = `CLI not found: '${cli}' (ENOENT). Please ensure ${cli} is installed and available in PATH or configured in settings.`;
        console.error(`[@extension.ts] ${notFoundErr}`);
        designerOutputChannel?.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${notFoundErr}`);
        postMessage?.({
            command: responseCommand,
            [key]: [],
            error: notFoundErr,
            debugLog: `Command: ${cli} ${args.join(' ')}\nError: ENOENT: CLI '${cli}' could not be resolved in PATH or standard locations.`
        });
        return;
    }

    const logMsg = `[${new Date().toLocaleTimeString()}] Executing CLI: ${resolvedCli} ${args.join(' ')}`;
    console.log('[@extension.ts]', logMsg);
    designerOutputChannel?.appendLine(logMsg);

    return new Promise((resolve) => {
        execFile(resolvedCli, args, { timeout: 15000, maxBuffer: 1024 * 1024 * 10 }, (err: ExecFileException | null, stdout: string, stderr: string) => {
            if (err) {
                const isNotFound = err.code === 'ENOENT' || (err.message && err.message.includes('ENOENT'));
                const errMsg = isNotFound
                    ? `CLI not found: '${cli}' (ENOENT). Please ensure ${cli} is installed and available in PATH.`
                    : (err.killed ? `Request timed out waiting for ${cli} CLI response.` : (stderr ? stderr.trim() : err.message));
                const errText = `Failed to list ${key} via ${cli}: ${errMsg}`;
                console.error(`[@extension.ts] ${errText}`);
                designerOutputChannel?.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${errText}`);

                postMessage?.({
                    command: responseCommand,
                    [key]: [],
                    error: errText,
                    debugLog: `Command: ${resolvedCli} ${args.join(' ')}\nError: ${err.message}\nStderr: ${stderr || ''}`
                });
                resolve();
                return;
            }

            try {
                const parsed = JSON.parse(stdout || '[]');
                const items = map(parsed);
                const extra = extraFields ? extraFields(parsed) : {};
                const successMsg = `${cli} ${key} retrieved successfully (${Array.isArray(items) ? items.length : 0} items).`;
                console.log('[@extension.ts]', successMsg);
                designerOutputChannel?.appendLine(`[${new Date().toLocaleTimeString()}] SUCCESS: ${successMsg}`);

                postMessage?.({
                    command: responseCommand,
                    [key]: Array.isArray(items) ? items : [],
                    ...extra,
                    debugLog: `Command: ${resolvedCli} ${args.join(' ')}\nRetrieved ${Array.isArray(items) ? items.length : 0} items.`
                });
            } catch (e: any) {
                const parseErrMsg = `Failed to parse ${cli} JSON output: ${e.message}`;
                console.error('[@extension.ts]', parseErrMsg);
                designerOutputChannel?.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${parseErrMsg}`);

                postMessage?.({
                    command: responseCommand,
                    [key]: [],
                    error: parseErrMsg,
                    debugLog: `Command: ${resolvedCli} ${args.join(' ')}\nOutput: ${stdout}`
                });
            }
            resolve();
        });
    });
}


/**
 * Asynchronously retrieves the active GCP project ID from gcloud CLI.
 * Returns undefined if gcloud is unavailable or fails.
 */
export function getGcloudProject(): Promise<string | undefined> {
    return new Promise((resolve) => {
        const gcloudBin = findGcloudPath();
        execFile(gcloudBin, ['config', 'get-value', 'project'], { timeout: 5000 }, (error, stdout) => {
            if (error || !stdout) {
                resolve(undefined);
            } else {
                resolve(stdout.trim() || undefined);
            }
        });
    });
}

/**
 * Interface representing a sample pipeline definition loaded from resources/samples.
 */
export interface SamplePipeline {
    id: string;
    filename: string;
    title: string;
    description: string;
    category?: string;
    badge?: string;
    language?: string;
    runner?: string;
    content: string;
}

/**
 * Formats a sample filename base into a human-readable title.
 * 
 * @param baseName The file name without extension.
 * @returns Human-friendly capitalized title.
 */
export function formatSampleTitle(baseName: string): string {
    return baseName
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Computes a human-readable pipeline flow description from nodes and edges following topological DAG order.
 * 
 * @param nodes List of pipeline nodes
 * @param edges List of pipeline edges
 * @returns Formatted flow string (e.g. "PubSub Connector ➔ Parse Message ➔ [BigQuery, Log Message]")
 */
export function computePipelineFlow(nodes: any[], edges: any[]): string {
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
        return '';
    }

    // Map node id -> node metadata
    const nodeMap = new Map<string, { id: string; label: string; type: string; x: number; y: number }>();
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const node of nodes) {
        const id = String(node.id);
        const label = node.data?.label || node.id || 'Unnamed';
        const type = node.data?.type || 'STEP';
        const x = node.position?.x ?? 0;
        const y = node.position?.y ?? 0;
        nodeMap.set(id, { id, label, type, x, y });
        inDegree.set(id, 0);
        adj.set(id, []);
    }

    if (edges && Array.isArray(edges)) {
        for (const edge of edges) {
            const src = String(edge.source);
            const tgt = String(edge.target);
            if (nodeMap.has(src) && nodeMap.has(tgt)) {
                adj.get(src)!.push(tgt);
                inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
            }
        }
    }

    // Topological layer traversal (Kahn's algorithm by layers)
    let currentLayer: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
        if (deg === 0) {
            currentLayer.push(id);
        }
    }

    // Sort root layer: SOURCE types first, then left-to-right (x), then top-to-bottom (y)
    currentLayer.sort((a, b) => {
        const na = nodeMap.get(a)!;
        const nb = nodeMap.get(b)!;
        if (na.type === 'SOURCE' && nb.type !== 'SOURCE') return -1;
        if (nb.type === 'SOURCE' && na.type !== 'SOURCE') return 1;
        return na.x - nb.x || na.y - nb.y;
    });

    const flowSegments: string[] = [];
    const visited = new Set<string>();

    while (currentLayer.length > 0) {
        const labels = currentLayer.map(id => nodeMap.get(id)!.label);
        if (labels.length === 1) {
            flowSegments.push(labels[0]);
        } else {
            flowSegments.push(`[${labels.join(', ')}]`);
        }

        for (const id of currentLayer) {
            visited.add(id);
        }

        const nextLayerCandidates = new Set<string>();
        for (const id of currentLayer) {
            for (const neighbor of adj.get(id) || []) {
                inDegree.set(neighbor, (inDegree.get(neighbor) || 1) - 1);
                if (inDegree.get(neighbor) === 0 && !visited.has(neighbor)) {
                    nextLayerCandidates.add(neighbor);
                }
            }
        }

        currentLayer = Array.from(nextLayerCandidates).sort((a, b) => {
            const na = nodeMap.get(a)!;
            const nb = nodeMap.get(b)!;
            return na.x - nb.x || na.y - nb.y;
        });
    }

    // If there are unvisited nodes (e.g. disconnected components), append them sorted by x position
    const unvisited = nodes.filter(n => !visited.has(String(n.id)));
    if (unvisited.length > 0) {
        const remainingLabels = unvisited
            .sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0))
            .map(n => n.data?.label || n.id);
        if (flowSegments.length === 0) {
            return remainingLabels.join(' ➔ ');
        }
        flowSegments.push(...remainingLabels);
    }

    return flowSegments.join(' ➔ ');
}

/**
 * Discovers and parses all .beam sample pipelines located in the resources/samples directory.
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Converted to `fs.promises` so that opening the webview no longer blocks the extension
 * host while every sample file is read off disk (finding M18).
 *
 * NOTE: this is plainly `async`. An earlier revision of this fix returned a value typed
 * `Promise<SamplePipeline[]> & SamplePipeline[]` -- an array with `then`/`catch`/`finally`
 * grafted onto it -- so that older synchronous callers kept working. That construct did
 * the work twice (once synchronously, once via the promise), and awaiting it returned a
 * different result than indexing it. Worse, it meant the tests and production executed
 * different code paths, so the tests no longer proved anything about shipped behaviour.
 * All callers await this. Keep it that way.
 *
 * @param context The extension context to resolve resource paths.
 * @returns Promise resolving to an array of SamplePipeline objects with metadata and YAML content.
 */
export async function getSamplePipelines(context: vscode.ExtensionContext): Promise<SamplePipeline[]> {
    // 1. Resolve candidates for the samples directory across development and production paths
    const possibleDirs: string[] = [
        context?.asAbsolutePath ? context.asAbsolutePath(path.join('resources', 'samples')) : '',
        context?.asAbsolutePath ? context.asAbsolutePath(path.join('src', 'samples')) : '',
        context?.extensionPath ? path.join(context.extensionPath, 'resources', 'samples') : '',
        context?.extensionPath ? path.join(context.extensionPath, 'src', 'samples') : '',
    ].filter(Boolean);

    if (possibleDirs.length === 0) {
        possibleDirs.push(
            path.join(__dirname, '..', 'resources', 'samples'),
            path.join(__dirname, '..', 'src', 'samples'),
            path.join(__dirname, '..', '..', 'resources', 'samples')
        );
    }

    // 2. Pick the first candidate that actually exists and is a directory.
    let samplesDir: string | undefined;
    for (const dir of possibleDirs) {
        // NOTE: inherently TOCTOU -- the directory could vanish between this probe and the
        // readdir below. The readdir is wrapped in its own try/catch for exactly that reason.
        const isDir = await fs.promises.stat(dir).then(s => s.isDirectory()).catch(() => false);
        if (isDir) {
            samplesDir = dir;
            break;
        }
    }

    if (!samplesDir) {
        return [];
    }

    const results: SamplePipeline[] = [];
    try {
        // 3. Read every *.beam file in the directory asynchronously.
        const files = await fs.promises.readdir(samplesDir);
        for (const file of files) {
            if (!file.endsWith('.beam')) continue;
            const fullPath = path.join(samplesDir, file);
            try {
                const content = await fs.promises.readFile(fullPath, 'utf-8');
                const baseName = path.basename(file, '.beam');
                const title = formatSampleTitle(baseName);

                // 4. Extract metadata and the DAG flow summary from the YAML structure.
                let language = 'Java';
                let runner = 'Dataflow';
                let flow = '';

                try {
                    const parsed = YAML.parse(content);
                    if (parsed) {
                        if (parsed.pipelineConfig?.language) {
                            language = parsed.pipelineConfig.language;
                        }
                        if (parsed.jobConfig?.runner) {
                            runner = parsed.jobConfig.runner;
                        }
                        flow = computePipelineFlow(parsed.nodes, parsed.edges);
                    }
                } catch (parseErr) {
                    console.warn(`Failed to parse YAML for sample ${file}, falling back to text scan`, parseErr);
                }

                const description = flow
                    ? `Pipeline flow: ${flow}`
                    : `Pre-configured ${language} sample pipeline for ${runner} runner`;

                results.push({
                    id: baseName,
                    filename: file,
                    title,
                    description,
                    category: 'Samples',
                    badge: language,
                    language,
                    runner,
                    content
                });
            } catch (err) {
                // A single unreadable sample must not hide the rest of the catalogue.
                console.error(`Failed to read sample file: ${file}`, err);
            }
        }
    } catch (err) {
        console.error('Failed to list samples directory:', err);
    }

    return results;
}

/**
 * Reads resource template or schema files, checking resources/ and src/ directories.
 * Supports both development environment execution and packaged VSIX execution.
 */
export function readResourceFile(context: vscode.ExtensionContext, fileName: string): string {
    const possiblePaths = [
        context.asAbsolutePath(path.join('resources', fileName)),
        context.asAbsolutePath(path.join('src', fileName)),
        path.join(__dirname, '..', 'resources', fileName),
        path.join(__dirname, '..', 'src', fileName)
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return fs.readFileSync(p, 'utf-8');
        }
    }
    throw new Error(`Resource file not found: ${fileName}. Checked paths: ${possiblePaths.join(', ')}`);
}

/**
 * Directory names, system paths, and dependency folders to ignore during file tree scans and cleanup.
 */
export const IGNORED_DIRECTORY_NAMES = new Set([
    'venv',
    '.venv',
    'env',
    '.env',
    'virtualenv',
    '.virtualenv',
    'node_modules',
    '__pycache__',
    'target',
    'build',
    'dist',
    'out',
    'bin',
    'site-packages',
    'dist-packages',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    '.tox',
    '.nox',
    '.eggs',
    '.git',
    '.github',
    '.idea',
    '.vscode'
]);

/**
 * Checks if a given relative or absolute file path belongs to an ignored directory,
 * virtual environment, or hidden cache structure.
 */
export function isIgnoredPath(fileNameOrPath: string): boolean {
    if (!fileNameOrPath) return true;
    const parts = fileNameOrPath.toLowerCase().replace(/\\/g, '/').split('/');
    return parts.some(part => {
        if (!part) return false;
        if (part === '.dockerignore' || part === '.gcloudignore') return false;
        if (IGNORED_DIRECTORY_NAMES.has(part)) return true;
        if (part.startsWith('.') || part.endsWith('.egg-info')) return true;
        return false;
    });
}

/**
 * Derives a stable identity for a pipeline so an output folder can be recognised as
 * belonging to it across sessions.
 *
 * NOTE: `pipelineConfig` carries no persisted id in older `.beam` files, and adding one
 * requires a webview round-trip. Rather than generate a fresh id per run -- which would
 * make every regeneration look like a *different* pipeline and trigger the "foreign
 * folder" prompt forever -- we fall back to a deterministic hash of the pipeline's path.
 * Stable across runs, needs no migration, and is replaced by the real id as soon as one
 * is present in the config.
 *
 * @param pipelineConfig The pipeline configuration from the webview
 * @param documentPath Absolute path of the .beam document
 * @returns A stable pipeline identifier
 */
export function resolvePipelineId(pipelineConfig: any, documentPath: string): string {
    const explicit = pipelineConfig?.pipelineId;
    if (typeof explicit === 'string' && explicit.trim()) {
        return explicit.trim();
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const key = workspaceFolder
        ? path.relative(workspaceFolder, documentPath)
        : documentPath;
    return `bp_path_${sha256(key).slice(0, 24)}`;
}

/**
 * Reads and validates the `.beamgen.json` ownership marker from an output folder.
 *
 * @param folderPath Absolute output folder
 * @returns The parsed manifest, or null when absent, unreadable or malformed
 */
function readGenerationManifest(folderPath: string): GenerationManifest | null {
    const markerPath = path.join(folderPath, MANIFEST_FILENAME);
    if (!fs.existsSync(markerPath)) {
        return null;
    }
    try {
        return parseManifest(JSON.parse(fs.readFileSync(markerPath, 'utf-8')));
    } catch (err) {
        // NOTE: an unreadable marker degrades to "no marker", which routes into the more
        // cautious unowned-nonempty branch rather than authorising a delete.
        console.warn(`[generation] Ignoring unreadable ${MANIFEST_FILENAME} in ${folderPath}`, err);
        return null;
    }
}

/**
 * Decides whether generation may proceed into the target folder, prompting the user when
 * the folder is not demonstrably ours.
 *
 * This is the answer to "what if the user points Target Folder at an existing project?".
 * We never auto-delete a folder we did not create.
 *
 * @param targetFolderPath Absolute output folder
 * @param pipelineId Stable identity of the pipeline requesting generation
 * @returns The ownership classification plus whether the caller may clean, or null if the
 *          user cancelled
 */
export async function gateOutputFolder(
    targetFolderPath: string,
    pipelineId: string
): Promise<{ ownership: FolderOwnership; manifest: GenerationManifest | null; mayClean: boolean } | null> {
    const manifest = readGenerationManifest(targetFolderPath);

    let entries: string[] = [];
    if (fs.existsSync(targetFolderPath)) {
        try {
            entries = fs.readdirSync(targetFolderPath);
        } catch {
            entries = [];
        }
    }
    // The marker and the design file itself do not make a folder "non-empty" for the
    // purposes of this decision.
    const meaningful = entries.filter(e => e !== MANIFEST_FILENAME && !e.endsWith('.beam'));
    const ownership = classifyFolder(manifest, meaningful.length === 0, pipelineId);

    if (ownership === 'fresh') {
        return { ownership, manifest, mayClean: false };
    }
    if (ownership === 'owned') {
        return { ownership, manifest, mayClean: true };
    }

    // 'unowned-nonempty' or 'foreign': never delete silently. Ask.
    // NOTE: VS Code's { modal: true } automatically provides a built-in "Cancel" dismiss button.
    const detail = ownership === 'foreign'
        ? `This folder was generated for a different pipeline. Continuing may overwrite its files.`
        : `This folder was not created by the designer and contains ${meaningful.length} item(s).`;
    const choice = await vscode.window.showWarningMessage(
        `${detail}\n\n${targetFolderPath}`,
        { modal: true },
        'Generate without cleaning'
    );
    if (choice !== 'Generate without cleaning') {
        return null;
    }
    // Proceed, but explicitly without deletion rights.
    return { ownership, manifest, mayClean: false };
}

/**
 * Removes directories that became empty once their generated contents were deleted.
 *
 * `planCleanup` can only emit paths it was handed -- the manifest's file list plus the
 * TOP-LEVEL folder entries -- so it has no way to know that a nested directory such as
 * `src/main/java/com/example` exists at all. Without this pass, switching a pipeline
 * from Java to Python deleted every `.java` file but left the whole directory skeleton
 * standing, and the user saw Java folders intermingled with the new Python output.
 *
 * BLAST RADIUS: a directory is removed only when it is completely empty. Anything the
 * user owns -- a hand-written source file, an unrelated subfolder -- keeps its parent
 * chain alive, which preserves the "never delete unknown user files" guarantee that the
 * rest of the cleanup design rests on. `fs.rmdirSync` is used rather than a recursive
 * remove precisely so that guarantee is enforced by the filesystem, not by our own
 * bookkeeping: a non-empty directory simply cannot be removed this way.
 *
 * @param targetFolderPath Absolute output folder; never itself removed
 * @param deletedRelPaths Relative paths that were just deleted
 * @returns Number of directories pruned
 */
function pruneEmptyDirectories(targetFolderPath: string, deletedRelPaths: string[]): number {
    // Collect every ancestor directory of every deleted path. A file at
    // `src/main/java/com/example/P.java` contributes five candidates, because deleting
    // that one file can cascade all the way back up to `src`.
    const candidates = new Set<string>();
    for (const rel of deletedRelPaths) {
        // Manifest paths may use Windows separators; normalise before splitting.
        let dir = path.posix.dirname(rel.replace(/\\/g, '/'));
        while (dir && dir !== '.' && dir !== '/' && !dir.startsWith('..')) {
            candidates.add(dir);
            dir = path.posix.dirname(dir);
        }
    }

    // Deepest first, so a child is gone by the time its parent is tested for emptiness.
    // Without this ordering `src/main` would still contain `src/main/java` and survive.
    const ordered = Array.from(candidates).sort(
        (a, b) => b.split('/').length - a.split('/').length
    );

    let pruned = 0;
    for (const rel of ordered) {
        // Same defence-in-depth containment check applied to file deletions. Manifest
        // paths are attacker-influenced, and dirname() of a hostile entry is equally so.
        // This also refuses '.' outright, which is what stops us removing the output
        // folder itself when the manifest owned everything in it.
        const abs = resolveDeletablePath(targetFolderPath, rel);
        if (!abs) {
            continue;
        }
        try {
            if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
                continue;
            }
            if (fs.readdirSync(abs).length > 0) {
                // Still holds something we do not own. Stop; its parents are non-empty
                // too and will fail this same check when their turn comes.
                continue;
            }
            fs.rmdirSync(abs);
            pruned++;
        } catch (err) {
            // Never fatal: a leftover empty directory is cosmetic, whereas aborting the
            // generation here would cost the user the payload we already hold.
            console.warn(`[generation] Could not prune empty directory ${abs}`, err);
        }
    }
    return pruned;
}

/**
 * Executes a scoped cleanup of a designer-owned output folder.
 *
 * MUST be called only after a validated generation payload is in memory -- deleting
 * before the model call is what made a timeout or unparseable response unrecoverable
 * (finding C3). Every path is re-checked for containment immediately before removal.
 *
 * @param targetFolderPath Absolute output folder
 * @param manifest The owning manifest
 * @param requestedLanguage Language being generated now
 * @returns Number of entries removed, and any hand-edited files detected
 */
export function executeScopedCleanup(
    targetFolderPath: string,
    manifest: GenerationManifest,
    requestedLanguage: string
): { removed: number; modifiedFiles: string[] } {
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(targetFolderPath);
    } catch {
        return { removed: 0, modifiedFiles: [] };
    }

    // Hash the manifest's files as they currently stand so we can report hand-edits.
    const currentHashes: Record<string, string> = {};
    for (const entry of manifest.files) {
        const abs = resolveDeletablePath(targetFolderPath, entry.path);
        if (abs && fs.existsSync(abs)) {
            try {
                currentHashes[entry.path] = sha256(fs.readFileSync(abs, 'utf-8'));
            } catch {
                // Binary or unreadable; skip hash comparison for this entry.
            }
        }
    }

    const plan = planCleanup(manifest, requestedLanguage, entries, currentHashes);

    let removed = 0;
    // Records what actually left the disk so we know which directories to re-test for
    // emptiness. Paths we skipped or failed to delete must not trigger a prune.
    const deletedRelPaths: string[] = [];
    for (const rel of plan.paths) {
        // Defence in depth: the manifest is on-disk data and therefore attacker-influenced
        // if a malicious folder is shared. Re-validate containment for every single path.
        const abs = resolveDeletablePath(targetFolderPath, rel);
        if (!abs) {
            console.warn(`[generation] Refusing to delete out-of-bounds manifest entry: ${rel}`);
            continue;
        }
        if (!fs.existsSync(abs)) {
            // Already gone -- the user may have deleted it by hand. Its parent can still
            // be empty as a result, so it remains a prune candidate.
            deletedRelPaths.push(rel);
            continue;
        }
        try {
            const stat = fs.statSync(abs);
            if (stat.isDirectory()) {
                fs.rmSync(abs, { recursive: true, force: true });
            } else {
                fs.unlinkSync(abs);
            }
            removed++;
            deletedRelPaths.push(rel);
        } catch (err) {
            console.error(`[generation] Failed to delete ${abs}`, err);
        }
    }

    // Deleting the files is not enough: the directories they lived in would otherwise
    // survive as empty husks and appear to be leftover code from the previous language.
    const prunedDirs = pruneEmptyDirectories(targetFolderPath, deletedRelPaths);
    if (prunedDirs > 0) {
        designerOutputChannel?.appendLine(
            `[generation] Pruned ${prunedDirs} empty director${prunedDirs === 1 ? 'y' : 'ies'} left by the previous generation.`
        );
    }

    if (plan.isLanguageSwitch) {
        designerOutputChannel?.appendLine(
            `[generation] Language switch ${manifest.language} -> ${requestedLanguage}: removed ${removed} entries including build artifacts.`
        );
    }
    return { removed, modifiedFiles: plan.modifiedFiles };
}

/**
 * Writes the `.beamgen.json` ownership marker recording what this generation produced.
 *
 * @param targetFolderPath Absolute output folder
 * @param pipelineId Owning pipeline identifier
 * @param language Language generated
 * @param written Files written in this run, relative path plus content
 */
export function writeGenerationManifest(
    targetFolderPath: string,
    pipelineId: string,
    language: string,
    written: Array<{ path: string; content: string }>
): void {
    try {
        const manifest = buildManifest(pipelineId, language, written);
        fs.writeFileSync(
            path.join(targetFolderPath, MANIFEST_FILENAME),
            JSON.stringify(manifest, null, 2),
            'utf-8'
        );
    } catch (err) {
        // A missing marker degrades safely: the next run classifies the folder as
        // unowned-nonempty and prompts rather than deleting.
        console.error(`[generation] Failed to write ${MANIFEST_FILENAME}`, err);
    }
}

/**
 * Allowlist of shell script basenames permitted to receive executable permissions (chmod 755).
 * Based on templates in `resources/templates/` and runner script invocations in `src/extension.ts`:
 * - `run_directrunner.sh`
 * - `run_dataflowrunner.sh`
 * - `run_dataflow.sh`
 * - `run_sparkrunner.sh`
 * - `run_spark.sh`
 */
export const ALLOWED_EXECUTABLE_SCRIPTS: ReadonlySet<string> = new Set([
    'run_directrunner.sh',
    'run_dataflowrunner.sh',
    'run_dataflow.sh',
    'run_sparkrunner.sh',
    'run_spark.sh',
]);

/**
 * Validates whether a file is permitted to be marked executable (chmod 755).
 * Enforces an exact allowlist of known runner script basenames to prevent LLM-directed chmod
 * on untrusted scripts (e.g. `evil.sh`) or non-script artifacts.
 *
 * @param filePath The file path or filename to evaluate
 * @returns true if the file basename is in ALLOWED_EXECUTABLE_SCRIPTS and has a .sh extension
 */
export function isAllowedExecutableScript(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') {
        return false;
    }
    const basename = path.basename(filePath.trim());
    if (!basename.endsWith('.sh')) {
        return false;
    }
    return ALLOWED_EXECUTABLE_SCRIPTS.has(basename);
}

/**
 * Resolves and validates a model-supplied candidate filename against a target directory,
 * guaranteeing that the resolved output path is strictly contained within the target folder.
 * 
 * Enforces strict containment security:
 * - Rejects null, undefined, non-string, and empty or whitespace-only inputs
 * - Rejects absolute paths (e.g. `/etc/passwd`)
 * - Rejects Windows drive letters (e.g. `C:\...`, `D:/...`) and UNC paths
 * - Resolves path and verifies it remains strictly inside the target folder
 * - Rejects paths resolving to the target folder itself (e.g. `.` or `./`)
 * - Rejects directory traversal escapes (e.g. `../../`, `src/../../../../tmp/pwned.sh`)
 *
 * @param targetFolderPath The root directory where files are allowed to be written
 * @param filename The model-supplied candidate filename or relative path
 * @returns Fully resolved safe file path, or null if the path is invalid or attempts to escape
 */
export function resolveSafeOutputPath(targetFolderPath: string, filename: string): string | null {
    // Fail fast if arguments are missing or invalid
    if (!targetFolderPath || typeof targetFolderPath !== 'string') {
        return null;
    }
    if (!filename || typeof filename !== 'string') {
        return null;
    }

    const trimmedFilename = filename.trim();
    if (!trimmedFilename) {
        return null;
    }

    // Explicitly reject absolute paths, Windows drive-letter paths (C:..., c:/...), and UNC paths
    if (
        path.isAbsolute(trimmedFilename) ||
        path.win32.isAbsolute(trimmedFilename) ||
        /^[a-zA-Z]:/.test(trimmedFilename) ||
        trimmedFilename.startsWith('/') ||
        trimmedFilename.startsWith('\\')
    ) {
        return null;
    }

    // Normalize Windows backslashes to forward slashes to prevent traversal evasion across platforms
    const normalized = trimmedFilename.replace(/\\/g, '/');
    const resolvedTarget = path.resolve(targetFolderPath);
    const resolvedPath = path.resolve(resolvedTarget, normalized);

    // Compute relative path from target directory to target file
    const rel = path.relative(resolvedTarget, resolvedPath);

    // Assert that the file is strictly inside targetFolderPath:
    // - !rel rejects a filename that resolves to the target folder itself
    // - rel === '.' also rejects the target folder itself
    // - rel.startsWith('..') rejects traversal out of the target folder
    // - path.isAbsolute(rel) / path.win32.isAbsolute(rel) rejects cross-drive or absolute relative paths
    if (!rel || rel === '.' || rel.startsWith('..') || path.isAbsolute(rel) || path.win32.isAbsolute(rel)) {
        return null;
    }

    return resolvedPath;
}

/**
 * Regular expression matching shell metacharacters that must not appear in folder paths
 * passed to terminal execution or path resolution to prevent shell command injection.
 * Prohibits: " ' ` $ ; & | > < \r \n
 */
export const SHELL_METASYMBOLS_REGEX = /["'`$;|&><\r\n]/;

/**
 * Validates whether a folder path or directory name is safe from shell command injection.
 * Rejects null, undefined, non-string, whitespace-only strings, and paths containing shell metacharacters
 * (`"`, `'`, '`', `$`, `;`, `&`, `|`, `>`, `<`, `\n`, `\r`).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param folderPath The directory path or folder name to validate
 * @returns true if the path is valid and free of dangerous shell metacharacters; false otherwise
 */
export function isSafeFolderPath(folderPath: unknown): boolean {
    if (!folderPath || typeof folderPath !== 'string') {
        return false;
    }
    const trimmed = folderPath.trim();
    if (trimmed.length === 0) {
        return false;
    }
    // Reject any string containing shell metacharacters
    if (SHELL_METASYMBOLS_REGEX.test(trimmed)) {
        return false;
    }
    return true;
}

/**
 * Checks whether an existing terminal's creation options specify a cwd matching the desired folder path.
 * Normalizes string and Uri-like cwd values and compares resolved paths to handle trailing slashes
 * and redundant path segments.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * @param creationOptions The creationOptions from vscode.Terminal (TerminalOptions | ExtensionTerminalOptions)
 * @param folderPath The target directory path to match
 * @returns true if creationOptions has a cwd matching folderPath; false otherwise
 */
export function terminalCwdMatches(creationOptions: unknown, folderPath: string): boolean {
    if (!creationOptions || typeof creationOptions !== 'object' || !folderPath) {
        return false;
    }
    const opts = creationOptions as { cwd?: string | { fsPath?: string } };
    if (!opts.cwd) {
        return false;
    }
    const cwdStr = typeof opts.cwd === 'string' ? opts.cwd : opts.cwd.fsPath;
    if (!cwdStr || typeof cwdStr !== 'string') {
        return false;
    }
    return path.resolve(cwdStr) === path.resolve(folderPath);
}


/**
 * Returns default content for generated ignore files (.dockerignore and .gcloudignore).
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * @returns Formatted newline-terminated ignore rules string
 */
export function getDefaultIgnoreFileContent(): string {
    return DEFAULT_IGNORE_PATTERNS.join('\n') + '\n';
}

/**
 * Synchronization state shared between BeamEditorProvider and handleMessages.
 * Tracks in-flight workspace edits to prevent echo loops when saving from canvas (Finding M4).
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */
export interface DocumentSyncState {
    isApplyingEdit: boolean;
    lastSavedContent: string | null;
}

/**
 * Safe wrapper around webview.postMessage (Finding M5).
 * 
 * Prevents throwing unhandled exceptions when late-returning async callbacks
 * (e.g. gcloud, bq CLI executions) attempt to post messages to a webview
 * whose panel has already been disposed.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * @param webview Webview instance to post messages to
 * @param isDisposed Predicate returning boolean indicating if the panel has been disposed
 * @returns Safe post function that returns false when disposed instead of throwing
 */
export function createSafePostMessage(
    webview: { postMessage: (msg: any) => ReturnType<vscode.Webview['postMessage']> | boolean },
    isDisposed: () => boolean
): (msg: any) => boolean {
    return (msg: any): boolean => {
        // NOTE: Guard against posting to disposed panel to prevent unhandled exceptions
        if (isDisposed()) {
            return false;
        }
        try {
            webview.postMessage(msg);
            return true;
        } catch (err) {
            console.warn('[postToWebview] Failed to post message to webview:', err);
            return false;
        }
    };
}

/**
 * Pure decision helper for finding M4 echo suppression.
 * 
 * Determines whether an onDidChangeTextDocument event should trigger a push to the webview.
 * Returns false if:
 * 1. The extension itself is actively applying a WorkspaceEdit originating from the webview canvas.
 * 2. The current document content matches the last content written from the webview canvas.
 * Returns true if the change originated from an external edit (e.g. user editing in text editor tab).
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * @param isApplyingEdit Flag indicating if an edit initiated by the canvas is currently being applied
 * @param currentContent The latest text content of the TextDocument
 * @param lastSavedContent The last content written or received from the canvas
 * @returns boolean indicating whether the content should be pushed to the webview
 */
export function shouldPushDocumentUpdate(
    isApplyingEdit: boolean,
    currentContent: string,
    lastSavedContent: string | null
): boolean {
    // Suppress if the change originated from our own active WorkspaceEdit
    if (isApplyingEdit) {
        return false;
    }
    // Suppress if the document content is identical to what we last saved
    if (lastSavedContent !== null && currentContent === lastSavedContent) {
        return false;
    }
    return true;
}

/**
 * Saves pipeline YAML definitions and generated code artifacts to disk.
 * 
 * Synchronization & Persistence Architecture (Finding M4):
 * - If targetUri corresponds to an open TextDocument in VS Code, updates are applied via
 *   vscode.workspace.applyEdit(...) to preserve in-memory document state, undo/redo history,
 *   and dirty tracking without producing spurious disk conflict warnings.
 * - If targetUri is NOT currently open as a TextDocument, direct filesystem write via
 *   fs.writeFileSync is used since no in-memory buffer exists.
 * - Auxiliary generated artifacts (code, requirements.txt, Dockerfile, runner scripts, ignore files)
 *   are output files not held open as .beam documents in VS Code, so writing them directly via fs is safe.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * @param targetUri File URI to save the pipeline definition to
 * @param data Serialized YAML content of the pipeline
 * @param code Optional generated pipeline execution code
 * @param fileExtension Code file extension (defaults to 'py')
 * @param outputFolder Optional custom destination directory for pipeline code
 * @param requirements Optional requirements.txt content
 * @param dockerfile Optional Dockerfile content
 * @param runScript Optional local runner script content
 * @param runDataflowScript Optional Dataflow runner script content
 * @param dockerIgnore Optional .dockerignore content
 * @param gcloudIgnore Optional .gcloudignore content
 * @param syncState Optional synchronization state for echo-loop suppression
 */
export async function savePipelineFiles(
    targetUri: vscode.Uri,
    data: string,
    code?: string,
    fileExtension: string = 'py',
    outputFolder?: string,
    requirements?: string,
    dockerfile?: string,
    runScript?: string,
    runDataflowScript?: string,
    dockerIgnore?: string,
    gcloudIgnore?: string,
    syncState?: DocumentSyncState
): Promise<void> {
    if (targetUri.scheme === 'untitled') {
        console.warn('[savePipelineFiles] Skipping direct file write for untitled URI:', targetUri.toString());
        return;
    }

    // M4: Check if the file is currently open as a TextDocument in VS Code
    const openDoc = vscode.workspace.textDocuments?.find(
        (doc) => doc.uri.toString() === targetUri.toString()
    );

    if (openDoc) {
        // Path A: Document is open in VS Code editor.
        // Skip WorkspaceEdit when content is already identical so opening a clean .beam file does not mark it dirty.
        if (openDoc.getText() === data) {
            if (syncState) {
                syncState.lastSavedContent = data;
            }
        } else {
            // Update via WorkspaceEdit to preserve undo history and dirty state.
            if (syncState) {
                syncState.isApplyingEdit = true;
                syncState.lastSavedContent = data;
            }
            try {
                const startPos = typeof openDoc.positionAt === 'function'
                    ? openDoc.positionAt(0)
                    : new vscode.Position(0, 0);
                const endPos = typeof openDoc.positionAt === 'function'
                    ? openDoc.positionAt(openDoc.getText().length)
                    : new vscode.Position(openDoc.lineCount || 0, 0);
                const fullRange = new vscode.Range(startPos, endPos);
                const edit = new vscode.WorkspaceEdit();
                edit.replace(openDoc.uri, fullRange, data);
                await vscode.workspace.applyEdit(edit);
            } finally {
                if (syncState) {
                    syncState.isApplyingEdit = false;
                }
            }
        }
    } else {
        // Path B: Document is NOT open in VS Code.
        // Direct filesystem write is safe as no in-memory buffer is being tracked.
        await fs.promises.writeFile(targetUri.fsPath, data, 'utf-8');
    }
    if (code) {
        const pipelineBaseName = path.basename(targetUri.fsPath, '.beam');
        let folderPath = path.join(path.dirname(targetUri.fsPath), pipelineBaseName);
        if (outputFolder && outputFolder.trim()) {
            if (path.isAbsolute(outputFolder)) {
                folderPath = outputFolder;
            } else {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (workspaceFolder) {
                    folderPath = path.join(workspaceFolder, outputFolder);
                }
            }
        }

        // Replace redundant existsSync/mkdirSync with idempotent fs.promises.mkdir (M18)
        await fs.promises.mkdir(folderPath, { recursive: true });

        const srcFolderPath = path.join(folderPath, 'src');
        await fs.promises.mkdir(srcFolderPath, { recursive: true });

        const codePath = path.join(srcFolderPath, `${pipelineBaseName}.${fileExtension}`);
        await fs.promises.writeFile(codePath, code, 'utf-8');

        if (fileExtension === 'py') {
            const reqPath = path.join(folderPath, 'requirements.txt');
            const reqContent = requirements || 'apache-beam\n';
            await fs.promises.writeFile(reqPath, reqContent, 'utf-8');

            const dockerPath = path.join(folderPath, 'Dockerfile');
            if (dockerfile) {
                // NOTE: inherently TOCTOU existence check
                const dockerExists = await fs.promises.stat(dockerPath).then(() => true).catch(() => false);
                if (!dockerExists) {
                    await fs.promises.writeFile(dockerPath, dockerfile, 'utf-8');
                }
            }

            const runScriptPath = path.join(folderPath, 'run_directrunner.sh');
            if (runScript) {
                await fs.promises.writeFile(runScriptPath, runScript, 'utf-8');
                try {
                    await fs.promises.chmod(runScriptPath, '755');
                } catch (e) {
                    console.error(`Failed to set executable permission on ${runScriptPath}`, e);
                }
            }

            const runDataflowScriptPath = path.join(folderPath, 'run_dataflow.sh');
            if (runDataflowScript) {
                await fs.promises.writeFile(runDataflowScriptPath, runDataflowScript, 'utf-8');
                try {
                    await fs.promises.chmod(runDataflowScriptPath, '755');
                } catch (e) {
                    console.error(`Failed to set executable permission on ${runDataflowScriptPath}`, e);
                }
            }

            const ignorePath = path.join(folderPath, '.dockerignore');
            if (dockerIgnore) {
                await fs.promises.writeFile(ignorePath, dockerIgnore, 'utf-8');
            }

            const gcloudIgnorePath = path.join(folderPath, '.gcloudignore');
            if (gcloudIgnore) {
                await fs.promises.writeFile(gcloudIgnorePath, gcloudIgnore, 'utf-8');
            }
        }
    }
}

/**
 * BeamEditorProvider
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Custom Text Editor provider for `.beam` visual pipeline design files in VS Code.
 * Coordinates bidirectional IPC message passing between the React Webview canvas
 * and host CLI tools (gcloud, bq), filesystem persistence, and Gemini code generation.
 * 
 * Architectural Decisions:
 * - Implements vscode.CustomTextEditorProvider for .beam YAML file synchronization.
 * - Handles CLI queries (BigQuery datasets/tables, PubSub topics/subscriptions, Secret Manager secrets, VPC networks/subnetworks).
 * - Dispatches 'getSecrets' via gcloud secrets list to support safe credential selection for streaming nodes like KinesisIO.
 * - Dispatches Gemini code generation requests and writes structured pipeline artifacts to disk.
 */
export class BeamEditorProvider implements vscode.CustomTextEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) { }

    /**
     * Resolves the custom text editor for a `.beam` document.
     * Initializes webview options, Content-Security-Policy (CSP) headers, asset URI resolution,
     * and bidirectional message handling between webview and extension host.
     * 
     * @param document The backing VS Code TextDocument.
     * @param webviewPanel The webview panel representing the editor.
     * @param _token Cancellation token.
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const webview = webviewPanel.webview;
        const extensionPath = this.context.extensionPath;
        const distPath = path.join(extensionPath, 'webview', 'dist');

        const htmlPath = path.join(distPath, 'index.html');
        let htmlContent = '';
        if (fs.existsSync(htmlPath)) {
            const rawHtml = fs.readFileSync(htmlPath, 'utf-8');

            // Resolve paths to webview bundle assets
            const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'index.js')));
            const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'index.css')));
            const nonce = getNonce();

            // NOTE: buildWebviewHtml injects Content-Security-Policy with script nonce and asset paths (finding M2)
            // `webview.cspSource` is non-optional in the VS Code API. It is passed through
            // unguarded on purpose: buildWebviewHtml throws on an empty value, which is far
            // easier to diagnose than a silently substituted origin that would make every
            // stylesheet and image in the panel fail to load for no visible reason.
            htmlContent = buildWebviewHtml(rawHtml, {
                jsUri: jsUri.toString(),
                cssUri: cssUri.toString(),
                cspSource: webview.cspSource,
                nonce
            });
        }

        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'webview', 'dist'))
            ]
        };

        webview.html = htmlContent;

        // M5: Track disposed state and collect subscriptions in disposables array for cleanup on panel dispose
        let isDisposed = false;
        const disposables: vscode.Disposable[] = [];

        // M4: Shared synchronization state to prevent echo loops between webview and document model
        const syncState: DocumentSyncState = {
            isApplyingEdit: false,
            lastSavedContent: null
        };

        // Dispose all registered subscriptions when the panel is closed
        webviewPanel.onDidDispose(() => {
            isDisposed = true;
            while (disposables.length > 0) {
                const item = disposables.pop();
                try {
                    item?.dispose();
                } catch (err) {
                    console.error('Error disposing webview resource:', err);
                }
            }
        });

        // Safe webview poster that drops messages once panel is disposed
        const postToWebview = createSafePostMessage(webview, () => isDisposed);

        // M4: Two-way synchronization - listen to external changes to the document and notify webview
        disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (e.document.uri.toString() === document.uri.toString()) {
                    const currentText = e.document.getText();
                    if (shouldPushDocumentUpdate(syncState.isApplyingEdit, currentText, syncState.lastSavedContent)) {
                        // NOTE: Record pushed content so identical echo changes from canvas auto-save are ignored
                        syncState.lastSavedContent = currentText;

                        let relativeFolder = '';
                        let defaultOutputFolder = '';
                        const beamFileDir = path.dirname(document.uri.fsPath);
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        if (workspaceFolder && beamFileDir.startsWith(workspaceFolder)) {
                            relativeFolder = path.relative(workspaceFolder, beamFileDir);
                        }
                        const filenameWithoutExt = path.basename(document.uri.fsPath, '.beam');
                        defaultOutputFolder = relativeFolder
                            ? path.join(relativeFolder, filenameWithoutExt)
                            : filenameWithoutExt;

                        postToWebview({
                            command: 'loadPipeline',
                            data: currentText,
                            filename: path.basename(document.uri.fsPath),
                            relativeFolder,
                            defaultOutputFolder
                        });
                    }
                }
            })
        );

        // M5: Store message listener disposable so it is cleaned up on panel dispose
        disposables.push(
            webview.onDidReceiveMessage(
                handleMessages(webview, this.context, document, undefined, undefined, () => isDisposed, syncState)
            )
        );
    }
}

/**
 * Returns the active output channel for Dataflow Designer, creating it if needed.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @returns The active vscode.OutputChannel
 */
export function getDesignerOutputChannel(): vscode.OutputChannel {
    if (!designerOutputChannel) {
        designerOutputChannel = vscode.window.createOutputChannel('Dataflow Designer');
    }
    return designerOutputChannel;
}

/**
 * Context object holding dependencies and shared state passed to IPC message handlers.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
export interface MessageContext {
    context: vscode.ExtensionContext;
    document?: vscode.TextDocument;
    uri?: vscode.Uri;
    webview: vscode.Webview;
    postToWebview: (msg: any) => boolean | Promise<boolean>;
    syncState?: DocumentSyncState;
    pipelineName?: string;
    outputChannel?: vscode.OutputChannel;
}

/**
 * Handler function signature for webview IPC message dispatching.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
export type MessageHandler = (ctx: MessageContext, message: any) => Promise<void> | void;

/**
 * Handler for 'getDatasets' command.
 * Fetches BigQuery datasets via CLI and posts results to webview.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetDatasets(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'bq',
        ['ls', '--format=json'],
        (json: any) => (Array.isArray(json) ? json.map((d: any) => d.datasetReference?.datasetId).filter(Boolean) : []),
        'datasetsLoaded',
        'datasets',
        ctx.postToWebview,
        (json: any) => ({
            projectId: Array.isArray(json) && json.length > 0 && json[0]?.datasetReference?.projectId
                ? json[0].datasetReference.projectId
                : 'DEFAULT_PROJECT'
        })
    );
}

/**
 * Handler for 'getTables' command.
 * Validates dataset identifier and fetches BigQuery tables via CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message with dataset name
 */
export async function handleGetTables(ctx: MessageContext, message: any): Promise<void> {
    if (!message.dataset || typeof message.dataset !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(message.dataset)) {
        const invalidErr = `Invalid or missing dataset identifier: '${message.dataset}'`;
        console.error('[@extension.ts]', invalidErr);
        ctx.postToWebview({ command: 'tablesLoaded', tables: [], error: invalidErr, debugLog: invalidErr });
        return;
    }
    await listAssets(
        'bq',
        ['ls', '--format=json', message.dataset],
        (json: any) => (Array.isArray(json) ? json.map((t: any) => t.tableReference?.tableId).filter(Boolean) : []),
        'tablesLoaded',
        'tables',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getTopics' command.
 * Fetches Pub/Sub topics via gcloud CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetTopics(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'gcloud',
        ['pubsub', 'topics', 'list', '--format=json'],
        (json: any) => (Array.isArray(json) ? json.map((t: any) => t.name).filter(Boolean) : []),
        'topicsLoaded',
        'topics',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getSubscriptions' command.
 * Fetches Pub/Sub subscriptions via gcloud CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetSubscriptions(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'gcloud',
        ['pubsub', 'subscriptions', 'list', '--format=json'],
        (json: any) => (Array.isArray(json) ? json.map((s: any) => s.name).filter(Boolean) : []),
        'subscriptionsLoaded',
        'subscriptions',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getNetworks' command.
 * Fetches Google Cloud VPC networks via gcloud CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetNetworks(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'gcloud',
        ['compute', 'networks', 'list', '--format=json'],
        (json: any) => (Array.isArray(json) ? json.map((n: any) => ({ name: n.name, value: n.name })) : []),
        'networksLoaded',
        'networks',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getSubnetworks' command.
 * Fetches Google Cloud subnets via gcloud CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetSubnetworks(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'gcloud',
        ['compute', 'networks', 'subnets', 'list', '--format=json'],
        (json: any) => (Array.isArray(json) ? json.map((s: any) => {
            const regionParts = (s.region || '').split('/');
            const region = regionParts[regionParts.length - 1];
            const networkParts = (s.network || '').split('/');
            const network = networkParts[networkParts.length - 1];
            return {
                name: s.name,
                region: region,
                network: network,
                value: `regions/${region}/subnetworks/${s.name}`
            };
        }) : []),
        'subnetworksLoaded',
        'subnetworks',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getStorageBuckets' command.
 * Fetches Cloud Storage buckets via gcloud CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetStorageBuckets(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'gcloud',
        ['storage', 'buckets', 'list', '--format=json'],
        (json: any) => (Array.isArray(json) ? json.map((b: any) => {
            const name = b.name || b.id || '';
            return name.replace(/^gs:\/\//, '').replace(/\/$/, '');
        }).filter((b: string) => b.length > 0) : []),
        'storageBucketsLoaded',
        'buckets',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getSecrets' command.
 * Fetches Secret Manager secrets via gcloud CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetSecrets(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'gcloud',
        ['secrets', 'list', '--format=json'],
        // NOTE: delegate to the shared, unit-tested mapper rather than inlining
        // the mapping here -- see mapSecretManagerItems for why (finding M1).
        mapSecretManagerItems,
        'secretsLoaded',
        'secrets',
        ctx.postToWebview
    );
}

/**
 * Maps parsed JSON output from `gcloud healthcare datasets list --format=json`
 * into an array of Cloud Healthcare dataset resource names
 * (e.g. `projects/{project_id}/locations/{location_id}/datasets/{dataset_id}`).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param json Parsed JSON array from gcloud healthcare datasets list
 * @returns Array of non-empty dataset resource name strings
 */
export function mapHealthcareDatasetItems(json: any): string[] {
    if (!Array.isArray(json)) {
        return [];
    }
    return json
        .map((d: any) => (typeof d?.name === 'string' ? d.name.trim() : ''))
        .filter((name: string) => name.length > 0);
}

/**
 * Handler for 'getHealthcareDatasets' command.
 * Fetches Google Cloud Healthcare API datasets via `gcloud healthcare datasets list --format=json`.
 * Supports an optional validated `location` filter parameter.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message containing optional `location`
 */
export async function handleGetHealthcareDatasets(ctx: MessageContext, message: any): Promise<void> {
    const rawLocation = typeof message?.location === 'string' ? message.location.trim() : '';
    const validLocation = /^[a-zA-Z0-9-]+$/.test(rawLocation) ? rawLocation : '';
    await listAssets(
        'gcloud',
        [
            'healthcare',
            'datasets',
            'list',
            ...(validLocation ? [`--location=${validLocation}`] : []),
            '--format=json'
        ],
        mapHealthcareDatasetItems,
        'healthcareDatasetsLoaded',
        'datasets',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getAwsQueues' command.
 * Fetches AWS SQS queues via AWS CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetAwsQueues(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'aws',
        ['sqs', 'list-queues', '--output', 'json'],
        (json: any) => (Array.isArray(json?.QueueUrls) ? json.QueueUrls : []),
        'awsQueuesLoaded',
        'queues',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getComputeInstances' command.
 * Fetches Compute Engine VM instances via gcloud CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetComputeInstances(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'gcloud',
        ['compute', 'instances', 'list', '--format=json'],
        (json: any) => (Array.isArray(json) ? json.map((inst: any) => {
            const internalIp = inst.networkInterfaces?.[0]?.networkIP || '';
            const externalIp = inst.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || '';
            const zoneParts = (inst.zone || '').split('/');
            const zone = zoneParts[zoneParts.length - 1];
            return {
                name: inst.name,
                status: inst.status,
                zone: zone,
                internalIp: internalIp,
                externalIp: externalIp
            };
        }) : []),
        'computeInstancesLoaded',
        'instances',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getBigtableInstances' command.
 * Fetches Cloud Bigtable instances via gcloud CLI and returns their short instance IDs.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetBigtableInstances(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'gcloud',
        ['bigtable', 'instances', 'list', '--format=json'],
        mapBigtableInstances,
        'bigtableInstancesLoaded',
        'bigtableInstances',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getBigtableTables' command.
 * Validates the Bigtable instance identifier and fetches its tables via gcloud CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message with `instance` (short ID or projects/{p}/instances/{i})
 */
export async function handleGetBigtableTables(ctx: MessageContext, message: any): Promise<void> {
    const parsed = parseBigtableInstanceParam(message?.instance);
    if (!parsed) {
        const invalidErr = `Invalid or missing Bigtable instance identifier: '${message?.instance}'`;
        console.error('[@extension.ts]', invalidErr);
        ctx.postToWebview({ command: 'bigtableTablesLoaded', bigtableTables: [], error: invalidErr, debugLog: invalidErr });
        return;
    }
    const args = ['bigtable', 'instances', 'tables', 'list', `--instances=${parsed.instance}`, '--format=json'];
    if (parsed.project) {
        args.push(`--project=${parsed.project}`);
    }
    await listAssets('gcloud', args, mapBigtableTables, 'bigtableTablesLoaded', 'bigtableTables', ctx.postToWebview);
}

/**
 * Handler for 'getSqlInstances' command.
 * Fetches Cloud SQL instances via gcloud CLI and returns their instance connection names.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetSqlInstances(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'gcloud',
        ['sql', 'instances', 'list', '--format=json'],
        mapSqlInstances,
        'sqlInstancesLoaded',
        'sqlInstances',
        ctx.postToWebview
    );
}

/**
 * Handler for 'getSqlDatabases' command.
 * Validates the Cloud SQL instance identifier and fetches its databases via gcloud CLI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message with `instance` (instance name or connection name)
 */
export async function handleGetSqlDatabases(ctx: MessageContext, message: any): Promise<void> {
    const parsed = parseSqlInstanceParam(message?.instance);
    if (!parsed) {
        const invalidErr = `Invalid or missing Cloud SQL instance identifier: '${message?.instance}'`;
        console.error('[@extension.ts]', invalidErr);
        ctx.postToWebview({ command: 'sqlDatabasesLoaded', sqlDatabases: [], error: invalidErr, debugLog: invalidErr });
        return;
    }
    const args = ['sql', 'databases', 'list', `--instance=${parsed.instance}`, '--format=json'];
    if (parsed.project) {
        args.push(`--project=${parsed.project}`);
    }
    await listAssets('gcloud', args, mapSqlDatabases, 'sqlDatabasesLoaded', 'sqlDatabases', ctx.postToWebview);
}

/**
 * Handler for 'getProjects' command.
 * Fetches accessible Google Cloud projects via gcloud CLI and returns their project IDs.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetProjects(ctx: MessageContext, _message: any): Promise<void> {
    await listAssets(
        'gcloud',
        ['projects', 'list', '--format=json'],
        mapProjects,
        'projectsLoaded',
        'projects',
        ctx.postToWebview
    );
}

/**
 * Handler for 'ready' command.
 * Initializes the designer webview with samples, project ID, and pipeline data.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleReady(ctx: MessageContext, _message: any): Promise<void> {
    const gcloudProjectId = (await getGcloudProject()) || 'YOUR_PROJECT_ID';

    // Send loaded samples to webview
    const samplePipelines = await getSamplePipelines(ctx.context);
    ctx.postToWebview({
        command: 'samplesLoaded',
        samples: samplePipelines
    });

    const activeUri = ctx.document ? ctx.document.uri : ctx.uri;
    let relativeFolder = '';
    let defaultOutputFolder = '';
    if (activeUri) {
        const beamFileDir = path.dirname(activeUri.fsPath);
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder && beamFileDir.startsWith(workspaceFolder)) {
            relativeFolder = path.relative(workspaceFolder, beamFileDir);
        }
        const filenameWithoutExt = path.basename(activeUri.fsPath, '.beam');
        defaultOutputFolder = relativeFolder ? path.join(relativeFolder, filenameWithoutExt) : filenameWithoutExt;
    }

    if (ctx.document) {
        if (ctx.syncState) {
            ctx.syncState.lastSavedContent = ctx.document.getText();
        }
        ctx.postToWebview({
            command: 'loadPipeline',
            data: ctx.document.getText(),
            filename: path.basename(ctx.document.uri.fsPath),
            projectId: gcloudProjectId,
            relativeFolder: relativeFolder,
            defaultOutputFolder: defaultOutputFolder
        });
    } else if (ctx.uri && fs.existsSync(ctx.uri.fsPath)) {
        const content = fs.readFileSync(ctx.uri.fsPath, 'utf-8');
        ctx.postToWebview({
            command: 'loadPipeline',
            data: content,
            filename: ctx.pipelineName,
            projectId: gcloudProjectId,
            relativeFolder: relativeFolder,
            defaultOutputFolder: defaultOutputFolder
        });
    } else {
        ctx.postToWebview({
            command: 'loadPipeline',
            data: null,
            filename: ctx.pipelineName,
            projectId: gcloudProjectId,
            relativeFolder: relativeFolder,
            defaultOutputFolder: defaultOutputFolder
        });
    }
}

/**
 * Handler for 'getSamples' command.
 * Fetches sample pipelines and posts them to the webview.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetSamples(ctx: MessageContext, _message: any): Promise<void> {
    const requestedSamples = await getSamplePipelines(ctx.context);
    ctx.postToWebview({
        command: 'samplesLoaded',
        samples: requestedSamples
    });
}

/**
 * Handler for 'openSample' command.
 * Prompts user to save sample pipeline to disk and opens it in the custom beam editor.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message with sample content or filename
 */
export async function handleOpenSample(ctx: MessageContext, message: any): Promise<void> {
    let sampleContent = message.content;
    let sampleFilename = message.filename || 'sample-pipeline.beam';
    if (!sampleFilename.endsWith('.beam')) {
        sampleFilename += '.beam';
    }

    if (!sampleContent && message.filename) {
        const available = await getSamplePipelines(ctx.context);
        const found = available.find(s => s.filename === message.filename);
        if (found) {
            sampleContent = found.content;
        }
    }

    if (sampleContent) {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            let defaultUri: vscode.Uri | undefined;
            if (workspaceFolder) {
                let candidateName = sampleFilename;
                let counter = 1;
                const nameWithoutExt = candidateName.replace(/\.beam$/, '');
                while (fs.existsSync(path.join(workspaceFolder, candidateName))) {
                    candidateName = `${nameWithoutExt}-${counter}.beam`;
                    counter++;
                }
                defaultUri = vscode.Uri.file(path.join(workspaceFolder, candidateName));
            }

            // Pop up the Save dialog automatically for the user with .beam filter
            const fileUri = await vscode.window.showSaveDialog({
                defaultUri,
                title: 'Save Sample Pipeline',
                filters: { 'Beam Pipeline': ['beam'] }
            });

            if (!fileUri) {
                return; // User cancelled the save dialog
            }

            // Write sample pipeline content to selected location
            fs.writeFileSync(fileUri.fsPath, sampleContent, 'utf-8');

            // Refresh tree explorer and open in the visual custom beam editor
            vscode.commands.executeCommand('dataflow-pipeline-builder.refreshPipelines');
            await vscode.commands.executeCommand('vscode.openWith', fileUri, BEAM_EDITOR_VIEW_TYPE);
        } catch (err: any) {
            console.error('Failed to save and open sample pipeline:', err);
            vscode.window.showErrorMessage(`Failed to open sample pipeline: ${err.message}`);
        }
    }
}

/**
 * Handler for 'savePipeline' command.
 * Prompts for location if untitled, saves pipeline files, and refreshes pipeline tree.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message with pipeline code and configuration
 */
export async function handleSavePipeline(ctx: MessageContext, message: any): Promise<void> {
    let targetUri = ctx.document ? ctx.document.uri : ctx.uri;
    if (!targetUri || targetUri.scheme === 'untitled') {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        let defaultUri: vscode.Uri | undefined;
        if (workspaceFolder) {
            let candidateName = 'pipeline.beam';
            let counter = 1;
            while (fs.existsSync(path.join(workspaceFolder, candidateName))) {
                candidateName = `pipeline-${counter}.beam`;
                counter++;
            }
            defaultUri = vscode.Uri.file(path.join(workspaceFolder, candidateName));
        }
        const chosenUri = await vscode.window.showSaveDialog({
            defaultUri,
            title: 'Save Apache Beam Pipeline',
            filters: { 'Beam Pipeline': ['beam'] }
        });
        if (!chosenUri) {
            return;
        }
        targetUri = chosenUri;
    }

    await savePipelineFiles(
        targetUri,
        message.data,
        message.code,
        message.fileExtension,
        message.outputFolder,
        message.requirements,
        message.dockerfile,
        message.runScript,
        message.runDataflowScript,
        message.dockerIgnore,
        message.gcloudIgnore,
        ctx.syncState
    );
    vscode.window.setStatusBarMessage(`Saved ${path.basename(targetUri.fsPath)} and generated files`, 2000);
    vscode.commands.executeCommand('dataflow-pipeline-builder.refreshPipelines');
}

/**
 * Handler for 'pickFolder' command.
 * Opens folder chooser dialog and reports selected folder path to webview.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handlePickFolder(ctx: MessageContext, _message: any): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: 'Select Output Folder'
    });
    if (uris && uris.length > 0) {
        let selectedPath = uris[0].fsPath;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder && selectedPath.startsWith(workspaceFolder)) {
            selectedPath = path.relative(workspaceFolder, selectedPath);
        }
        ctx.postToWebview({
            command: 'folderSelected',
            path: selectedPath
        });
    }
}

/**
 * Handler for 'readFolderFiles' command.
 * Traverses files in output folder recursively and posts file list to webview.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message with optional folderPath
 */
export async function handleReadFolderFiles(ctx: MessageContext, message: any): Promise<void> {
    let folderPath = message.folderPath;
    const activeUriForFolder = ctx.document ? ctx.document.uri : ctx.uri;
    if (!folderPath && activeUriForFolder) {
        const baseName = path.basename(activeUriForFolder.fsPath, '.beam');
        folderPath = path.join(path.dirname(activeUriForFolder.fsPath), baseName);
    } else if (folderPath && !path.isAbsolute(folderPath)) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder) {
            folderPath = path.join(workspaceFolder, folderPath);
        }
    }
    // NOTE: inherently TOCTOU directory check
    const folderExists = folderPath
        ? await fs.promises.stat(folderPath).then(s => s.isDirectory()).catch(() => false)
        : false;
    if (folderPath && folderExists) {
        try {
            const excludedDirs = new Set(GENERATED_FILE_LIST_EXCLUDE_DIRS);
            const getFilesRecursively = async (dir: string, baseDir: string = dir): Promise<string[]> => {
                let results: string[] = [];
                const list = await fs.promises.readdir(dir);
                for (const item of list) {
                    if (item.startsWith('.')) continue;
                    const fullPath = path.join(dir, item);
                    const stat = await fs.promises.stat(fullPath);
                    if (stat.isDirectory()) {
                        // Skip dependency and build directories. Running a generated Python
                        // pipeline creates `venv/` (thousands of files) and Maven creates
                        // `target/`; without this the Source Code tab lists those instead of
                        // the handful of files the generator actually produced.
                        if (excludedDirs.has(item)) continue;
                        const nested = await getFilesRecursively(fullPath, baseDir);
                        results = results.concat(nested);
                    } else if (stat.isFile()) {
                        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                        results.push(relPath);
                    }
                }
                return results;
            };
            const files = await getFilesRecursively(folderPath);
            let tokenUsage: { inputTokens: number; outputTokens: number; totalTokens?: number } | undefined;
            try {
                const logFilePath = path.join(folderPath, 'gemini.log');
                if (fs.existsSync(logFilePath)) {
                    const logContent = JSON.parse(await fs.promises.readFile(logFilePath, 'utf-8'));
                    if (logContent && logContent.tokenUsage && typeof logContent.tokenUsage === 'object' && logContent.tokenUsage !== 'Unavailable') {
                        tokenUsage = {
                            inputTokens: Number(logContent.tokenUsage.inputTokens) || 0,
                            outputTokens: Number(logContent.tokenUsage.outputTokens) || 0,
                            totalTokens: Number(logContent.tokenUsage.totalTokens) || 0,
                        };
                    }
                }
            } catch {
                // Ignore missing or corrupt gemini.log
            }
            ctx.postToWebview({
                command: 'folderFilesRead',
                files: files,
                folderPath: folderPath,
                tokenUsage: tokenUsage
            });
        } catch (e) {
            console.error('Failed to read folder files', e);
            ctx.postToWebview({
                command: 'folderFilesRead',
                files: [],
                folderPath: folderPath
            });
        }
    } else {
        ctx.postToWebview({
            command: 'folderFilesRead',
            files: [],
            folderPath: folderPath
        });
    }
}

/**
 * Handler for 'readFileContent' command.
 * Reads contents of a specified file within folder boundary and posts to webview.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message with folderPath and filePath
 */
export async function handleReadFileContent(ctx: MessageContext, message: any): Promise<void> {
    let readFolder = message.folderPath;

    const activeUriForRead = ctx.document ? ctx.document.uri : ctx.uri;
    if (!readFolder && activeUriForRead) {
        const baseName = path.basename(activeUriForRead.fsPath, '.beam');
        readFolder = path.join(path.dirname(activeUriForRead.fsPath), baseName);
    } else if (readFolder && !path.isAbsolute(readFolder)) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder) {
            readFolder = path.join(workspaceFolder, readFolder);
        }
    }

    if (readFolder && message.filePath && typeof message.filePath === 'string') {
        const resolvedReadFolder = path.resolve(readFolder);
        const fullFilePath = path.resolve(
            path.isAbsolute(message.filePath)
                ? message.filePath
                : path.join(resolvedReadFolder, message.filePath)
        );

        const relativePath = path.relative(resolvedReadFolder, fullFilePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            console.error(`Blocked attempt to read file outside folder: ${fullFilePath}`);
            return;
        }

        // NOTE: inherently TOCTOU existence check
        const fileExists = await fs.promises.stat(fullFilePath).then(s => s.isFile()).catch(() => false);
        if (fileExists) {
            try {
                const content = await fs.promises.readFile(fullFilePath, 'utf-8');
                ctx.postToWebview({
                    command: 'fileContentLoaded',
                    filePath: message.filePath,
                    content: content
                });
            } catch (e) {
                console.error('Failed to read file content', e);
            }
        }
    }
}

/**
 * Handler for 'showOutputChannel' command.
 * Reveals the extension output channel and logs the webview request.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export function handleShowOutputChannel(ctx: MessageContext, _message: any): void {
    const channel = ctx.outputChannel || getDesignerOutputChannel();
    channel.show(true);
    channel.appendLine(`[${new Date().toLocaleTimeString()}] Log channel requested from Webview.`);
}

/**
 * Handler for 'getRunningJobs' command.
 * Queries active Dataflow jobs via gcloud CLI and posts results to webview.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message with optional projectId and region
 */
export async function handleGetRunningJobs(ctx: MessageContext, message: any): Promise<void> {
    const channel = ctx.outputChannel || getDesignerOutputChannel();
    channel.show(true);

    let targetProject = message.projectId;
    if (!targetProject || targetProject === 'YOUR_PROJECT_ID') {
        channel.appendLine(`[${new Date().toLocaleTimeString()}] Resolving active project from gcloud...`);
        targetProject = await getGcloudProject();
    }
    const targetRegion = message.region || 'us-central1';
    const gcloudBin = findGcloudPath();
    const gcloudArgs = ['dataflow', 'jobs', 'list', '--status=all', '--format=json'];

    if (targetRegion && targetRegion !== 'ALL') {
        gcloudArgs.push(`--region=${targetRegion}`);
    }
    if (targetProject && targetProject !== 'YOUR_PROJECT_ID') {
        gcloudArgs.push(`--project=${targetProject}`);
    }

    const logMsg = `[${new Date().toLocaleTimeString()}] Executing CLI: ${gcloudBin} ${gcloudArgs.join(' ')}`;
    console.log('[@extension.ts]', logMsg);
    channel.appendLine(logMsg);

    execFile(gcloudBin, gcloudArgs, { timeout: 15000, maxBuffer: 1024 * 1024 * 10 }, (err: any, stdout: string, stderr: string) => {
        if (err) {
            const errText = `Failed to list Dataflow jobs via gcloud: ${err.message}. Stderr: ${stderr || 'none'}`;
            console.error('[@extension.ts]', errText);
            channel.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${errText}`);

            const errMsg = err.killed ? 'Request timed out waiting for gcloud CLI response. Try selecting a specific region.' : (stderr || err.message);
            ctx.postToWebview({
                command: 'runningJobsLoaded',
                jobs: [],
                error: `Failed to query Dataflow jobs: ${errMsg}`,
                debugLog: `Command: ${gcloudBin} ${gcloudArgs.join(' ')}\nError: ${err.message}\nStderr: ${stderr || ''}`
            });
            return;
        }
        try {
            const successMsg = `gcloud jobs retrieved successfully. Output size: ${(stdout || '').length} bytes.`;
            console.log('[@extension.ts]', successMsg);
            channel.appendLine(`[${new Date().toLocaleTimeString()}] SUCCESS: ${successMsg}`);
            channel.appendLine(stdout || '[]');

            const parsedJobs = JSON.parse(stdout || '[]');
            ctx.postToWebview({
                command: 'runningJobsLoaded',
                jobs: Array.isArray(parsedJobs) ? parsedJobs : [],
                projectId: targetProject,
                debugLog: `Command: ${gcloudBin} ${gcloudArgs.join(' ')}\nRetrieved ${parsedJobs.length} jobs.`
            });
        } catch (e: any) {
            const parseErrMsg = `Failed to parse gcloud JSON output: ${e.message}`;
            console.error('[@extension.ts]', parseErrMsg);
            channel.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${parseErrMsg}`);

            ctx.postToWebview({
                command: 'runningJobsLoaded',
                jobs: [],
                error: parseErrMsg,
                debugLog: `Command: ${gcloudBin} ${gcloudArgs.join(' ')}\nOutput: ${stdout}`
            });
        }
    });
}

/**
 * Handler for 'openExternal' command.
 * Opens an external URL in the system browser.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param _ctx Message context (unused)
 * @param message Incoming IPC message containing target URL
 */
export function handleOpenExternal(_ctx: MessageContext, message: any): void {
    if (message.url) {
        try {
            vscode.env.openExternal(vscode.Uri.parse(message.url));
        } catch (e) {
            console.error('Failed to open URL', e);
        }
    }
}
let activeExecutionProcess: ChildProcess | null = null;
let activeGenerationCts: vscode.CancellationTokenSource | null = null;
/**
 * Executes a pipeline script as a child process and streams real-time stdout/stderr
 * logs and detected job IDs to the webview and output channel.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message with pipeline and runner configuration
 */
export async function handleRunPipeline(ctx: MessageContext, message: any): Promise<void> {
    const runUri = ctx.document ? ctx.document.uri : ctx.uri;
    if (runUri) {
        const pipelineBaseName = path.basename(runUri.fsPath, '.beam');
        let folderPath = path.join(path.dirname(runUri.fsPath), pipelineBaseName);
        const outputFolder = message.pipelineConfig?.outputFolder;
        if (outputFolder && outputFolder.trim()) {
            if (!isSafeFolderPath(outputFolder)) {
                vscode.window.showErrorMessage(`Invalid output folder "${outputFolder}": contains unsafe shell characters.`);
                return;
            }
            if (path.isAbsolute(outputFolder)) {
                folderPath = outputFolder;
            } else {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (workspaceFolder) {
                    folderPath = path.join(workspaceFolder, outputFolder);
                }
            }
        }

        if (!isSafeFolderPath(folderPath)) {
            vscode.window.showErrorMessage(`Invalid pipeline folder path "${folderPath}": contains unsafe shell characters.`);
            return;
        }

        const runner = message.jobConfig?.runner || 'DirectRunner';
        let scriptName = '';
        let possibleNames: string[] = [];

        if (runner === 'DirectRunner') {
            possibleNames = ['run_directrunner.sh'];
        } else if (runner === 'Dataflow') {
            possibleNames = ['run_dataflowrunner.sh', 'run_dataflow.sh'];
        } else if (runner === 'Spark') {
            possibleNames = ['run_sparkrunner.sh', 'run_spark.sh'];
        }

        let scriptExists = false;
        for (const name of possibleNames) {
            const scriptPath = path.join(folderPath, name);
            if (fs.existsSync(scriptPath)) {
                scriptName = name;
                scriptExists = true;
                break;
            }
        }

        if (scriptExists) {
            if (!isAllowedExecutableScript(scriptName)) {
                vscode.window.showErrorMessage(`Unauthorized runner script: ${scriptName}`);
                return;
            }

            try {
                // If a process is already running, terminate it before starting a new run
                if (activeExecutionProcess) {
                    try {
                        if (activeExecutionProcess.pid && process.platform !== 'win32') {
                            try { process.kill(-activeExecutionProcess.pid, 'SIGINT'); } catch (e) { activeExecutionProcess.kill('SIGINT'); }
                        } else {
                            activeExecutionProcess.kill('SIGINT');
                        }
                    } catch (e) {
                        try { activeExecutionProcess.kill('SIGINT'); } catch (err) {
                            // Process might have already terminated
                        }
                    }
                    activeExecutionProcess = null;
                }

                const scriptFullPath = path.join(folderPath, scriptName);
                try {
                    fs.chmodSync(scriptFullPath, '755');
                } catch (e) {
                    // Best effort file permission update, continue execution
                }

                let runnerDesc = runner === 'DirectRunner'
                    ? '# Using Python / Java Direct Runner (Local Machine)'
                    : runner === 'Dataflow'
                        ? '# Submitting Apache Beam Flex Template Job to Google Cloud Dataflow'
                        : '# Submitting Apache Beam Job to Serverless Spark (Dataproc)';
                const commandLine = `${runnerDesc}\ncd "${folderPath}" && bash ./${scriptName}`;

                ctx.postToWebview({
                    command: 'pipelineStarted',
                    runner: runner,
                    commandLine: commandLine,
                    folderPath: folderPath
                });

                const channel = ctx.outputChannel || getDesignerOutputChannel();
                channel.appendLine(`\n[${new Date().toLocaleTimeString()}] Starting pipeline execution with ${runner}:`);
                channel.appendLine(`Command: cd "${folderPath}" && bash ./${scriptName}`);

                const extraPathDirs = [
                    '/opt/homebrew/bin',
                    '/opt/homebrew/sbin',
                    '/usr/local/bin',
                    '/usr/bin',
                    '/bin',
                    '/usr/sbin',
                    '/sbin',
                    path.join(process.env.HOME || '', 'Development/libraries/google-cloud-sdk/bin'),
                    path.join(process.env.HOME || '', 'google-cloud-sdk/bin'),
                    path.join(process.env.HOME || '', '.local/bin'),
                    path.join(process.env.HOME || '', '.pyenv/shims'),
                    path.join(process.env.HOME || '', '.sdkman/candidates/maven/current/bin'),
                    path.join(process.env.HOME || '', '.sdkman/candidates/java/current/bin')
                ];
                const existingPaths = (process.env.PATH || '').split(path.delimiter);
                const mergedPaths = Array.from(new Set([...extraPathDirs.filter(d => fs.existsSync(d)), ...existingPaths]));

                const customEnv: Record<string, string> = {
                    ...process.env as Record<string, string>,
                    PATH: mergedPaths.join(path.delimiter),
                    PYTHONUNBUFFERED: '1',
                    FORCE_COLOR: '0'
                };

                if (message.runtimeVariables && Array.isArray(message.runtimeVariables)) {
                    for (const v of message.runtimeVariables) {
                        if (v.key && v.key.trim()) {
                            customEnv[v.key.trim()] = v.value || '';
                        }
                    }
                }
                if (message.jobConfig) {
                    if (message.jobConfig.gcsStagingPath) {
                        customEnv['GCS_STAGING_PATH'] = message.jobConfig.gcsStagingPath;
                    }
                    if (message.jobConfig.subnetwork) {
                        customEnv['SUBNETWORK'] = message.jobConfig.subnetwork;
                    }
                }

                const isWindows = process.platform === 'win32';
                const spawnCmd = isWindows ? scriptFullPath : 'bash';
                const spawnArgs = isWindows ? [] : [scriptFullPath];

                const child = spawn(spawnCmd, spawnArgs, {
                    cwd: folderPath,
                    env: customEnv,
                    detached: !isWindows
                });
                activeExecutionProcess = child;

                let detectedJobId: string | null = null;
                let targetProject = message.jobConfig?.projectId || 'YOUR_PROJECT_ID';
                const targetRegion = message.jobConfig?.region || 'us-central1';

                getGcloudProject().then(proj => {
                    if (proj) {
                        targetProject = proj;
                    }
                }).catch(() => {});

                const checkForJobId = (chunkStr: string) => {
                    if (detectedJobId) return;

                    const dataflowMatch = chunkStr.match(/(?:id:\s*['"]?|Submitted job:\s*|\b)([0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9a-zA-Z_-]{10,})/i);
                    if (dataflowMatch && dataflowMatch[1]) {
                        detectedJobId = dataflowMatch[1];
                        channel.appendLine(`[${new Date().toLocaleTimeString()}] Detected Dataflow Job ID: ${detectedJobId}`);
                        ctx.postToWebview({
                            command: 'pipelineJobIdDetected',
                            jobId: detectedJobId,
                            runner: 'Dataflow',
                            projectId: targetProject,
                            region: targetRegion
                        });
                        return;
                    }

                    const sparkMatch = chunkStr.match(/(?:batches\/|Batch\s*\[|Batch ID:\s*)([a-zA-Z0-9_-]{4,})/i);
                    if (sparkMatch && sparkMatch[1] && !['created', 'running', 'pending', 'failed'].includes(sparkMatch[1].toLowerCase())) {
                        detectedJobId = sparkMatch[1];
                        channel.appendLine(`[${new Date().toLocaleTimeString()}] Detected Spark Batch ID: ${detectedJobId}`);
                        ctx.postToWebview({
                            command: 'pipelineJobIdDetected',
                            jobId: detectedJobId,
                            runner: 'Spark',
                            projectId: targetProject,
                            region: targetRegion
                        });
                    }
                };

                child.stdout?.on('data', (data: Buffer | string) => {
                    const text = data.toString();
                    channel.append(text);
                    ctx.postToWebview({
                        command: 'pipelineLog',
                        text: text,
                        stream: 'stdout'
                    });
                    checkForJobId(text);
                });

                child.stderr?.on('data', (data: Buffer | string) => {
                    const text = data.toString();
                    channel.append(text);
                    ctx.postToWebview({
                        command: 'pipelineLog',
                        text: text,
                        stream: 'stderr'
                    });
                    checkForJobId(text);
                });

                child.on('error', (err: any) => {
                    const errText = `\n[Process execution error: ${err.message}]\n`;
                    channel.appendLine(errText);
                    ctx.postToWebview({
                        command: 'pipelineLog',
                        text: errText,
                        stream: 'stderr'
                    });
                    ctx.postToWebview({
                        command: 'pipelineFinished',
                        exitCode: 1,
                        status: 'failed'
                    });
                    if (activeExecutionProcess === child) {
                        activeExecutionProcess = null;
                    }
                });

                child.on('close', (code: number | null, signal: string | null) => {
                    const status = (code === 0) ? 'completed' : (signal ? 'stopped' : 'failed');
                    const finishText = `\n[Execution ${status} (exit code: ${code ?? 0}${signal ? `, signal: ${signal}` : ''})]\n`;
                    channel.appendLine(finishText);
                    ctx.postToWebview({
                        command: 'pipelineLog',
                        text: finishText,
                        stream: 'stdout'
                    });
                    ctx.postToWebview({
                        command: 'pipelineFinished',
                        exitCode: code ?? 0,
                        status: status
                    });
                    if (activeExecutionProcess === child) {
                        activeExecutionProcess = null;
                    }
                });

            } catch (e: any) {
                console.error('Failed to spawn runner process', e);
                vscode.window.showErrorMessage(`Failed to execute runner process: ${e.message}`);
                ctx.postToWebview({
                    command: 'pipelineLog',
                    text: `\nFailed to start runner process: ${e.message}\n`,
                    stream: 'stderr'
                });
                ctx.postToWebview({
                    command: 'pipelineFinished',
                    exitCode: 1,
                    status: 'failed'
                });
            }
        } else {
            const namesStr = possibleNames.join(' or ');
            const notFoundMsg = `Runner script not found (${namesStr}) in ${folderPath}. Please save and/or generate code first.`;
            vscode.window.showErrorMessage(notFoundMsg);
            ctx.postToWebview({
                command: 'pipelineLog',
                text: `[Error]: ${notFoundMsg}\n`,
                stream: 'stderr'
            });
            ctx.postToWebview({
                command: 'pipelineFinished',
                exitCode: 1,
                status: 'failed'
            });
        }
    } else {
        vscode.window.showErrorMessage("Please save the pipeline first to run it.");
    }
}

/**
 * Terminates an active background pipeline execution process.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message
 */
export async function handleStopPipeline(ctx: MessageContext, _message: any): Promise<void> {
    if (activeExecutionProcess) {
        const procToKill = activeExecutionProcess;
        activeExecutionProcess = null;
        try {
            if (procToKill.pid && process.platform !== 'win32') {
                try { process.kill(-procToKill.pid, 'SIGINT'); } catch (e) { procToKill.kill('SIGINT'); }
            } else {
                procToKill.kill('SIGINT');
            }
            setTimeout(() => {
                try {
                    if (procToKill.pid && process.platform !== 'win32') {
                        process.kill(-procToKill.pid, 'SIGKILL');
                    }
                } catch (e) {
                    // Process already exited before SIGKILL timeout
                }
            }, 2000);
        } catch (e) {
            try { procToKill.kill('SIGINT'); } catch (err) {
                // Ignore process already dead error
            }
        }
        const channel = ctx.outputChannel || getDesignerOutputChannel();
        channel.appendLine(`[${new Date().toLocaleTimeString()}] Pipeline execution stopped by user.`);
        ctx.postToWebview({ command: 'pipelineStopped' });
    }
}

/**
 * Cancels any active Gemini code generation task.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param _message Incoming IPC message
 */
export async function handleStopCodeGeneration(ctx: MessageContext, _message: any): Promise<void> {
    if (activeGenerationCts) {
        activeGenerationCts.cancel();
        activeGenerationCts.dispose();
        activeGenerationCts = null;
    }
    const channel = ctx.outputChannel || getDesignerOutputChannel();
    channel.appendLine(`[${new Date().toLocaleTimeString()}] Code generation canceled by user.`);
    vscode.window.showInformationMessage("Gemini code generation stopped.");
    ctx.postToWebview({ command: 'codeGenerationStopped' });
}

/**
 * Handler for 'regenerateCode' command.
 * Invokes modular AI code generation pipeline.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * @param ctx Message context
 * @param message Incoming IPC message with code generation parameters
 */
export async function handleRegenerateCodeCommand(ctx: MessageContext, message: any): Promise<void> {
    if (activeGenerationCts) {
        activeGenerationCts.cancel();
        activeGenerationCts.dispose();
    }
    activeGenerationCts = new vscode.CancellationTokenSource();
    try {
        await handleRegenerateCode({
            message,
            context: ctx.context,
            document: ctx.document,
            uri: ctx.uri,
            postToWebview: ctx.postToWebview,
            outputChannel: ctx.outputChannel || getDesignerOutputChannel(),
        });
    } finally {
        if (activeGenerationCts) {
            activeGenerationCts.dispose();
            activeGenerationCts = null;
        }
    }
}

/**
 * Registry mapping command strings to individual message handlers.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
export const MESSAGE_HANDLERS: Record<string, MessageHandler> = {
    getDatasets: handleGetDatasets,
    getTables: handleGetTables,
    getTopics: handleGetTopics,
    getSubscriptions: handleGetSubscriptions,
    getNetworks: handleGetNetworks,
    getSubnetworks: handleGetSubnetworks,
    getStorageBuckets: handleGetStorageBuckets,
    getSecrets: handleGetSecrets,
    getHealthcareDatasets: handleGetHealthcareDatasets,
    getAwsQueues: handleGetAwsQueues,
    getComputeInstances: handleGetComputeInstances,
    getBigtableInstances: handleGetBigtableInstances,
    getBigtableTables: handleGetBigtableTables,
    getSqlInstances: handleGetSqlInstances,
    getSqlDatabases: handleGetSqlDatabases,
    getProjects: handleGetProjects,
    ready: handleReady,
    getSamples: handleGetSamples,
    openSample: handleOpenSample,
    savePipeline: handleSavePipeline,
    pickFolder: handlePickFolder,
    readFolderFiles: handleReadFolderFiles,
    readFileContent: handleReadFileContent,
    showOutputChannel: handleShowOutputChannel,
    getRunningJobs: handleGetRunningJobs,
    openExternal: handleOpenExternal,
    runPipeline: handleRunPipeline,
    stopPipeline: handleStopPipeline,
    stopCodeGeneration: handleStopCodeGeneration,
    regenerateCode: handleRegenerateCodeCommand,
};

/**
 * Handles incoming IPC messages from the Webview frontend.
 * Dispatches commands through the MESSAGE_HANDLERS registry.
 * Provides safe parameter handling, non-blocking shell executions, and lifecycle-safe messaging.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * @param webview Webview instance to post messages to
 * @param context Extension context
 * @param document Active TextDocument for .beam file if open in CustomTextEditor
 * @param uri URI of the .beam file
 * @param pipelineName Pipeline name
 * @param isDisposed Callback returning whether the panel has been disposed (M5)
 * @param syncState Shared edit synchronization state for echo suppression (M4)
 */
export function handleMessages(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    document?: vscode.TextDocument,
    uri?: vscode.Uri,
    pipelineName?: string,
    isDisposed: () => boolean = () => false,
    syncState?: DocumentSyncState
) {
    const postToWebview = createSafePostMessage(webview, isDisposed);

    const ctx: MessageContext = {
        context,
        document,
        uri,
        webview,
        postToWebview,
        syncState,
        pipelineName,
        get outputChannel() {
            return getDesignerOutputChannel();
        }
    };

    return async (message: any) => {
        // NOTE: this guard is new in the A1 refactor. The previous code read
        // `message.command` directly, so a null/undefined message threw a TypeError
        // inside an async handler and surfaced as an unhandled rejection. Malformed
        // input on an IPC boundary should not be able to do that, so it is ignored
        // here instead. A non-object message already behaved as a no-op before (no
        // case matched), so only the null/undefined path changes.
        if (!message || typeof message !== 'object') {
            return;
        }
        const handler = MESSAGE_HANDLERS[message.command];
        if (handler) {
            await handler(ctx, message);
        }
    };
}

