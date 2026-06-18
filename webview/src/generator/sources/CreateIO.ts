import type { TransformGenerator, Node } from '../beamGenerator';

export class CreateSourceGenerator implements TransformGenerator {
    generate(node: Node, indent: number): string {
        const elements: string[] = node.data.properties?.elements || [];
        const escapedElements = elements.map(el => JSON.stringify(el));
        
        const nextIndent = ' '.repeat(indent + 4);
        
        if (escapedElements.length === 0) {
            return `| 'Create elements' >> beam.Create([])`;
        }
        
        if (escapedElements.length === 1) {
            return `| 'Create elements' >> beam.Create([${escapedElements[0]}])`;
        }

        return `| 'Create elements' >> beam.Create([
${nextIndent}${escapedElements.join(`,\n${nextIndent}`)}
${' '.repeat(indent)}])`;
    }
}
