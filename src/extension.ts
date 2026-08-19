import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from './constants';

/**
 * Extension Activation Entry Point
 * Registers tree providers, custom text editor providers, and extension commands.
 * 
 * @param context The extension context provided by VS Code
 */
let designerOutputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Apache Beam Pipeline Builder is now active!');
    designerOutputChannel = vscode.window.createOutputChannel('Dataflow Designer');
    context.subscriptions.push(designerOutputChannel);
    designerOutputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Apache Beam Designer initialized.`);

    const treeDataProvider = new DataFlowTreeProvider();
    vscode.window.registerTreeDataProvider('dataflowExplorer', treeDataProvider);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'dataflow-pipeline-builder.beamEditor',
            new BeamEditorProvider(context)
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.refreshPipelines', () => {
            treeDataProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.showEditor', () => {
            vscode.commands.executeCommand('dataflow-pipeline-builder.openPipeline', 'Manual Pipeline', 'edit');
        })
    );

    // Refresh tree view on file rename or move
    context.subscriptions.push(
        vscode.workspace.onDidRenameFiles(_e => {
            treeDataProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.openPipeline', (pipelineName: string, mode: 'edit' | 'view', uri?: vscode.Uri) => {
            const panel = vscode.window.createWebviewPanel(
                'beamPipelineEditor',
                `Apache Beam Pipeline Editor - ${pipelineName} (${mode})`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(context.extensionPath, 'webview', 'dist'))
                    ]
                }
            );

            const webview = panel.webview;
            const extensionPath = context.extensionPath;
            const distPath = path.join(extensionPath, 'webview', 'dist');

            const htmlPath = path.join(distPath, 'index.html');
            let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

            // Resolve paths to assets
            const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'index.js')));
            const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'index.css')));

            htmlContent = htmlContent
                .replace('./assets/index.js', jsUri.toString())
                .replace('./assets/index.css', cssUri.toString());

            webview.html = htmlContent;

            // Handle messages from webview
            webview.onDidReceiveMessage(
                handleMessages(webview, context, undefined, uri, pipelineName),
                undefined,
                context.subscriptions
            );
        })
    );
}

/**
 * DataFlowTreeProvider
 * Provides workspace pipeline file hierarchy and active job views for the sidebar explorer.
 */
class DataFlowTreeProvider implements vscode.TreeDataProvider<DataItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DataItem | undefined | null | void> = new vscode.EventEmitter<DataItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DataItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private pipelines: DataItem[] = [];

    constructor() {
        this.refresh();
    }

    refresh(): void {
        this.scanPipelines();
    }

    private async scanPipelines() {
        const files = await vscode.workspace.findFiles('**/*.beam');
        this.pipelines = this.buildTree(files);
        this._onDidChangeTreeData.fire();
    }

    private buildTree(files: vscode.Uri[]): DataItem[] {
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

    getTreeItem(element: DataItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DataItem): Thenable<DataItem[]> {
        if (!element) {
            return Promise.resolve([
                new DataItem('Pipelines', vscode.TreeItemCollapsibleState.Collapsed, 'category', this.pipelines),
                new DataItem('Running Pipelines', vscode.TreeItemCollapsibleState.Collapsed, 'category')
            ]);
        }

        if (element.label === 'Pipelines') {
            return Promise.resolve(element.children || []);
        }

        if (element.contextValue === 'folder') {
            return Promise.resolve(element.children || []);
        }

        if (element.label === 'Running Pipelines') {
            return Promise.resolve([
                new DataItem('pipeline 2', vscode.TreeItemCollapsibleState.None, 'pipeline-view')
            ]);
        }

        return Promise.resolve([]);
    }
}

/**
 * DataItem
 * Represents individual items within the DataFlow Explorer tree view.
 */
class DataItem extends vscode.TreeItem {
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
                command: 'vscode.open',
                title: 'Open Pipeline',
                arguments: [this.resourceUri]
            };
            this.iconPath = new vscode.ThemeIcon('file');
        } else if (contextValue === 'pipeline-view') {
            this.command = {
                command: 'dataflow-pipeline-builder.openPipeline',
                title: 'Open Pipeline',
                arguments: [label, 'view']
            };
            this.iconPath = new vscode.ThemeIcon('pulse');
        } else if (contextValue === 'folder') {
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}

export function deactivate() { }

/**
 * Safely parses JSON response string from Gemini model.
 * Handles markdown code fences and automatically repairs truncated JSON responses by
 * salvaging all completely generated file objects from the 'files' array.
 * 
 * @param rawText Raw output text from Gemini model.
 * @returns Parsed JSON object containing generated files array.
 */
function parseOrRepairJson(rawText: string): any {
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

        // Truncation repair: search backwards for '}' characters that close completed file objects in 'files' array
        let lastIndex = cleaned.lastIndexOf('}');
        while (lastIndex > 0) {
            let candidate = cleaned.substring(0, lastIndex + 1).trim();
            // Remove trailing comma if present before closing brackets
            if (candidate.endsWith(',')) {
                candidate = candidate.substring(0, candidate.length - 1).trim();
            }
            // Append closing array and object brackets
            const testJson = candidate + ']}';
            try {
                const parsed = JSON.parse(testJson);
                if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) {
                    console.log(`[parseOrRepairJson] Successfully repaired truncated JSON response and salvaged ${parsed.files.length} file(s).`);
                    return parsed;
                }
            } catch (_) {
                // Try previous '}' occurrence
            }
            lastIndex = cleaned.lastIndexOf('}', lastIndex - 1);
        }

        // If structural repair could not salvage any completed file objects, rethrow original syntax error
        throw firstErr;
    }
}

/**
 * Helper to find the absolute path to gcloud CLI binary.
 */
function findGcloudPath(): string {
    const candidates = [
        '/Users/mikenimer/Development/libraries/google-cloud-sdk/bin/gcloud',
        path.join(process.env.HOME || '', 'Development/libraries/google-cloud-sdk/bin/gcloud'),
        path.join(process.env.HOME || '', 'google-cloud-sdk/bin/gcloud'),
        '/opt/homebrew/bin/gcloud',
        '/usr/local/bin/gcloud',
        'gcloud'
    ];
    for (const cand of candidates) {
        if (cand !== 'gcloud' && fs.existsSync(cand)) {
            return cand;
        }
    }
    return 'gcloud';
}

/**
 * Asynchronously retrieves the active GCP project ID from gcloud CLI.
 * Returns undefined if gcloud is unavailable or fails.
 */
function getGcloudProject(): Promise<string | undefined> {
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
 * Reads resource template or schema files, checking resources/ and src/ directories.
 * Supports both development environment execution and packaged VSIX execution.
 */
function readResourceFile(context: vscode.ExtensionContext, fileName: string): string {
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
 * Safely deletes all files and subdirectories generated for a given pipeline in the output folder.
 * Validates path bounds to ensure it never deletes files outside a valid workspace subfolder.
 * 
 * @param folderPath The directory path where the pipeline's code is generated.
 */
function deleteCodeFiles(folderPath: string) {
    if (!folderPath || !fs.existsSync(folderPath)) {
        return;
    }

    const resolvedFolderPath = path.resolve(folderPath);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        console.warn(`[deleteCodeFiles] Refusing deletion in ${resolvedFolderPath}: No active workspace folder.`);
        return;
    }

    const resolvedWorkspace = path.resolve(workspaceFolder);
    const relative = path.relative(resolvedWorkspace, resolvedFolderPath);
    // Ensure target folder is strictly inside a workspace subfolder and NOT the workspace root itself
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        console.warn(`[deleteCodeFiles] Refusing deletion in workspace root or external path: ${resolvedFolderPath}`);
        return;
    }

    try {
        const items = fs.readdirSync(resolvedFolderPath);
        for (const item of items) {
            // Ignore hidden files and folders except generated ignores
            if (item.startsWith('.') && item !== '.dockerignore' && item !== '.gcloudignore') {
                continue;
            }

            // Never delete .beam files containing source designs
            if (item.endsWith('.beam')) {
                continue;
            }

            const itemPath = path.join(resolvedFolderPath, item);
            if (fs.existsSync(itemPath)) {
                try {
                    const stat = fs.statSync(itemPath);
                    if (stat.isDirectory()) {
                        fs.rmSync(itemPath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(itemPath);
                    }
                } catch (err) {
                    console.error(`Failed to delete item: ${itemPath}`, err);
                }
            }
        }
    } catch (err) {
        console.error(`Failed to read output folder: ${resolvedFolderPath}`, err);
    }
}

/**
 * Saves pipeline YAML definitions and generated code artifacts to disk.
 */
function savePipelineFiles(
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
    gcloudIgnore?: string
) {
    fs.writeFileSync(targetUri.fsPath, data, 'utf-8');
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


        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const srcFolderPath = path.join(folderPath, 'src');

        if (!fs.existsSync(srcFolderPath)) {
            fs.mkdirSync(srcFolderPath, { recursive: true });
        }
        const codePath = path.join(srcFolderPath, `${pipelineBaseName}.${fileExtension}`);
        fs.writeFileSync(codePath, code, 'utf-8');

        if (fileExtension === 'py') {
            const reqPath = path.join(folderPath, 'requirements.txt');
            const reqContent = requirements || 'apache-beam\n';
            fs.writeFileSync(reqPath, reqContent, 'utf-8');

            const dockerPath = path.join(folderPath, 'Dockerfile');
            if (!fs.existsSync(dockerPath) && dockerfile) {
                fs.writeFileSync(dockerPath, dockerfile, 'utf-8');
            }

            const runScriptPath = path.join(folderPath, 'run_directrunner.sh');
            if (runScript) {
                fs.writeFileSync(runScriptPath, runScript, 'utf-8');
                try {
                    fs.chmodSync(runScriptPath, '755');
                } catch (e) {
                    console.error(`Failed to set executable permission on ${runScriptPath}`, e);
                }
            }

            const runDataflowScriptPath = path.join(folderPath, 'run_dataflow.sh');
            if (runDataflowScript) {
                fs.writeFileSync(runDataflowScriptPath, runDataflowScript, 'utf-8');
                try {
                    fs.chmodSync(runDataflowScriptPath, '755');
                } catch (e) {
                    console.error(`Failed to set executable permission on ${runDataflowScriptPath}`, e);
                }
            }

            const ignorePath = path.join(folderPath, '.dockerignore');
            if (dockerIgnore) {
                fs.writeFileSync(ignorePath, dockerIgnore, 'utf-8');
            }

            const gcloudIgnorePath = path.join(folderPath, '.gcloudignore');
            if (gcloudIgnore) {
                fs.writeFileSync(gcloudIgnorePath, gcloudIgnore, 'utf-8');
            }
        }
    }
}

/**
 * BeamEditorProvider
 * Custom Text Editor provider for `.beam` visual pipeline design files.
 */
class BeamEditorProvider implements vscode.CustomTextEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const webview = webviewPanel.webview;
        const extensionPath = this.context.extensionPath;
        const distPath = path.join(extensionPath, 'webview', 'dist');

        const htmlPath = path.join(distPath, 'index.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        // Resolve paths to assets
        const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'index.js')));
        const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'index.css')));

        htmlContent = htmlContent
            .replace('./assets/index.js', jsUri.toString())
            .replace('./assets/index.css', cssUri.toString());

        webview.html = htmlContent;
        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'webview', 'dist'))
            ]
        };

        // Handle messages from webview
        webview.onDidReceiveMessage(
            handleMessages(webview, this.context, document)
        );
    }
}

/**
 * Handles incoming IPC messages from the Webview frontend.
 * Provides safe parameter handling and non-blocking shell executions.
 */
function handleMessages(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    document?: vscode.TextDocument,
    uri?: vscode.Uri,
    pipelineName?: string
) {
    return async (message: any) => {
        switch (message.command) {
            case 'getDatasets':
                execFile('bq', ['ls', '--format=json'], (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        console.error(`bq ls error: ${error}`);
                        console.error(`stderr: ${stderr}`);
                        webview.postMessage({ command: 'datasetsLoaded', datasets: [] });
                        return;
                    }
                    try {
                        const datasetsJson = JSON.parse(stdout);
                        const datasets = datasetsJson.map((d: any) => d.datasetReference.datasetId);
                        const projectId = datasetsJson.length > 0 ? datasetsJson[0].datasetReference.projectId : 'DEFAULT_PROJECT';
                        webview.postMessage({ command: 'datasetsLoaded', datasets, projectId });
                    } catch (e) {
                        console.error('Failed to parse bq output', e);
                        webview.postMessage({ command: 'datasetsLoaded', datasets: [] });
                    }
                });
                return;
            case 'getTables':
                if (!message.dataset || typeof message.dataset !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(message.dataset)) {
                    console.error('Invalid or missing dataset identifier:', message.dataset);
                    webview.postMessage({ command: 'tablesLoaded', tables: [] });
                    return;
                }
                execFile('bq', ['ls', '--format=json', message.dataset], (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        console.error(`bq ls tables error: ${error}`);
                        console.error(`stderr: ${stderr}`);
                        webview.postMessage({ command: 'tablesLoaded', tables: [] });
                        return;
                    }
                    try {
                        const tablesJson = JSON.parse(stdout);
                        const tables = tablesJson.map((t: any) => t.tableReference.tableId);
                        webview.postMessage({ command: 'tablesLoaded', tables });
                    } catch (e) {
                        console.error('Failed to parse bq output', e);
                        webview.postMessage({ command: 'tablesLoaded', tables: [] });
                    }
                });
                return;
            case 'getTopics':
                execFile('gcloud', ['pubsub', 'topics', 'list', '--format=json'], (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        console.error(`gcloud topics error: ${error}`);
                        console.error(`stderr: ${stderr}`);
                        webview.postMessage({ command: 'topicsLoaded', topics: [] });
                        return;
                    }
                    try {
                        const topicsJson = JSON.parse(stdout);
                        const topics = topicsJson.map((t: any) => t.name);
                        webview.postMessage({ command: 'topicsLoaded', topics });
                    } catch (e) {
                        console.error('Failed to parse topics output', e);
                        webview.postMessage({ command: 'topicsLoaded', topics: [] });
                    }
                });
                return;
            case 'getSubscriptions':
                execFile('gcloud', ['pubsub', 'subscriptions', 'list', '--format=json'], (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        console.error(`gcloud subscriptions error: ${error}`);
                        console.error(`stderr: ${stderr}`);
                        webview.postMessage({ command: 'subscriptionsLoaded', subscriptions: [] });
                        return;
                    }
                    try {
                        const subsJson = JSON.parse(stdout);
                        const subscriptions = subsJson.map((s: any) => s.name);
                        webview.postMessage({ command: 'subscriptionsLoaded', subscriptions });
                    } catch (e) {
                        console.error('Failed to parse subscriptions output', e);
                        webview.postMessage({ command: 'subscriptionsLoaded', subscriptions: [] });
                    }
                });
                return;
            case 'getNetworks':
                execFile('gcloud', ['compute', 'networks', 'list', '--format=json'], (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        console.error(`gcloud networks error: ${error}`);
                        console.error(`stderr: ${stderr}`);
                        webview.postMessage({ command: 'networksLoaded', networks: [] });
                        return;
                    }
                    try {
                        const networksJson = JSON.parse(stdout);
                        const networks = networksJson.map((n: any) => {
                            return {
                                name: n.name,
                                value: n.name
                            };
                        });
                        webview.postMessage({ command: 'networksLoaded', networks });
                    } catch (e) {
                        console.error('Failed to parse networks output', e);
                        webview.postMessage({ command: 'networksLoaded', networks: [] });
                    }
                });
                return;
            case 'getSubnetworks':
                execFile('gcloud', ['compute', 'networks', 'subnets', 'list', '--format=json'], (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        console.error(`gcloud subnets error: ${error}`);
                        console.error(`stderr: ${stderr}`);
                        webview.postMessage({ command: 'subnetworksLoaded', subnetworks: [] });
                        return;
                    }
                    try {
                        const subnetsJson = JSON.parse(stdout);
                        const subnetworks = subnetsJson.map((s: any) => {
                            const regionParts = s.region.split('/');
                            const region = regionParts[regionParts.length - 1];
                            const networkParts = s.network.split('/');
                            const network = networkParts[networkParts.length - 1];
                            return {
                                name: s.name,
                                region: region,
                                network: network,
                                value: `regions/${region}/subnetworks/${s.name}`
                            };
                        });
                        webview.postMessage({ command: 'subnetworksLoaded', subnetworks });
                    } catch (e) {
                        console.error('Failed to parse subnetworks output', e);
                        webview.postMessage({ command: 'subnetworksLoaded', subnetworks: [] });
                    }
                });
                return;
            case 'ready':
                const gcloudProjectId = (await getGcloudProject()) || 'YOUR_PROJECT_ID';

                const activeUri = document ? document.uri : uri;
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

                if (document) {
                    webview.postMessage({
                        command: 'loadPipeline',
                        data: document.getText(),
                        filename: path.basename(document.uri.fsPath),
                        projectId: gcloudProjectId,
                        relativeFolder: relativeFolder,
                        defaultOutputFolder: defaultOutputFolder
                    });
                } else if (uri && fs.existsSync(uri.fsPath)) {
                    const content = fs.readFileSync(uri.fsPath, 'utf-8');
                    webview.postMessage({
                        command: 'loadPipeline',
                        data: content,
                        filename: pipelineName,
                        projectId: gcloudProjectId,
                        relativeFolder: relativeFolder,
                        defaultOutputFolder: defaultOutputFolder
                    });
                } else {
                    webview.postMessage({
                        command: 'loadPipeline',
                        data: null,
                        filename: pipelineName,
                        projectId: gcloudProjectId,
                        relativeFolder: relativeFolder,
                        defaultOutputFolder: defaultOutputFolder
                    });
                }
                return;
            case 'savePipeline':
                const targetUri = document ? document.uri : uri;
                if (targetUri) {
                    savePipelineFiles(
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
                        message.gcloudIgnore
                    );
                    vscode.window.setStatusBarMessage(`Saved ${path.basename(targetUri.fsPath)} and generated files`, 2000);
                } else {
                    vscode.window.showSaveDialog({
                        filters: { 'Beam Pipeline': ['beam'] }
                    }).then(fileUri => {
                        if (fileUri) {
                            savePipelineFiles(
                                fileUri,
                                message.data,
                                message.code,
                                message.fileExtension,
                                message.outputFolder,
                                message.requirements,
                                message.dockerfile,
                                message.runScript,
                                message.runDataflowScript,
                                message.dockerIgnore,
                                message.gcloudIgnore
                            );
                            vscode.window.setStatusBarMessage(`Saved ${path.basename(fileUri.fsPath)} and generated files`, 2000);
                            vscode.commands.executeCommand('dataflow-pipeline-builder.refreshPipelines');
                        }
                    });
                }
                return;
            case 'pickFolder':
                vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    title: 'Select Output Folder'
                }).then(uris => {
                    if (uris && uris.length > 0) {
                        let selectedPath = uris[0].fsPath;
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        if (workspaceFolder && selectedPath.startsWith(workspaceFolder)) {
                            selectedPath = path.relative(workspaceFolder, selectedPath);
                        }
                        webview.postMessage({
                            command: 'folderSelected',
                            path: selectedPath
                        });
                    }
                });
                return;
            case 'readFolderFiles':

                let folderPath = message.folderPath;
                const activeUriForFolder = document ? document.uri : uri;
                if (!folderPath && activeUriForFolder) {
                    const baseName = path.basename(activeUriForFolder.fsPath, '.beam');
                    folderPath = path.join(path.dirname(activeUriForFolder.fsPath), baseName);
                } else if (folderPath && !path.isAbsolute(folderPath)) {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (workspaceFolder) {
                        folderPath = path.join(workspaceFolder, folderPath);
                    }
                }
                if (folderPath && fs.existsSync(folderPath)) {
                    try {
                        const getFilesRecursively = (dir: string, baseDir: string = dir): string[] => {
                            let results: string[] = [];
                            const list = fs.readdirSync(dir);
                            for (const item of list) {
                                if (item.startsWith('.')) continue;
                                const fullPath = path.join(dir, item);
                                const stat = fs.statSync(fullPath);
                                if (stat.isDirectory()) {
                                    results = results.concat(getFilesRecursively(fullPath, baseDir));
                                } else if (stat.isFile()) {
                                    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                                    results.push(relPath);
                                }
                            }
                            return results;
                        };
                        const files = getFilesRecursively(folderPath);
                        webview.postMessage({
                            command: 'folderFilesRead',
                            files: files,
                            folderPath: folderPath
                        });
                    } catch (e) {
                        console.error('Failed to read folder files', e);
                        webview.postMessage({
                            command: 'folderFilesRead',
                            files: [],
                            folderPath: folderPath
                        });
                    }
                } else {
                    webview.postMessage({
                        command: 'folderFilesRead',
                        files: [],
                        folderPath: folderPath
                    });
                }
                return;
            case 'readFileContent':
                let readFolder = message.folderPath;

                const activeUriForRead = document ? document.uri : uri;
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

                    if (fs.existsSync(fullFilePath)) {
                        try {
                            const content = fs.readFileSync(fullFilePath, 'utf-8');
                            webview.postMessage({
                                command: 'fileContentLoaded',
                                filePath: message.filePath,
                                content: content
                            });
                        } catch (e) {
                            console.error('Failed to read file content', e);
                        }
                    }
                }
                return;
            case 'showOutputChannel':
                if (!designerOutputChannel) {
                    designerOutputChannel = vscode.window.createOutputChannel('Dataflow Designer');
                }
                designerOutputChannel.show(true);
                designerOutputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Log channel requested from Webview.`);
                return;
            case 'getRunningJobs':
                if (!designerOutputChannel) {
                    designerOutputChannel = vscode.window.createOutputChannel('Dataflow Designer');
                }
                designerOutputChannel.show(true);

                let targetProject = message.projectId;
                if (!targetProject || targetProject === 'YOUR_PROJECT_ID') {
                    designerOutputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Resolving active project from gcloud...`);
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
                designerOutputChannel.appendLine(logMsg);
                
                execFile(gcloudBin, gcloudArgs, { timeout: 15000, maxBuffer: 1024 * 1024 * 10 }, (err: any, stdout: string, stderr: string) => {
                    if (err) {
                        const errText = `Failed to list Dataflow jobs via gcloud: ${err.message}. Stderr: ${stderr || 'none'}`;
                        console.error('[@extension.ts]', errText);
                        designerOutputChannel?.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${errText}`);
                        
                        const errMsg = err.killed ? 'Request timed out waiting for gcloud CLI response. Try selecting a specific region.' : (stderr || err.message);
                        webview.postMessage({
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
                        designerOutputChannel?.appendLine(`[${new Date().toLocaleTimeString()}] SUCCESS: ${successMsg}`);
                        designerOutputChannel?.appendLine(stdout || '[]');
                        
                        const parsedJobs = JSON.parse(stdout || '[]');
                        webview.postMessage({
                            command: 'runningJobsLoaded',
                            jobs: Array.isArray(parsedJobs) ? parsedJobs : [],
                            projectId: targetProject,
                            debugLog: `Command: ${gcloudBin} ${gcloudArgs.join(' ')}\nRetrieved ${parsedJobs.length} jobs.`
                        });
                    } catch (e: any) {
                        const parseErrMsg = `Failed to parse gcloud JSON output: ${e.message}`;
                        console.error('[@extension.ts]', parseErrMsg);
                        designerOutputChannel?.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${parseErrMsg}`);
                        
                        webview.postMessage({
                            command: 'runningJobsLoaded',
                            jobs: [],
                            error: parseErrMsg,
                            debugLog: `Command: ${gcloudBin} ${gcloudArgs.join(' ')}\nOutput: ${stdout}`
                        });
                    }
                });
                return;
            case 'openExternal':
                if (message.url) {
                    try {
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                    } catch (e) {
                        console.error('Failed to open URL', e);
                    }
                }
                return;
            case 'runPipeline':
                const runUri = document ? document.uri : uri;
                if (runUri) {
                    const pipelineBaseName = path.basename(runUri.fsPath, '.beam');
                    let folderPath = path.join(path.dirname(runUri.fsPath), pipelineBaseName);
                    const outputFolder = message.pipelineConfig?.outputFolder;
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

                    const runner = message.jobConfig?.runner;
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
                        try {
                            const task = new vscode.Task(
                                { type: 'shell', task: 'Apache Beam Runner' },
                                vscode.TaskScope.Workspace,
                                "Apache Beam Runner",
                                "Beam Extension",
                                new vscode.ShellExecution(`./${scriptName}`, { cwd: folderPath })
                            );
                            task.presentationOptions = {
                                focus: true,
                                reveal: vscode.TaskRevealKind.Always,
                                panel: vscode.TaskPanelKind.Dedicated
                            };
                            vscode.tasks.executeTask(task);
                        } catch (e) {
                            console.error('Failed to run script task', e);
                            vscode.window.showErrorMessage(`Failed to run script: ${e}`);
                        }
                    } else {
                        const namesStr = possibleNames.join(' or ');
                        vscode.window.showErrorMessage(`Runner script not found (${namesStr}) in ${folderPath}. Please save and/or generate code first.`);
                    }
                } else {
                    vscode.window.showErrorMessage("Please save the pipeline first to run it.");
                }
                return;
            case 'regenerateCode':
                const yamlData = message.data;
                const filenameVal = message.filename;
                const languageVal = message.language;
                const outputFolderVal = message.outputFolder;
                const targetActiveUri = document ? document.uri : uri;

                let targetFolderPath = '';
                if (targetActiveUri) {
                    const pipelineBaseName = path.basename(targetActiveUri.fsPath, '.beam');
                    targetFolderPath = path.join(path.dirname(targetActiveUri.fsPath), pipelineBaseName);
                }
                if (outputFolderVal && outputFolderVal.trim()) {
                    if (path.isAbsolute(outputFolderVal)) {
                        targetFolderPath = outputFolderVal;
                    } else {
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        if (workspaceFolder) {
                            targetFolderPath = path.join(workspaceFolder, outputFolderVal);
                        }
                    }
                }


                if (!targetFolderPath) {
                    vscode.window.showErrorMessage('Could not determine output folder.');
                    webview.postMessage({ command: 'codeRegenerated', success: false, error: 'Could not determine output folder.' });
                    return;
                }

                if (!fs.existsSync(targetFolderPath)) {
                    try {
                        fs.mkdirSync(targetFolderPath, { recursive: true });
                    } catch (e: any) {
                        vscode.window.showErrorMessage(`Failed to create directory: ${targetFolderPath}`);
                        webview.postMessage({ command: 'codeRegenerated', success: false, error: `Failed to create directory: ${targetFolderPath}. ${e.message}` });
                        return;
                    }
                }

                const baseName = filenameVal.replace('.beam', '');
                deleteCodeFiles(targetFolderPath);

                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Generating code using Gemini...",
                    cancellable: false
                }, async (_progress) => {
                    let promptText = '';
                    try {
                        const gcloudProjectId = await getGcloudProject();

                        const aiOptions: any = {};
                        if (gcloudProjectId) {
                            aiOptions.vertexai = true;
                            aiOptions.project = gcloudProjectId;
                            aiOptions.location = 'global';
                        }

                        const ai = new GoogleGenAI(aiOptions);

                        // Determine target language subfolder and prompt file
                        const langSubfolder = languageVal.toLowerCase() === 'java' ? 'java' : 'python';
                        const promptFile = langSubfolder === 'java' ? 'code-gen-prompt-java.txt' : 'code-gen-prompt-python.txt';
                        const promptTemplate = readResourceFile(context, promptFile);

                        // Load static file templates for Dockerfile and runner scripts
                        const dockerfileTemplate = readResourceFile(context, path.join('templates', langSubfolder, 'Dockerfile'));
                        const directRunnerTemplate = readResourceFile(context, path.join('templates', langSubfolder, 'run_directrunner.sh'));
                        const dataflowRunnerTemplate = readResourceFile(context, path.join('templates', langSubfolder, 'run_dataflowrunner.sh'));

                        let sparkRunnerSection = '';
                        if (langSubfolder === 'java') {
                            const sparkRunnerTemplate = readResourceFile(context, path.join('templates', 'java', 'run_sparkrunner.sh'));
                            sparkRunnerSection = `### 'run_sparkrunner.sh' Template\n\`\`\`\n${sparkRunnerTemplate}\n\`\`\``;
                        }

                        // Substitute placeholders, pipeline definitions, and templates into final prompt text
                        promptText = promptTemplate
                            .replace(/\{\{language\}\}/g, languageVal)
                            .replace('{{pipeline}}', yamlData)
                            .replace('{{dockerfile_template}}', dockerfileTemplate)
                            .replace('{{run_directrunner_template}}', directRunnerTemplate)
                            .replace('{{run_dataflowrunner_template}}', dataflowRunnerTemplate)
                            .replace('{{sparkrunner_template_section}}', sparkRunnerSection);



                        const responseSchema = JSON.parse(readResourceFile(context, 'code-gen-schema.json'));


                        const response = await ai.models.generateContent({
                            model: DEFAULT_GEMINI_MODEL,
                            contents: promptText,
                            config: {
                                responseMimeType: 'application/json',
                                responseSchema: responseSchema
                            }
                        });

                        // Log successful request and usage data to gemini.log
                        try {
                            const logFilePath = path.join(targetFolderPath, 'gemini.log');
                            const logData = {
                                timestamp: new Date().toISOString(),
                                model: DEFAULT_GEMINI_MODEL,
                                prompt: promptText,
                                responseSchema: responseSchema,
                                tokenUsage: response.usageMetadata ? {
                                    inputTokens: response.usageMetadata.promptTokenCount,
                                    outputTokens: response.usageMetadata.candidatesTokenCount,
                                    totalTokens: (response.usageMetadata.promptTokenCount || 0) + (response.usageMetadata.candidatesTokenCount || 0)
                                } : 'Unavailable',
                                rawResponse: response.text
                            };
                            fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2), 'utf-8');
                        } catch (logErr) {
                            console.error('Failed to write request log to gemini.log', logErr);
                        }

                        if (!response.text) {
                            throw new Error("Empty response from Gemini model.");
                        }
                        const responseObj = parseOrRepairJson(response.text);


                        let mainPipelineCode = '';
                        const fileExt = languageVal.toLowerCase() === 'python' ? 'py' : 'java';

                        if (responseObj.files && Array.isArray(responseObj.files)) {
                            for (const file of responseObj.files) {
                                if (!file.filename || file.content === undefined) {
                                    continue;
                                }

                                // Normalize standard names to match diagrams and directory structure
                                let normalizedFilename = file.filename;

                                // Strip redundant top-level folder matching baseName if model included it (e.g. "foobar/Dockerfile" -> "Dockerfile")
                                if (normalizedFilename.startsWith(`${baseName}/`)) {
                                    normalizedFilename = normalizedFilename.substring(baseName.length + 1);
                                }
                                // Strip leading relative path traversal (../ or ..\) to ensure files remain strictly inside targetFolderPath
                                normalizedFilename = normalizedFilename.replace(/^(\.\.[\/\\])+/, '');

                                const fileNameOnly = path.basename(normalizedFilename);
                                const dirNameOnly = path.dirname(normalizedFilename);


                                // Filter out files mismatched with target language
                                if (fileExt === 'py') {
                                    if (fileNameOnly.toLowerCase() === 'pom.xml' || fileNameOnly.toLowerCase() === 'run_sparkrunner.sh' || normalizedFilename.includes('target/')) {
                                        console.log(`[regenerateCode] Skipping Java artifact '${normalizedFilename}' for Python project.`);
                                        continue;
                                    }
                                } else if (fileExt === 'java') {
                                    if (fileNameOnly.toLowerCase() === 'requirements.txt') {
                                        console.log(`[regenerateCode] Skipping Python artifact '${normalizedFilename}' for Java project.`);
                                        continue;
                                    }
                                }


                                // Route pipeline code and test files to appropriate subfolders
                                const pascalBaseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
                                if (fileExt === 'java') {
                                    const lowerName = fileNameOnly.toLowerCase();
                                    if (lowerName === 'pipeline.java' || lowerName === `${baseName.toLowerCase()}.java` || lowerName === `${pascalBaseName.toLowerCase()}.java`) {
                                        normalizedFilename = `src/main/java/com/example/${pascalBaseName}.java`;
                                    } else if (lowerName === 'pipelinetest.java' || lowerName === 'pipeline_test.java' || lowerName === `${baseName.toLowerCase()}test.java` || lowerName === `${pascalBaseName.toLowerCase()}test.java`) {
                                        normalizedFilename = `src/test/java/com/example/${pascalBaseName}Test.java`;
                                    } else if (fileNameOnly.endsWith('.java')) {
                                        if (!normalizedFilename.startsWith('src/main/java/') && !normalizedFilename.startsWith('src/test/java/')) {
                                            normalizedFilename = `src/main/java/com/example/${fileNameOnly}`;
                                        }
                                    }
                                } else {
                                    if (fileNameOnly.toLowerCase() === 'pipeline.py' || fileNameOnly.toLowerCase() === `${baseName.toLowerCase()}.py`) {
                                        normalizedFilename = `src/${baseName}.py`;
                                    } else if (fileNameOnly.toLowerCase() === 'pipeline_test.py' || fileNameOnly.toLowerCase() === `${baseName.toLowerCase()}_test.py`) {
                                        normalizedFilename = `src/${baseName}_test.py`;
                                    } else if (fileNameOnly.endsWith('.py')) {
                                        if (dirNameOnly === '.' || dirNameOnly === '') {
                                            normalizedFilename = `src/${fileNameOnly}`;
                                        }
                                    }
                                }


                                let fileContent = file.content;
                                // If the project language is Python and baseName is not 'pipeline', fix references to src.pipeline / pipeline in generated files
                                if (fileExt === 'py' && baseName.toLowerCase() !== 'pipeline' && fileContent) {
                                    fileContent = fileContent.replace(/\bfrom\s+src\.pipeline\b/g, `from src.${baseName}`)
                                                             .replace(/\bimport\s+src\.pipeline\b/g, `import src.${baseName}`)
                                                             .replace(/\bfrom\s+pipeline\b/g, `from src.${baseName}`)
                                                             .replace(/\bimport\s+pipeline\b/g, `import src.${baseName}`);
                                }

                                const filePath = path.join(targetFolderPath, normalizedFilename);
                                const parentDir = path.dirname(filePath);
                                if (!fs.existsSync(parentDir)) {
                                    fs.mkdirSync(parentDir, { recursive: true });
                                }
                                fs.writeFileSync(filePath, fileContent, 'utf-8');

                                if (file.executable) {
                                    try {
                                        fs.chmodSync(filePath, '755');
                                    } catch (e) {
                                        console.error(`Failed to set executable permission on ${filePath}`, e);
                                    }
                                }

                                const lowerNorm = normalizedFilename.toLowerCase();
                                const lowerBase = path.basename(normalizedFilename).toLowerCase();
                                if (fileExt === 'java') {
                                    if (lowerNorm.endsWith('.java') && !lowerNorm.includes('test')) {
                                        if (lowerBase === `${pascalBaseName.toLowerCase()}.java` || 
                                            lowerBase === `${baseName.toLowerCase()}.java` || 
                                            lowerBase === 'pipeline.java' || 
                                            normalizedFilename.startsWith('src/main/java/') ||
                                            !mainPipelineCode) {
                                            mainPipelineCode = fileContent;
                                        }
                                    }
                                } else {
                                    if (lowerNorm.endsWith('.py') && !lowerNorm.includes('test') && !lowerBase.endsWith('__init__.py')) {
                                        if (lowerBase === `${baseName.toLowerCase()}.py` || 
                                            lowerBase === 'pipeline.py' || 
                                            normalizedFilename.startsWith('src/') ||
                                            !mainPipelineCode) {
                                            mainPipelineCode = fileContent;
                                        }
                                    }
                                }

                            }
                        } else {
                            throw new Error("Invalid response format from Gemini: 'files' array is missing.");
                        }

                        // Default code if the main pipeline file wasn't found in the generated list
                        if (!mainPipelineCode && responseObj.files.length > 0) {
                            const codeFile = responseObj.files.find((f: any) => 
                                f.filename && f.filename.endsWith(`.${fileExt}`) && !f.filename.toLowerCase().includes('test')
                            ) || responseObj.files.find((f: any) => f.filename && f.filename.endsWith(`.${fileExt}`));
                            if (codeFile) {
                                mainPipelineCode = codeFile.content;
                            } else {
                                mainPipelineCode = responseObj.files[0].content;
                            }
                        }

                        // Ensure src/__init__.py exists for Python projects so unittest recognizes src as a package
                        if (fileExt === 'py') {
                            const initPyPath = path.join(targetFolderPath, 'src', '__init__.py');
                            if (!fs.existsSync(initPyPath)) {
                                const srcDir = path.dirname(initPyPath);
                                if (!fs.existsSync(srcDir)) {
                                    fs.mkdirSync(srcDir, { recursive: true });
                                }
                                fs.writeFileSync(initPyPath, '# Package init\n', 'utf-8');
                            }
                        }



                        // Write default ignore files if not present in generated files
                        const dockerIgnorePath = path.join(targetFolderPath, '.dockerignore');
                        if (!fs.existsSync(dockerIgnorePath)) {
                            fs.writeFileSync(dockerIgnorePath, `.git\n.venv\nnode_modules\n__pycache__\ntarget/\n*.beam\n*.tf\n`, 'utf-8');
                        }
                        const gcloudIgnorePath = path.join(targetFolderPath, '.gcloudignore');
                        if (!fs.existsSync(gcloudIgnorePath)) {
                            fs.writeFileSync(gcloudIgnorePath, `.git\n.venv\nnode_modules\n__pycache__\ntarget/\n*.beam\n*.tf\n`, 'utf-8');
                        }


                        vscode.window.showInformationMessage('Code files generated successfully by Gemini!');

                        webview.postMessage({
                            command: 'codeRegenerated',
                            success: true,
                            code: mainPipelineCode
                        });

                    } catch (err: any) {
                        // Log failure to gemini.log
                        try {
                            const logFilePath = path.join(targetFolderPath, 'gemini.log');
                            const logData = {
                                timestamp: new Date().toISOString(),
                                model: DEFAULT_GEMINI_MODEL,
                                prompt: promptText,
                                error: err.message,
                                stack: err.stack
                            };
                            fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2), 'utf-8');
                        } catch (logErr) {
                            console.error('Failed to write failure details to gemini.log', logErr);
                        }

                        vscode.window.showErrorMessage(`Gemini Code Generation Error: ${err.message}`);
                        webview.postMessage({ command: 'codeRegenerated', success: false, error: err.message });
                    }
                });
                return;
        }
    };
}
