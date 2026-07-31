import type { TransformGenerator, Node } from '../beamGenerator';

export class FilterGenerator implements TransformGenerator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate(_node: Node, _indent: number): string {
        return `| 'Filter' >> beam.Filter(lambda x: True)`;
    }
}
