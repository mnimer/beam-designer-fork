import type { TransformGenerator, Node } from '../beamGenerator';

export class SlidingWindowsGenerator implements TransformGenerator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate(node: Node, _indent: number): string {
        const size = node.data.properties?.size || '60';
        const period = node.data.properties?.period || '30';
        return `| 'Sliding Windows' >> beam.WindowInto(beam.window.SlidingWindows(size=${size}, period=${period}))`;
    }
}
