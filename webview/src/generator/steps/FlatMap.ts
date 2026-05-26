import type { TransformGenerator, Node } from '../beamGenerator';

export class FlatMapGenerator implements TransformGenerator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate(_node: Node, _indent: number): string {
        return `| 'FlatMap' >> beam.FlatMap(lambda x: [x])`;
    }
}
