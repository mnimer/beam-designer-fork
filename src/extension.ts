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
                                fs.writeFileSync(uri.fsPath, message.data, 'utf-8');
                                if (message.pythonCode) {
                                    const pyPath = uri.fsPath.replace('.pipeline', '.py');
                                    fs.writeFileSync(pyPath, message.pythonCode, 'utf-8');

                                    const folderPath = path.dirname(uri.fsPath);
                                    const pipelineBaseName = path.basename(uri.fsPath, '.pipeline');

                                    // Create requirements.txt if it does not exist
                                    const reqPath = path.join(folderPath, 'requirements.txt');
                                    if (!fs.existsSync(reqPath)) {
                                        const reqContent = message.requirements || 'apache-beam\n';
                                        fs.writeFileSync(reqPath, reqContent, 'utf-8');
                                    }

                                    // Create DataFlow Flex Template Docker file if it does not exist
                                    const dockerPath = path.join(folderPath, 'Dockerfile');
                                    if (!fs.existsSync(dockerPath)) {
                                        const dockerContent = message.dockerfile || `ARG IMAGE_PYTHON_VERSION=3.11

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
                                vscode.window.setStatusBarMessage(`Saved \${pipelineName} and generated .py`, 2000);
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
