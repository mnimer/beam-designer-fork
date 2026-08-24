/**
 * SidebarItem Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * This component represents a draggable item in the sidebar that can be added to the React-Flow canvas.
 * 
 * Architectural Decisions:
 * - Uses HTML5 drag and drop dataTransfer to transmit nodeType, label, type, iconName, and beamTransform.
 * - Displays an icon mapped dynamically from Lucide React icons.
 * - Supports Streaming Sources, Batch Sources, Transforms, and Sinks.
 */
import React from 'react';
import { Database, Cloud, HardDrive, Cable, Radio, Share2, Clock, Layers, BarChart, Box, FileCode, Terminal, Calendar, Filter, GitMerge, Key, Hash, Shuffle, Activity, Type, Grid, Code, FileText, Folder, ListOrdered, Zap } from 'lucide-react';

const iconComponentMap: Record<string, any> = {
  Radio, Database, Cable, Share2, HardDrive, Cloud, Clock, Layers, BarChart, Box, FileCode, Terminal,
  Calendar, Filter, GitMerge, Key, Hash, Shuffle, Activity, Type, Grid, Code, FileText, Folder, ListOrdered, Zap
};
interface SidebarItemProps {
  label: string;
  type: string;
  iconName: string;
  beamTransform?: string;
  onDragStart: (event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string, beamTransform?: string) => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ label, type, iconName, beamTransform, onDragStart }) => {
  const IconComponent = iconComponentMap[iconName];
  return (
    <div
      className="flex flex-col items-center justify-center px-1 py-1.5 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors min-w-0"
      draggable
      onDragStart={(e) => onDragStart(e, 'pipeline', label, type, iconName, beamTransform)}
    >
      {IconComponent && <IconComponent className="w-5 h-5 text-slate-300 mb-1 shrink-0" />}
      <span className="text-[11px] leading-tight font-medium text-slate-300 text-center max-w-full break-normal [word-break:keep-all] [overflow-wrap:normal] hyphens-none">{label}</span>
    </div>
  );
};
