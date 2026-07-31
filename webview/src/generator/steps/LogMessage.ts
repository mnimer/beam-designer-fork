import type { TransformGenerator, Node } from '../beamGenerator';

export class LogMessageGenerator implements TransformGenerator {
    generate(node: Node, _indent: number): string {
        const badTag = `bad_${node.id}`;
        const goodTag = `good_${node.id}`;
        const properties = node.data.properties || {};
        const logLevel = properties.logLevel || 'Info';

        return `| "Log Message" >> beam.ParDo(LogMessageFn(log_level='${logLevel}', bad_tag='${badTag}')).with_outputs('${badTag}', main='${goodTag}')`;
    }
}
