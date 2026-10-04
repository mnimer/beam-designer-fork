/**
 * Vitest Global Setup for Integration Tests.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Automatically clears the integration test report cache (.test-report.json)
 * and report markdown (test-report.md) once at the start of every Vitest
 * integration test run so test-report.md only reflects the current execution.
 */

import { clearReportCache } from './test-reporter';
import { getGcloudProject } from './codegen-runner';

/**
 * Global setup hook for Vitest integration tests.
 * Clears cached test reports and initializes the Google Cloud project environment variable if missing.
 *
 * @returns Promise that resolves when setup is complete.
 */
export default async function setup(): Promise<void> {
    clearReportCache();
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
        const project = await getGcloudProject();
        if (project) {
            process.env.GOOGLE_CLOUD_PROJECT = project;
        }
    }
}

