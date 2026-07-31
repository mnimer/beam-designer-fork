import type { TransformGenerator, Node } from '../beamGenerator';

export class MapGenerator implements TransformGenerator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate(_node: Node, _indent: number): string {
        return `| 'Map' >> beam.Map(lambda x: x)`;
    }
}
