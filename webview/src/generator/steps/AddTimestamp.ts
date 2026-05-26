import type { TransformGenerator, Node } from '../beamGenerator';

export class AddTimestampGenerator implements TransformGenerator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate(_node: Node, _indent: number): string {
        return `| 'Add Timestamp' >> beam.Map(lambda x: beam.window.TimestampedValue(x, time.time()))`;
    }
}
