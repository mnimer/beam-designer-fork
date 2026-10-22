/** @fileoverview Service for discovering and loading sample pipelines.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { normalizeLanguage } from '../shared/language';
import type { SamplePipeline } from '../shared/types';

export type { SamplePipeline };

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
 * Synthesizes README-level markdown documentation from a parsed `.beam` sample structure
 * when no standalone `<baseName>.md` or `<baseName>/README.md` file is present on disk.
 *
 * @param title Human-readable title of the sample pipeline.
 * @param filename Sample `.beam` filename.
 * @param flow Topological DAG flow summary string.
 * @param runner Default runner name.
 * @param parsed Parsed `.beam` YAML object.
 * @returns Comprehensive Markdown README string.
 */
export function buildSampleReadmeMarkdown(
    title: string,
    filename: string,
    flow: string,
    runner: string,
    parsed: any
): string {
    const nodes: any[] = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
    const runtimeVariables: any[] = Array.isArray(parsed?.runtimeVariables) ? parsed.runtimeVariables : [];

    const lines: string[] = [
        `# ${title}`,
        '',
        '## Overview',
        flow
            ? `Pre-configured Apache Beam sample pipeline (\`${filename}\`) implementing the flow: **${flow}**.`
            : `Pre-configured Apache Beam sample pipeline (\`${filename}\`) configured for the **${runner}** runner.`,
        '',
        'This sample can be generated and executed in either **Python** or **Java** using the **Generate Code** panel.',
    ];

    if (flow || nodes.length > 0) {
        lines.push(
            '',
            '## Pipeline Architecture & Data Flow'
        );
        if (flow) {
            lines.push(`\`${flow}\``);
        }
        if (nodes.length > 0) {
            lines.push('');
            nodes.forEach((node, index) => {
                const label = node?.data?.label || node?.id || 'Node';
                const type = node?.data?.type || 'STEP';
                const transform = node?.data?.beam_transform || node?.data?.label || type;
                lines.push(`${index + 1}. **${label} (\`${transform}\` / \`${type}\`)**`);
            });
        }
    }

    if (runtimeVariables.length > 0) {
        lines.push(
            '',
            '## Runtime Parameters',
            '| Parameter | Default Value |',
            '|---|---|'
        );
        for (const variable of runtimeVariables) {
            const key = variable?.key || 'PARAM';
            const val = variable?.value !== undefined && variable?.value !== null && String(variable.value) !== ''
                ? `\`${String(variable.value)}\``
                : '*(unset)*';
            lines.push(`| \`${key}\` | ${val} |`);
        }
    }

    lines.push(
        '',
        '## Code Generation & Execution',
        `1. Click **New File** to save a copy of \`${filename}\` in your workspace.`,
        '2. Open the **Generate Code** tab, choose **Python** or **Java**, and click **Generate Code**.',
        '3. Run locally with DirectRunner or deploy to Google Cloud Dataflow:',
        '```bash',
        './run_directrunner.sh',
        '```'
    );

    return lines.join('\n');
}

/**
 * Discovers and parses all .beam sample pipelines located in the resources/samples directory.
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
                let runner = 'DirectRunner';
                let flow = '';
                let nodesCount = 0;
                let parsedYaml: any = null;

                try {
                    parsedYaml = YAML.parse(content);
                    if (parsedYaml) {
                        language = normalizeLanguage(parsedYaml.pipelineConfig?.language) ?? 'Java';
                        if (parsedYaml.jobConfig?.runner) {
                            runner = parsedYaml.jobConfig.runner;
                        }
                        if (Array.isArray(parsedYaml.nodes)) {
                            nodesCount = parsedYaml.nodes.length;
                        }
                        flow = computePipelineFlow(parsedYaml.nodes, parsedYaml.edges);
                    }
                } catch (parseErr) {
                    console.warn(`Failed to parse YAML for sample ${file}, falling back to text scan`, parseErr);
                }

                // 5. Load companion Markdown README (<baseName>.md or <baseName>/README.md) if available
                let readmeContent = '';
                const candidateReadmePaths = [
                    path.join(samplesDir, `${baseName}.md`),
                    path.join(samplesDir, baseName, 'README.md'),
                ];
                for (const readmePath of candidateReadmePaths) {
                    try {
                        const isReadmeFile = await fs.promises.stat(readmePath).then(s => s.isFile()).catch(() => false);
                        if (isReadmeFile) {
                            readmeContent = await fs.promises.readFile(readmePath, 'utf-8');
                            if (readmeContent.trim().length > 0) {
                                break;
                            }
                        }
                    } catch {
                        // Fall through to next candidate or synthesized README
                    }
                }

                if (!readmeContent.trim()) {
                    readmeContent = buildSampleReadmeMarkdown(title, file, flow, runner, parsedYaml);
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
                    nodesCount,
                    readmeContent,
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
