import type { TransformGenerator, Node } from '../beamGenerator';

export class ValuesGenerator implements TransformGenerator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate(_node: Node, _indent: number): string {
        return `| 'Values' >> beam.Values()`;
    }
}
