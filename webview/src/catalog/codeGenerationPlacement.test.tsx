/**
 * @fileoverview Guard test: every dedicated property panel renders its Code Generation
 * Instructions block pushed to the bottom of the panel.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * The push is achieved by the flexible spacer that SystemInstructionsField renders
 * immediately before its wrapper. That only works when:
 *   1. the spacer is the wrapper's immediate previous sibling (no duplicate hand-rolled spacer),
 *   2. both are DIRECT children of the panel root, and
 *   3. the panel root is a `flex-1 flex flex-col` container that fills the panel height.
 */

import { describe, expect, it } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PROPERTY_FORM_REGISTRY } from './propertyFormRegistry';

/**
 * Derives the node type from a registry key prefix.
 *
 * @param key Registry key such as `SOURCE:PubSubIO`.
 * @returns The node type string used by panels.
 */
function nodeTypeForKey(key: string): string {
  if (key.startsWith('SOURCE:')) return 'source';
  if (key.startsWith('SINK:')) return 'sink';
  return 'transform';
}

/**
 * Inspects a rendered panel and returns a placement problem description, or null when valid.
 *
 * @param container The render container holding the panel.
 * @returns Problem description, `'absent'` when the panel has no instructions field, or null.
 */
function placementProblem(container: HTMLElement): string | null | 'absent' {
  const textarea = container.querySelector('textarea[name="system_instructions"]');
  if (!textarea) return 'absent';
  const wrapper = textarea.closest('[data-codegen-instructions]');
  if (!wrapper) return 'instructions textarea is not rendered via SystemInstructionsField';
  const spacer = wrapper.previousElementSibling;
  if (!spacer || !spacer.hasAttribute('data-codegen-spacer')) {
    return 'spacer is not the immediate previous sibling of the instructions block';
  }
  const beforeSpacer = spacer.previousElementSibling;
  if (beforeSpacer && /\bflex-1\b/.test(beforeSpacer.className) && beforeSpacer.children.length === 0) {
    return 'redundant hand-rolled flex spacer precedes the built-in spacer';
  }
  const root = container.firstElementChild;
  if (wrapper.parentElement !== root) {
    return 'instructions block is not a direct child of the panel root';
  }
  const cls = root?.className ?? '';
  if (!/\bflex-1\b/.test(cls) || !/\bflex-col\b/.test(cls)) {
    return `panel root must be "flex-1 flex flex-col" (got "${cls}")`;
  }
  return null;
}

describe('Code Generation Instructions placement', () => {
  it('is pushed to the bottom of every dedicated property panel', () => {
    const seen = new Set<unknown>();
    const problems: string[] = [];
    let checked = 0;

    for (const [key, Component] of Object.entries(PROPERTY_FORM_REGISTRY)) {
      if (seen.has(Component)) continue;
      seen.add(Component);
      const type = nodeTypeForKey(key);
      const beamTransform = key.includes(':') ? key.split(':')[1] : key;
      const node = {
        id: 'placement-node',
        type,
        data: { label: beamTransform, type, beam_transform: beamTransform, properties: {} },
      };
      const { container } = render(<Component node={node} onChange={() => {}} />);
      const problem = placementProblem(container);
      cleanup();
      if (problem === 'absent') continue;
      checked++;
      if (problem) problems.push(`${key}: ${problem}`);
    }

    expect(checked).toBeGreaterThan(100);
    expect(problems, problems.join('\n')).toEqual([]);
  }, 60_000); // renders ~150 panels; the default 5s timeout is too tight on a loaded machine
});
