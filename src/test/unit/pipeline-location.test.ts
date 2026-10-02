/**
 * @fileoverview Unit tests for pipeline location computation.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { computePipelineLocation } from '../../editor/pipelineLocation';

describe('computePipelineLocation', () => {
    const ws = path.resolve('/workspace/project');

    it('handles file at workspace root', () => {
        const file = path.resolve('/workspace/project/my-pipeline.beam');
        const result = computePipelineLocation(file, ws);
        expect(result).toEqual({
            relativeFolder: '',
            defaultOutputFolder: 'my-pipeline'
        });
    });

    it('handles nested file inside workspace', () => {
        const file = path.resolve('/workspace/project/pipelines/subfolder/my-pipeline.beam');
        const result = computePipelineLocation(file, ws);
        expect(result).toEqual({
            relativeFolder: path.join('pipelines', 'subfolder'),
            defaultOutputFolder: path.join('pipelines', 'subfolder', 'my-pipeline')
        });
    });

    it('handles file outside workspace', () => {
        const file = path.resolve('/other/location/my-pipeline.beam');
        const result = computePipelineLocation(file, ws);
        expect(result).toEqual({
            relativeFolder: '',
            defaultOutputFolder: 'my-pipeline'
        });
    });

    it('handles undefined workspace folder', () => {
        const file = path.resolve('/workspace/project/my-pipeline.beam');
        const result = computePipelineLocation(file, undefined);
        expect(result).toEqual({
            relativeFolder: '',
            defaultOutputFolder: 'my-pipeline'
        });
    });

    it('does not treat sibling-prefix directory as inside workspace', () => {
        const siblingWs = path.resolve('/ws');
        const fileInSiblingDir = path.resolve('/ws2/x.beam');
        const result = computePipelineLocation(fileInSiblingDir, siblingWs);
        expect(result).toEqual({
            relativeFolder: '',
            defaultOutputFolder: 'x'
        });
    });
});
