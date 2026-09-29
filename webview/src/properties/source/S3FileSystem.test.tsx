/**
 * S3FileSystem Source Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating S3FileSystemSourceProperties component functionality,
 * form change callbacks, validation states for required fields, accordion toggling,
 * static datalist options, conditional credential branches (StaticCredentialsProvider,
 * ProfileCredentialsProvider, DefaultCredentialsProvider), Secret Manager secret pickers, and asserting
 * that Cloud Storage bucket discovery IPC is deliberately NOT dispatched.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode to verify getSecrets is dispatched while getStorageBuckets is NOT dispatched.
 * - Thoroughly tests all credential provider conditional render branches.
 * - Validates required field states, default fallbacks, instruction fallbacks, and accordion toggling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  S3FileSystemSourceProperties,
  S3_SOURCE_PATH_SUGGESTIONS,
  AWS_REGIONS,
  AWS_CREDENTIALS_PROVIDERS,
  S3_SOURCE_FORMATS,
  S3_SOURCE_COMPRESSION_TYPES
} from './S3FileSystem';

describe('S3FileSystemSourceProperties', () => {
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
        label: 'S3FileSystem',
        beam_transform: 'S3FileSystem',
        properties: {}
      }
    };

    const { container } = render(<S3FileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#s3SourceFilePattern') as HTMLInputElement;
    expect(filePatternInput).toBeInTheDocument();
    expect(filePatternInput).toHaveValue('');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('File Pattern is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'S3FileSystem',
        beam_transform: 'S3FileSystem',
        properties: {
          filePattern: 's3://my-bucket/data/*.parquet',
          awsRegion: 'us-west-2',
          credentialsProvider: 'DefaultCredentialsProvider',
          endpointUrl: 'http://localhost:9000',
          format: 'ParquetIO',
          compression: 'GZIP',
          validate: false,
          minBundleSize: 67108864,
          system_instructions: 'Custom S3 reader instructions'
        }
      }
    };

    const { container } = render(<S3FileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const filePatternInput = container.querySelector('#s3SourceFilePattern') as HTMLInputElement;
    const regionSelect = container.querySelector('#s3SourceAwsRegion') as HTMLSelectElement;
    const credentialsSelect = container.querySelector('#s3SourceCredentialsProvider') as HTMLSelectElement;
    const endpointInput = container.querySelector('#s3SourceEndpointUrl') as HTMLInputElement;
    const formatSelect = container.querySelector('#s3SourceFormat') as HTMLSelectElement;
    const compressionSelect = container.querySelector('#s3SourceCompression') as HTMLSelectElement;
    const instructionsTextarea = container.querySelector('#s3SourceInstructions') as HTMLTextAreaElement;

    expect(filePatternInput).toHaveValue('s3://my-bucket/data/*.parquet');
    expect(filePatternInput).toHaveAttribute('aria-invalid', 'false');
    expect(regionSelect).toHaveValue('us-west-2');
    expect(credentialsSelect).toHaveValue('DefaultCredentialsProvider');
    expect(endpointInput).toHaveValue('http://localhost:9000');
    expect(formatSelect).toHaveValue('ParquetIO');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(instructionsTextarea).toHaveValue('Custom S3 reader instructions');

    // Assert region options match AWS_REGIONS
    expect(regionSelect.options.length).toBe(AWS_REGIONS.length);
    AWS_REGIONS.forEach((reg, idx) => {
      expect(regionSelect.options[idx].value).toBe(reg.value);
    });

    // Assert credentials provider options match AWS_CREDENTIALS_PROVIDERS
    expect(credentialsSelect.options.length).toBe(AWS_CREDENTIALS_PROVIDERS.length);
    AWS_CREDENTIALS_PROVIDERS.forEach((cred, idx) => {
      expect(credentialsSelect.options[idx].value).toBe(cred.value);
    });

    // Assert format options match S3_SOURCE_FORMATS
    expect(formatSelect.options.length).toBe(S3_SOURCE_FORMATS.length);
    S3_SOURCE_FORMATS.forEach((fmt, idx) => {
      expect(formatSelect.options[idx].value).toBe(fmt.value);
    });

    // Assert compression options match S3_SOURCE_COMPRESSION_TYPES
    expect(compressionSelect.options.length).toBe(S3_SOURCE_COMPRESSION_TYPES.length);
  });

  it('renders static S3 URI datalist suggestions and associates list attribute', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<S3FileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const datalist = container.querySelector('datalist#s3-source-path-options') || container.querySelector('datalist');
    expect(datalist).toBeInTheDocument();

    const options = Array.from(datalist!.querySelectorAll('option')).map((opt) => opt.value);
    S3_SOURCE_PATH_SUGGESTIONS.forEach((sug) => {
      expect(options).toContain(sug);
    });
  });

  it('handles field changes for filePattern, awsRegion, credentialsProvider, endpointUrl, format, and compression', () => {
    const mockNode: any = {
      data: {
        properties: {
          filePattern: '',
          awsRegion: 'us-east-1',
          credentialsProvider: 'DefaultCredentialsProvider',
          format: 'TextIO',
          compression: 'AUTO'
        }
      }
    };

    const { container } = render(<S3FileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Change filePattern
    const filePatternInput = container.querySelector('#s3SourceFilePattern') as HTMLInputElement;
    fireEvent.change(filePatternInput, {
      target: { name: 'filePattern', value: 's3://analytics-bucket/logs/*.json' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        filePattern: 's3://analytics-bucket/logs/*.json'
      })
    );

    // Change awsRegion
    const regionSelect = container.querySelector('#s3SourceAwsRegion') as HTMLSelectElement;
    fireEvent.change(regionSelect, {
      target: { name: 'awsRegion', value: 'eu-central-1' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        awsRegion: 'eu-central-1'
      })
    );

    // Change credentialsProvider
    const credentialsSelect = container.querySelector('#s3SourceCredentialsProvider') as HTMLSelectElement;
    fireEvent.change(credentialsSelect, {
      target: { name: 'credentialsProvider', value: 'StaticCredentialsProvider' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialsProvider: 'StaticCredentialsProvider'
      })
    );

    // Change endpointUrl
    const endpointInput = container.querySelector('#s3SourceEndpointUrl') as HTMLInputElement;
    fireEvent.change(endpointInput, {
      target: { name: 'endpointUrl', value: 'http://minio.local:9000' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointUrl: 'http://minio.local:9000'
      })
    );

    // Change format
    const formatSelect = container.querySelector('#s3SourceFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'format', value: 'AvroIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'AvroIO'
      })
    );

    // Change compression
    const compressionSelect = container.querySelector('#s3SourceCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'ZSTD' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'ZSTD'
      })
    );
  });

  describe('Conditional credential branches', () => {
    it('renders accessKeyId and secretAccessKey Secret Manager pickers (no type="password") when credentialsProvider is StaticCredentialsProvider', () => {
      const mockNode: any = {
        data: {
          properties: {
            credentialsProvider: 'StaticCredentialsProvider',
            accessKeyId: 'aws-s3-access-key-id',
            secretAccessKey: 'aws-s3-secret-access-key'
          }
        }
      };

      const { container } = render(<S3FileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

      const credentialsSelect = container.querySelector('#s3SourceCredentialsProvider') as HTMLSelectElement;
      const staticOption = Array.from(credentialsSelect.options).find(
        (opt) => opt.value === 'StaticCredentialsProvider'
      );
      expect(staticOption?.textContent).toBe('Google Cloud Secret Manager (StaticCredentialsProvider)');

      const accessKeyInput = container.querySelector('#s3SourceAccessKeyId') as HTMLInputElement;
      const secretKeyInput = container.querySelector('#s3SourceSecretAccessKey') as HTMLInputElement;
      const profileNameInput = container.querySelector('#s3SourceProfileName');

      expect(accessKeyInput).toBeInTheDocument();
      expect(accessKeyInput).toHaveValue('aws-s3-access-key-id');
      expect(accessKeyInput).toHaveAttribute('type', 'text');
      expect(accessKeyInput).toHaveAttribute('placeholder', 'e.g. aws-s3-access-key-id');
      expect(screen.getByText('AWS Access Key Secret (Secret Manager)')).toBeInTheDocument();

      expect(secretKeyInput).toBeInTheDocument();
      expect(secretKeyInput).toHaveValue('aws-s3-secret-access-key');
      expect(secretKeyInput).toHaveAttribute('type', 'text');
      expect(secretKeyInput).not.toHaveAttribute('type', 'password');
      expect(secretKeyInput).toHaveAttribute('placeholder', 'e.g. aws-s3-secret-access-key');
      expect(screen.getByText('AWS Secret Access Key (Secret Manager)')).toBeInTheDocument();
      expect(profileNameInput).not.toBeInTheDocument();

      // Fire change on accessKeyId
      fireEvent.change(accessKeyInput, {
        target: { name: 'accessKeyId', value: 'new-aws-access-key-secret' }
      });
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          accessKeyId: 'new-aws-access-key-secret'
        })
      );

      // Fire change on secretAccessKey
      fireEvent.change(secretKeyInput, {
        target: { name: 'secretAccessKey', value: 'new-aws-secret-key-secret' }
      });
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          secretAccessKey: 'new-aws-secret-key-secret'
        })
      );
    });

    it('renders profileName when credentialsProvider is ProfileCredentialsProvider', () => {
      const mockNode: any = {
        data: {
          properties: {
            credentialsProvider: 'ProfileCredentialsProvider',
            profileName: 'production-read'
          }
        }
      };

      const { container } = render(<S3FileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

      const profileNameInput = container.querySelector('#s3SourceProfileName') as HTMLInputElement;
      const accessKeyInput = container.querySelector('#s3SourceAccessKeyId');
      const secretKeyInput = container.querySelector('#s3SourceSecretAccessKey');

      expect(profileNameInput).toBeInTheDocument();
      expect(profileNameInput).toHaveValue('production-read');
      expect(accessKeyInput).not.toBeInTheDocument();
      expect(secretKeyInput).not.toBeInTheDocument();

      // Fire change on profileName
      fireEvent.change(profileNameInput, {
        target: { name: 'profileName', value: 'staging-profile' }
      });
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          profileName: 'staging-profile'
        })
      );
    });

    it('renders neither static keys nor profile name when credentialsProvider is DefaultCredentialsProvider', () => {
      const mockNodeDefault: any = {
        data: {
          properties: {
            credentialsProvider: 'DefaultCredentialsProvider'
          }
        }
      };

      const { container } = render(<S3FileSystemSourceProperties node={mockNodeDefault} onChange={mockOnChange} />);

      expect(container.querySelector('#s3SourceAccessKeyId')).not.toBeInTheDocument();
      expect(container.querySelector('#s3SourceSecretAccessKey')).not.toBeInTheDocument();
      expect(container.querySelector('#s3SourceProfileName')).not.toBeInTheDocument();
    });
  });

  it('excludes unsupported WebIdentityTokenCredentialsProvider and XZ compression, and documents AwsOptions flags', () => {
    const providerValues = AWS_CREDENTIALS_PROVIDERS.map((p) => p.value);
    expect(providerValues).toEqual([
      'DefaultCredentialsProvider',
      'StaticCredentialsProvider',
      'ProfileCredentialsProvider'
    ]);
    expect(providerValues).not.toContain('WebIdentityTokenCredentialsProvider');

    const compressionValues = S3_SOURCE_COMPRESSION_TYPES.map((c) => c.value);
    expect(compressionValues).not.toContain('XZ');

    const mockNode: any = {
      data: {
        properties: {
          filePattern: 's3://my-bucket/data/*.parquet'
        }
      }
    };
    render(<S3FileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);
    expect(screen.getByText(/AwsOptions --awsRegion in Java; --s3_region_name in Python/i)).toBeInTheDocument();
    expect(screen.getByText(/--endpoint/i)).toBeInTheDocument();
  });

  it('toggles advanced tuning accordion and updates validate and minBundleSize', () => {
    const mockNode: any = {
      data: {
        properties: {
          validate: true,
          minBundleSize: 0
        }
      }
    };

    const { container } = render(<S3FileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Accordion is closed initially
    expect(container.querySelector('#s3SourceValidate')).not.toBeInTheDocument();
    expect(container.querySelector('#s3SourceMinBundleSize')).not.toBeInTheDocument();

    // Toggle open
    const toggleButton = screen.getByRole('button', { name: /Read Tuning & Options/i });
    fireEvent.click(toggleButton);

    const validateCheckbox = container.querySelector('#s3SourceValidate') as HTMLInputElement;
    const minBundleSizeInput = container.querySelector('#s3SourceMinBundleSize') as HTMLInputElement;

    expect(validateCheckbox).toBeInTheDocument();
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
      target: { name: 'minBundleSize', value: '16384' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        minBundleSize: '16384'
      })
    );

    // Toggle closed
    fireEvent.click(toggleButton);
    expect(container.querySelector('#s3SourceValidate')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<S3FileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#s3SourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Read parquet files from s3 bucket' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Read parquet files from s3 bucket'
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
    const { rerender } = render(<S3FileSystemSourceProperties node={mockNodeSpecialData} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from node data')).toBeInTheDocument();

    const mockNodePropertySys: any = {
      data: {
        properties: {
          system_instructions: 'System instructions from properties'
        }
      }
    };
    rerender(<S3FileSystemSourceProperties node={mockNodePropertySys} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('System instructions from properties')).toBeInTheDocument();

    const mockNodePropertySpecial: any = {
      data: {
        properties: {
          special_instructions: 'Special instructions from properties'
        }
      }
    };
    rerender(<S3FileSystemSourceProperties node={mockNodePropertySpecial} onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('Special instructions from properties')).toBeInTheDocument();
  });

  it('requests GCP Secret Manager secrets via getSecrets and does NOT request storage buckets', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          credentialsProvider: 'StaticCredentialsProvider'
        }
      }
    };

    const { container } = render(<S3FileSystemSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getStorageBuckets' })
    );
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getSecrets' })
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: [
              { id: 'aws-s3-access-key-id', name: 'aws-s3-access-key-id', fullName: 'projects/p/secrets/aws-s3-access-key-id' },
              'projects/p/secrets/aws-s3-secret-access-key'
            ]
          }
        })
      );
    });

    const accessKeyInput = container.querySelector('#s3SourceAccessKeyId') as HTMLInputElement;
    fireEvent.focus(accessKeyInput);
    const option = screen.getByRole('option', { name: 'aws-s3-access-key-id' });
    expect(option).toBeInTheDocument();
    fireEvent.mouseDown(option);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ accessKeyId: 'aws-s3-access-key-id' })
    );
  });
});
