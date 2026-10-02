/**
 * @fileoverview Unit tests for the node documentation catalog registries and merged index.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, expect, it } from 'vitest';
import {
  NODE_DOCUMENTATION_REGISTRY,
  SINK_DOCS,
  SOURCE_DOCS,
  TRANSFORM_DOCS,
} from './index';

describe('Node Documentation Catalog', () => {
  it('has no duplicate keys across sources, transforms, and sinks', () => {
    const sourceKeys = Object.keys(SOURCE_DOCS);
    const transformKeys = Object.keys(TRANSFORM_DOCS);
    const sinkKeys = Object.keys(SINK_DOCS);

    const transformSet = new Set(transformKeys);
    const sinkSet = new Set(sinkKeys);

    const dupSourceTransform = sourceKeys.filter((k) => transformSet.has(k));
    const dupSourceSink = sourceKeys.filter((k) => sinkSet.has(k));
    const dupTransformSink = transformKeys.filter((k) => sinkSet.has(k));

    expect(dupSourceTransform).toEqual([]);
    expect(dupSourceSink).toEqual([]);
    expect(dupTransformSink).toEqual([]);
  });

  it('merged registry size equals the sum of the three category maps', () => {
    const sourceCount = Object.keys(SOURCE_DOCS).length;
    const transformCount = Object.keys(TRANSFORM_DOCS).length;
    const sinkCount = Object.keys(SINK_DOCS).length;
    const mergedCount = Object.keys(NODE_DOCUMENTATION_REGISTRY).length;

    expect(mergedCount).toBe(sourceCount + transformCount + sinkCount);
  });

  it('every entry has a non-empty title, description, and docsUrl', () => {
    for (const [key, doc] of Object.entries(NODE_DOCUMENTATION_REGISTRY)) {
      expect(doc.title, `Empty title for key: ${key}`).toBeTruthy();
      expect(doc.title.trim().length, `Whitespace title for key: ${key}`).toBeGreaterThan(0);

      expect(doc.description, `Empty description for key: ${key}`).toBeTruthy();
      expect(doc.description.trim().length, `Whitespace description for key: ${key}`).toBeGreaterThan(0);

      expect(doc.docsUrl, `Empty docsUrl for key: ${key}`).toBeTruthy();
      expect(doc.docsUrl.trim().length, `Whitespace docsUrl for key: ${key}`).toBeGreaterThan(0);
      expect(doc.docsUrl, `Invalid URL format for key: ${key}`).toMatch(/^https?:\/\//);
    }
  });
});
