import type { TransformGenerator, Node } from '../beamGenerator';

export class ParseMessageGenerator implements TransformGenerator {
    generate(node: Node, _indent: number): string {
        const badTag = `bad_${node.id}`;
        const goodTag = `good_${node.id}`;
        const properties = node.data.properties || {};
        const messageType = properties.messageType || 'JSON';

        if (messageType === 'Base64') {
            return `| "Parse Base64 Message" >> beam.ParDo(ProcessBase64BytesFn(bad_tag='${badTag}')).with_outputs('${badTag}', main='${goodTag}')`;
        } else if (messageType === 'String') {
            return `| "Parse String Message" >> beam.ParDo(ParseStringToStrFn(bad_tag='${badTag}')).with_outputs('${badTag}', main='${goodTag}')`;
        } else {
            // Default to JSON
            return `| "Parse Json to Dict" >> beam.ParDo(ParseJsonToDictFn(bad_tag='${badTag}')).with_outputs('${badTag}', main='${goodTag}')`;
        }
    }
}
