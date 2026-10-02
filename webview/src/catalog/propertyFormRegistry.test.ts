/**
 * @fileoverview Unit tests for the dedicated property form component registry.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, expect, it } from 'vitest';
import { PROPERTY_FORM_REGISTRY } from './propertyFormRegistry';
import { NODE_DOCUMENTATION_REGISTRY } from './documentation';

describe('PROPERTY_FORM_REGISTRY', () => {
  it('has dedicated panel entries matching the documented node catalog count', () => {
    const registryKeys = Object.keys(PROPERTY_FORM_REGISTRY);
    const documentedKeys = Object.keys(NODE_DOCUMENTATION_REGISTRY);
    expect(registryKeys.length).toBe(documentedKeys.length);
    expect(registryKeys.length).toBeGreaterThan(0);
  });

  it('contains valid component functions or objects for every registered key', () => {
    for (const [key, Component] of Object.entries(PROPERTY_FORM_REGISTRY)) {
      expect(Component, `Entry for key "${key}" must be defined`).toBeDefined();
      const isFunction = typeof Component === 'function';
      const isObjectComponent = typeof Component === 'object' && Component !== null;
      expect(
        isFunction || isObjectComponent,
        `Entry for key "${key}" must be a function or component object, got ${typeof Component}`
      ).toBe(true);
    }
  });
});
