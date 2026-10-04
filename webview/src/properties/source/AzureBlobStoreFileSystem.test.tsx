/**
 * AzureBlobStoreFileSystem Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating AzureBlobStoreFileSystemSourceProperties component functionality,
 * form change callbacks, validation states for required fields, accordion toggling,
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
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  AzureBlobStoreFileSystemSourceProperties,
  AZURE_SOURCE_PATH_SUGGESTIONS,
  AZURE_AUTH_METHODS,
  AZURE_SOURCE_FORMATS
} from './AzureBlobStoreFileSystem';

describe('AzureBlobStoreFileSystemSourceProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing filePattern', () => {
    const mockNode: any = {
      data: {
        label: 'AzureBlobStoreFileSystem',
        beam_transform: 'AzureBlobStoreFileSystem',
        properties: {}
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const filePatternInput = container.querySelector('#azureSourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'AzureBlobStoreFileSystem',
        beam_transform: 'AzureBlobStoreFileSystem',
        properties: {
          filePattern: 'azfs://account/container/data/*.parquet',
          storageAccount: 'mystorageaccount',
          authMethod: 'ConnectionString',
          connectionString: 'azure-blob-connection-string-secret',
          format: 'ParquetIO',
          validate: false,
          minBundleSize: 8192,
          system_instructions: 'Custom Azure Blob reader instructions'
        }
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const filePatternInput = container.querySelector('#azureSourceFilePattern') as HTMLInputElement;
    const storageAccountInput = container.querySelector('#azureSourceStorageAccount') as HTMLInputElement;
    const authMethodSelect = container.querySelector('#azureSourceAuthMethod') as HTMLSelectElement;
    const connectionStringInput = container.querySelector('#azureSourceConnectionString') as HTMLInputElement;
    const formatSelect = container.querySelector('#azureSourceFormat') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#azureSourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('azfs://account/container/data/*.parquet');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(storageAccountInput).toHaveValue('mystorageaccount');
    expect(authMethodSelect).toHaveValue('ConnectionString');
    expect(authMethodSelect.options.length).toBe(AZURE_AUTH_METHODS.length);
    AZURE_AUTH_METHODS.forEach((method, idx) => {
      expect(authMethodSelect.options[idx].value).toBe(method.value);
    });

    expect(connectionStringInput).toHaveValue('azure-blob-connection-string-secret');
    expect(connectionStringInput).toHaveAttribute('type', 'text');
    expect(connectionStringInput).not.toHaveAttribute('type', 'password');
    expect(screen.getByText('Connection String Secret (Secret Manager)')).toBeInTheDocument();
    expect(formatSelect).toHaveValue('ParquetIO');
    expect(formatSelect.options.length).toBe(AZURE_SOURCE_FORMATS.length);
    AZURE_SOURCE_FORMATS.forEach((fmt, idx) => {
      expect(formatSelect.options[idx].value).toBe(fmt.value);
    });
    expect(instructionsTextarea).toHaveValue('Custom Azure Blob reader instructions');

    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('renders static datalist suggestions for Azure azfs:// path patterns and excludes abfss://', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const datalist = container.querySelector('#azure-source-path-options');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(AZURE_SOURCE_PATH_SUGGESTIONS.length);

    AZURE_SOURCE_PATH_SUGGESTIONS.forEach((suggestion) => {
      expect(suggestion.startsWith('azfs://')).toBe(true);
      expect(suggestion.includes('abfss://')).toBe(false);
      const option = datalist?.querySelector(`option[value="${suggestion}"]`);
      expect(option).toBeInTheDocument();
    });
  });

  it('handles field changes for filePattern, storageAccount, and format', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    // filePattern change
    const filePatternInput = container.querySelector('#azureSourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 'azfs://account/container/input/*.csv' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 'azfs://account/container/input/*.csv'
      })
    );

    // storageAccount change
    const storageAccountInput = container.querySelector('#azureSourceStorageAccount') as HTMLInputElement;
    fireEvent.change(storageAccountInput, {
      target: { name: 'storageAccount', value: 'azurelake' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        storageAccount: 'azurelake'
      })
    );

    // format change
    const formatSelect = container.querySelector('#azureSourceFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'format', value: 'AvroIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'AvroIO'
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
      <AzureBlobStoreFileSystemSourceProperties node={mockNodeConn} onChange={mockOnChange} />
    );

    const connInput = container.querySelector('#azureSourceConnectionString') as HTMLInputElement;
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
    rerender(<AzureBlobStoreFileSystemSourceProperties node={mockNodeSas} onChange={mockOnChange} />);
    expect(container.querySelector('#azureSourceConnectionString')).not.toBeInTheDocument();
    const sasInput = container.querySelector('#azureSourceSasToken') as HTMLInputElement;
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
          filePattern: 'azfs://account/container/input/*.parquet',
          authMethod: 'AccessKey',
          storageAccount: '',
          accountKey: 'azure-account-key-secret'
        }
      }
    };
    rerender(<AzureBlobStoreFileSystemSourceProperties node={mockNodeKeyMissingAccount} onChange={mockOnChange} />);
    expect(container.querySelector('#azureSourceSasToken')).not.toBeInTheDocument();
    const storageAccountInput = container.querySelector('#azureSourceStorageAccount') as HTMLInputElement;
    expect(storageAccountInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Storage Account Name is required for AccessKey authentication.')).toBeInTheDocument();

    const keyInput = container.querySelector('#azureSourceAccountKey') as HTMLInputElement;
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
    rerender(<AzureBlobStoreFileSystemSourceProperties node={mockNodeClient} onChange={mockOnChange} />);
    expect(container.querySelector('#azureSourceAccountKey')).not.toBeInTheDocument();
    const clientIdInput = container.querySelector('#azureSourceClientId') as HTMLInputElement;
    const tenantIdInput = container.querySelector('#azureSourceTenantId') as HTMLInputElement;
    const clientSecretInput = container.querySelector('#azureSourceClientSecret') as HTMLInputElement;
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
    rerender(<AzureBlobStoreFileSystemSourceProperties node={mockNodeIdentity} onChange={mockOnChange} />);
    expect(container.querySelector('#azureSourceClientSecret')).not.toBeInTheDocument();
    expect(screen.getByText(/Managed Identity:/)).toBeInTheDocument();
  });

  it('handles accordion toggling and change events for validate checkbox and minBundleSize', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const toggleButton = screen.getByText('Read Tuning & Options');
    fireEvent.click(toggleButton);

    const validateCheckbox = container.querySelector('#azureSourceValidate') as HTMLInputElement;
    const minBundleSizeInput = container.querySelector('#azureSourceMinBundleSize') as HTMLInputElement;

    expect(validateCheckbox).toBeInTheDocument();
    expect(validateCheckbox).toBeChecked(); // defaults to true
    expect(minBundleSizeInput).toBeInTheDocument();

    // Toggle validate checkbox
    fireEvent.click(validateCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        validate: false
      })
    );

    // Change minBundleSize
    fireEvent.change(minBundleSizeInput, {
      target: { name: 'minBundleSize', value: '65536' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        minBundleSize: '65536'
      })
    );
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />
    );

    const instructionsTextarea = container.querySelector('#azureSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Read Azure Blob records with ParquetIO' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Read Azure Blob records with ParquetIO'
      })
    );
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

    render(<AzureBlobStoreFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getStorageBuckets' })
    );
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getSecrets' })
    );
  });

  /**
   * Regression guard: containerName and expansionService (plus the false Python xlang notice)
   * were removed because container is path segment 2 of azfs://account/container/blob and Python
   * natively ships BlobStorageFileSystem + AzureOptions.
   */
  it('never renders containerName, expansionService, or abfss:// claims even when legacy persisted values exist', () => {
    const mockLegacyNode: any = {
      data: {
        properties: {
          filePattern: 'azfs://account/container/data/*.parquet',
          containerName: 'legacy-container',
          expansionService: 'localhost:8097'
        }
      }
    };

    const { container } = render(
      <AzureBlobStoreFileSystemSourceProperties node={mockLegacyNode} onChange={mockOnChange} />
    );

    expect(container.querySelector('#azureSourceContainerName')).not.toBeInTheDocument();
    expect(container.querySelector('#azureSourceExpansionService')).not.toBeInTheDocument();
    expect(screen.queryByText('Container Name')).not.toBeInTheDocument();
    expect(screen.queryByText(/Expansion Service/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/abfss:\/\//i)).not.toBeInTheDocument();
  });
});
