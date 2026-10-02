/**
 * StoragePathField Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Single shared implementation of "a required file path field with Cloud Storage bucket
 * autocomplete", used by every file connector property panel (TFRecordIO, XmlIO, CsvIO, JsonIO,
 * ContextualTextIO, ThriftIO, ParquetIO, AvroIO, TextIO, ...). It owns three concerns that were
 * previously hand-rolled and copy-pasted per connector: the bucket IPC request, the gs:// datalist
 * projection, and the surfacing of bucket-discovery failures.
 * 
 * Architectural Decisions:
 * - The Cloud Storage discovery error is rendered whenever `useAssetLoader` reports an error, and is
 *   NEVER gated on path validity. This is a deliberate defect fix: four connector panels rendered
 *   the discovery error only inside a branch that also required the path field to be invalid (e.g.
 *   nested in a `!isInvalid ? ... : null` helper or shown only alongside the required-field error).
 *   A user with a perfectly valid `gs://bucket/data/*.csv` path whose `gcloud storage buckets list`
 *   failed (403, expired ADC, no project set) therefore saw silently empty autocomplete and no
 *   warning at all. Path validity and bucket-listing health are independent signals, so they are
 *   rendered independently here and the gated variant is structurally impossible to reintroduce.
 * - The discovery error span reuses PropertyField's own inline error class string
 *   (`text-xs text-red-400 mt-1`, see webview/src/components/common/PropertyField.tsx:240) and
 *   `role="alert"`, so the two error treatments are visually and semantically identical.
 * - Bucket names are projected to `gs://<bucket>/` suggestions, except names already carrying the
 *   `gs://` scheme, which pass through untouched. This matches the projection previously duplicated
 *   in the TFRecordIO and ThriftIO panels and prevents `gs://gs://bucket/` double-prefixing.
 * - The `useAssetLoader('storageBuckets')` call lives inside this component rather than in each
 *   panel, so a connector cannot forget to request buckets or forget to read the error channel.
 * - Rendering is delegated to PropertyField (label, tooltip, required asterisk, datalist, inline
 *   error, helper text) rather than re-implementing input markup, so there is exactly one input
 *   style in the codebase.
 * - Validation is intentionally minimal and explicit: invalid strictly means "required and blank".
 *   Scheme or glob validation is out of scope; local paths, s3://, hdfs://, and gs:// are all legal.
 * - When `required` and `errorMessage` are both supplied, `errorMessage` doubles as the title of
 *   PropertyField's required asterisk. The migrated panels already passed their validation message
 *   as PropertyField's `required` string, so reusing it here keeps the hover text byte-identical
 *   instead of silently downgrading every panel to the generic "Required".
 * - Fully controlled (props in, events up): the caller owns `value` and receives the native change
 *   event. No internal value state and no two-way binding.
 * - No inline styles, no new colors, and spacing stays on the 8pt grid via PropertyField.
 */

import React from 'react';
import { PropertyField } from './PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';

/** Default prefix for the Cloud Storage bucket discovery failure message. */
export const DEFAULT_BUCKET_ERROR_PREFIX = 'Failed to load Cloud Storage buckets';

/**
 * Props for the {@link StoragePathField} component.
 */
export interface StoragePathFieldProps {
  /** DOM id of the input element. */
  id: string;
  /** Form field name, used by panel-level change handlers to key the property update. */
  name: string;
  /** Human-readable label rendered above the input. */
  label: string;
  /** Tooltip text describing the expected path or glob pattern. */
  tooltip: string;
  /** Current path value. */
  value: string;
  /** Standard React change handler receiving the native change event. */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Placeholder example path. */
  placeholder?: string;
  /** Whether a non-blank path is mandatory. Defaults to true. */
  required?: boolean;
  /** Validation message rendered when the field is required and blank. */
  errorMessage?: string;
  /** Optional helper text rendered below the input. */
  helperText?: React.ReactNode;
  /** Prefix for the bucket discovery failure message. Defaults to DEFAULT_BUCKET_ERROR_PREFIX. */
  bucketErrorPrefix?: string;
}

/**
 * Projects discovered bucket names into `gs://` datalist suggestions.
 *
 * Names that already carry the `gs://` scheme are returned unchanged so that fully qualified
 * bucket URIs are never double-prefixed.
 *
 * @param buckets Raw bucket names reported by the extension host.
 * @returns Suggestion strings suitable for a PropertyField datalist.
 */
export const toBucketSuggestions = (buckets: string[]): string[] =>
  buckets.map((bucket) => (bucket.startsWith('gs://') ? bucket : `gs://${bucket}/`));

/**
 * Renders a required file path input with Cloud Storage bucket autocomplete and an
 * always-visible bucket discovery error.
 *
 * @param props Controlled path field configuration.
 * @returns The PropertyField input plus, when discovery failed, an inline alert.
 */
export const StoragePathField: React.FC<StoragePathFieldProps> = ({
  id,
  name,
  label,
  tooltip,
  value,
  onChange,
  placeholder,
  required = true,
  errorMessage,
  helperText,
  bucketErrorPrefix = DEFAULT_BUCKET_ERROR_PREFIX
}) => {
  // NOTE: Request Cloud Storage buckets via useAssetLoader for datalist autocompletion
  const { items: buckets, loading: bucketsLoading, error: bucketError } = useAssetLoader<string>('storageBuckets');

  const bucketSuggestions = toBucketSuggestions(buckets);

  // Validation: a required path must contain at least one non-whitespace character
  const isInvalid = required && value.trim().length === 0;

  return (
    <>
      <PropertyField
        id={id}
        name={name}
        label={label}
        tooltip={tooltip}
        required={required ? (errorMessage ?? true) : false}
        aria-required={required}
        aria-invalid={isInvalid}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        invalid={isInvalid}
        error={isInvalid && errorMessage ? errorMessage : null}
        mono={true}
        datalist={bucketSuggestions}
        loading={bucketsLoading}
        helperText={helperText}
      />

      {/*
        Cloud Storage discovery error. Rendered purely from the loader's error channel: a valid
        path plus a failed `gcloud storage buckets list` must still warn the user.
      */}
      {bucketError && (
        <span className="text-xs text-red-400 mt-1" role="alert">
          {bucketErrorPrefix}: {bucketError}
        </span>
      )}
    </>
  );
};
