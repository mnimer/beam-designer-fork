import type { TransformGenerator, Node } from '../beamGenerator';

export class ToStringGenerator implements TransformGenerator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate(_node: Node, _indent: number): string {
        return `| 'To String' >> beam.Map(lambda x: str(x))`;
    }
}
