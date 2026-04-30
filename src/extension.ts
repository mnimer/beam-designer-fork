import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';


export function activate(context: vscode.ExtensionContext) {
    console.log('Apache Beam Pipeline Builder is now active!');

    const treeDataProvider = new DataFlowTreeProvider();
    vscode.window.registerTreeDataProvider('dataflowExplorer', treeDataProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.showEditor', () => {
            vscode.commands.executeCommand('dataflow-pipeline-builder.openPipeline', 'Manual Pipeline', 'edit');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.openPipeline', (pipelineName: string, mode: 'edit' | 'view') => {
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
        })
    );
}

class DataFlowTreeProvider implements vscode.TreeDataProvider<DataItem> {
    getTreeItem(element: DataItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DataItem): Thenable<DataItem[]> {
        if (!element) {
            return Promise.resolve([
                new DataItem('Pipelines', vscode.TreeItemCollapsibleState.Collapsed, 'category'),
                new DataItem('Running Pipelines', vscode.TreeItemCollapsibleState.Collapsed, 'category')
            ]);
        }

        if (element.label === 'Pipelines') {
            return Promise.resolve([
                new DataItem('pipeline 1', vscode.TreeItemCollapsibleState.None, 'pipeline-edit'),
                new DataItem('pipeline 2', vscode.TreeItemCollapsibleState.None, 'pipeline-edit')
            ]);
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
        public readonly contextValue: string
    ) {
        super(label, collapsibleState);

        if (contextValue === 'pipeline-edit') {
            this.command = {
                command: 'dataflow-pipeline-builder.openPipeline',
                title: 'Open Pipeline',
                arguments: [label, 'edit']
            };
            this.iconPath = new vscode.ThemeIcon('file-submodule');
        } else if (contextValue === 'pipeline-view') {
            this.command = {
                command: 'dataflow-pipeline-builder.openPipeline',
                title: 'Open Pipeline',
                arguments: [label, 'view']
            };
            this.iconPath = new vscode.ThemeIcon('pulse');
        }
    }
}

export function deactivate() { }
