import type { TransformGenerator, Node } from '../beamGenerator';

export class ParseJSONGenerator implements TransformGenerator {
    generate(node: Node, _indent: number): string {
        const badTag = `bad_${node.id}`;
        const goodTag = `good_${node.id}`;
        return `| "Parse Json to Dict" >> beam.ParDo(ParseJsonToDictFn(bad_tag='${badTag}')).with_outputs('${badTag}', main='${goodTag}')`;
    }
}
