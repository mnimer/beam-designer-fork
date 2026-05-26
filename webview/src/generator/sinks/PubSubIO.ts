import type { TransformGenerator, Node } from '../beamGenerator';

export class PubSubSinkGenerator implements TransformGenerator {
    generate(node: Node, _indent: number): string {
        const topic = node.data.properties?.topic || 'projects/DEFAULT_PROJECT/topics/DEFAULT_TOPIC';
        return `| 'Write to PubSub' >> beam.io.WriteToPubSub(topic='${topic}')`;
    }
}
