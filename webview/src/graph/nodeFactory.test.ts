/**
 * @fileoverview Unit tests for nodeFactory module.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createNodeId, createNodesForPaletteItem, type PaletteItem } from './nodeFactory';
import type { PipelineNode } from '../hooks/usePipelineGraph';

describe('nodeFactory', () => {
  describe('createNodeId', () => {
    it('generates 1000 unique node IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const id = createNodeId();
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
      expect(ids.size).toBe(1000);
    });

    it('preserves prefix correctly', () => {
      const kvId = createNodeId('kv_mapper_');
      expect(kvId.startsWith('kv_mapper_')).toBe(true);
      expect(kvId.length).toBeGreaterThan('kv_mapper_'.length);

      const pubSubId = createNodeId('pubsub_');
      expect(pubSubId.startsWith('pubsub_')).toBe(true);
      expect(pubSubId.length).toBeGreaterThan('pubsub_'.length);

      const plainId = createNodeId();
      expect(plainId).not.toContain('kv_mapper_');
      expect(plainId).not.toContain('pubsub_');
    });

    describe('fallback when crypto.randomUUID is not available', () => {
      const originalCrypto = globalThis.crypto;

      afterEach(() => {
        Object.defineProperty(globalThis, 'crypto', {
          value: originalCrypto,
          configurable: true,
          writable: true,
        });
      });

      it('falls back to counter + Math.random when crypto.randomUUID is absent', () => {
        // Temporarily remove randomUUID
        Object.defineProperty(globalThis, 'crypto', {
          value: {},
          configurable: true,
          writable: true,
        });

        const id1 = createNodeId('test_');
        const id2 = createNodeId('test_');

        expect(id1.startsWith('test_')).toBe(true);
        expect(id2.startsWith('test_')).toBe(true);
        expect(id1).not.toBe(id2);
      });
    });
  });

  describe('createNodesForPaletteItem', () => {
    it('yields the two-node pair + edge with the same structure as before for FileIO item', () => {
      const item: PaletteItem = {
        label: 'FileIO',
        type: 'SOURCE',
        iconName: 'Folder',
        beamTransform: 'FileIO',
      };
      const pos = { x: 100, y: 150 };

      const result = createNodesForPaletteItem(item, pos);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);

      const [matchNode, readMatchesNode] = result.nodes;

      // Match node assertions
      expect(matchNode.id).toBeDefined();
      expect(matchNode.type).toBe('pipeline');
      expect(matchNode.position).toEqual({ x: 100, y: 150 });
      expect(matchNode.data).toEqual({
        label: 'FileIO Match',
        type: 'SOURCE',
        iconName: 'Folder',
        beam_transform: 'FileIO.match',
      });

      // Read matches node assertions
      expect(readMatchesNode.id).toBeDefined();
      expect(readMatchesNode.type).toBe('pipeline');
      expect(readMatchesNode.position).toEqual({ x: 340, y: 150 }); // x + 240, y
      expect(readMatchesNode.data).toEqual({
        label: 'FileIO Read Matches',
        type: 'STEP',
        iconName: 'FileCode',
        beam_transform: 'FileIO.readMatches',
      });

      // IDs must be unique
      expect(matchNode.id).not.toBe(readMatchesNode.id);

      // Edge assertions
      const edge = result.edges[0];
      expect(edge.id).toBe(`e-${matchNode.id}-${readMatchesNode.id}`);
      expect(edge.source).toBe(matchNode.id);
      expect(edge.target).toBe(readMatchesNode.id);
    });

    it('preserves custom nodeType when passed for FileIO', () => {
      const item: PaletteItem = {
        label: 'FileIO',
        type: 'SOURCE',
        iconName: 'Folder',
        nodeType: 'customPipelineType',
      };
      const result = createNodesForPaletteItem(item, { x: 50, y: 50 });

      expect(result.nodes[0].type).toBe('customPipelineType');
      expect(result.nodes[1].type).toBe('customPipelineType');
    });

    it('yields one node for a regular item', () => {
      const item: PaletteItem = {
        label: 'BigQuery',
        type: 'SINK',
        iconName: 'Database',
        beamTransform: 'BigQueryIO.write',
      };
      const pos = { x: 200, y: 300 };

      const result = createNodesForPaletteItem(item, pos);

      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(0);

      const node = result.nodes[0];
      expect(node.id).toBeDefined();
      expect(node.type).toBe('pipeline');
      expect(node.position).toEqual(pos);
      expect(node.data).toEqual({
        label: 'BigQuery',
        type: 'SINK',
        iconName: 'Database',
        beam_transform: 'BigQueryIO.write',
      });
    });

    it('omits beam_transform when item does not provide beamTransform', () => {
      const item: PaletteItem = {
        label: 'Custom Step',
        type: 'STEP',
        iconName: 'Cpu',
      };
      const result = createNodesForPaletteItem(item, { x: 0, y: 0 });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].data.beam_transform).toBeUndefined();
    });

    describe('auto-edge wiring for STEP items', () => {
      it('auto-connects Parse Message step to an existing PubSub source', () => {
        const pubsubNode: PipelineNode = {
          id: 'pubsub-123',
          type: 'pipeline',
          position: { x: 0, y: 0 },
          data: {
            label: 'PubSub Source',
            type: 'SOURCE',
            iconName: 'Radio',
            beam_transform: 'PubSubIO',
          },
        };

        const item: PaletteItem = {
          label: 'Parse Message',
          type: 'STEP',
          iconName: 'Code',
        };

        const result = createNodesForPaletteItem(item, { x: 200, y: 0 }, [pubsubNode]);

        expect(result.nodes).toHaveLength(1);
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0]).toEqual({
          id: `e-pubsub-123-${result.nodes[0].id}`,
          source: 'pubsub-123',
          target: result.nodes[0].id,
        });
      });

      it('auto-connects Parse Message step to an existing PubSub source whose label was renamed', () => {
        const pubsubNode: PipelineNode = {
          id: 'pubsub-renamed-456',
          type: 'pipeline',
          position: { x: 0, y: 0 },
          data: {
            label: 'My stream',
            type: 'SOURCE',
            iconName: 'Radio',
            beam_transform: 'PubSubIO',
          },
        };

        const item: PaletteItem = {
          label: 'Parse Message',
          type: 'STEP',
          iconName: 'Code',
        };

        const result = createNodesForPaletteItem(item, { x: 200, y: 0 }, [pubsubNode]);

        expect(result.nodes).toHaveLength(1);
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0]).toEqual({
          id: `e-pubsub-renamed-456-${result.nodes[0].id}`,
          source: 'pubsub-renamed-456',
          target: result.nodes[0].id,
        });
      });

      it('auto-connects first STEP to existing SOURCE when no other STEP exists', () => {
        const sourceNode: PipelineNode = {
          id: 'src-1',
          type: 'pipeline',
          position: { x: 0, y: 0 },
          data: {
            label: 'Generic Source',
            type: 'SOURCE',
            iconName: 'Radio',
          },
        };

        const item: PaletteItem = {
          label: 'Filter',
          type: 'STEP',
          iconName: 'Filter',
        };

        const result = createNodesForPaletteItem(item, { x: 200, y: 0 }, [sourceNode]);

        expect(result.nodes).toHaveLength(1);
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0]).toEqual({
          id: `e-src-1-${result.nodes[0].id}`,
          source: 'src-1',
          target: result.nodes[0].id,
        });
      });

      it('does NOT auto-connect STEP if a STEP already exists in the graph', () => {
        const sourceNode: PipelineNode = {
          id: 'src-1',
          type: 'pipeline',
          position: { x: 0, y: 0 },
          data: {
            label: 'Generic Source',
            type: 'SOURCE',
            iconName: 'Radio',
          },
        };
        const existingStepNode: PipelineNode = {
          id: 'step-1',
          type: 'pipeline',
          position: { x: 200, y: 0 },
          data: {
            label: 'First Step',
            type: 'STEP',
            iconName: 'Code',
          },
        };

        const item: PaletteItem = {
          label: 'Second Step',
          type: 'STEP',
          iconName: 'Code',
        };

        const result = createNodesForPaletteItem(item, { x: 400, y: 0 }, [sourceNode, existingStepNode]);

        expect(result.nodes).toHaveLength(1);
        expect(result.edges).toHaveLength(0);
      });
    });
  });
});
