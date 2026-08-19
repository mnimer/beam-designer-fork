/**
 * Utility functions for managing and computing pipeline output folder paths.
 * 
 * Purpose:
 * Ensures generated code output paths stay synchronized and relative to the
 * location and filename of the `.beam` pipeline design file currently open.
 */

/**
 * Dynamically computes an updated output folder path for a `.beam` pipeline file.
 * 
 * Logic Flow:
 * 1. If no saved output folder exists or it is empty, returns `defaultOutputFolder`.
 * 2. Normalizes path separators and trims trailing slashes.
 * 3. Handles absolute paths by updating the last component (pipeline folder name).
 * 4. For relative paths:
 *    - If `savedFolder` does not match `relativeFolder`, or if it contains stale/nested
 *      concatenated path fragments from previous file renames (e.g. `foobar/job1-pipeline`),
 *      resets the path to `defaultOutputFolder` (`relativeFolder/nameWithoutExt`).
 * 
 * @param savedFolder Output folder path saved in the pipeline's YAML definition
 * @param relativeFolder Workspace-relative folder path where the `.beam` file resides
 * @param nameWithoutExt Filename of the `.beam` file without extension (e.g. 'parse-message-pipeline')
 * @param defaultOutputFolder Default output folder path (e.g. 'relativeFolder/nameWithoutExt')
 * @returns Updated workspace-relative or absolute output folder path
 */
export function computeUpdatedOutputFolder(
  savedFolder: string | undefined,
  relativeFolder: string,
  nameWithoutExt: string,
  defaultOutputFolder: string
): string {
  // Return default if savedFolder is missing or whitespace only
  const trimmed = savedFolder ? savedFolder.trim() : '';
  if (!trimmed) {
    return defaultOutputFolder;
  }

  // Normalize slashes and remove trailing slashes
  const normSaved = trimmed.replace(/\\/g, '/').replace(/\/$/, '');
  const normRelative = (relativeFolder || '').trim().replace(/\\/g, '/').replace(/\/$/, '');
  const isAbsolute = normSaved.startsWith('/');

  // If no pipeline name is available, keep normalized saved folder
  if (!nameWithoutExt) {
    return normSaved;
  }

  // Handle absolute paths: update the final folder name while retaining absolute root path
  if (isAbsolute) {
    const savedParts = normSaved.split('/').filter(Boolean);
    const oldDirParts = savedParts.slice(0, savedParts.length - 1);
    const newDir = oldDirParts.join('/');
    return newDir ? `/${newDir}/${nameWithoutExt}` : `/${nameWithoutExt}`;
  }

  // If savedFolder is already equal to defaultOutputFolder, keep it
  if (normSaved === defaultOutputFolder) {
    return defaultOutputFolder;
  }

  // If relativeFolder is present and savedFolder does NOT start with relativeFolder,
  // it means savedFolder was from an old directory location (e.g. 'test/job1').
  // Reset directly to defaultOutputFolder!
  if (normRelative && !normSaved.startsWith(normRelative + '/') && normSaved !== normRelative) {
    return defaultOutputFolder;
  }

  // Extract sub-path within relativeFolder
  const subPath = normRelative && normSaved.startsWith(normRelative + '/')
    ? normSaved.slice(normRelative.length + 1)
    : normSaved;

  const subParts = subPath.split('/').filter(Boolean);

  // If subParts has multiple nested directories (e.g. 'foobar/job1-pipeline/parse-message-pipeline'),
  // it is a corrupted/stale path from earlier app renames. Reset to defaultOutputFolder!
  if (subParts.length > 1) {
    return defaultOutputFolder;
  }

  // Default to standard relative output folder (relativeFolder/nameWithoutExt)
  return defaultOutputFolder;
}
