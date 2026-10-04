/**
 * @fileoverview Pure extraction of Dataflow job IDs (and region/project from Console URLs) from runner output.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Result of detecting a Dataflow job in execution output.
 */
export interface DetectedDataflowJob {
    /** The Dataflow job ID string (format: YYYY-MM-DD_HH_MM_SS-...). */
    jobId: string;
    /** Optional GCP region extracted from the log line or console URL. */
    region?: string;
    /** Optional GCP project ID extracted from the log line or console URL. */
    projectId?: string;
}

/**
 * Pure detector for identifying Google Cloud Dataflow job IDs from command-line runner output.
 *
 * Supports:
 * 1. Cloud Console URLs:
 *    e.g. https://console.cloud.google.com/dataflow/jobs/us-central1/2026-09-30_02_00_00-1234567890123456?project=my-project
 *    or https://console.cloud.google.com/dataflow/jobs/locations/us-central1/jobs/2026-09-30_02_00_00-1234567890123456?project=my-project
 * 2. "Submitted job: <jobId>" standard Beam log output
 * 3. "id: '<jobId>'" gcloud / JSON / YAML output
 * 4. Raw job ID tokens matching the pattern YYYY-MM-DD_...
 *
 * @param line - Chunk or single line of output from stdout or stderr.
 * @returns DetectedDataflowJob if found, or null otherwise.
 */
export function detectDataflowJob(line: string): DetectedDataflowJob | null {
    if (!line || typeof line !== 'string') {
        return null;
    }

    // Pattern 1: Google Cloud Console URL
    // e.g. https://console.cloud.google.com/dataflow/jobs/<region>/<jobId>?project=<project>
    // or .../dataflow/jobs/locations/<region>/jobs/<jobId>?project=<project>
    const urlMatch = line.match(
        /https:\/\/console\.cloud\.google\.com\/dataflow\/jobs(?:\/locations\/([a-z0-9-]+)\/jobs|\/([a-z0-9-]+))?\/([0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9a-zA-Z_-]{10,})(?:\?([^\s"'<>]*))?/i
    );
    if (urlMatch) {
        const region = urlMatch[1] || urlMatch[2];
        const jobId = urlMatch[3];
        const queryString = urlMatch[4];
        let projectId: string | undefined;
        if (queryString) {
            const projectMatch = queryString.match(/(?:^|&)project=([a-z0-9-_]+)/i);
            if (projectMatch) {
                projectId = projectMatch[1];
            }
        }
        return {
            jobId,
            ...(region ? { region } : {}),
            ...(projectId ? { projectId } : {})
        };
    }

    // Pattern 2: Standard log / CLI format
    // Matches "Submitted job: 2026-...", "id: '2026-...", or bare job ID token
    const match = line.match(/(?:id:\s*['"]?|Submitted job:\s*|\b)([0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9a-zA-Z_-]{10,})/i);
    if (match && match[1]) {
        return {
            jobId: match[1]
        };
    }

    return null;
}
