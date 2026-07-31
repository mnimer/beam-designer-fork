import type { TransformGenerator, Node } from '../beamGenerator';

export class UserWindowsGenerator implements TransformGenerator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate(node: Node, _indent: number): string {
        const windowFn = node.data.properties?.windowFn || 'beam.window.GlobalWindows()';
        return `| 'User Windows' >> beam.WindowInto(${windowFn})`;
    }
}
