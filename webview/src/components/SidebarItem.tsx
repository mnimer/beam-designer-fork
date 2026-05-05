import React from 'react';
import { Database, Cloud, HardDrive, Cable, Radio, Share2, Clock, Layers, BarChart, Box, FileCode } from 'lucide-react';

const iconComponentMap: Record<string, any> = {
  Radio, Database, Cable, Share2, HardDrive, Cloud, Clock, Layers, BarChart, Box, FileCode
};

/**
 * SidebarItem Component
 * 
 * This component represents a draggable item in the sidebar that can be added to the canvas.
 * 
 * Architectural Decisions:
 * - Uses HTML5 drag and drop.
 * - Displays an icon and a label.
 */
interface SidebarItemProps {
  label: string;
  type: string;
  iconName: string;
  onDragStart: (event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string) => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ label, type, iconName, onDragStart }) => {
  const IconComponent = iconComponentMap[iconName];
  return (
    <div
      className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors"
      draggable
      onDragStart={(e) => onDragStart(e, 'pipeline', label, type, iconName)}
    >
      {IconComponent && <IconComponent className="w-6 h-6 text-slate-300 mb-1" />}
      <span className="text-xs text-slate-300 mt-1">{label}</span>
    </div>
  );
};
