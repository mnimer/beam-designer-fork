import type { TransformGenerator, Node } from '../beamGenerator';

export class BigQuerySinkGenerator implements TransformGenerator {
    generate(node: Node, indent: number): string {
        const table = node.data.properties?.table || 'DEFAULT_PROJECT:DEFAULT_DATASET.DEFAULT_TABLE';
        const createDisposition = node.data.properties?.createDisposition || 'CREATE_IF_NEEDED';
        const writeDisposition = node.data.properties?.writeDisposition || 'WRITE_APPEND';
        const nextIndent = ' '.repeat(indent + 4);
        return `| 'Write to BigQuery (${node.id})' >> beam.io.WriteToBigQuery(
${nextIndent}table='${table}',
${nextIndent}create_disposition=beam.io.BigQueryDisposition.${createDisposition},
${nextIndent}write_disposition=beam.io.BigQueryDisposition.${writeDisposition}
${' '.repeat(indent)})`;
    }
}
