import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('Apache Beam Pipeline Builder is now active!');

    const treeDataProvider = new DataFlowTreeProvider();
    vscode.window.registerTreeDataProvider('dataflowExplorer', treeDataProvider);

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

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.openPipeline', (pipelineName: string, mode: 'edit' | 'view', uri?: vscode.Uri) => {
            const savePipelineFiles = (targetUri: vscode.Uri, data: string, pythonCode?: string, requirements?: string, dockerfile?: string) => {

                fs.writeFileSync(targetUri.fsPath, data, 'utf-8');
                if (pythonCode) {
                    const pyPath = targetUri.fsPath.replace('.pipeline', '.py');

                    fs.writeFileSync(pyPath, pythonCode, 'utf-8');

                    const folderPath = path.dirname(targetUri.fsPath);
                    const pipelineBaseName = path.basename(targetUri.fsPath, '.pipeline');

                    const reqPath = path.join(folderPath, 'requirements.txt');
                    const reqContent = requirements || 'apache-beam\n';
                    fs.writeFileSync(reqPath, reqContent, 'utf-8');

                    const dockerPath = path.join(folderPath, 'Dockerfile');
                    if (!fs.existsSync(dockerPath)) {
                        const dockerContent = dockerfile || `ARG IMAGE_PYTHON_VERSION=3.11

# --- Stage 1: Get Python Flex Template Launcher Binary ---
FROM gcr.io/dataflow-templates-base/python3-template-launcher-base:latest AS launcher

# --- Stage 2: Build Application Image ---
FROM apache/beam_python\${IMAGE_PYTHON_VERSION}_sdk:2.55.0

# 1. Copy Flex Template launcher binary (Path is STRICT)
COPY --from=launcher /opt/google/dataflow/python_template_launcher /opt/google/dataflow/python_template_launcher

# 2. Set working directory
WORKDIR /template

# 3. Copy files
COPY requirements.txt .
COPY ${pipelineBaseName}.py .

# 4. Install Python Dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 5. Specify Pipeline Entrypoint
ENV FLEX_TEMPLATE_PYTHON_PY_FILE=/template/${pipelineBaseName}.py
`;
                        fs.writeFileSync(dockerPath, dockerContent, 'utf-8');
                    }
                }
            };
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
                message => {
                    switch (message.command) {
                        case 'getDatasets':
                            const exec = require('child_process').exec;
                            exec('bq ls --format=json', (error: any, stdout: string, stderr: string) => {
                                if (error) {
                                    console.error(`exec error: ${error}`);
                                    console.error(`stderr: ${stderr}`);
                                    webview.postMessage({ command: 'datasetsLoaded', datasets: [] });
                                    return;
                                }
                                try {
                                    const datasetsJson = JSON.parse(stdout);
                                    const datasets = datasetsJson.map((d: any) => d.datasetReference.datasetId);
                                    webview.postMessage({ command: 'datasetsLoaded', datasets });
                                } catch (e) {
                                    console.error('Failed to parse bq output', e);
                                    webview.postMessage({ command: 'datasetsLoaded', datasets: [] });
                                }
                            });
                            return;
                        case 'getTables':
                            const execTables = require('child_process').exec;
                            execTables(`bq ls --format=json ${message.dataset}`, (error: any, stdout: string, stderr: string) => {
                                if (error) {
                                    console.error(`exec error: ${error}`);
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
                            const execTopics = require('child_process').exec;
                            execTopics('gcloud pubsub topics list --format=json', (error: any, stdout: string, stderr: string) => {
                                if (error) {
                                    console.error(`exec error: ${error}`);
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
                            const execSubs = require('child_process').exec;
                            execSubs('gcloud pubsub subscriptions list --format=json', (error: any, stdout: string, stderr: string) => {
                                if (error) {
                                    console.error(`exec error: ${error}`);
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
                        case 'ready':
                            if (uri && fs.existsSync(uri.fsPath)) {
                                const content = fs.readFileSync(uri.fsPath, 'utf-8');
                                webview.postMessage({ command: 'loadPipeline', data: content, filename: pipelineName });
                            } else {
                                webview.postMessage({ command: 'loadPipeline', data: null, filename: pipelineName });
                            }
                            return;
                        case 'savePipeline':
                            if (uri) {
                                savePipelineFiles(uri, message.data, message.pythonCode, message.requirements, message.dockerfile);
                                vscode.window.setStatusBarMessage(`Saved ${pipelineName} and generated files`, 2000);
                            } else {
                                console.log('[@extension.ts] No URI, prompting for save location');
                                vscode.window.showSaveDialog({
                                    filters: { 'Pipeline': ['pipeline'] }
                                }).then(fileUri => {
                                    if (fileUri) {
                                        console.log('[@extension.ts] User selected save location', fileUri.fsPath);
                                        uri = fileUri; // Update uri in closure
                                        savePipelineFiles(uri, message.data, message.pythonCode, message.requirements, message.dockerfile);
                                        vscode.window.setStatusBarMessage(`Saved ${path.basename(uri.fsPath)} and generated files`, 2000);
                                        vscode.commands.executeCommand('dataflow-pipeline-builder.refreshPipelines');
                                    }
                                });
                            }
                            return;
                        case 'runPipeline':
                            console.log('[@extension.ts] runPipeline received', message);
                            if (message.jobConfig.runner !== 'DirectRunner') {
                                vscode.window.showInformationMessage(`Running with ${message.jobConfig.runner} is not supported yet in this action.`);
                                return;
                            }
                            if (uri) {
                                const folderPath = path.dirname(uri.fsPath);
                                const pipelineBaseName = path.basename(uri.fsPath, '.pipeline');
                                const pyPath = path.join(folderPath, `${pipelineBaseName}.py`);

                                if (fs.existsSync(pyPath)) {
                                    const terminal = vscode.window.createTerminal("Apache Beam Runner");
                                    terminal.show();

                                    // Construct the command
                                    const command = `cd "${folderPath}" && if [ ! -d ".venv" ]; then python3 -m venv .venv; fi && source .venv/bin/activate && pip install -r requirements.txt && python -m "${pipelineBaseName}" --runner=DirectRunner --streaming`;

                                    terminal.sendText(command);
                                } else {
                                    vscode.window.showErrorMessage(`Python file not found: ${pyPath}. Please save the pipeline first.`);
                                }
                            } else {
                                vscode.window.showErrorMessage("Please save the pipeline first to run it.");
                            }
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );
        })
    );
}

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
        const files = await vscode.workspace.findFiles('**/*.pipeline');
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
                command: 'dataflow-pipeline-builder.openPipeline',
                title: 'Open Pipeline',
                arguments: [label, 'edit', this.resourceUri]
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
