import type { TransformGenerator, Node } from '../beamGenerator';

export class ParseBase64Generator implements TransformGenerator {
    generate(_node: Node, _indent: number): string {
        return `| "Parse Base64 Message" >> beam.ParDo(ProcessBase64BytesFn())`;
    }
}
