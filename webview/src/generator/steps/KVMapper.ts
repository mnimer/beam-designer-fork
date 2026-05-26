import type { TransformGenerator, Node } from '../beamGenerator';

export class KVMapperGenerator implements TransformGenerator {
    generate(node: Node, _indent: number): string {
        const keyProp = node.data.properties?.keyPropertyName || '';
        return `| 'KV Mapper' >> beam.Map(lambda x: (x.get('${keyProp}') if isinstance(x, dict) else getattr(x, '${keyProp}', None), x))`;
    }
}
