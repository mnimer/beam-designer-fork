import type { TransformGenerator, Node } from '../beamGenerator';

export class ParseBase64Generator implements TransformGenerator {
    generate(node: Node, _indent: number): string {
        const badTag = `bad_${node.id}`;
        const goodTag = `good_${node.id}`;
        return `| "Parse Base64 Message" >> beam.ParDo(ProcessBase64BytesFn(bad_tag='${badTag}')).with_outputs('${badTag}', main='${goodTag}')`;
    }
}
