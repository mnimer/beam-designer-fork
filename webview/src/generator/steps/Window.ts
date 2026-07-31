import type { TransformGenerator, Node } from '../beamGenerator';

export class WindowGenerator implements TransformGenerator {
    generate(node: Node, _indent: number): string {
        const duration = node.data.properties?.duration || '60';
        return `| 'Window into 1 min' >> beam.WindowInto(beam.window.FixedWindows(${duration}))`;
    }
}
