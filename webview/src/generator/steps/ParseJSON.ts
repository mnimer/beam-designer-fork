import type { TransformGenerator, Node } from '../beamGenerator';

export class ParseJSONGenerator implements TransformGenerator {
    generate(_node: Node, _indent: number): string {
        return `| "Parse Json to Dict" >> beam.ParDo(ParseJsonToDictFn())`;
    }
}
