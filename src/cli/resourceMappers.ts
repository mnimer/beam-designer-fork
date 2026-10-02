/** @fileoverview Provides data mapping and parsing utilities for Cloud CLI outputs.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

export interface SecretManagerItem {
    name: string;
    id: string;
    fullName: string;
    value: string;
}

/**
 * Extracts the short secret ID from a Secret Manager fully-qualified resource path or secret name.
 * Handles paths like "projects/123/secrets/my-secret", names with trailing slashes, or simple IDs.
 * 
 * @param fullName Full resource path (e.g. projects/.../secrets/my-secret) or secret name
 * @returns The short secret ID without project path prefix
 */
export function toShortSecretId(fullName?: string | null): string {
    if (!fullName) {
        return '';
    }
    // NOTE: Strip any trailing slashes to properly parse paths such as 'projects/.../secrets/my-secret/'
    const trimmed = fullName.trim().replace(/\/+$/, '');
    if (!trimmed) {
        return '';
    }
    const parts = trimmed.split('/');
    return parts[parts.length - 1] || '';
}

/**
 * Maps already-parsed `gcloud secrets list --format=json` output into normalized
 * SecretManagerItem objects.
 *
 * Guarantees short secret IDs reach the webview: `name`, `id` and `value` all carry the
 * short ID, and only `fullName` retains the fully-qualified resource path. Any consumer
 * therefore reads a usable ID whichever field it happens to pick (finding M1/M20).
 *
 * NOTE: This is deliberately separate from parseSecretManagerOutput. The generic
 * `listAssets` helper has already JSON.parse'd the CLI output by the time it calls its
 * mapper, so it needs the mapping over parsed JSON. Keeping one shared implementation
 * means the logic covered by src/test/secrets.test.ts is the logic that actually runs --
 * an inline duplicate here would recreate exactly the M1 failure mode of a correct,
 * tested code path that never executes.
 *
 * @param json Parsed JSON from `gcloud secrets list --format=json`
 * @returns Array of SecretManagerItem objects containing short IDs and full resource names
 */
export function mapSecretManagerItems(json: any): SecretManagerItem[] {
    if (!Array.isArray(json)) {
        return [];
    }
    return json.map((s: any) => {
        const rawName = s?.name || '';
        const shortName = toShortSecretId(rawName) || rawName;
        return {
            name: shortName,
            id: shortName,
            fullName: rawName,
            value: shortName
        };
    });
}

/**
 * Parses raw JSON output from `gcloud secrets list --format=json` into normalized
 * SecretManagerItem objects. Thin wrapper over mapSecretManagerItems for callers that
 * hold the raw stdout string rather than parsed JSON.
 *
 * @param stdout JSON string from gcloud secrets list command
 * @returns Array of SecretManagerItem objects containing short IDs and full resource names
 */
export function parseSecretManagerOutput(stdout: string): SecretManagerItem[] {
    return mapSecretManagerItems(JSON.parse(stdout));
}

/**
 * Returns the last non-empty '/'-separated segment of a resource name
 * (e.g. `projects/p/instances/i` -> `i`), or '' for non-strings.
 *
 * @param value Resource name from gcloud JSON output
 * @returns The trailing path segment
 */
function lastPathSegment(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }
    const parts = value.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
}

/**
 * Maps `gcloud bigtable instances list --format=json` to short instance IDs.
 *
 * @param json Parsed gcloud JSON output
 * @returns Short Bigtable instance IDs
 */
export function mapBigtableInstances(json: any): string[] {
    return Array.isArray(json) ? json.map((i: any) => lastPathSegment(i?.name)).filter(Boolean) : [];
}

/**
 * Maps `gcloud bigtable instances tables list --format=json` to short table IDs.
 *
 * @param json Parsed gcloud JSON output
 * @returns Short Bigtable table IDs
 */
export function mapBigtableTables(json: any): string[] {
    return Array.isArray(json) ? json.map((t: any) => lastPathSegment(t?.name)).filter(Boolean) : [];
}

/**
 * Maps `gcloud sql instances list --format=json` to instance connection names
 * (`project:region:instance`), which is what the Cloud SQL connectors expect.
 * Falls back to composing the name from project/region/name when connectionName is absent.
 *
 * @param json Parsed gcloud JSON output
 * @returns Cloud SQL instance connection names
 */
export function mapSqlInstances(json: any): string[] {
    if (!Array.isArray(json)) {
        return [];
    }
    return json.map((i: any) => {
        if (typeof i?.connectionName === 'string' && i.connectionName) {
            return i.connectionName;
        }
        return i?.project && i?.region && i?.name ? `${i.project}:${i.region}:${i.name}` : '';
    }).filter(Boolean);
}

/**
 * Maps `gcloud sql databases list --format=json` to database names.
 *
 * @param json Parsed gcloud JSON output
 * @returns Database names
 */
export function mapSqlDatabases(json: any): string[] {
    return Array.isArray(json) ? json.map((d: any) => d?.name).filter(Boolean) : [];
}

/**
 * Maps `gcloud projects list --format=json` to project IDs.
 *
 * @param json Parsed gcloud JSON output
 * @returns Project IDs
 */
export function mapProjects(json: any): string[] {
    return Array.isArray(json) ? json.map((p: any) => p?.projectId).filter(Boolean) : [];
}

/**
 * Parses a Bigtable instance identifier sent from the webview. Accepts a short
 * instance ID or `projects/{project}/instances/{instance}`. The charset is strict
 * (no ',' so a caller cannot smuggle a multi-instance list into `--instances=`),
 * while length is left to the API to validate.
 *
 * @param raw Value of `message.instance`
 * @returns `{ instance, project? }`, or null when missing or invalid
 */
export function parseBigtableInstanceParam(raw: unknown): { instance: string; project?: string } | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const v = raw.trim();
    const full = /^projects\/([a-z0-9.:-]+)\/instances\/([a-z][a-z0-9-]*)$/i.exec(v);
    if (full) {
        return { project: full[1], instance: full[2] };
    }
    return /^[a-z][a-z0-9-]*$/i.test(v) ? { instance: v } : null;
}

/**
 * Parses a Cloud SQL instance identifier sent from the webview. Accepts a bare
 * instance name or an instance connection name `[domain:]project:region:instance`.
 *
 * @param raw Value of `message.instance`
 * @returns `{ instance, project? }`, or null when missing or invalid
 */
export function parseSqlInstanceParam(raw: unknown): { instance: string; project?: string } | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const m = /^(?:([a-z0-9.:-]+):([a-z0-9-]+):)?([a-z][a-z0-9-]*)$/i.exec(raw.trim());
    if (!m) {
        return null;
    }
    return m[1] ? { project: m[1], instance: m[3] } : { instance: m[3] };
}

/**
 * Maps `gcloud healthcare datasets list --format=json` to dataset resource names.
 *
 * @param json Parsed JSON array from gcloud healthcare datasets list
 * @returns Array of non-empty dataset resource name strings
 */
export function mapHealthcareDatasetItems(json: any): string[] {
    if (!Array.isArray(json)) {
        return [];
    }
    return json
        .map((d: any) => (typeof d?.name === 'string' ? d.name.trim() : ''))
        .filter((name: string) => name.length > 0);
}
