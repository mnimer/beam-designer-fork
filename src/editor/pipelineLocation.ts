/**
 * @fileoverview Utility for computing pipeline relative and default output folder locations.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as path from 'path';
import { isSubPath } from '../security/pathGuard';

/**
 * Result of computing relative and default output folders for a pipeline file.
 */
export interface PipelineLocation {
    /** Relative directory of the pipeline file from workspaceFolder, or empty string. */
    relativeFolder: string;
    /** Default output folder path (relativeFolder + filenameWithoutExt, or just filenameWithoutExt). */
    defaultOutputFolder: string;
}

/**
 * Computes relativeFolder and defaultOutputFolder for a .beam file given an optional workspace folder.
 *
 * @param beamFsPath The filesystem path of the .beam file.
 * @param workspaceFolder The filesystem path of the root workspace folder, if defined.
 * @returns An object containing relativeFolder and defaultOutputFolder.
 */
export function computePipelineLocation(
    beamFsPath: string,
    workspaceFolder: string | undefined
): PipelineLocation {
    let relativeFolder = '';
    const beamFileDir = path.dirname(beamFsPath);
    if (workspaceFolder && isSubPath(workspaceFolder, beamFileDir)) {
        relativeFolder = path.relative(workspaceFolder, beamFileDir);
    }
    const filenameWithoutExt = path.basename(beamFsPath, '.beam');
    const defaultOutputFolder = relativeFolder
        ? path.join(relativeFolder, filenameWithoutExt)
        : filenameWithoutExt;

    return { relativeFolder, defaultOutputFolder };
}
