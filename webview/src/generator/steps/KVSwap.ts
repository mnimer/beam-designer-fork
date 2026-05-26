import type { TransformGenerator, Node } from '../beamGenerator';

export class KVSwapGenerator implements TransformGenerator {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    generate(_node: Node, _indent: number): string {
        return `| 'KV Swap' >> beam.KVSwap()`;
    }
}
