/** @fileoverview Central registry and resolver for node category and transform icons.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart,
  Box,
  Cable,
  Calendar,
  Clock,
  Cloud,
  Code,
  Cpu,
  Database,
  FileCode,
  FileText,
  Filter,
  Folder,
  GitMerge,
  Grid,
  HardDrive,
  Hash,
  Key,
  Layers,
  ListOrdered,
  Radio,
  Share2,
  Shuffle,
  Terminal,
  Type,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react';

/**
 * Single canonical registry mapping icon identifier strings to Lucide React icon components.
 * Represents the union of all icon mappings across the canvas, palette, and property pane.
 */
export const NODE_ICON_COMPONENTS: Record<string, LucideIcon> = {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart,
  Box,
  Cable,
  Calendar,
  Clock,
  Cloud,
  Code,
  Cpu,
  Database,
  FileCode,
  FileText,
  Filter,
  Folder,
  GitMerge,
  Grid,
  HardDrive,
  Hash,
  Key,
  Layers,
  ListOrdered,
  Radio,
  Share2,
  Shuffle,
  Terminal,
  Type,
  Workflow,
  Wrench,
  Zap,
};

/**
 * Resolves an icon component for a given node icon name.
 * Returns the mapped Lucide icon component, or the provided fallback (defaults to Box).
 *
 * @param name - The icon identifier string from the node definition or data payload.
 * @param fallback - Optional fallback LucideIcon to return when name is missing or unknown. Defaults to Box.
 * @returns The resolved LucideIcon component.
 */
export function getNodeIcon(name: string | undefined, fallback: LucideIcon = Box): LucideIcon {
  if (name && Object.prototype.hasOwnProperty.call(NODE_ICON_COMPONENTS, name)) {
    return NODE_ICON_COMPONENTS[name];
  }
  return fallback;
}
