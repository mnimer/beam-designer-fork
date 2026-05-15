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
    sourceHandle?: string;
    targetHandle?: string;
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
 * - Uses topological sort and variable assignment for each step to support proper branching in Beam Python SDK.
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
     * @returns Object containing generated code, file extension, and other configuration files.
     */
    public generate(yamlStr: string, filename: string, projectId?: string, gcsStagingPath?: string, language: string = 'Python'): { code: string, fileExtension: string, requirements: string, dockerfile: string, runScript: string, runDataflowScript: string, dockerIgnore: string, gcloudIgnore: string } {
        // Parse YAML and generate files
        try {
            const data = YAML.parse(yamlStr) as PipelineData;
            const isPython = language.toLowerCase() === 'python';
            
            const code = isPython ? this.generateFromData(data) : this.generateJavaFromData(data, filename);
            const fileExtension = isPython ? 'py' : 'java';
            
            // Generate requirements.txt content, passing data to check for nodes
            const requirements = isPython ? this.generateRequirements(data) : 'maven-dependencies-here';
            
            // Generate Dockerfile content, removing .beam extension from filename if present
            const dockerfile = isPython ? this.generateDockerfile(filename.replace('.beam', '')) : '# Java Dockerfile';

            // Generate run_directrunner.sh content, passing data to check for streaming sources
            const runScript = isPython ? this.generateRunScript(filename.replace('.beam', ''), data) : '# Java Run Script';

            // Generate run_dataflow.sh content, passing data to check for streaming sources
            const runDataflowScript = isPython ? this.generateDataflowScript(filename.replace('.beam', ''), data, projectId, gcsStagingPath) : '# Java Dataflow Run Script';

            // Generate .dockerignore content
            const dockerIgnore = isPython ? this.generateDockerIgnore() : '';
            
            return { code, fileExtension, requirements, dockerfile, runScript, runDataflowScript, dockerIgnore, gcloudIgnore: dockerIgnore };
        } catch (e) {
            console.error('Failed to parse YAML in generator', e);
            return {
                code: `# Error parsing pipeline YAML: ${e}`,
                fileExtension: language.toLowerCase() === 'python' ? 'py' : 'java',
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
*.beam
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
from apache_beam.pvalue import TaggedOutput
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

        // Topological Sort to handle branching correctly
        const inDegree: Record<string, number> = {};
        data.nodes.forEach(n => inDegree[n.id] = 0);
        data.edges.forEach(e => {
            inDegree[e.target] = (inDegree[e.target] || 0) + 1;
        });

        const queue: Node[] = data.nodes.filter(n => inDegree[n.id] === 0);
        const codeLines: string[] = [];
        const parDoDefinitions: string[] = [];
        const seenParDos = new Set<string>();

        while (queue.length > 0) {
            const node = queue.shift()!;
            
            // Generate variable name for node
            const varName = this.getVariableName(node);
            
            // Find input variable
            const incomingEdges = data.edges.filter(e => e.target === node.id);
            let inputVar = 'p';
            
            if (incomingEdges.length > 0) {
                const edge = incomingEdges[0];
                const sourceNode = data.nodes.find(n => n.id === edge.source);
                if (sourceNode) {
                    const sourceVarName = this.getVariableName(sourceNode);
                    if (edge.sourceHandle === 'valid' || (!edge.sourceHandle && sourceNode.data.type === 'STEP')) {
                        inputVar = `${sourceVarName}['good_${sourceNode.id}']`;
                    } else if (edge.sourceHandle === 'error') {
                        inputVar = `${sourceVarName}['bad_${sourceNode.id}']`;
                    } else {
                        inputVar = sourceVarName;
                    }
                }
            }

            const key = `${node.data.label}_${node.data.type}`;
            const generator = this.generators[key];
            let transformCode = '';
            if (generator) {
                transformCode = generator.generate(node, 0).trim();
            } else {
                transformCode = `| '# No generator for ${key}'`;
            }

            // Add comment above step
            codeLines.push(`        # ${node.data.type}: ${node.data.label}`);
            
            // Add main transform line
            codeLines.push(`        ${varName} = ${inputVar} ${transformCode}`);

            // Add log messages for undefined connectors right after each step
            if (node.data.type === 'STEP') {
                // Check valid output
                const hasValidEdge = data.edges.some(e => e.source === node.id && (e.sourceHandle === 'valid' || !e.sourceHandle));
                if (!hasValidEdge) {
                    codeLines.push(`        ${varName}['good_${node.id}'] | "Log Good ${node.id}" >> beam.Map(lambda x: logging.info(f"Valid: {x}"))`);
                }
                
                // Check error output
                const hasErrorEdge = data.edges.some(e => e.source === node.id && e.sourceHandle === 'error');
                if (!hasErrorEdge) {
                    codeLines.push(`        ${varName}['bad_${node.id}'] | "Log Bad ${node.id}" >> beam.Map(lambda x: print(f"Error: {x}"))`);
                }
            } else if (node.data.type === 'SOURCE') {
                const hasEdge = data.edges.some(e => e.source === node.id);
                if (!hasEdge) {
                    codeLines.push(`        ${varName} | "Log Source ${node.id}" >> beam.Map(lambda x: logging.info(f"Source: {x}"))`);
                }
            }

            // Add line break between steps
            codeLines.push('');

            // Collect ParDo definitions
            if (node.data.label === 'Parse JSON' && !seenParDos.has('ParseJsonToDictFn')) {
                seenParDos.add('ParseJsonToDictFn');
                parDoDefinitions.push(`class ParseJsonToDictFn(beam.DoFn):
    def __init__(self, bad_tag):
        self.bad_tag = bad_tag

    def process(self, element):
        try:
            # element is a byte string from Pub/Sub
            decoded_str = element.decode('utf-8')
            data_dict = json.loads(decoded_str)
            yield data_dict
        except Exception as e:
            logging.error(f"Failed to parse JSON: {e}")
            yield TaggedOutput(self.bad_tag, element)
`);
            } else if (node.data.label === 'Parse Base64' && !seenParDos.has('ProcessBase64BytesFn')) {
                seenParDos.add('ProcessBase64BytesFn');
                parDoDefinitions.push(`class ProcessBase64BytesFn(beam.DoFn):
    def __init__(self, bad_tag):
        self.bad_tag = bad_tag

    def process(self, element):
        try:
            # TODO: Implement base64 decoding
            yield element
        except Exception as e:
            logging.error(f"Failed to process base64: {e}")
            yield TaggedOutput(self.bad_tag, element)
`);
            }

            // Process outgoing edges
            const outgoingEdges = data.edges.filter(e => e.source === node.id);
            outgoingEdges.forEach(edge => {
                inDegree[edge.target]--;
                if (inDegree[edge.target] === 0) {
                    const nextNode = data.nodes.find(n => n.id === edge.target);
                    if (nextNode) {
                        queue.push(nextNode);
                    }
                }
            });
        }

        code += codeLines.join('\n');
        code += '\n\n';

        // Append ParDo definitions
        if (parDoDefinitions.length > 0) {
            code += parDoDefinitions.join('\n');
            code += '\n';
        }

        code += `if __name__ == '__main__':
    run()
`;
        return code;
    }

    /**
     * Generates Java code from pipeline data.
     * @param data Parsed pipeline data.
     * @param filename Base name of the pipeline.
     */
    private generateJavaFromData(data: PipelineData, filename: string): string {
        const className = filename.replace('.beam', '').replace(/[^a-zA-Z0-9]/g, '');
        let code = `package com.example;

import org.apache.beam.sdk.Pipeline;
import org.apache.beam.sdk.options.PipelineOptions;
import org.apache.beam.sdk.options.PipelineOptionsFactory;
import org.apache.beam.sdk.transforms.PTransform;
import org.apache.beam.sdk.values.PCollection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ${className || 'BeamPipeline'} {
    private static final Logger LOG = LoggerFactory.getLogger(${className || 'BeamPipeline'}.class);

    public static void main(String[] args) {
        PipelineOptions options = PipelineOptionsFactory.fromArgs(args).withValidation().create();
        Pipeline p = Pipeline.create(options);

`;

        data.nodes.forEach(node => {
            code += `        // ${node.data.type}: ${node.data.label}\n`;
            if (node.data.type === 'SOURCE') {
                if (node.data.label.includes('PubSub')) {
                    const topic = node.data.properties?.topic || 'projects/your-project/topics/your-topic';
                    code += `        // PCollection<String> ${this.getVariableName(node)} = p.apply(PubsubIO.readStrings().fromTopic("${topic}"));\n`;
                } else {
                    code += `        // PCollection<String> ${this.getVariableName(node)} = p.apply(...);\n`;
                }
            } else if (node.data.type === 'STEP') {
                code += `        // PCollection<String> ${this.getVariableName(node)} = ...\n`;
            } else if (node.data.type === 'SINK') {
                if (node.data.label.includes('BigQuery')) {
                    const table = `${node.data.properties?.projectId || 'your-project'}:${node.data.properties?.dataset || 'your-dataset'}.${node.data.properties?.table || 'your-table'}`;
                    code += `        // ${this.getVariableName(node)}.apply(BigQueryIO.writeTableRows().to("${table}"));\n`;
                } else {
                    code += `        // ${this.getVariableName(node)}.apply(...);\n`;
                }
            }
            code += '\n';
        });

        code += `        p.run().waitUntilFinish();
    }
}
`;
        return code;
    }

    private getVariableName(node: Node): string {
        // Replace non-alphanumeric chars with underscore and make lowercase
        const sanitizedLabel = node.data.label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        return `${sanitizedLabel}_${node.id}`;
    }
}
