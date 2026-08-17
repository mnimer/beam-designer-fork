
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PropertyForm } from './PropertyForm';

describe('PropertyForm', () => {
  it('renders PubSubProperties when label contains PubSub', () => {
    const mockNode = {
      data: {
        label: 'PubSub Source',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('projects/my-project/topics/my-topic')).toBeInTheDocument();
  });

  it('renders BigQueryProperties when label contains BigQuery', () => {
    const mockNode = {
      data: {
        label: 'BigQuery Sink',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my_table')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label contains Windowing', () => {
    const mockNode = {
      data: {
        label: 'Windowing Step',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
  });

  it('renders generic message for unknown label', () => {
    const mockNode = {
      data: {
        label: 'Unknown Node',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Nothing to customize')).toBeInTheDocument();
  });
  it('renders ParseMessageProperties when label is Parse Message', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Message Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('JSON')).toBeInTheDocument();
    expect(screen.getByText('Parse PubSub JSON message and convert it to a dictionary (Dict) format.')).toBeInTheDocument();
    expect(screen.getByText('Code Generation Instructions')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText('Enter code generation instructions...');
    fireEvent.change(textarea, { target: { name: 'system_instructions', value: 'Parse custom field' } });
    expect(mockOnChange).toHaveBeenCalledWith({ system_instructions: 'Parse custom field' });
  });

  it('renders appropriate helper text based on messageType property', () => {
    const mockNode = {
      data: {
        label: 'Parse Message',
        properties: {
          messageType: 'Base64' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByDisplayValue('Base64')).toBeInTheDocument();
    expect(screen.getByText('Decode PubSub Message and decode Base64 bytes.')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label is Fixed Windows', () => {
    const mockNode = {
      data: {
        label: 'Fixed Windows',
        properties: {
          windowType: 'Fixed Window' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Window Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fixed Window')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label is Sliding Windows', () => {
    const mockNode = {
      data: {
        label: 'Sliding Windows',
        properties: {
          windowType: 'Sliding Window' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Window Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sliding Window')).toBeInTheDocument();
  });

  it('renders WindowingProperties when label is User Windows', () => {
    const mockNode = {
      data: {
        label: 'User Windows',
        properties: {
          windowType: 'Session Window' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Window Type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Session Window')).toBeInTheDocument();
  });

  it('renders LogMessageProperties when label is Log Message', () => {
    const mockNode = {
      data: {
        label: 'Log Message',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Log Level')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Info')).toBeInTheDocument();
    expect(screen.queryByText('Standard operational message logs highlighting progress or status changes.')).not.toBeInTheDocument();
  });

  it('renders KVMapperProperties when label is KV Mapper', () => {
    const mockNode = {
      data: {
        label: 'KV Mapper',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Key Property Name')).toBeInTheDocument();
  });

  it('renders FilterProperties when label is Filter', () => {
    const mockNode = {
      data: {
        label: 'Filter',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Compare')).toBeInTheDocument();
  });

  it('renders FlatMapProperties when label is FlatMap', () => {
    const mockNode = {
      data: {
        label: 'FlatMap',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Split via')).toBeInTheDocument();
  });

  it('renders MapProperties when label is Map', () => {
    const mockNode = {
      data: {
        label: 'Map',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Map properties are currently empty/i)).toBeInTheDocument();
  });

  it('renders AggregationProperties when label is Approximate Quantiles', () => {
    const mockNode = {
      data: {
        label: 'Approximate Quantiles',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Approximate Quantiles properties are currently empty\. Computes approximate quantiles of the elements in a collection\./i)).toBeInTheDocument();
  });

  it('renders CreateProperties when label is Create', () => {
    const mockNode = {
      data: {
        label: 'Create',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('In-Memory Elements')).toBeInTheDocument();
  });

  it('renders ParDoProperties when label is ParDo', () => {
    const mockNode = {
      data: {
        label: 'ParDo',
        beam_transform: 'ParDo',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Code Generation Prompt')).toBeInTheDocument();
    expect(screen.getByText('System Instructions')).toBeInTheDocument();
  });

  it('renders OtherProperties when label is Flatten', () => {
    const mockNode = {
      data: {
        label: 'Flatten',
        beam_transform: 'Flatten',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Flatten properties are currently empty\. Merges multiple PCollection objects of the same type into a single logical PCollection\./i)).toBeInTheDocument();
  });

  it('renders OtherProperties when label is ReShuffle', () => {
    const mockNode = {
      data: {
        label: 'ReShuffle',
        beam_transform: 'Reshuffle',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/ReShuffle properties are currently empty\. Redistributes elements across workers by assigning temporary random keys to break fusion and balance load\./i)).toBeInTheDocument();
  });

  it('renders TextIOSourceProperties when type is SOURCE and label is TextIO', () => {
    const mockNode = {
      data: {
        label: 'TextIO',
        type: 'SOURCE',
        beam_transform: 'TextIO',
        properties: {
          filePattern: 'gs://input/*.txt'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/File Pattern \/ Path \(\.from\)/i)).toHaveValue('gs://input/*.txt');
  });

  it('renders TextIOSinkProperties when type is SINK and label is TextIO', () => {
    const mockNode = {
      data: {
        label: 'TextIO',
        type: 'SINK',
        beam_transform: 'TextIO',
        properties: {
          to: 'gs://output/results'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Destination File Prefix \(\.to\)/i)).toHaveValue('gs://output/results');
  });

  it('renders FileIOSourceProperties when label is FileIO and type is SOURCE', () => {
    const mockNode = {
      data: {
        label: 'FileIO Match',
        type: 'SOURCE',
        beam_transform: 'FileIO.match',
        properties: {
          filePattern: 'gs://input/*.csv'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/File Pattern/i)).toHaveValue('gs://input/*.csv');
    expect(screen.getByText(/Continuously \(Stream Watch\)/i)).toBeInTheDocument();
  });

  it('renders FileIOReadMatchesProperties when label is FileIO Read Matches', () => {
    const mockNode = {
      data: {
        label: 'FileIO Read Matches',
        type: 'STEP',
        beam_transform: 'FileIO.readMatches',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/PCollection<FileIO\.ReadableFile>/i)).toBeInTheDocument();
  });

  it('renders FileIOSinkProperties when type is SINK and label is FileIO', () => {
    const mockNode = {
      data: {
        label: 'FileIO',
        type: 'SINK',
        beam_transform: 'FileIO',
        properties: {
          to: 'gs://output/files/'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PropertyForm node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Destination Directory \(\.to\)/i)).toHaveValue('gs://output/files/');
  });
});
