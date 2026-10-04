/**
 * @fileoverview Horizontal tab bar displaying generated source and configuration files.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React from 'react';
import { FileCode, FileText } from 'lucide-react';

/**
 * Props for the FileTabBar component.
 */
export interface FileTabBarProps {
  /** List of file names to display as horizontal tabs. */
  files: string[];
  /** Currently selected file name, or null when defaulting to the first file. */
  selectedFile: string | null;
  /** Callback invoked when a file tab is selected. */
  onSelectFile: (fileName: string) => void;
}

/**
 * Helper to pick the appropriate file icon based on file extension.
 *
 * @param fileName File name string.
 * @returns React icon element.
 */
const getFileIcon = (fileName: string): React.ReactElement => {
  if (fileName.endsWith('.py') || fileName.endsWith('.java')) {
    return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  }
  return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
};

/**
 * FileTabBar component rendering horizontal scrollable tabs for generated files.
 *
 * @param props Component properties.
 * @returns React component.
 */
export const FileTabBar: React.FC<FileTabBarProps> = ({
  files,
  selectedFile,
  onSelectFile,
}) => {
  return (
    <div className="flex items-center border-b border-slate-700 bg-[#151722] px-2 overflow-x-auto min-h-[38px] shrink-0 no-scrollbar">
      {files.map((file) => {
        const isSelected = selectedFile === file || (!selectedFile && file === files[0]);
        return (
          <button
            key={file}
            type="button"
            onClick={() => onSelectFile(file)}
            className={`flex items-center gap-2 py-2 px-3 text-xs font-medium border-b-2 transition cursor-pointer shrink-0 whitespace-nowrap ${
              isSelected
                ? 'bg-[#1E202A] text-white border-blue-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-transparent'
            }`}
          >
            {getFileIcon(file)}
            <span className="font-mono">{file}</span>
          </button>
        );
      })}
    </div>
  );
};
