import YAML from 'yaml';
import { PubSubSourceGenerator } from './sources/PubSubIO';
import { BigQuerySinkGenerator } from './sinks/BigQueryIO';
import { WindowGenerator } from './steps/Window';
import { ParseJSONGenerator } from './steps/ParseJSON';
import { ParseBase64Generator } from './steps/ParseBase64';

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
        gcsStagingPath?: string;
        subnetwork?: string;
    };
}

export interface TransformGenerator {
    generate(node: Node, indent: number): string;
}



/**
 * BeamGenerator
 * 
 * This class is responsible for generating Apache Beam Python code,
 * requirements.txt, Dockerfile, and run_directrunner.sh from a YAML pipeline definition.
 * 
 * Architectural Decisions:
 * - Moved content generation for requirements.txt and Dockerfile here to centralize generation logic.
 * - Returns an object containing all generated file contents.
 * - Added runScript generation to simplify local execution.
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
        this.generators['Fixed Window_STEP'] = new WindowGenerator();
        this.generators['Parse JSON_STEP'] = new ParseJSONGenerator();
        this.generators['Parse Base64_STEP'] = new ParseBase64Generator();
    }

    /**
     * Generates pipeline files from YAML string.
     * @param yamlStr The YAML representation of the pipeline.
     * @param filename The base name of the pipeline file.
     * @returns Object containing python, requirements, dockerfile, and runScript content.
     */
    public generate(yamlStr: string, filename: string, projectId?: string, gcsStagingPath?: string): { python: string, requirements: string, dockerfile: string, runScript: string, runDataflowScript: string, dockerIgnore: string, gcloudIgnore: string } {
        // Parse YAML and generate files
        try {
            const data = YAML.parse(yamlStr) as PipelineData;
            
            // Generate Python code
            const python = this.generateFromData(data);
            
            // Generate requirements.txt content, passing data to check for nodes
            const requirements = this.generateRequirements(data);
            
            // Generate Dockerfile content, removing .pipeline extension from filename if present
            const dockerfile = this.generateDockerfile(filename.replace('.pipeline', ''));

            // Generate run_directrunner.sh content, passing data to check for streaming sources
            const runScript = this.generateRunScript(filename.replace('.pipeline', ''), data);

            // Generate run_dataflow.sh content, passing data to check for streaming sources
            const runDataflowScript = this.generateDataflowScript(filename.replace('.pipeline', ''), data, projectId, gcsStagingPath);

            // Generate .dockerignore content
            const dockerIgnore = this.generateDockerIgnore();
            
            return { python, requirements, dockerfile, runScript, runDataflowScript, dockerIgnore, gcloudIgnore: dockerIgnore };
        } catch (e) {
            console.error('Failed to parse YAML in generator', e);
            return {
                python: `# Error parsing pipeline YAML: ${e}`,
                requirements: '',
                dockerfile: '',
                runScript: '',
                runDataflowScript: '',
                dockerIgnore: '',
                gcloudIgnore: ''
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
            // Add missing dependencies for Beam on newer Python versions when using BigQuery
            reqs += 'google-apitools\n';
            reqs += 'regex\n';
            reqs += 'pyOpenSSL\n';
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
     * Generates content for run_directrunner.sh.
     * @param pipelineBaseName Base name of the pipeline file.
     * @param data Parsed pipeline data.
     */
    private generateRunScript(pipelineBaseName: string, data: PipelineData): string {
        const hasPubSub = data.nodes.some(n => n.data.label.includes('PubSub'));
        const streamingFlag = hasPubSub ? ' --streaming' : '';
        
        return `#!/bin/bash
# Auto-generated by Apache Beam Designer

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Running pipeline..."
python -m "${pipelineBaseName}" --runner=DirectRunner${streamingFlag}
`;
    }

    /**
     * Generates content for run_dataflow.sh.
     * @param pipelineBaseName Base name of the pipeline file.
     * @param data Parsed pipeline data.
     */
    private generateDataflowScript(pipelineBaseName: string, data: PipelineData, projectId?: string, gcsStagingPath?: string): string {
        const hasPubSub = data.nodes.some(n => n.data.label.includes('PubSub'));
        const streamingParam = hasPubSub ? ',streaming=true' : '';
        
        const project = projectId || 'YOUR_PROJECT_ID';
        const bucket = gcsStagingPath ? gcsStagingPath.replace('gs://', '') : 'YOUR_TEMPLATE_BUCKET';
        
        const subnetwork = data.jobConfig?.subnetwork;
        const subnetworkFlag = subnetwork ? ` \\\n    --subnetwork="${subnetwork}"` : '';
        
        return `#!/bin/bash
# Auto-generated by Apache Beam Designer

# Set your variables here or ensure they are in your environment
PROJECT_ID=\${PROJECT_ID:-"${project}"}
REGION=\${REGION:-"us-central1"}
REPOSITORY=\${REPOSITORY:-"beam-pipelines"}
IMAGE_NAME=\${IMAGE_NAME:-"${pipelineBaseName}"}
TAG=\${TAG:-"latest"}
TEMPLATE_BUCKET=\${TEMPLATE_BUCKET:-"${bucket}"}

IMAGE_URI="\${REGION}-docker.pkg.dev/\${PROJECT_ID}/\${REPOSITORY}/\${IMAGE_NAME}:\${TAG}"
TEMPLATE_PATH="gs://\${TEMPLATE_BUCKET}/templates/\${IMAGE_NAME}.json"

echo "Building and pushing Docker image..."
gcloud builds submit --tag "\${IMAGE_URI}" .

echo "Building Flex Template..."
gcloud dataflow flex-template build "\${TEMPLATE_PATH}" \\
    --image "\${IMAGE_URI}" \\
    --sdk-language "PYTHON"

echo "Running Flex Template..."
gcloud dataflow flex-template run "\${IMAGE_NAME}-\$(date +%Y%m%d-%H%M%S)" \\
    --template-file-gcs-location "\${TEMPLATE_PATH}" \\
    --region "\${REGION}"${subnetworkFlag} \\
    --parameters runner=DataflowRunner${streamingParam}
`;
    }

    /**
     * Generates content for .dockerignore.
     */
    private generateDockerIgnore(): string {
        return `.git
.venv
node_modules
__pycache__
*.pipeline
*.tf
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
import json
import logging

`;

        code += `def run(argv=None):
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

        // Collect ParDos in order of usage
        const parDoDefinitions: string[] = [];
        const seenParDos = new Set<string>();
        const seenNodes = new Set<string>();

        sources.forEach(source => {
            this.collectParDos(source, data, parDoDefinitions, seenParDos, seenNodes);
        });

        // Append ParDo definitions
        if (parDoDefinitions.length > 0) {
            code += '\n';
            code += parDoDefinitions.join('\n');
            code += '\n';
        }

        code += `if __name__ == '__main__':
    run()
`;
        return code;
    }

    private collectParDos(node: Node, data: PipelineData, collected: string[], seenParDos: Set<string>, seenNodes: Set<string>) {
        if (seenNodes.has(node.id)) return;
        seenNodes.add(node.id);

        if (node.data.label === 'Parse JSON' && !seenParDos.has('ParseJsonToDictFn')) {
            seenParDos.add('ParseJsonToDictFn');
            collected.push(`class ParseJsonToDictFn(beam.DoFn):
    def process(self, element):
        try:
            # element is a byte string from Pub/Sub
            decoded_str = element.decode('utf-8')
            data_dict = json.loads(decoded_str)
            yield data_dict
        except Exception as e:
            logging.error(f"Failed to parse JSON: {e}")
`);
        } else if (node.data.label === 'Parse Base64' && !seenParDos.has('ProcessBase64BytesFn')) {
            seenParDos.add('ProcessBase64BytesFn');
            collected.push(`class ProcessBase64BytesFn(beam.DoFn):
    def process(self, element):
        # TODO: Implement base64 decoding
        yield element
`);
        }

        const outgoingEdges = data.edges.filter(e => e.source === node.id);
        outgoingEdges.forEach(edge => {
            const nextNode = data.nodes.find(n => n.id === edge.target);
            if (nextNode) {
                this.collectParDos(nextNode, data, collected, seenParDos, seenNodes);
            }
        });
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
