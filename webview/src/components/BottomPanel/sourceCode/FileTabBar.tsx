/**
 * @fileoverview Vertical file explorer sidebar displaying generated source and configuration files.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React from 'react';
import { FileCode } from 'lucide-react';
import { getFileColorInfo } from './fileTypeColors';

/**
 * Props for the FileTabBar component.
 */
export interface FileTabBarProps {
  /** List of file names to display in the vertical file list. */
  readonly files: string[];
  /** Currently selected file name, or null when defaulting to the first file. */
  readonly selectedFile: string | null;
  /** Callback invoked when a file item is selected. */
  readonly onSelectFile: (fileName: string) => void;
}

/**
 * Renders a vertical sidebar file list for selecting one generated file at a time.
 */
export const FileTabBar: React.FC<FileTabBarProps> = ({
  files,
  selectedFile,
  onSelectFile,
}) => {
  return (
    <aside
      data-testid="generated-files-sidebar-list"
      aria-label="Generated files"
      className="w-56 border-r border-[#30363d] bg-[#161b22] overflow-y-auto shrink-0 p-2 space-y-1 select-none"
    >
      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Generated Files ({files.length})
      </div>
      {files.map((file) => {
        const isSelected = selectedFile === file || (!selectedFile && file === files[0]);
        const colorInfo = getFileColorInfo(file);
        return (
          <button
            key={file}
            type="button"
            onClick={() => onSelectFile(file)}
            data-testid={`generated-file-item-${file}`}
            aria-current={isSelected ? 'true' : undefined}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-mono transition text-left cursor-pointer ${
              isSelected
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-semibold'
                : 'text-slate-400 hover:bg-[#21262d] hover:text-slate-200 border border-transparent'
            }`}
          >
            <FileCode
              className={`w-3.5 h-3.5 shrink-0 ${
                isSelected ? colorInfo.iconColor : 'text-slate-500'
              }`}
            />
            <span className="truncate flex-1">{file}</span>
            {colorInfo.badgeLabel && (
              <span
                className={`px-1 py-0.2 rounded text-[8px] font-sans font-bold uppercase tracking-wider shrink-0 border ${colorInfo.badgeClass}`}
              >
                {colorInfo.badgeLabel}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
};
