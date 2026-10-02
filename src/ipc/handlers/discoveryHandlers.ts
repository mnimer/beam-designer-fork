/** @fileoverview Asset discovery IPC message handlers for GCP and AWS resources.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { execFile } from 'child_process';
import { findGcloudPath } from '../../cli/cliResolver';
import { listAssets, getGcloudProject } from '../../cli/gcloudClient';
import {
    mapBigtableInstances,
    mapBigtableTables,
    mapSqlInstances,
    mapSqlDatabases,
    mapProjects,
    parseBigtableInstanceParam,
    parseSqlInstanceParam,
    mapSecretManagerItems,
    mapHealthcareDatasetItems
} from '../../cli/resourceMappers';
import { getDesignerOutputChannel } from '../../core/outputChannel';
import { isValidGcpRegion } from '../../security/pathGuard';
import { MessageContext } from '../messageContext';

/**
 * Handler for 'getDatasets' command.
 * Fetches BigQuery datasets via CLI and posts results to webview.
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
 * Handler for 'getHealthcareDatasets' command.
 * Fetches Google Cloud Healthcare API datasets via `gcloud healthcare datasets list --format=json`.
 * Supports an optional validated `location` filter parameter.
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
 * Handler for 'getRunningJobs' command.
 * Queries active Dataflow jobs via gcloud CLI and posts results to webview.
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
    if (message.region && message.region !== 'ALL' && !isValidGcpRegion(message.region)) {
        const errMsg = 'Invalid region';
        channel.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${errMsg}`);
        ctx.postToWebview({
            command: 'runningJobsLoaded',
            jobs: [],
            error: `Failed to query Dataflow jobs: ${errMsg}`,
            debugLog: errMsg
        });
        return;
    }
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
