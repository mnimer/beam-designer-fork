/**
 * BigQuery Schema Editor Component (Re-export from shared SchemaEditor)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Re-exports the multi-tab SchemaEditor and its pure conversion utilities
 * for backwards compatibility with BigQueryIO and existing tests.
 */

export {
  SchemaEditor as BigQuerySchemaEditor,
  BIGQUERY_TYPES,
  BEAM_SCHEMA_TYPES,
  fieldsToJson,
  fieldsToString,
  jsonToFields,
  stringToFields,
  resolveSchemaFields,
  type SchemaField as BigQueryField,
  type SchemaEditorProps as BigQuerySchemaEditorProps
} from '../../components/common/SchemaEditor';
