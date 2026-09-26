/**
 * useAssetLoader Hook
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Encapsulates requesting, loading, error, and caching state for extension-provided assets
 * (BigQuery datasets/tables, Pub/Sub topics/subscriptions, Secret Manager secrets, AWS queues, etc.).
 * 
 * Architectural Decisions:
 * - Standardizes request IPC and response handling across all property panes.
 * - Built on useExtensionMessage to ensure robust lifecycle cleanup and zero stale closures.
 * - Seamlessly surfaces inline error messages dispatched by listAssets in src/extension.ts.
 * - Allows explicit manual re-fetching via refresh() callback.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useExtensionMessage } from './useExtensionMessage';

export type AssetType =
  | 'datasets'
  | 'tables'
  | 'topics'
  | 'subscriptions'
  | 'secrets'
  | 'healthcareDatasets'
  | 'awsQueues'
  | 'queues'
  | 'storageBuckets'
  | 'buckets'
  | 'networks'
  | 'subnetworks'
  | 'computeInstances'
  | 'instances';

export interface AssetConfig {
  requestCommand: string;
  responseCommand: string;
  responseKey: string;
}

/**
 * Registry mapping asset types to their corresponding IPC request commands,
 * response commands, and response payload keys defined in src/extension.ts.
 */
export const ASSET_CONFIGS: Record<string, AssetConfig> = {
  datasets: {
    requestCommand: 'getDatasets',
    responseCommand: 'datasetsLoaded',
    responseKey: 'datasets'
  },
  tables: {
    requestCommand: 'getTables',
    responseCommand: 'tablesLoaded',
    responseKey: 'tables'
  },
  topics: {
    requestCommand: 'getTopics',
    responseCommand: 'topicsLoaded',
    responseKey: 'topics'
  },
  subscriptions: {
    requestCommand: 'getSubscriptions',
    responseCommand: 'subscriptionsLoaded',
    responseKey: 'subscriptions'
  },
  secrets: {
    requestCommand: 'getSecrets',
    responseCommand: 'secretsLoaded',
    responseKey: 'secrets'
  },
  healthcareDatasets: {
    requestCommand: 'getHealthcareDatasets',
    responseCommand: 'healthcareDatasetsLoaded',
    responseKey: 'datasets'
  },
  awsQueues: {
    requestCommand: 'getAwsQueues',
    responseCommand: 'awsQueuesLoaded',
    responseKey: 'queues'
  },
  queues: {
    requestCommand: 'getAwsQueues',
    responseCommand: 'awsQueuesLoaded',
    responseKey: 'queues'
  },
  storageBuckets: {
    requestCommand: 'getStorageBuckets',
    responseCommand: 'storageBucketsLoaded',
    responseKey: 'buckets'
  },
  buckets: {
    requestCommand: 'getStorageBuckets',
    responseCommand: 'storageBucketsLoaded',
    responseKey: 'buckets'
  },
  networks: {
    requestCommand: 'getNetworks',
    responseCommand: 'networksLoaded',
    responseKey: 'networks'
  },
  subnetworks: {
    requestCommand: 'getSubnetworks',
    responseCommand: 'subnetworksLoaded',
    responseKey: 'subnetworks'
  },
  computeInstances: {
    requestCommand: 'getComputeInstances',
    responseCommand: 'computeInstancesLoaded',
    responseKey: 'instances'
  },
  instances: {
    requestCommand: 'getComputeInstances',
    responseCommand: 'computeInstancesLoaded',
    responseKey: 'instances'
  }
};

export interface UseAssetLoaderOptions<T = any> {
  /** Optional parameter payload to send with the request (e.g. { dataset: 'my_dataset' }) */
  params?: Record<string, any>;
  /** Optional shorthand for dataset param if loading tables */
  dataset?: string;
  /** Whether loading is enabled. Defaults to true (unless assetType is 'tables' with empty dataset). */
  enabled?: boolean;
  /** Optional callback invoked when assets or error are loaded */
  onLoaded?: (items: T[], rawMessage: any) => void;
  /** Initial items fallback */
  initialItems?: T[];
}

export interface UseAssetLoaderResult<T = any> {
  /** Loaded asset items */
  items: T[];
  /** Alias for items */
  data: T[];
  /** Error message if listing failed, or null */
  error: string | null;
  /** Whether assets are currently being loaded */
  loading: boolean;
  /** Alias for loading */
  isLoading: boolean;
  /** Function to manually trigger re-fetching assets */
  refresh: () => void;
  /** Set items manually */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  /** Set error manually */
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  /** Raw response message */
  rawResponse: any;
}

/**
 * Reusable hook to request and observe assets from the VS Code extension host.
 *
 * @template T Type of the individual asset item
 * @param assetType Key identifier matching ASSET_CONFIGS
 * @param options Optional configuration including params, enabled flag, and onLoaded callback
 * @returns State object with items, error, loading, and refresh callback
 */
export function useAssetLoader<T = any>(
  assetType: AssetType | string,
  options?: UseAssetLoaderOptions<T>
): UseAssetLoaderResult<T> {
  const config = ASSET_CONFIGS[assetType];
  if (!config) {
    throw new Error(`Unknown assetType '${assetType}' passed to useAssetLoader.`);
  }

  // Combine params with shorthand options
  const params = {
    ...(options?.dataset ? { dataset: options.dataset } : {}),
    ...(options?.params || {})
  };

  // Tables require a dataset identifier; auto-disable if dataset is not provided
  const isTables = assetType === 'tables';
  const hasDataset = Boolean(params.dataset && String(params.dataset).trim().length > 0);
  const autoEnabled = isTables ? hasDataset : true;
  const isEnabled = options?.enabled !== undefined ? options.enabled : autoEnabled;

  const [items, setItems] = useState<T[]>(options?.initialItems || []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(isEnabled);
  const [rawResponse, setRawResponse] = useState<any>(null);

  // Keep latest onLoaded callback in a ref to avoid stale closures
  const onLoadedRef = useRef(options?.onLoaded);
  onLoadedRef.current = options?.onLoaded;

  // Memoize stable serialized params key to re-trigger fetch on param changes
  const paramsKey = JSON.stringify(params);

  /**
   * Dispatches request to the VS Code extension host IPC.
   */
  const requestAssets = useCallback(() => {
    if (!isEnabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const vscode = (window as any).vscode;
    if (vscode && typeof vscode.postMessage === 'function') {
      vscode.postMessage({
        command: config.requestCommand,
        ...params
      });
    }
  }, [config.requestCommand, isEnabled, paramsKey]);

  // NOTE: Listen for response command from extension host using useExtensionMessage
  useExtensionMessage(config.responseCommand, (message: any) => {
    const rawItems = message[config.responseKey];
    const loadedItems: T[] = Array.isArray(rawItems) ? rawItems : [];
    const receivedError: string | null = message.error || null;

    setItems(loadedItems);
    setError(receivedError);
    setLoading(false);
    setRawResponse(message);

    if (onLoadedRef.current) {
      onLoadedRef.current(loadedItems, message);
    }
  });

  // Automatically request assets on mount or when dependencies change
  useEffect(() => {
    if (isEnabled) {
      requestAssets();
    } else {
      setLoading(false);
      if (isTables && !hasDataset) {
        setItems([]);
        setError(null);
      }
    }
  }, [isEnabled, paramsKey, requestAssets]);

  return {
    items,
    data: items,
    error,
    loading,
    isLoading: loading,
    refresh: requestAssets,
    setItems,
    setError,
    rawResponse
  };
}
