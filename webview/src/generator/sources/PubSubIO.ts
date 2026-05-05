import type { TransformGenerator, Node } from '../beamGenerator';

export class PubSubSourceGenerator implements TransformGenerator {
    generate(node: Node, _indent: number): string {
        const topic = node.data.properties?.topic || 'projects/DEFAULT_PROJECT/topics/DEFAULT_TOPIC';
        return `| 'Read from PubSub (${node.id})' >> beam.io.ReadFromPubSub(topic='${topic}')`;
    }
}
