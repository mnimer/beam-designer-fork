import type { TransformGenerator, Node } from '../beamGenerator';

export class FixedWindowsGenerator implements TransformGenerator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate(node: Node, _indent: number): string {
        const duration = node.data.properties?.duration || '60';
        return `| 'Fixed Windows' >> beam.WindowInto(beam.window.FixedWindows(${duration}))`;
    }
}
