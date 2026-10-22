/**
 * @fileoverview Pure TypeScript data contracts crossing the host<->webview IPC boundary.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Rules:
 * - Pure interfaces / types only (zero runtime overhead, no enums).
 * - Zero dependencies on vscode, node, or react.
 */

/**
 * Token usage telemetry from Gemini code generation runs.
 */
export interface TokenUsage {
    /** Number of input prompt tokens consumed. */
    inputTokens: number;
    /** Number of candidate output tokens generated. */
    outputTokens: number;
    /** Optional total tokens consumed across the request. */
    totalTokens?: number;
}

/**
 * Built-in sample pipeline catalog entry.
 */
export interface SamplePipeline {
    /** Unique identifier for the sample (e.g. 'generate-mock-data'). */
    id: string;
    /** Bundled .beam file name (e.g. 'generate-mock-data.beam'). */
    filename: string;
    /** Human-readable title of the sample (e.g. 'Generate Mock Data'). */
    title: string;
    /** Summary description or flow of what the sample demonstrates. */
    description: string;
    /** Optional category group (e.g. 'Samples'). */
    category?: string;
    /** Optional visual badge text (e.g. 'Java' or 'Python'). */
    badge?: string;
    /** Optional normalized pipeline language ('Python' | 'Java'). */
    language?: string;
    /** Optional recommended runner name ('DirectRunner' | 'Dataflow' | 'Spark'). */
    runner?: string;
    /** Optional number of nodes in the sample pipeline DAG. */
    nodesCount?: number;
    /** Optional full Markdown README documentation for the sample pipeline. */
    readmeContent?: string;
    /** Raw .beam YAML text content. */
    content: string;
}

/**
 * Log stream identifier for pipeline execution output.
 */
export type LogStream = 'stdout' | 'stderr';
