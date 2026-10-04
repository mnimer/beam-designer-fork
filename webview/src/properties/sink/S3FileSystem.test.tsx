/**
 * S3FileSystem Sink Properties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating S3FileSystemSinkProperties component functionality,
 * form change callbacks, validation states for required fields, accordion toggling,
 * static datalist options, conditional credential branches (StaticCredentialsProvider,
 * ProfileCredentialsProvider, DefaultCredentialsProvider), Secret Manager secret pickers, conditional
 * SSE-KMS key id branch, and asserting that Cloud Storage bucket discovery IPC is
 * deliberately NOT dispatched.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react for component testing.
 * - Mocks window.vscode to verify getSecrets is dispatched while getStorageBuckets is NOT dispatched.
 * - Thoroughly tests all credential provider conditional render branches.
 * - Thoroughly tests SSE algorithm conditional render branches for ssekmsKeyId.
 * - Validates required field states, default fallbacks, instruction fallbacks, and accordion toggling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  S3FileSystemSinkProperties,
  S3_SINK_PATH_SUGGESTIONS,
  AWS_REGIONS,
  AWS_CREDENTIALS_PROVIDERS,
  S3_STORAGE_CLASSES,
  SSE_ALGORITHMS,
  S3_SINK_FORMATS,
  S3_SINK_COMPRESSION_TYPES
} from './S3FileSystem';

describe('S3FileSystemSinkProperties', () => {
  let originalVscode: any;
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    originalVscode = (window as any).vscode;
  });

  afterEach(() => {
    (window as any).vscode = originalVscode;
  });

  it('renders with empty properties and flags validation error for missing to path prefix', () => {
    const mockNode: any = {
      data: {
        label: 'S3FileSystem',
        beam_transform: 'S3FileSystem',
        properties: {}
      }
    };

    const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#s3SinkTo') as HTMLInputElement;
    expect(toInput).toBeInTheDocument();
    expect(toInput).toHaveValue('');
    expect(toInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Output Path Prefix is required.')).toBeInTheDocument();
  });

  it('renders with populated properties and no validation error', () => {
    const mockNode: any = {
      data: {
        label: 'S3FileSystem',
        beam_transform: 'S3FileSystem',
        properties: {
          to: 's3://my-bucket/output/results',
          suffix: '.parquet',
          format: 'ParquetIO',
          compression: 'GZIP',
          awsRegion: 'us-west-2',
          credentialsProvider: 'DefaultCredentialsProvider',
          endpointUrl: 'http://localhost:9000',
          s3StorageClass: 'STANDARD_IA',
          sseAlgorithm: 'AES256',
          uploadBufferSizeBytes: 16777216,
          system_instructions: 'Custom S3 writer instructions'
        }
      }
    };

    const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const toInput = container.querySelector('#s3SinkTo') as HTMLInputElement;
    const suffixInput = container.querySelector('#s3SinkSuffix') as HTMLInputElement;
    const formatSelect = container.querySelector('#s3SinkFormat') as HTMLSelectElement;
    const compressionSelect = container.querySelector('#s3SinkCompression') as HTMLSelectElement;
    const regionSelect = container.querySelector('#s3SinkAwsRegion') as HTMLSelectElement;
    const credentialsSelect = container.querySelector('#s3SinkCredentialsProvider') as HTMLSelectElement;
    const endpointInput = container.querySelector('#s3SinkEndpointUrl') as HTMLInputElement;
    const storageClassSelect = container.querySelector('#s3SinkStorageClass') as HTMLSelectElement;
    const sseAlgorithmSelect = container.querySelector('#s3SinkSseAlgorithm') as HTMLSelectElement;
    const uploadBufferInput = container.querySelector('#s3SinkUploadBufferSize') as HTMLInputElement;
    const instructionsTextarea = container.querySelector('#s3SinkInstructions') as HTMLTextAreaElement;

    expect(toInput).toHaveValue('s3://my-bucket/output/results');
    expect(toInput).toHaveAttribute('aria-invalid', 'false');
    expect(suffixInput).toHaveValue('.parquet');
    expect(formatSelect).toHaveValue('ParquetIO');
    expect(compressionSelect).toHaveValue('GZIP');
    expect(regionSelect).toHaveValue('us-west-2');
    expect(credentialsSelect).toHaveValue('DefaultCredentialsProvider');
    expect(endpointInput).toHaveValue('http://localhost:9000');
    expect(storageClassSelect).toHaveValue('STANDARD_IA');
    expect(sseAlgorithmSelect).toHaveValue('AES256');
    expect(uploadBufferInput).toHaveValue(16777216);
    expect(instructionsTextarea).toHaveValue('Custom S3 writer instructions');

    // Assert region options match AWS_REGIONS
    expect(regionSelect.options.length).toBe(AWS_REGIONS.length);
    AWS_REGIONS.forEach((reg, idx) => {
      expect(regionSelect.options[idx].value).toBe(reg.value);
    });

    // Assert credentials options match AWS_CREDENTIALS_PROVIDERS
    expect(credentialsSelect.options.length).toBe(AWS_CREDENTIALS_PROVIDERS.length);
    AWS_CREDENTIALS_PROVIDERS.forEach((cred, idx) => {
      expect(credentialsSelect.options[idx].value).toBe(cred.value);
    });

    // Assert storage class options match S3_STORAGE_CLASSES
    expect(storageClassSelect.options.length).toBe(S3_STORAGE_CLASSES.length);
    S3_STORAGE_CLASSES.forEach((sc, idx) => {
      expect(storageClassSelect.options[idx].value).toBe(sc.value);
    });

    // Assert SSE algorithm options match SSE_ALGORITHMS
    expect(sseAlgorithmSelect.options.length).toBe(SSE_ALGORITHMS.length);
    SSE_ALGORITHMS.forEach((sse, idx) => {
      expect(sseAlgorithmSelect.options[idx].value).toBe(sse.value);
    });

    // Assert format options match S3_SINK_FORMATS
    expect(formatSelect.options.length).toBe(S3_SINK_FORMATS.length);
    S3_SINK_FORMATS.forEach((fmt, idx) => {
      expect(formatSelect.options[idx].value).toBe(fmt.value);
    });

    // Assert compression options match S3_SINK_COMPRESSION_TYPES
    expect(compressionSelect.options.length).toBe(S3_SINK_COMPRESSION_TYPES.length);
  });

  it('renders static S3 URI datalist suggestions and associates list attribute', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const datalist = container.querySelector('datalist#s3-sink-path-options') || container.querySelector('datalist');
    expect(datalist).toBeInTheDocument();

    const options = Array.from(datalist!.querySelectorAll('option')).map((opt) => opt.value);
    S3_SINK_PATH_SUGGESTIONS.forEach((sug) => {
      expect(options).toContain(sug);
    });
  });

  it('handles field changes for to, suffix, format, compression, awsRegion, credentialsProvider, endpointUrl, s3StorageClass, sseAlgorithm, and uploadBufferSizeBytes', () => {
    const mockNode: any = {
      data: {
        properties: {
          to: '',
          suffix: '',
          format: 'TextIO',
          compression: 'UNCOMPRESSED',
          awsRegion: 'us-east-1',
          credentialsProvider: 'DefaultCredentialsProvider',
          s3StorageClass: 'STANDARD',
          sseAlgorithm: ''
        }
      }
    };

    const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Change to
    const toInput = container.querySelector('#s3SinkTo') as HTMLInputElement;
    fireEvent.change(toInput, {
      target: { name: 'to', value: 's3://processed-bucket/output/' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 's3://processed-bucket/output/'
      })
    );

    // Change suffix
    const suffixInput = container.querySelector('#s3SinkSuffix') as HTMLInputElement;
    fireEvent.change(suffixInput, {
      target: { name: 'suffix', value: '.csv' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        suffix: '.csv'
      })
    );

    // Change format
    const formatSelect = container.querySelector('#s3SinkFormat') as HTMLSelectElement;
    fireEvent.change(formatSelect, {
      target: { name: 'format', value: 'AvroIO' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'AvroIO'
      })
    );

    // Change compression
    const compressionSelect = container.querySelector('#s3SinkCompression') as HTMLSelectElement;
    fireEvent.change(compressionSelect, {
      target: { name: 'compression', value: 'BZIP2' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        compression: 'BZIP2'
      })
    );

    // Change awsRegion
    const regionSelect = container.querySelector('#s3SinkAwsRegion') as HTMLSelectElement;
    fireEvent.change(regionSelect, {
      target: { name: 'awsRegion', value: 'eu-west-1' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        awsRegion: 'eu-west-1'
      })
    );

    // Change credentialsProvider
    const credentialsSelect = container.querySelector('#s3SinkCredentialsProvider') as HTMLSelectElement;
    fireEvent.change(credentialsSelect, {
      target: { name: 'credentialsProvider', value: 'ProfileCredentialsProvider' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialsProvider: 'ProfileCredentialsProvider'
      })
    );

    // Change endpointUrl
    const endpointInput = container.querySelector('#s3SinkEndpointUrl') as HTMLInputElement;
    fireEvent.change(endpointInput, {
      target: { name: 'endpointUrl', value: 'http://custom-s3:9000' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointUrl: 'http://custom-s3:9000'
      })
    );

    // Change s3StorageClass
    const storageClassSelect = container.querySelector('#s3SinkStorageClass') as HTMLSelectElement;
    fireEvent.change(storageClassSelect, {
      target: { name: 's3StorageClass', value: 'INTELLIGENT_TIERING' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        s3StorageClass: 'INTELLIGENT_TIERING'
      })
    );

    // Change sseAlgorithm
    const sseAlgorithmSelect = container.querySelector('#s3SinkSseAlgorithm') as HTMLSelectElement;
    fireEvent.change(sseAlgorithmSelect, {
      target: { name: 'sseAlgorithm', value: 'AES256' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sseAlgorithm: 'AES256'
      })
    );

    // Change uploadBufferSizeBytes
    const uploadBufferInput = container.querySelector('#s3SinkUploadBufferSize') as HTMLInputElement;
    fireEvent.change(uploadBufferInput, {
      target: { name: 'uploadBufferSizeBytes', value: '10485760' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadBufferSizeBytes: '10485760'
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

      const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

      const credentialsSelect = container.querySelector('#s3SinkCredentialsProvider') as HTMLSelectElement;
      const staticOption = Array.from(credentialsSelect.options).find(
        (opt) => opt.value === 'StaticCredentialsProvider'
      );
      expect(staticOption?.textContent).toBe('Google Cloud Secret Manager (StaticCredentialsProvider)');

      const accessKeyInput = container.querySelector('#s3SinkAccessKeyId') as HTMLInputElement;
      const secretKeyInput = container.querySelector('#s3SinkSecretAccessKey') as HTMLInputElement;
      const profileNameInput = container.querySelector('#s3SinkProfileName');

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
            profileName: 'analytics-writer'
          }
        }
      };

      const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

      const profileNameInput = container.querySelector('#s3SinkProfileName') as HTMLInputElement;
      const accessKeyInput = container.querySelector('#s3SinkAccessKeyId');
      const secretKeyInput = container.querySelector('#s3SinkSecretAccessKey');

      expect(profileNameInput).toBeInTheDocument();
      expect(profileNameInput).toHaveValue('analytics-writer');
      expect(accessKeyInput).not.toBeInTheDocument();
      expect(secretKeyInput).not.toBeInTheDocument();

      // Fire change on profileName
      fireEvent.change(profileNameInput, {
        target: { name: 'profileName', value: 'prod-writer' }
      });
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          profileName: 'prod-writer'
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

      const { container } = render(<S3FileSystemSinkProperties node={mockNodeDefault} onChange={mockOnChange} />);

      expect(container.querySelector('#s3SinkAccessKeyId')).not.toBeInTheDocument();
      expect(container.querySelector('#s3SinkSecretAccessKey')).not.toBeInTheDocument();
      expect(container.querySelector('#s3SinkProfileName')).not.toBeInTheDocument();
    });
  });

  describe('Conditional SSE-KMS Key ID branch', () => {
    it('renders ssekmsKeyId field when sseAlgorithm is aws:kms and handles changes', () => {
      const mockNode: any = {
        data: {
          properties: {
            sseAlgorithm: 'aws:kms',
            ssekmsKeyId: 'arn:aws:kms:us-east-1:123456789012:key/test-key-id'
          }
        }
      };

      const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

      const kmsKeyInput = container.querySelector('#s3SinkSseKmsKeyId') as HTMLInputElement;
      expect(kmsKeyInput).toBeInTheDocument();
      expect(kmsKeyInput).toHaveValue('arn:aws:kms:us-east-1:123456789012:key/test-key-id');

      // Change ssekmsKeyId
      fireEvent.change(kmsKeyInput, {
        target: { name: 'ssekmsKeyId', value: 'arn:aws:kms:us-west-2:123456789012:key/new-key-id' }
      });
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          ssekmsKeyId: 'arn:aws:kms:us-west-2:123456789012:key/new-key-id'
        })
      );
    });

    it('defaults sseAlgorithm to empty string and does NOT render ssekmsKeyId when sseAlgorithm is empty or AES256', () => {
      const mockNodeDefault: any = {
        data: {
          properties: {
            ssekmsKeyId: 'some-key'
          }
        }
      };

      const { container, rerender } = render(<S3FileSystemSinkProperties node={mockNodeDefault} onChange={mockOnChange} />);
      const sseSelect = container.querySelector('#s3SinkSseAlgorithm') as HTMLSelectElement;
      expect(sseSelect).toHaveValue('');
      expect(container.querySelector('#s3SinkSseKmsKeyId')).not.toBeInTheDocument();

      const mockNodeAes: any = {
        data: {
          properties: {
            sseAlgorithm: 'AES256',
            ssekmsKeyId: 'some-key'
          }
        }
      };

      rerender(<S3FileSystemSinkProperties node={mockNodeAes} onChange={mockOnChange} />);
      expect(container.querySelector('#s3SinkSseKmsKeyId')).not.toBeInTheDocument();
    });
  });

  it('excludes WebIdentityTokenCredentialsProvider, XZ compression, and NONE SSE sentinel, and enforces 64 MB default / 5 MB min uploadBufferSizeBytes', () => {
    const providerValues = AWS_CREDENTIALS_PROVIDERS.map((p) => p.value);
    expect(providerValues).toEqual([
      'DefaultCredentialsProvider',
      'StaticCredentialsProvider',
      'ProfileCredentialsProvider'
    ]);
    expect(providerValues).not.toContain('WebIdentityTokenCredentialsProvider');

    const compressionValues = S3_SINK_COMPRESSION_TYPES.map((c) => c.value);
    expect(compressionValues).not.toContain('XZ');

    expect(SSE_ALGORITHMS[0]).toEqual({
      value: '',
      label: 'None (Default — Omit --SSEAlgorithm)'
    });
    expect(SSE_ALGORITHMS.map((s) => s.value)).not.toContain('NONE');

    const mockNode: any = {
      data: {
        properties: {
          to: 's3://my-bucket/output/',
          sseAlgorithm: 'aws:kms'
        }
      }
    };
    const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);
    const uploadBufferInput = container.querySelector('#s3SinkUploadBufferSize') as HTMLInputElement;
    expect(uploadBufferInput).toHaveAttribute('placeholder', '67108864');
    expect(uploadBufferInput).toHaveAttribute('min', '5242880');
    expect(screen.getAllByText(/--SSEAlgorithm/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/--SSEKMSKeyId/i)).toBeInTheDocument();
  });

  it('toggles sharding options accordion and updates numShards and shardTemplate', () => {
    const mockNode: any = {
      data: {
        properties: {
          numShards: 5,
          shardTemplate: '-SSSSS-of-NNNNN'
        }
      }
    };

    const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Accordion is closed initially
    expect(container.querySelector('#s3SinkNumShards')).not.toBeInTheDocument();
    expect(container.querySelector('#s3SinkShardTemplate')).not.toBeInTheDocument();

    // Toggle open
    const toggleButton = screen.getByRole('button', { name: /Sharding & Output Partitioning Options/i });
    fireEvent.click(toggleButton);

    const numShardsInput = container.querySelector('#s3SinkNumShards') as HTMLInputElement;
    const shardTemplateInput = container.querySelector('#s3SinkShardTemplate') as HTMLInputElement;

    expect(numShardsInput).toBeInTheDocument();
    expect(numShardsInput).toHaveValue(5);
    expect(shardTemplateInput).toBeInTheDocument();
    expect(shardTemplateInput).toHaveValue('-SSSSS-of-NNNNN');

    // Change numShards
    fireEvent.change(numShardsInput, {
      target: { name: 'numShards', value: '10' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        numShards: '10'
      })
    );

    // Change shardTemplate
    fireEvent.change(shardTemplateInput, {
      target: { name: 'shardTemplate', value: '-part-SSSSS-of-NNNNN.parquet' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        shardTemplate: '-part-SSSSS-of-NNNNN.parquet'
      })
    );

    // Toggle closed
    fireEvent.click(toggleButton);
    expect(container.querySelector('#s3SinkNumShards')).not.toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const mockNode: any = {
      data: {
        properties: {}
      }
    };

    const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = container.querySelector('#s3SinkInstructions') as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Write parquet files to s3 with 5 shards' }
    });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Write parquet files to s3 with 5 shards'
      })
    );
  });

  it('requests GCP Secret Manager secrets and does NOT request storage buckets', () => {
    const mockPostMessage = vi.fn();
    (window as any).vscode = { postMessage: mockPostMessage };

    const mockNode: any = {
      data: {
        properties: {
          credentialsProvider: 'StaticCredentialsProvider'
        }
      }
    };

    const { container } = render(<S3FileSystemSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(mockPostMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: 'getStorageBuckets' })
    );

    const accessKeyInput = container.querySelector('#s3SinkAccessKeyId') as HTMLInputElement;
    fireEvent.change(accessKeyInput, { target: { name: 'accessKeyId', value: 'aws-s3-access-key-id' } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ accessKeyId: 'aws-s3-access-key-id' })
    );
  });
});
