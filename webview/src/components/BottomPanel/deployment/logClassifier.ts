/**
 * @fileoverview Pure classification helper for execution log line styling.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Classifies a log line and determines the appropriate Tailwind CSS color/style classes.
 *
 * @param line - The raw string line of the log entry.
 * @param stream - Stream type: 'stdout' or 'stderr'.
 * @returns Tailwind CSS classes string for styling the log line.
 */
export function getLogLineColorClass(line: string, stream?: 'stdout' | 'stderr'): string {
  const upper = line.toUpperCase();
  let colorClass = 'text-slate-200';

  if (line.startsWith('[Execution completed')) {
    colorClass = 'text-emerald-400 font-bold';
  } else if (line.startsWith('[Execution stopped')) {
    colorClass = 'text-amber-400 font-bold';
  } else if (line.startsWith('[Execution failed') || line.startsWith('[Process execution error') || line.startsWith('[Error]')) {
    colorClass = 'text-rose-400 font-bold';
  } else if (
    upper.includes('[SUCCESS]') || 
    upper.includes('BUILD SUCCESS') || 
    upper.includes('SUCCESS:') ||
    upper.includes('STATE DONE') ||
    upper.includes('FINISHED SUCCESSFULLY')
  ) {
    colorClass = 'text-emerald-400';
  } else if (
    upper.includes('[WARNING]') || 
    upper.includes('[WARN]') || 
    upper.includes('WARN ') || 
    upper.includes('WARNING:') ||
    upper.includes('DEPRECATED')
  ) {
    colorClass = 'text-amber-400';
  } else if (
    upper.includes('[ERROR]') || 
    upper.includes('ERROR:') || 
    upper.includes('EXCEPTION') || 
    upper.includes('FATAL') || 
    upper.includes('BUILD FAILURE')
  ) {
    colorClass = 'text-rose-400';
  } else if (
    upper.includes('[INFO]') || 
    upper.includes('INFO ') || 
    upper.includes('[DEBUG]') || 
    upper.includes('DEBUG ')
  ) {
    colorClass = 'text-slate-200';
  } else if (stream === 'stderr') {
    // Generic stderr messages that aren't marked as INFO/SUCCESS/WARN
    colorClass = 'text-slate-300';
  }

  return colorClass;
}

/**
 * Alias for getLogLineColorClass.
 */
export const classifyLogLine = getLogLineColorClass;
