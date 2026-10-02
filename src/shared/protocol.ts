/**
 * @fileoverview Typed IPC protocol between the extension host and the designer
 * webview (plan item M4).
 *
 * Declares every command the webview may send (`WebviewToHostCommand`) and the
 * discriminated union of messages the host posts back (`HostToWebviewMessage`).
 * The host types `MessageContext.postToWebview` with the union, so a misspelt
 * command or a missing payload field fails the build instead of silently doing
 * nothing in the webview.
 *
 * Compiled by both the host and webview tsconfigs: keep it pure (types and
 * plain constants only, `import type`, no enums).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { LogStream, SamplePipeline, TokenUsage } from './types';

/** Every command the webview may send to the host; mirrors the host's MESSAGE_HANDLERS registry. */
export const WEBVIEW_TO_HOST_COMMANDS = [
    'getDatasets',
    'getTables',
    'getTopics',
    'getSubscriptions',
    'getNetworks',
    'getSubnetworks',
    'getStorageBuckets',
    'getSecrets',
    'getHealthcareDatasets',
    'getAwsQueues',
    'getComputeInstances',
    'getBigtableInstances',
    'getBigtableTables',
    'getSqlInstances',
    'getSqlDatabases',
    'getProjects',
    'ready',
    'getSamples',
    'openSample',
    'savePipeline',
    'pickFolder',
    'readFolderFiles',
    'readFileContent',
    'showOutputChannel',
    'getRunningJobs',
    'openExternal',
    'runPipeline',
    'stopPipeline',
    'stopCodeGeneration',
    'regenerateCode',
] as const;

/** A command name the host accepts from the webview. */
export type WebviewToHostCommand = (typeof WEBVIEW_TO_HOST_COMMANDS)[number];

/**
 * A message the webview posts to the host. Payload fields vary per command
 * and are validated by each host handler, so only the command is typed here.
 */
export interface WebviewToHostMessage {
    command: WebviewToHostCommand;
    [field: string]: unknown;
}

/** Response commands posted by asset discovery handlers (see the webview's ASSET_CONFIGS). */
export type AssetResponseCommand =
    | 'datasetsLoaded'
    | 'tablesLoaded'
    | 'topicsLoaded'
    | 'subscriptionsLoaded'
    | 'networksLoaded'
    | 'subnetworksLoaded'
    | 'storageBucketsLoaded'
    | 'secretsLoaded'
    | 'healthcareDatasetsLoaded'
    | 'awsQueuesLoaded'
    | 'computeInstancesLoaded'
    | 'bigtableInstancesLoaded'
    | 'bigtableTablesLoaded'
    | 'sqlInstancesLoaded'
    | 'sqlDatabasesLoaded'
    | 'projectsLoaded';

/**
 * Result of an asset lookup. The item array lives under a per-command key
 * (for example `tables` or `bigtableInstances`), so extra keys are allowed.
 */
export interface AssetListResponse {
    command: AssetResponseCommand;
    /** Human-readable failure reason; absent on success. */
    error?: string;
    /** CLI command line and raw error output, for troubleshooting. */
    debugLog?: string;
    /** Parameters of the request this answers (F11 correlation). */
    requestParams?: Record<string, unknown>;
    /** The item array (under the command's payload key) and any extra fields. */
    [payloadKey: string]: unknown;
}

/** Pipeline document contents pushed to the webview on load and on external edits. */
export interface LoadPipelineMessage {
    command: 'loadPipeline';
    /** Raw `.beam` YAML text, or null for a new, empty pipeline. */
    data: string | null;
    /** File name of the pipeline (for example `orders.beam`). */
    filename?: string;
    /** Default GCP project from gcloud, when known. */
    projectId?: string;
    /** Folder of the `.beam` file relative to the workspace root, or ''. */
    relativeFolder: string;
    /** Default generated-code folder for this pipeline. */
    defaultOutputFolder: string;
}

/** Bundled sample pipelines for the palette's Samples tab. */
export interface SamplesLoadedMessage {
    command: 'samplesLoaded';
    samples: SamplePipeline[];
}

/** Outcome of a Gemini code generation request. */
export interface CodeRegeneratedMessage {
    command: 'codeRegenerated';
    success: boolean;
    /** Generated main source, on success. */
    code?: string;
    /** Token accounting reported by Gemini, on success. */
    tokenUsage?: TokenUsage;
    /** True when the user stopped generation. */
    cancelled?: boolean;
    /** Failure reason when `success` is false. */
    error?: string;
}

/** Acknowledges a stop request for code generation. */
export interface CodeGenerationStoppedMessage {
    command: 'codeGenerationStopped';
}

/** One chunk of runner output. */
export interface PipelineLogMessage {
    command: 'pipelineLog';
    text: string;
    stream: LogStream;
}

/** A pipeline run has been launched. */
export interface PipelineStartedMessage {
    command: 'pipelineStarted';
    runner: string;
    /** The command line that was executed. */
    commandLine: string;
    /** Folder the runner script was executed in. */
    folderPath: string;
}

/** Terminal state of a pipeline run. */
export type PipelineRunStatus = 'completed' | 'failed' | 'stopped';

/** A pipeline run has ended. */
export interface PipelineFinishedMessage {
    command: 'pipelineFinished';
    exitCode: number;
    status: PipelineRunStatus;
}

/** The runner process was stopped at the user's request. */
export interface PipelineStoppedMessage {
    command: 'pipelineStopped';
}

/** A Dataflow job ID was detected in runner output. */
export interface PipelineJobIdDetectedMessage {
    command: 'pipelineJobIdDetected';
    jobId: string;
    runner: string;
    projectId?: string;
    region?: string;
}

/** Result of listing Dataflow jobs. */
export interface RunningJobsLoadedMessage {
    command: 'runningJobsLoaded';
    /** Raw job objects as returned by `gcloud dataflow jobs list`. */
    jobs: unknown[];
    projectId?: string;
    error?: string;
    debugLog?: string;
}

/** The folder chosen in the folder picker. */
export interface FolderSelectedMessage {
    command: 'folderSelected';
    path: string;
}

/** Files found in the generated-code folder. */
export interface FolderFilesReadMessage {
    command: 'folderFilesRead';
    /** File paths relative to `folderPath`. */
    files: string[];
    folderPath: string;
    /** Token usage recorded in the folder's gemini.log, when present. */
    tokenUsage?: TokenUsage;
}

/** Contents of a generated file requested by the Source Code tab. */
export interface FileContentLoadedMessage {
    command: 'fileContentLoaded';
    filePath: string;
    content: string;
}

/** A requested generated file could not be read. */
export interface FileContentErrorMessage {
    command: 'fileContentError';
    filePath: string;
    error: string;
}

/** Every message the host may post to the webview. */
export type HostToWebviewMessage =
    | AssetListResponse
    | LoadPipelineMessage
    | SamplesLoadedMessage
    | CodeRegeneratedMessage
    | CodeGenerationStoppedMessage
    | PipelineLogMessage
    | PipelineStartedMessage
    | PipelineFinishedMessage
    | PipelineStoppedMessage
    | PipelineJobIdDetectedMessage
    | RunningJobsLoadedMessage
    | FolderSelectedMessage
    | FolderFilesReadMessage
    | FileContentLoadedMessage
    | FileContentErrorMessage;

/** A command name the webview may receive from the host. */
export type HostToWebviewCommand = HostToWebviewMessage['command'];
