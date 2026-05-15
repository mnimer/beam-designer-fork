import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';

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

function deleteCodeFiles(folderPath: string, baseName: string) {
    const filesToDelete = [
        `${baseName}.py`,
        `${baseName}.java`,
        `${baseName}_test.py`,
        `${baseName}Test.java`,
        'requirements.txt',
        'pom.xml',
        'Dockerfile',
        'metadata.json',
        'run_directrunner.sh',
        'run_dataflow.sh',
        'run_spark.sh',
        '.dockerignore',
        '.gcloudignore',
        'gemini.log'
    ];
    for (const file of filesToDelete) {
        const filePath = path.join(folderPath, file);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.error(`Failed to delete ${filePath}`, err);
            }
        }
    }
    
    // Delete Java target directory if it exists
    const targetDir = path.join(folderPath, 'target');
    if (fs.existsSync(targetDir)) {
        try {
            fs.rmSync(targetDir, { recursive: true, force: true });
        } catch (err) {
            console.error(`Failed to delete target directory: ${targetDir}`, err);
        }
    }
}

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
        let folderPath = path.dirname(targetUri.fsPath);
        if (outputFolder) {
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

        const pipelineBaseName = path.basename(targetUri.fsPath, '.beam');
        const codePath = path.join(folderPath, `${pipelineBaseName}.${fileExtension}`);
        fs.writeFileSync(codePath, code, 'utf-8');

        // Only write python-specific files if fileExtension is py
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
                if (!folderPath) {
                    const activeUri = document ? document.uri : uri;
                    if (activeUri) {
                        folderPath = path.dirname(activeUri.fsPath);
                    }
                } else if (!path.isAbsolute(folderPath)) {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (workspaceFolder) {
                        folderPath = path.join(workspaceFolder, folderPath);
                    }
                }
                if (folderPath && fs.existsSync(folderPath)) {
                    try {
                        const files = fs.readdirSync(folderPath).filter(file => {
                            const fullPath = path.join(folderPath, file);
                            return fs.statSync(fullPath).isFile() && !file.startsWith('.');
                        });
                        webview.postMessage({
                            command: 'folderFilesLoaded',
                            folderPath: folderPath,
                            files: files
                        });
                    } catch (e) {
                        console.error('Failed to read folder files', e);
                        webview.postMessage({ command: 'folderFilesLoaded', folderPath, files: [] });
                    }
                } else {
                    webview.postMessage({ command: 'folderFilesLoaded', folderPath: folderPath || '', files: [] });
                }
                return;
            case 'readFileContent':
                let readFolder = message.folderPath;
                if (!readFolder) {
                    const activeUri = document ? document.uri : uri;
                    if (activeUri) {
                        readFolder = path.dirname(activeUri.fsPath);
                    }
                } else if (!path.isAbsolute(readFolder)) {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (workspaceFolder) {
                        readFolder = path.join(workspaceFolder, readFolder);
                    }
                }

                if (readFolder) {
                    const fullFilePath = path.isAbsolute(message.filePath) 
                        ? message.filePath 
                        : path.join(readFolder, message.filePath);
                    
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
            case 'runPipeline':
                const runUri = document ? document.uri : uri;
                if (runUri) {
                    let folderPath = path.dirname(runUri.fsPath);
                    const outputFolder = message.pipelineConfig?.outputFolder;
                    if (outputFolder) {
                        if (path.isAbsolute(outputFolder)) {
                            folderPath = outputFolder;
                        } else {
                            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                            if (workspaceFolder) {
                                folderPath = path.join(workspaceFolder, outputFolder);
                            }
                        }
                    }

                    const pipelineBaseName = path.basename(runUri.fsPath, '.beam');
                    const isPython = !message.pipelineConfig || message.pipelineConfig.language.toLowerCase() === 'python';

                    if (isPython) {
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
                        const javaPath = path.join(folderPath, `${pipelineBaseName}.java`);
                        if (fs.existsSync(javaPath)) {
                            vscode.window.showInformationMessage(`Java runner execution not fully configured. Found file at ${javaPath}`);
                        } else {
                            vscode.window.showErrorMessage(`Java file not found: ${javaPath}. Please save the pipeline first.`);
                        }
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
                    targetFolderPath = path.dirname(targetActiveUri.fsPath);
                }
                if (outputFolderVal) {
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
                deleteCodeFiles(targetFolderPath, baseName);
                
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Generating code using Gemini...",
                    cancellable: false
                }, async (_progress) => {
                    let promptText = '';
                    try {
                        let gcloudProjectId = undefined;
                        try {
                            const { execSync } = require('child_process');
                            gcloudProjectId = execSync('gcloud config get project').toString().trim();
                        } catch (e) {
                            console.error('Failed to get gcloud project for Gemini', e);
                        }
                        
                        const aiOptions: any = {};
                        if (gcloudProjectId) {
                            aiOptions.vertexai = true;
                            aiOptions.project = gcloudProjectId;
                            aiOptions.location = 'global';
                        }
                        
                        const ai = new GoogleGenAI(aiOptions);
                        
                        const promptTemplatePath = path.join(__dirname, '..', 'src', 'code-gen-prompt.txt');
                        if (!fs.existsSync(promptTemplatePath)) {
                            throw new Error(`Prompt template file not found at ${promptTemplatePath}`);
                        }
                        const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf-8');
                        promptText = promptTemplate
                            .replace(/\{\{language\}\}/g, languageVal)
                            .replace('{{pipeline}}', yamlData);
                        
                        const responseSchemaPath = path.join(__dirname, '..', 'src', 'code-gen-schema.json');
                        if (!fs.existsSync(responseSchemaPath)) {
                            throw new Error(`Response schema file not found at ${responseSchemaPath}`);
                        }
                        const responseSchema = JSON.parse(fs.readFileSync(responseSchemaPath, 'utf-8'));
                        
                        const response = await ai.models.generateContent({
                            model: 'gemini-3.1-pro-preview',
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
                                model: 'gemini-3.1-pro-preview',
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
                        const responseObj = JSON.parse(response.text);
                        
                        let mainPipelineCode = '';
                        const fileExt = languageVal.toLowerCase() === 'python' ? 'py' : 'java';
                        const mainPipelineFileName = `${baseName}.${fileExt}`;
                        
                        if (responseObj.files && Array.isArray(responseObj.files)) {
                            for (const file of responseObj.files) {
                                if (!file.filename || file.content === undefined) {
                                    continue;
                                }
                                
                                // Normalize standard names to match diagrams
                                let normalizedFilename = file.filename;
                                if (normalizedFilename.toLowerCase() === 'pipeline.py' || normalizedFilename.toLowerCase() === 'pipeline.java') {
                                    normalizedFilename = `${baseName}.${fileExt}`;
                                } else if (normalizedFilename.toLowerCase() === 'pipeline_test.py' || normalizedFilename.toLowerCase() === 'pipelinetest.java') {
                                    const testExt = fileExt === 'py' ? '_test.py' : 'Test.java';
                                    normalizedFilename = `${baseName}${testExt}`;
                                }
                                
                                const filePath = path.join(targetFolderPath, normalizedFilename);
                                const parentDir = path.dirname(filePath);
                                if (!fs.existsSync(parentDir)) {
                                    fs.mkdirSync(parentDir, { recursive: true });
                                }
                                fs.writeFileSync(filePath, file.content, 'utf-8');
                                
                                if (file.executable) {
                                    try {
                                        fs.chmodSync(filePath, '755');
                                    } catch (e) {
                                        console.error(`Failed to set executable permission on ${filePath}`, e);
                                    }
                                }
                                
                                if (normalizedFilename === mainPipelineFileName) {
                                    mainPipelineCode = file.content;
                                }
                            }
                        } else {
                            throw new Error("Invalid response format from Gemini: 'files' array is missing.");
                        }
                        
                        // Default code if the main pipeline file wasn't found in the generated list
                        if (!mainPipelineCode && responseObj.files.length > 0) {
                            mainPipelineCode = responseObj.files[0].content;
                        }
                        
                        // Write default ignore files if not present in generated files
                        const dockerIgnorePath = path.join(targetFolderPath, '.dockerignore');
                        if (!fs.existsSync(dockerIgnorePath)) {
                            fs.writeFileSync(dockerIgnorePath, `.git\n.venv\nnode_modules\n__pycache__\n*.beam\n*.tf\n`, 'utf-8');
                        }
                        const gcloudIgnorePath = path.join(targetFolderPath, '.gcloudignore');
                        if (!fs.existsSync(gcloudIgnorePath)) {
                            fs.writeFileSync(gcloudIgnorePath, `.git\n.venv\nnode_modules\n__pycache__\n*.beam\n*.tf\n`, 'utf-8');
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
                                model: 'gemini-3.1-pro-preview',
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
