/**
 * @fileoverview Hook that loads GCP Secret Manager secrets from the extension
 * host and normalizes them for secret pickers.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Replaces the hand-rolled `window.addEventListener('message')` + `getSecrets`
 * effects duplicated across connector panels. Built on {@link useAssetLoader},
 * so it inherits request/response correlation (F11) and refresh support.
 */

import { useMemo } from 'react';
import { useAssetLoader } from './useAssetLoader';
import { normalizeSecretItem } from '../components/common/SecretManagerAuthFields';
import type { NormalizedSecret, SecretItem } from '../components/common/SecretManagerAuthFields';

/** Datalist option consumed by PropertyField's `datalist` prop. */
export interface SecretOption {
  /** Short secret ID written into the node property. */
  value: string;
  /** Display label. */
  label: string;
}

/**
 * Result of {@link useSecretOptions}.
 */
export interface UseSecretOptionsResult {
  /** Normalized secrets (short `id`, display `name`, optional resource `fullName`). */
  secrets: NormalizedSecret[];
  /** Datalist options (`value` = short ID, `label` = display name). */
  options: SecretOption[];
  /** Whether a request is in flight. */
  loading: boolean;
  /** Listing error from the host, or null. */
  error: string | null;
  /** Re-requests the secret list. */
  refresh: () => void;
}

/**
 * Loads and normalizes Secret Manager secrets for the current project.
 *
 * @returns Secrets, datalist options, loading/error state and a refresh callback.
 */
export function useSecretOptions(): UseSecretOptionsResult {
  const { items, loading, error, refresh } = useAssetLoader<SecretItem | string>('secrets');
  const secrets = useMemo(() => items.map(normalizeSecretItem), [items]);
  const options = useMemo(() => secrets.map((s) => ({ value: s.id, label: s.name })), [secrets]);
  return { secrets, options, loading, error, refresh };
}
