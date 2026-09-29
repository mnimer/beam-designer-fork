/**
 * AzureBlobStoreFileSystem Sink Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating AzureBlobStoreFileSystemSinkProperties component functionality,
 * form change callbacks, validation states for required fields, sharding accordion toggling,
 * static datalist suggestions for Azure URI shapes, conditional authentication rendering branches,
 * Secret Manager secret pickers for credentials, and asserting that Cloud Storage bucket discovery IPC is deliberately NOT dispatched.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode to verify getSecrets is dispatched while getStorageBuckets is NOT dispatched.
 * - Verifies conditional rendering across all 5 auth methods (ConnectionString, SasToken, AccessKey, ClientSecret, ManagedIdentity).
 * - Verifies Secret Manager datalist pickers (type="text", no type="password") on all sensitive credential fields.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AzureBlobStoreFileSystemSinkProperties,
  AZURE_SINK_PATH_SUGGESTIONS,
  AZURE_SINK_AUTH_METHODS,
  AZURE_SINK_FORMATS,
  AZURE_SINK_COMPRESSION_TYPES
} from './AzureBlobStoreFileSystem';

describe('AzureBlobStoreFileSystemSinkProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing to destination', () => {
    const mockNode: any = {
      data: {
        label: 'AzureBlobStoreFileSystem',
        beam_transform: 'AzureBlobStoreFileSystem',
        properties: {}
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    const toInput = container.querySelector('#azureSinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'AzureBlobStoreFileSystem',
        beam_transform: 'AzureBlobStoreFileSystem',
        properties: {
          to: 'azfs://account/container/output/',
          suffix: '.parquet',
          storageAccount: 'mystorageaccount',
          authMethod: 'ConnectionString',
          connectionString: 'azure-blob-connection-string-secret',
          format: 'ParquetIO',
          compression: 'GZIP',
          system_instructions: 'Custom Azure Blob writer instructions'
        }
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    const toInput = container.querySelector('#azureSinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#azureSinkSuffix') as HTMLInputElement;
    const storageAccountInput = container.querySelector('#azureSinkStorageAccount') as HTMLInputElement;
    const authMethodSelect = container.querySelector('#azureSinkAuthMethod') as HTMLSelectElement;
    const connectionStringInput = container.querySelector('#azureSinkConnectionString') as HTMLInputElement;
    const formatSelect = container.querySelector('#azureSinkFormat') as HTMLSelectElement;
    const compressionSelect = container.querySelector('#azureSinkCompression') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#azureSinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('azfs://account/container/output/');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.parquet');
    expect(storageAccountInput).toHaveValue('mystorageaccount');
    expect(authMethodSelect).toHaveValue('ConnectionString');
    expect(authMethodSelect.options.length).toBe(AZURE_SINK_AUTH_METHODS.length);
    AZURE_SINK_AUTH_METHODS.forEach((method, idx) => {
      expect(authMethodSelect.options[idx].value).toBe(method.value);
    });

    expect(connectionStringInput).toHaveValue('azure-blob-connection-string-secret');
    expect(connectionStringInput).toHaveAttribute('type', 'text');
    expect(connectionStringInput).not.toHaveAttribute('type', 'password');
    expect(screen.getByText('Connection String Secret (Secret Manager)')).toBeInTheDocument();

    expect(formatSelect).toHaveValue('ParquetIO');
    expect(formatSelect.options.length).toBe(AZURE_SINK_FORMATS.length);
    AZURE_SINK_FORMATS.forEach((fmt, idx) => {
      expect(formatSelect.options[idx].value).toBe(fmt.value);
    });

    expect(compressionSelect).toHaveValue('GZIP');
    expect(compressionSelect.options.length).toBe(AZURE_SINK_COMPRESSION_TYPES.length);
    AZURE_SINK_COMPRESSION_TYPES.forEach((comp, idx) => {
      expect(compressionSelect.options[idx].value).toBe(comp.value);
    });
    expect(instructionsTextarea).toHaveValue('Custom Azure Blob writer instructions');

    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('toggles required validation on and off as to transitions between empty and populated', () => {
    const mockNodeEmpty: any = {
      data: {
        properties: {
          to: ''
        }
      }
    };

    const { rerender } = render(
      <AzureBlobStoreFileSystemSinkProperties node={mockNodeEmpty} onChange={mockOnChange} />
    );
    expect(screen.getByText('Destination Directory is required.')).toBeInTheDocument();

    const mockNodePopulated: any = {
      data: {
        properties: {
          to: 'azfs://account/container/output/'
        }
      }
    };

    rerender(
      <AzureBlobStoreFileSystemSinkProperties node={mockNodePopulated} onChange={mockOnChange} />
    );
    expect(screen.queryByText('Destination Directory is required.')).not.toBeInTheDocument();
  });

  it('renders static datalist suggestions for Azure azfs:// sink path patterns and excludes abfss://', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    const datalist = container.querySelector('#azure-sink-path-options');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(AZURE_SINK_PATH_SUGGESTIONS.length);

    AZURE_SINK_PATH_SUGGESTIONS.forEach((suggestion) => {
      expect(suggestion.startsWith('azfs://')).toBe(true);
      expect(suggestion.includes('abfss://')).toBe(false);
      const option = datalist?.querySelector(`option[value="${suggestion}"]`);
      expect(option).toBeInTheDocument();
    });
  });

  it('handles field changes for to, suffix, storageAccount, format, and compression', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    // to change
    const toInput = container.querySelector('#azureSinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 'azfs://account/container/data/output/' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'azfs://account/container/data/output/'
      })
    );

    // suffix change
    const suffixInput = container.querySelector('#azureSinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.csv' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.csv'
      })
    );

    // storageAccount change
    const storageAccountInput = container.querySelector('#azureSinkStorageAccount') as HTMLInputElement;
    fireEvent.change(storageAccountInput, {
      target: { name: 'storageAccount', value: 'prodstorage' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        storageAccount: 'prodstorage'
      })
    );

    // format change
    const formatSelect = container.querySelector('#azureSinkFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'format', value: 'AvroIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'AvroIO'
      })
    );

    // compression change
    const compressionSelect = container.querySelector('#azureSinkCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'ZSTD' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'ZSTD'
      })
    );
  });

  it('renders and interacts with conditional authMethod branches: ConnectionString, SasToken, AccessKey, ClientSecret, ManagedIdentity', () => {
    // 1. ConnectionString branch
    const mockNodeConn: any = {
      data: {
        properties: {
          authMethod: 'ConnectionString',
          connectionString: 'azure-blob-conn-secret'
        }
      }
    };
    const { container, rerender } = render(
      <AzureBlobStoreFileSystemSinkProperties node={mockNodeConn} onChange={mockOnChange} />
    );

    const connInput = container.querySelector('#azureSinkConnectionString') as HTMLInputElement;
    expect(connInput).toBeInTheDocument();
    expect(connInput).toHaveAttribute('type', 'text');
    expect(connInput).toHaveAttribute('placeholder', 'e.g. azure-blob-connection-string-secret');
    expect(screen.getByText('Connection String Secret (Secret Manager)')).toBeInTheDocument();
    fireEvent.change(connInput, {
      target: { name: 'connectionString', value: 'updated-azure-conn-secret' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: 'updated-azure-conn-secret' })
    );

    // 2. SasToken branch
    const mockNodeSas: any = {
      data: {
        properties: {
          authMethod: 'SasToken',
          sasToken: 'azure-sas-secret'
        }
      }
    };
    rerender(<AzureBlobStoreFileSystemSinkProperties node={mockNodeSas} onChange={mockOnChange} />);
    expect(container.querySelector('#azureSinkConnectionString')).not.toBeInTheDocument();
    const sasInput = container.querySelector('#azureSinkSasToken') as HTMLInputElement;
    expect(sasInput).toBeInTheDocument();
    expect(sasInput).toHaveAttribute('type', 'text');
    expect(sasInput).toHaveAttribute('placeholder', 'e.g. azure-blob-sas-token-secret');
    expect(screen.getByText('SAS Token Secret (Secret Manager)')).toBeInTheDocument();
    fireEvent.change(sasInput, {
      target: { name: 'sasToken', value: 'updated-sas-secret' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ sasToken: 'updated-sas-secret' })
    );

    // 3. AccessKey branch (requires storageAccount to be non-empty)
    const mockNodeKeyMissingAccount: any = {
      data: {
        properties: {
          to: 'azfs://account/container/output/',
          authMethod: 'AccessKey',
          storageAccount: '',
          accountKey: 'azure-account-key-secret'
        }
      }
    };
    rerender(<AzureBlobStoreFileSystemSinkProperties node={mockNodeKeyMissingAccount} onChange={mockOnChange} />);
    expect(container.querySelector('#azureSinkSasToken')).not.toBeInTheDocument();
    const storageAccountInput = container.querySelector('#azureSinkStorageAccount') as HTMLInputElement;
    expect(storageAccountInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Storage Account Name is required for AccessKey authentication.')).toBeInTheDocument();

    const keyInput = container.querySelector('#azureSinkAccountKey') as HTMLInputElement;
    expect(keyInput).toBeInTheDocument();
    expect(keyInput).toHaveAttribute('type', 'text');
    expect(keyInput).toHaveAttribute('placeholder', 'e.g. azure-storage-account-key-secret');
    expect(screen.getByText('Account Key Secret (Secret Manager)')).toBeInTheDocument();
    expect(screen.getByText(/BlobstoreOptions\.setAccessKey\(String\)/i)).toBeInTheDocument();
    fireEvent.change(keyInput, {
      target: { name: 'accountKey', value: 'updated-account-key-secret' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ accountKey: 'updated-account-key-secret' })
    );

    // 4. ClientSecret branch
    const mockNodeClient: any = {
      data: {
        properties: {
          authMethod: 'ClientSecret',
          clientId: 'app-id-123',
          tenantId: 'tenant-id-456',
          clientSecret: 'azure-client-secret'
        }
      }
    };
    rerender(<AzureBlobStoreFileSystemSinkProperties node={mockNodeClient} onChange={mockOnChange} />);
    expect(container.querySelector('#azureSinkAccountKey')).not.toBeInTheDocument();
    const clientIdInput = container.querySelector('#azureSinkClientId') as HTMLInputElement;
    const tenantIdInput = container.querySelector('#azureSinkTenantId') as HTMLInputElement;
    const clientSecretInput = container.querySelector('#azureSinkClientSecret') as HTMLInputElement;
    expect(clientIdInput).toBeInTheDocument();
    expect(tenantIdInput).toBeInTheDocument();
    expect(clientSecretInput).toBeInTheDocument();
    expect(clientSecretInput).toHaveAttribute('type', 'text');
    expect(clientSecretInput).toHaveAttribute('placeholder', 'e.g. azure-ad-client-secret');
    expect(screen.getByText('Client Secret (Secret Manager)')).toBeInTheDocument();

    fireEvent.change(clientIdInput, { target: { name: 'clientId', value: 'new-app-id' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'new-app-id' }));

    fireEvent.change(tenantIdInput, { target: { name: 'tenantId', value: 'new-tenant-id' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'new-tenant-id' }));

    fireEvent.change(clientSecretInput, { target: { name: 'clientSecret', value: 'new-secret' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: 'new-secret' }));

    // 5. ManagedIdentity branch
    const mockNodeIdentity: any = {
      data: {
        properties: {
          authMethod: 'ManagedIdentity'
        }
      }
    };
    rerender(<AzureBlobStoreFileSystemSinkProperties node={mockNodeIdentity} onChange={mockOnChange} />);
    expect(container.querySelector('#azureSinkClientSecret')).not.toBeInTheDocument();
    expect(screen.getByText(/Managed Identity:/)).toBeInTheDocument();
  });

  it('handles sharding accordion toggling and change events for numShards and shardTemplate', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    // Accordion should start closed
    expect(container.querySelector('#azureSinkNumShards')).not.toBeInTheDocument();
    expect(container.querySelector('#azureSinkShardTemplate')).not.toBeInTheDocument();

    // Toggle open
    const toggleButton = screen.getByText('Sharding & Shard Template Options');
    fireEvent.click(toggleButton);

    const numShardsInput = container.querySelector('#azureSinkNumShards') as HTMLInputElement;
    const shardTemplateInput = container.querySelector('#azureSinkShardTemplate') as HTMLInputElement;

    expect(numShardsInput).toBeInTheDocument();
    expect(shardTemplateInput).toBeInTheDocument();

    // Change numShards
    fireEvent.change(numShardsInput, {
      target: { name: 'numShards', value: '4' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '4'
      })
    );

    // Change shardTemplate
    fireEvent.change(shardTemplateInput, {
      target: { name: 'shardTemplate', value: '-W-of-N' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        shardTemplate: '-W-of-N'
      })
    );

    // Toggle closed
    fireEvent.click(toggleButton);
    expect(container.querySelector('#azureSinkNumShards')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />
    );

    const instructionsTextarea = container.querySelector('#azureSinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Write Azure Blob records with TextIO' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Write Azure Blob records with TextIO'
      })
    );
  });

  it('falls back to special_instructions and property-level instructions when present', () => {
    const mockNodeSpecialData: any = {
      data: {
        special_instructions: 'Special instructions from node data',
        properties: {}
      }
    };
    const { rerender } = render(
      <AzureBlobStoreFileSystemSinkProperties node={mockNodeSpecialData} onChange={mockOnChange} />
    );
    expect(screen.getByDisplayValue('Special instructions from node data')).toBeInTheDocument();

    const mockNodePropertySys: any = {
      data: {
        properties: {
          system_instructions: 'System instructions from properties'
        }
      }
    };
    rerender(
      <AzureBlobStoreFileSystemSinkProperties node={mockNodePropertySys} onChange={mockOnChange} />
    );
    expect(screen.getByDisplayValue('System instructions from properties')).toBeInTheDocument();

    const mockNodePropertySpecial: any = {
      data: {
        properties: {
          special_instructions: 'Special instructions from properties'
        }
      }
    };
    rerender(
      <AzureBlobStoreFileSystemSinkProperties node={mockNodePropertySpecial} onChange={mockOnChange} />
    );
    expect(screen.getByDisplayValue('Special instructions from properties')).toBeInTheDocument();
  });

  it('requests GCP Secret Manager secrets via getSecrets and does NOT request storage buckets', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          authMethod: 'ConnectionString'
        }
      }
    };

    const { container } = render(<AzureBlobStoreFileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getStorageBuckets' })
    );
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getSecrets' })
    );

    // Simulate secretsLoaded message from extension host and verify datalist options populate
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: [
              { id: 'azure-sink-conn-secret', name: 'azure-sink-conn-secret', fullName: 'projects/p/secrets/azure-sink-conn-secret' },
              'projects/p/secrets/azure-sink-sas-secret'
            ]
          }
        })
      );
    });

    const connInput = container.querySelector('#azureSinkConnectionString') as HTMLInputElement;
    fireEvent.focus(connInput);
    const option = screen.getByRole('option', { name: 'azure-sink-conn-secret' });
    expect(option).toBeInTheDocument();
    fireEvent.mouseDown(option);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: 'azure-sink-conn-secret' })
    );
  });

  /**
   * Regression guard: accessTier, blobType, containerName, expansionService, XZ compression,
   * and abfss:// claims were removed because AzureBlobStoreFileSystem.create() unconditionally
   * writes BlockBlobs at the container default tier and registers only azfs:// in both Java and Python.
   */
  it('never renders accessTier, blobType, containerName, expansionService, XZ compression, or abfss:// claims', () => {
    expect(AZURE_SINK_COMPRESSION_TYPES.map((c) => c.value)).not.toContain('XZ');

    const mockLegacyNode: any = {
      data: {
        properties: {
          to: 'azfs://account/container/output/',
          containerName: 'legacy-container',
          accessTier: 'Archive',
          blobType: 'AppendBlob',
          expansionService: 'localhost:8097'
        }
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSinkProperties node={mockLegacyNode} onChange={mockOnChange} />
    );

    expect(container.querySelector('#azureSinkContainerName')).not.toBeInTheDocument();
    expect(container.querySelector('#azureSinkAccessTier')).not.toBeInTheDocument();
    expect(container.querySelector('#azureSinkBlobType')).not.toBeInTheDocument();
    expect(container.querySelector('#azureSinkExpansionService')).not.toBeInTheDocument();
    expect(screen.queryByText('Container Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Azure Access Tier')).not.toBeInTheDocument();
    expect(screen.queryByText('Azure Blob Type')).not.toBeInTheDocument();
    expect(screen.queryByText(/Expansion Service/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/abfss:\/\//i)).not.toBeInTheDocument();
  });
});
