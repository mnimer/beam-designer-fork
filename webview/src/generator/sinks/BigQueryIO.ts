import type { TransformGenerator, Node } from '../beamGenerator';

export class BigQuerySinkGenerator implements TransformGenerator {
    generate(node: Node, indent: number): string {
        const dataset = node.data.properties?.dataset;
        const tableProp = node.data.properties?.table;
        const projectId = node.data.properties?.projectId || 'DEFAULT_PROJECT';

        let table = 'DEFAULT_PROJECT:DEFAULT_DATASET.DEFAULT_TABLE';
        if (dataset && tableProp) {
            table = `${projectId}:${dataset}.${tableProp}`;
        } else if (tableProp) {
            table = tableProp;
        }
        const createDisposition = node.data.properties?.createDisposition || 'CREATE_NEVER';
        const writeDisposition = node.data.properties?.writeDisposition || 'WRITE_APPEND';
        const method = node.data.properties?.method;
        const triggering_frequency = node.data.properties?.triggering_frequency;
        const custom_gcs_temp_location = node.data.properties?.custom_gcs_temp_location;
        const num_storage_api_streams = node.data.properties?.num_storage_api_streams;
        const streaming_inserts = node.data.properties?.streaming_inserts;
        const insert_retry_strategy = node.data.properties?.insert_retry_strategy;

        const nextIndent = ' '.repeat(indent + 4);
        
        const createDispositionStr = createDisposition.startsWith('beam.io.') ? createDisposition : `beam.io.BigQueryDisposition.${createDisposition}`;
        const writeDispositionStr = writeDisposition.startsWith('beam.io.') ? writeDisposition : `beam.io.BigQueryDisposition.${writeDisposition}`;

        const args = [
            `table='${table}'`,
            `create_disposition=${createDispositionStr}`,
            `write_disposition=${writeDispositionStr}`
        ];

        if (method) {
            args.push(`method=beam.io.WriteToBigQuery.Method.${method}`);
            
            if (method === 'FILE_LOADS') {
                if (triggering_frequency) args.push(`triggering_frequency=${triggering_frequency}`);
                if (custom_gcs_temp_location) args.push(`custom_gcs_temp_location='${custom_gcs_temp_location}'`);
            } else if (method === 'STORAGE_WRITE_API') {
                if (triggering_frequency) args.push(`triggering_frequency=${triggering_frequency}`);
                if (num_storage_api_streams) args.push(`num_storage_api_streams=${num_storage_api_streams}`);
            } else if (method === 'STREAMING_INSERTS') {
                if (streaming_inserts) args.push(`streaming_inserts=${streaming_inserts}`);
                if (insert_retry_strategy) args.push(`insert_retry_strategy=${insert_retry_strategy}`);
            }
        }

        return `| 'Write to BigQuery' >> beam.io.WriteToBigQuery(
${nextIndent}${args.join(`,\n${nextIndent}`)}
${' '.repeat(indent)})`;
    }
}
