import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('Apache Beam Pipeline Builder is now active!');

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

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.openPipeline', (pipelineName: string, mode: 'edit' | 'view', uri?: vscode.Uri) => {
            // savePipelineFiles was moved to file level
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
                handleMessages(webview, undefined, uri, pipelineName),
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

function savePipelineFiles(targetUri: vscode.Uri, data: string, pythonCode?: string, requirements?: string, dockerfile?: string, runScript?: string, runDataflowScript?: string, dockerIgnore?: string, gcloudIgnore?: string) {
    fs.writeFileSync(targetUri.fsPath, data, 'utf-8');
    if (pythonCode) {
        const pyPath = targetUri.fsPath.replace('.beam', '.py');

        fs.writeFileSync(pyPath, pythonCode, 'utf-8');

        const folderPath = path.dirname(targetUri.fsPath);
        const pipelineBaseName = path.basename(targetUri.fsPath, '.beam');

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

class BeamEditorProvider implements vscode.CustomTextEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

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
            handleMessages(webview, document)
        );
    }
}

function handleMessages(webview: vscode.Webview, document?: vscode.TextDocument, uri?: vscode.Uri, pipelineName?: string) {
    return (message: any) => {
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
                        const projectId = datasetsJson.length > 0 ? datasetsJson[0].datasetReference.projectId : 'DEFAULT_PROJECT';
                        webview.postMessage({ command: 'datasetsLoaded', datasets, projectId });
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
            case 'getSubnetworks':
                const execSubnets = require('child_process').exec;
                execSubnets('gcloud compute networks subnets list --format=json', (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        console.error(`exec error: ${error}`);
                        console.error(`stderr: ${stderr}`);
                        webview.postMessage({ command: 'subnetworksLoaded', subnetworks: [] });
                        return;
                    }
                    try {
                        const subnetsJson = JSON.parse(stdout);
                        const subnetworks = subnetsJson.map((s: any) => {
                            const regionParts = s.region.split('/');
                            const region = regionParts[regionParts.length - 1];
                            return {
                                name: s.name,
                                region: region,
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
                let gcloudProjectId = 'YOUR_PROJECT_ID';
                try {
                    const { execSync } = require('child_process');
                    gcloudProjectId = execSync('gcloud config get project').toString().trim();
                } catch (e) {
                    console.error('Failed to get gcloud project', e);
                }

                if (document) {
                    webview.postMessage({ 
                        command: 'loadPipeline', 
                        data: document.getText(), 
                        filename: path.basename(document.uri.fsPath), 
                        projectId: gcloudProjectId 
                    });
                } else if (uri && fs.existsSync(uri.fsPath)) {
                    const content = fs.readFileSync(uri.fsPath, 'utf-8');
                    webview.postMessage({ command: 'loadPipeline', data: content, filename: pipelineName, projectId: gcloudProjectId });
                } else {
                    webview.postMessage({ command: 'loadPipeline', data: null, filename: pipelineName, projectId: gcloudProjectId });
                }
                return;
            case 'savePipeline':
                const targetUri = document ? document.uri : uri;
                if (targetUri) {
                    savePipelineFiles(targetUri, message.data, message.pythonCode, message.requirements, message.dockerfile, message.runScript, message.runDataflowScript, message.dockerIgnore, message.gcloudIgnore);
                    vscode.window.setStatusBarMessage(`Saved ${path.basename(targetUri.fsPath)} and generated files`, 2000);
                } else {
                    vscode.window.showSaveDialog({
                        filters: { 'Beam Pipeline': ['beam'] }
                    }).then(fileUri => {
                        if (fileUri) {
                            savePipelineFiles(fileUri, message.data, message.pythonCode, message.requirements, message.dockerfile, message.runScript, message.runDataflowScript, message.dockerIgnore, message.gcloudIgnore);
                            vscode.window.setStatusBarMessage(`Saved ${path.basename(fileUri.fsPath)} and generated files`, 2000);
                            vscode.commands.executeCommand('dataflow-pipeline-builder.refreshPipelines');
                        }
                    });
                }
                return;
            case 'runPipeline':
                const runUri = document ? document.uri : uri;
                if (runUri) {
                    const folderPath = path.dirname(runUri.fsPath);
                    const pipelineBaseName = path.basename(runUri.fsPath, '.beam');
                    const pyPath = path.join(folderPath, `${pipelineBaseName}.py`);

                    if (fs.existsSync(pyPath)) {
                        const terminal = vscode.window.createTerminal("Apache Beam Runner");
                        terminal.show();

                        let command = '';
                        if (message.jobConfig.runner === 'DirectRunner') {
                            command = `cd "${folderPath}" && ./run_directrunner.sh`;
                        } else if (message.jobConfig.runner === 'Dataflow') {
                            command = `cd "${folderPath}" && ./run_dataflow.sh`;
                        }

                        terminal.sendText(command);
                    } else {
                        vscode.window.showErrorMessage(`Python file not found: ${pyPath}. Please save the pipeline first.`);
                    }
                } else {
                    vscode.window.showErrorMessage("Please save the pipeline first to run it.");
                }
                return;
        }
    };
}
