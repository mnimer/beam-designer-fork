import YAML from 'yaml';
import { PubSubSourceGenerator } from './sources/PubSubIO';
import { BigQuerySinkGenerator } from './sinks/BigQueryIO';
import { WindowGenerator } from './steps/Window';

export interface Node {
    id: string;
    type: string;
    data: {
        label: string;
        type: string;
        iconName: string;
        properties?: any;
    };
}

interface Edge {
    source: string;
    target: string;
    id: string;
}

interface PipelineData {
    nodes: Node[];
    edges: Edge[];
    runtimeVariables?: { key: string, value: string }[];
    jobConfig?: {
        runner: string;
        machineType: string;
        minInstances: number;
        maxInstances: number;
    };
}

export interface TransformGenerator {
    generate(node: Node, indent: number): string;
}



export class BeamGenerator {
    private generators: Record<string, TransformGenerator> = {};

    constructor() {
        this.registerGenerators();
    }

    private registerGenerators() {
        this.generators['PubSub_SOURCE'] = new PubSubSourceGenerator();
        this.generators['BigQuery_SINK'] = new BigQuerySinkGenerator();
        this.generators['Windows_STEP'] = new WindowGenerator();
    }

    public generate(yamlStr: string): string {
        try {
            const data = YAML.parse(yamlStr) as PipelineData;
            return this.generateFromData(data);
        } catch (e) {
            console.error('Failed to parse YAML in generator', e);
            return `# Error parsing pipeline YAML: ${e}`;
        }
    }

    private generateFromData(data: PipelineData): string {
        let code = `import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions
import argparse

def run(argv=None):
    parser = argparse.ArgumentParser()
`;

        // Add runtime variables as arguments
        if (data.runtimeVariables) {
            data.runtimeVariables.forEach(v => {
                code += `    parser.add_argument('--${v.key}', default='${v.value}')\n`;
            });
        }

        code += `
    known_args, pipeline_args = parser.parse_known_args(argv)
    
    # Merge jobConfig into pipeline_args if needed
    # For now we assume runner is passed or defaults to DirectRunner
    
    options = PipelineOptions(pipeline_args)
    
    with beam.Pipeline(options=options) as p:
`;

        // Find source nodes
        const sources = data.nodes.filter(n => n.data.type === 'SOURCE');

        sources.forEach(source => {
            code += `        # Branch starting from ${source.data.label}\n`;
            code += `        (\n`;
            code += `            p\n`;
            code += `${this.generateNodeCode(source, data, 12)}`;
            code += `        )\n\n`;
        });

        code += `if __name__ == '__main__':
    run()
`;
        return code;
    }

    private generateNodeCode(node: Node, data: PipelineData, indent: number): string {
        const key = `${node.data.label}_${node.data.type}`;
        const generator = this.generators[key];
        
        const indentStr = ' '.repeat(indent);
        let code = '';
        if (generator) {
            code = `${indentStr}${generator.generate(node, indent)}\n`;
        } else {
            code = `${indentStr}# No generator for ${key}\n`;
        }

        // Find next nodes
        const outgoingEdges = data.edges.filter(e => e.source === node.id);
        outgoingEdges.forEach(edge => {
            const nextNode = data.nodes.find(n => n.id === edge.target);
            if (nextNode) {
                code += this.generateNodeCode(nextNode, data, indent);
            }
        });

        return code;
    }
}
