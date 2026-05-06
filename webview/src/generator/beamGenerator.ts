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



/**
 * BeamGenerator
 * 
 * This class is responsible for generating Apache Beam Python code,
 * requirements.txt, and Dockerfile from a YAML pipeline definition.
 * 
 * Architectural Decisions:
 * - Moved content generation for requirements.txt and Dockerfile here to centralize generation logic.
 * - Returns an object containing all generated file contents.
 */
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

    /**
     * Generates pipeline files from YAML string.
     * @param yamlStr The YAML representation of the pipeline.
     * @param filename The base name of the pipeline file.
     * @returns Object containing python, requirements, and dockerfile content.
     */
    /**
     * Generates pipeline files from YAML string.
     * @param yamlStr The YAML representation of the pipeline.
     * @param filename The base name of the pipeline file.
     * @returns Object containing python, requirements, and dockerfile content.
     */
    public generate(yamlStr: string, filename: string): { python: string, requirements: string, dockerfile: string } {
        // Parse YAML and generate files
        try {
            const data = YAML.parse(yamlStr) as PipelineData;
            
            // Generate Python code
            const python = this.generateFromData(data);
            
            // Generate requirements.txt content, passing data to check for nodes
            const requirements = this.generateRequirements(data);
            
            // Generate Dockerfile content, removing .pipeline extension from filename if present
            const dockerfile = this.generateDockerfile(filename.replace('.pipeline', ''));
            
            return { python, requirements, dockerfile };
        } catch (e) {
            console.error('Failed to parse YAML in generator', e);
            return {
                python: `# Error parsing pipeline YAML: ${e}`,
                requirements: '',
                dockerfile: ''
            };
        }
    }

    /**
     * Generates content for requirements.txt based on nodes in the pipeline.
     * @param data Parsed pipeline data.
     */
    private generateRequirements(data: PipelineData): string {
        let reqs = 'apache-beam\n';
        
        // Check for PubSub nodes
        const hasPubSub = data.nodes.some(n => n.data.label.includes('PubSub'));
        // Check for BigQuery nodes
        const hasBigQuery = data.nodes.some(n => n.data.label.includes('BigQuery'));
        
        if (hasPubSub) {
            reqs += 'google-cloud-pubsub\n';
        }
        if (hasBigQuery) {
            reqs += 'google-cloud-bigquery\n';
        }
        
        return reqs;
    }

    /**
     * Generates content for Dockerfile.
     * @param pipelineBaseName Base name of the pipeline file.
     */
    private generateDockerfile(pipelineBaseName: string): string {
        return `ARG IMAGE_PYTHON_VERSION=3.11

# --- Stage 1: Get Python Flex Template Launcher Binary ---
FROM gcr.io/dataflow-templates-base/python3-template-launcher-base:latest AS launcher

# --- Stage 2: Build Application Image ---
FROM apache/beam_python\${IMAGE_PYTHON_VERSION}_sdk:2.55.0

# 1. Copy Flex Template launcher binary (Path is STRICT)
COPY --from=launcher /opt/google/dataflow/python_template_launcher /opt/google/dataflow/python_template_launcher

# 2. Set working directory
WORKDIR /template

# 3. Copy files
COPY requirements.txt .
COPY ${pipelineBaseName}.py .

# 4. Install Python Dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 5. Specify Pipeline Entrypoint
ENV FLEX_TEMPLATE_PYTHON_PY_FILE=/template/${pipelineBaseName}.py
`;
    }

    /**
     * Generates Python code from pipeline data.
     * @param data Parsed pipeline data.
     */
    private generateFromData(data: PipelineData): string {
        // Initialize python code with imports
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

        // Find source nodes and generate branch for each
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
