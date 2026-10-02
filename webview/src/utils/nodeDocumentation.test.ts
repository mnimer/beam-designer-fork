/** @fileoverview Unit tests for node documentation utilities and SELF_DOCUMENTED_TRANSFORMS set.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hasInlineNodeDocsCard,
  getNodeDocumentation,
  openNodeDocs,
} from './nodeDocumentation';

describe('nodeDocumentation', () => {
  describe('hasInlineNodeDocsCard', () => {
    it('returns true when beam_transform is in SELF_DOCUMENTED_TRANSFORMS', () => {
      expect(hasInlineNodeDocsCard({ data: { beam_transform: 'CloudBigtable' } })).toBe(true);
      expect(hasInlineNodeDocsCard({ data: { beam_transform: 'Count' } })).toBe(true);
      expect(hasInlineNodeDocsCard({ data: { beam_transform: 'Flatten' } })).toBe(true);
    });

    it('returns true when componentType is in SELF_DOCUMENTED_TRANSFORMS (fallback)', () => {
      expect(hasInlineNodeDocsCard({ data: { componentType: 'CloudSQL' } })).toBe(true);
      expect(hasInlineNodeDocsCard({ data: { componentType: 'Sum' } })).toBe(true);
    });

    it('returns false for transforms not in the set or when empty/null', () => {
      expect(hasInlineNodeDocsCard({ data: { beam_transform: 'PubSubIO' } })).toBe(false);
      expect(hasInlineNodeDocsCard({ data: { beam_transform: 'UnknownTransform' } })).toBe(false);
      expect(hasInlineNodeDocsCard({})).toBe(false);
      expect(hasInlineNodeDocsCard(null)).toBe(false);
      expect(hasInlineNodeDocsCard(undefined)).toBe(false);
    });
  });

  describe('getNodeDocumentation', () => {
    it('resolves metadata using qualified key nodeType:transform when available', () => {
      const doc = getNodeDocumentation({
        data: {
          type: 'SOURCE',
          beam_transform: 'PubSubIO',
          label: 'Pub/Sub Source',
        },
      });
      expect(doc).toBeDefined();
      expect(doc?.title).toContain('Pub/Sub');
    });

    it('falls back to transform name or label when qualified key is absent', () => {
      const doc = getNodeDocumentation({
        data: {
          type: 'CUSTOM',
          beam_transform: 'ParDo',
          label: 'My ParDo Step',
        },
      });
      expect(doc).toBeDefined();
      expect(doc?.title).toContain('ParDo');
    });

    it('returns undefined when node has no matching documentation or is empty', () => {
      expect(getNodeDocumentation({ data: { beam_transform: 'NonExistentXYZ' } })).toBeUndefined();
      expect(getNodeDocumentation(null)).toBeUndefined();
      expect(getNodeDocumentation(undefined)).toBeUndefined();
    });
  });

  describe('openNodeDocs', () => {
    const originalVscode = (window as unknown as { vscode?: unknown }).vscode;

    beforeEach(() => {
      delete (window as unknown as { vscode?: unknown }).vscode;
    });

    afterEach(() => {
      (window as unknown as { vscode?: unknown }).vscode = originalVscode;
    });

    it('posts openExternal command message when window.vscode is defined', () => {
      const postMessageMock = vi.fn();
      (window as unknown as { vscode?: { postMessage: (msg: unknown) => void } }).vscode = {
        postMessage: postMessageMock,
      };

      openNodeDocs('https://beam.apache.org');
      expect(postMessageMock).toHaveBeenCalledWith({
        command: 'openExternal',
        url: 'https://beam.apache.org',
      });
    });

    it('does nothing without throwing when window.vscode is undefined', () => {
      expect(() => openNodeDocs('https://beam.apache.org')).not.toThrow();
    });
  });
});
