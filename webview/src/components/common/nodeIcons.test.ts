/** @fileoverview Tests for the shared nodeIcons registry and getNodeIcon resolver.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import { Box, HelpCircle } from 'lucide-react';
import { getNodeIcon, NODE_ICON_COMPONENTS } from './nodeIcons';
import { SOURCE_NODES, STEP_NODES, SINK_NODES } from '../../catalog/nodes';

describe('nodeIcons registry and resolver', () => {
  // (a) every key from all three original maps resolves (hard-code the union key list in the test)
  const UNION_KEYS = [
    'Activity',
    'ArrowDownToLine',
    'ArrowUpFromLine',
    'BarChart',
    'Box',
    'Cable',
    'Calendar',
    'Clock',
    'Cloud',
    'Code',
    'Cpu',
    'Database',
    'FileCode',
    'FileText',
    'Filter',
    'Folder',
    'GitMerge',
    'Grid',
    'HardDrive',
    'Hash',
    'Key',
    'Layers',
    'ListOrdered',
    'Radio',
    'Share2',
    'Shuffle',
    'Terminal',
    'Type',
    'Workflow',
    'Wrench',
    'Zap',
  ];

  it('resolves every key from the union of all three original maps', () => {
    expect(Object.keys(NODE_ICON_COMPONENTS)).toHaveLength(UNION_KEYS.length);

    for (const key of UNION_KEYS) {
      expect(NODE_ICON_COMPONENTS[key]).toBeDefined();
      const resolved = getNodeIcon(key);
      expect(resolved).toBe(NODE_ICON_COMPONENTS[key]);
    }
  });

  // (b) every icon name used in catalog/nodes resolves
  it('resolves every icon name used in catalog/nodes definitions', () => {
    const allCatalogNodes = [...SOURCE_NODES, ...STEP_NODES, ...SINK_NODES];
    expect(allCatalogNodes.length).toBeGreaterThan(0);

    for (const node of allCatalogNodes) {
      const icon = getNodeIcon(node.iconName);
      expect(icon).toBeDefined();
      expect(NODE_ICON_COMPONENTS[node.iconName]).toBeDefined();
      expect(icon).toBe(NODE_ICON_COMPONENTS[node.iconName]);
    }
  });

  // (c) unknown name returns the fallback
  it('returns explicit or default fallback for unknown, empty, or undefined icon names', () => {
    // When custom fallback is provided
    expect(getNodeIcon('NonExistentIcon', HelpCircle)).toBe(HelpCircle);
    expect(getNodeIcon(undefined, HelpCircle)).toBe(HelpCircle);
    expect(getNodeIcon('', HelpCircle)).toBe(HelpCircle);

    // When no fallback is provided, defaults to Box
    expect(getNodeIcon('NonExistentIcon')).toBe(Box);
    expect(getNodeIcon(undefined)).toBe(Box);
    expect(getNodeIcon('')).toBe(Box);
  });
});
