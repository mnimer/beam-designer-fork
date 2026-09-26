/**
 * AzureBlobStoreFileSystem Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating AzureBlobStoreFileSystemSourceProperties component functionality,
 * form change callbacks, validation states for required fields, accordion toggling,
 * static datalist suggestions for Azure URI shapes, conditional authentication rendering branches,
 * password masking for secrets, and asserting that Cloud Storage bucket discovery IPC is deliberately NOT dispatched.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode to verify no getStorageBuckets messages are dispatched.
 * - Verifies conditional rendering across all 5 auth methods (ConnectionString, SasToken, AccessKey, ClientSecret, ManagedIdentity).
 * - Verifies password masking (type="password") on all sensitive credential fields.
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
          connectionString: 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc;EndpointSuffix=core.windows.net',
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

    expect(connectionStringInput).toHaveValue('DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc;EndpointSuffix=core.windows.net');
    expect(connectionStringInput).toHaveAttribute('type', 'password');
    expect(formatSelect).toHaveValue('ParquetIO');
    expect(formatSelect.options.length).toBe(AZURE_SOURCE_FORMATS.length);
    AZURE_SOURCE_FORMATS.forEach((fmt, idx) => {
      expect(formatSelect.options[idx].value).toBe(fmt.value);
    });
    expect(instructionsTextarea).toHaveValue('Custom Azure Blob reader instructions');

    expect(screen.queryByText('File Pattern is required.')).not.toBeInTheDocument();
  });

  it('toggles required validation on and off as filePattern transitions between empty and populated', () => {
    const mockNodeEmpty: any = {
      data: {
        properties: {
          filePattern: ''
        }
      }
    };

    const { rerender } = render(
      <AzureBlobStoreFileSystemSourceProperties node={mockNodeEmpty} onChange={mockOnChange} />
    );
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();

    const mockNodePopulated: any = {
      data: {
        properties: {
          filePattern: 'azfs://account/container/data/*.csv'
        }
      }
    };

    rerender(
      <AzureBlobStoreFileSystemSourceProperties node={mockNodePopulated} onChange={mockOnChange} />
    );
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
          connectionString: 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=key;'
        }
      }
    };
    const { container, rerender } = render(
      <AzureBlobStoreFileSystemSourceProperties node={mockNodeConn} onChange={mockOnChange} />
    );

    const connInput = container.querySelector('#azureSourceConnectionString') as HTMLInputElement;
    expect(connInput).toBeInTheDocument();
    expect(connInput).toHaveAttribute('type', 'password');
    fireEvent.change(connInput, {
      target: { name: 'connectionString', value: 'DefaultEndpointsProtocol=https;Updated;' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ connectionString: 'DefaultEndpointsProtocol=https;Updated;' })
    );

    // 2. SasToken branch
    const mockNodeSas: any = {
      data: {
        properties: {
          authMethod: 'SasToken',
          sasToken: 'sp=r&st=2026-01-01'
        }
      }
    };
    rerender(<AzureBlobStoreFileSystemSourceProperties node={mockNodeSas} onChange={mockOnChange} />);
    expect(container.querySelector('#azureSourceConnectionString')).not.toBeInTheDocument();
    const sasInput = container.querySelector('#azureSourceSasToken') as HTMLInputElement;
    expect(sasInput).toBeInTheDocument();
    expect(sasInput).toHaveAttribute('type', 'password');
    fireEvent.change(sasInput, {
      target: { name: 'sasToken', value: 'sp=r&st=2026-02-01' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ sasToken: 'sp=r&st=2026-02-01' })
    );

    // 3. AccessKey branch (requires storageAccount to be non-empty)
    const mockNodeKeyMissingAccount: any = {
      data: {
        properties: {
          filePattern: 'azfs://account/container/input/*.parquet',
          authMethod: 'AccessKey',
          storageAccount: '',
          accountKey: 'mysecretkey123=='
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
    expect(keyInput).toHaveAttribute('type', 'password');
    expect(screen.getByText(/BlobstoreOptions\.setAccessKey\(String\)/i)).toBeInTheDocument();
    fireEvent.change(keyInput, {
      target: { name: 'accountKey', value: 'updatedkey456==' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ accountKey: 'updatedkey456==' })
    );

    // 4. ClientSecret branch
    const mockNodeClient: any = {
      data: {
        properties: {
          authMethod: 'ClientSecret',
          clientId: 'app-id-123',
          tenantId: 'tenant-id-456',
          clientSecret: 'secret-val-789'
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
    expect(clientSecretInput).toHaveAttribute('type', 'password');

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

    // Accordion should start closed
    expect(container.querySelector('#azureSourceValidate')).not.toBeInTheDocument();
    expect(container.querySelector('#azureSourceMinBundleSize')).not.toBeInTheDocument();

    // Toggle open
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

    // Toggle closed
    fireEvent.click(toggleButton);
    expect(container.querySelector('#azureSourceValidate')).not.toBeInTheDocument();
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

  it('falls back to special_instructions and property-level instructions when present', () => {
    const mockNodeSpecialData: any = {
      data: {
        special_instructions: 'Special instructions from node data',
        properties: {}
      }
    };
    const { rerender } = render(
      <AzureBlobStoreFileSystemSourceProperties node={mockNodeSpecialData} onChange={mockOnChange} />
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
      <AzureBlobStoreFileSystemSourceProperties node={mockNodePropertySys} onChange={mockOnChange} />
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
      <AzureBlobStoreFileSystemSourceProperties node={mockNodePropertySpecial} onChange={mockOnChange} />
    );
    expect(screen.getByDisplayValue('Special instructions from properties')).toBeInTheDocument();
  });

  it('does NOT request storage buckets via vscode.postMessage (no bucket discovery for Azure Blob Storage)', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    render(<AzureBlobStoreFileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getStorageBuckets' })
    );
    expect(mockPostMessage).not.toHaveBeenCalled();
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
