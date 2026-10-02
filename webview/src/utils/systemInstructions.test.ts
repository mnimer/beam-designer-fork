/**
 * @fileoverview Unit tests for resolveSystemInstructions fallback utility.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import { resolveSystemInstructions } from './systemInstructions';

describe('resolveSystemInstructions', () => {
  it('returns empty string when node is undefined or null', () => {
    expect(resolveSystemInstructions()).toBe('');
    expect(resolveSystemInstructions(null)).toBe('');
    expect(resolveSystemInstructions({})).toBe('');
    expect(resolveSystemInstructions({ data: {} })).toBe('');
    expect(resolveSystemInstructions({ data: { properties: {} } })).toBe('');
  });

  it('level 4: falls back to node.data.properties.special_instructions', () => {
    const node = {
      data: {
        properties: {
          special_instructions: 'props special text',
        },
      },
    };
    expect(resolveSystemInstructions(node)).toBe('props special text');
  });

  it('level 3: prefers node.data.properties.system_instructions over properties.special_instructions', () => {
    const node = {
      data: {
        properties: {
          system_instructions: 'props system text',
          special_instructions: 'props special text',
        },
      },
    };
    expect(resolveSystemInstructions(node)).toBe('props system text');
  });

  it('level 2: prefers node.data.special_instructions over properties.system_instructions', () => {
    const node = {
      data: {
        special_instructions: 'data special text',
        properties: {
          system_instructions: 'props system text',
          special_instructions: 'props special text',
        },
      },
    };
    expect(resolveSystemInstructions(node)).toBe('data special text');
  });

  it('level 1: prefers node.data.system_instructions over all fallbacks', () => {
    const node = {
      data: {
        system_instructions: 'data system text',
        special_instructions: 'data special text',
        properties: {
          system_instructions: 'props system text',
          special_instructions: 'props special text',
        },
      },
    };
    expect(resolveSystemInstructions(node)).toBe('data system text');
  });
});
