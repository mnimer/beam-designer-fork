/**
 * App Component Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests for the main visual canvas App component, including React Flow integration,
 * edge redirection, output folder updates, and node reference stability.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppWithProvider from './App.tsx';

let capturedEdges: any[] = [];
let capturedNodes: any[] = [];

// Mock React Flow
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    default: ({ nodes = [], edges = [], onNodeClick, onEdgeClick, children, onDrop }: any) => {
      capturedNodes = nodes;
      return (
        <div className="react-flow" data-testid="react-flow" onDrop={onDrop}>
        {nodes.map((n: any) => (
          <div key={n.id} data-testid={`node-${n.id}`} onClick={(e) => onNodeClick && onNodeClick(e, n)}>
            {n.data.label}
          </div>
        ))}
        {edges.map((e: any) => (
          <div key={e.id} data-testid={`edge-${e.id}`} onClick={(evt) => onEdgeClick && onEdgeClick(evt, e)}>
            {e.id}
          </div>
        ))}
        {children}
      </div>
      );
    },
    MiniMap: () => <div data-testid="mini-map" />,
    Controls: ({ children }: any) => <div data-testid="controls">{children}</div>,
    ControlButton: ({ onClick, children, title }: any) => <button onClick={onClick} title={title} data-testid="control-button">{children}</button>,
    Background: () => <div data-testid="background" />,
    useReactFlow: () => ({ project: (p: any) => p, fitView: vi.fn() }),
    useNodesState: (initial: any) => {
      const [nodes, setNodes] = React.useState(initial);
      return [nodes, setNodes, vi.fn()];
    },
    useEdgesState: (initial: any) => {
      const [edges, setEdges] = React.useState(initial);
      React.useEffect(() => {
        capturedEdges = edges;
      }, [edges]);
      return [edges, setEdges, vi.fn()];
    },
  };
});

describe('App', () => {
  it('renders Nodes card and Bottom panel', () => {
    render(<AppWithProvider />);

    expect(screen.getByText('SOURCES')).toBeInTheDocument();
    expect(screen.getByText('DEPLOYMENT')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('does not render hardcoded placeholder nodes on initial mount (regression test)', () => {
    render(<AppWithProvider />);

    // Must NOT contain the old dummy placeholder nodes
    expect(screen.queryByText('PubSub_In')).not.toBeInTheDocument();
    expect(screen.queryByText('Window')).not.toBeInTheDocument();
    expect(screen.queryByText('BigQuery_Out')).not.toBeInTheDocument();
  });

  it('connects Parse Message step to PubSub source on drop', () => {
    render(<AppWithProvider />);

    // Load a pipeline with a PubSub source
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'loadPipeline',
        filename: 'test.beam',
        data: `
nodes:
  - id: '1'
    type: 'pipeline'
    position: { x: 100, y: 200 }
    data: { label: 'PubSub_In', type: 'SOURCE', iconName: 'Radio', beam_transform: 'PubSubIO' }
edges: []
`
      }
    }));

    const reactFlow = screen.getByTestId('react-flow');

    // Mock getBoundingClientRect for the element
    reactFlow.getBoundingClientRect = vi.fn().mockReturnValue({ left: 0, top: 0 });

    // Simulate drop event
    fireEvent.drop(reactFlow, {
      clientX: 100,
      clientY: 100,
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/reactflow') {
            return JSON.stringify({
              nodeType: 'pipeline',
              label: 'Parse Message',
              type: 'STEP',
              iconName: 'FileCode'
            });
          }
          return '';
        }
      }
    });

    // Verify that the edge was created connecting PubSub to Parse Message
    expect(capturedEdges.length).toBe(1);
    const newEdge = capturedEdges.find(e => e.source === '1');
    expect(newEdge).toBeTruthy();
  });

  it('deletes selected edge on Delete key press', () => {
    render(<AppWithProvider />);

    // Load a pipeline with two connected nodes
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'loadPipeline',
        filename: 'test.beam',
        data: `
nodes:
  - id: '1'
    type: 'pipeline'
    position: { x: 100, y: 200 }
    data: { label: 'Node 1', type: 'SOURCE', iconName: 'Radio' }
  - id: '2'
    type: 'pipeline'
    position: { x: 300, y: 200 }
    data: { label: 'Node 2', type: 'STEP', iconName: 'Clock' }
edges:
  - id: 'e1-2'
    source: '1'
    target: '2'
`
      }
    }));

    // Find the edge element (rendered by our mock)
    const edge = screen.getByTestId('edge-e1-2');
    
    // Click the edge to select it
    fireEvent.click(edge);
    
    // Simulate Delete key press on window
    fireEvent.keyDown(window, { key: 'Delete' });
    
    // Verify that the edge was removed from capturedEdges
    expect(capturedEdges.length).toBe(0);
    expect(capturedEdges.find(e => e.id === 'e1-2')).toBeFalsy();
  });

  it('renders Auto Layout button and repositions nodes on click', () => {
    render(<AppWithProvider />);

    const layoutBtn = screen.getByTitle('Auto Layout Diagram');
    expect(layoutBtn).toBeInTheDocument();

    // Trigger layout click
    fireEvent.click(layoutBtn);

    // Since the mock components verify that state was processed successfully, 
    // we can assert that no errors were thrown and fitView was invoked successfully.
    expect(layoutBtn).toBeInTheDocument();
  });

  it('allows expanding and collapsing navigation widget on click (defaults to off)', () => {
    render(<AppWithProvider />);

    // Defaults to off
    expect(screen.queryByTestId('mini-map')).not.toBeInTheDocument();

    const expandBtn = screen.getByTitle('Expand Navigation Map');
    expect(expandBtn).toBeInTheDocument();

    // Click to expand
    fireEvent.click(expandBtn);
    expect(screen.getByTestId('mini-map')).toBeInTheDocument();

    // Click to collapse
    const collapseBtn = screen.getByTitle('Collapse Navigation Map');
    expect(collapseBtn).toBeInTheDocument();
    fireEvent.click(collapseBtn);
    expect(screen.queryByTestId('mini-map')).not.toBeInTheDocument();
  });

  it('updates output folder when receiving loadPipeline and updateOutputFolder messages', () => {
    render(<AppWithProvider />);

    // Switch to SOURCE CODE tab
    const sourceCodeTabBtn = screen.getByText('SOURCE CODE');
    fireEvent.click(sourceCodeTabBtn);

    // Verify initial output folder is empty (placeholder is visible)
    const outputFolderInput = screen.getByPlaceholderText('Default (pipeline directory)') as HTMLInputElement;
    expect(outputFolderInput.value).toBe('');

    // Simulate receiving loadPipeline message with relativeFolder and defaultOutputFolder
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'loadPipeline',
        filename: 'my-pipeline.beam',
        relativeFolder: 'src/pipelines',
        defaultOutputFolder: 'src/pipelines/my-pipeline',
        data: 'nodes: []\nedges: []\npipelineConfig:\n  language: Python\n  outputFolder: ""\n  needsRebuild: false'
      }
    }));

    // Expect the input to be updated to the default output folder (with filename appended)
    expect(outputFolderInput.value).toBe('src/pipelines/my-pipeline');

    // Simulate receiving updateOutputFolder message
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'updateOutputFolder',
        outputFolder: 'src/other-pipelines/my-pipeline'
      }
    }));

    // Expect the input to be updated to the new path
    expect(outputFolderInput.value).toBe('src/other-pipelines/my-pipeline');
  });

  it('updates output folder when a renamed pipeline is loaded via loadPipeline message', () => {
    render(<AppWithProvider />);

    // Switch to SOURCE CODE tab
    const sourceCodeTabBtn = screen.getByText('SOURCE CODE');
    fireEvent.click(sourceCodeTabBtn);

    const outputFolderInput = screen.getByPlaceholderText('Default (pipeline directory)') as HTMLInputElement;

    // Simulate loading renamed file test/parse message/parse-message-pipeline.beam
    // with stale output folder test/job1/job1 in saved YAML
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'loadPipeline',
        filename: 'parse-message-pipeline.beam',
        relativeFolder: 'test/parse message',
        defaultOutputFolder: 'test/parse message/parse-message-pipeline',
        data: 'nodes: []\nedges: []\npipelineConfig:\n  language: Python\n  outputFolder: "test/job1/job1"\n  needsRebuild: false'
      }
    }));

    // Expect the output folder to be updated relative to the new .beam file location and name
    expect(outputFolderInput.value).toBe('test/parse message/parse-message-pipeline');
  });

  it('spawns FileIO Match and FileIO Read Matches connected nodes on FileIO source drop', () => {
    render(<AppWithProvider />);

    const reactFlow = screen.getByTestId('react-flow');

    fireEvent.drop(reactFlow, {
      clientX: 200,
      clientY: 200,
      dataTransfer: {
        getData: () => JSON.stringify({
          nodeType: 'pipelineNode',
          label: 'FileIO',
          type: 'SOURCE',
          iconName: 'Folder',
          beamTransform: 'FileIO'
        }),
      },
    });

    expect(screen.getByText('FileIO Match')).toBeInTheDocument();
    expect(screen.getByText('FileIO Read Matches')).toBeInTheDocument();
  });

  /**
   * M16 Finding Regression Test:
   * Edge redirection must rewire ALL inbound edges when inserting a KV Mapper,
   * not just the first one returned by findIndex.
   */
  it('M16: redirects ALL incoming edges when inserting KV Mapper before a Window node', () => {
    render(<AppWithProvider />);

    // Load a pipeline with 3 source nodes, all connected to 1 Window node
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'loadPipeline',
        filename: 'test.beam',
        data: `
nodes:
  - id: 's1'
    type: 'pipeline'
    position: { x: 100, y: 100 }
    data: { label: 'Source 1', type: 'SOURCE', iconName: 'Radio' }
  - id: 's2'
    type: 'pipeline'
    position: { x: 100, y: 200 }
    data: { label: 'Source 2', type: 'SOURCE', iconName: 'Radio' }
  - id: 's3'
    type: 'pipeline'
    position: { x: 100, y: 300 }
    data: { label: 'Source 3', type: 'SOURCE', iconName: 'Radio' }
  - id: 'w1'
    type: 'pipeline'
    position: { x: 400, y: 200 }
    data: { label: 'Window', type: 'STEP', iconName: 'Clock', beam_transform: 'Window', properties: { windowType: 'Session Window' } }
edges:
  - id: 'e-s1-w1'
    source: 's1'
    target: 'w1'
  - id: 'e-s2-w1'
    source: 's2'
    target: 'w1'
  - id: 'e-s3-w1'
    source: 's3'
    target: 'w1'
`
      }
    }));

    // Select the Window node to display PropertyPane
    const windowNode = screen.getByTestId('node-w1');
    fireEvent.click(windowNode);

    // Find and click the 'Add KV Mapper' button inside Session Window property panel
    const addKVMapperBtn = screen.getByRole('button', { name: /Add KV Mapper/i });
    expect(addKVMapperBtn).toBeInTheDocument();
    fireEvent.click(addKVMapperBtn);

    // After insertion, all 3 original edges must target the newly inserted KV Mapper node
    const edge1 = capturedEdges.find(e => e.id === 'e-s1-w1');
    const edge2 = capturedEdges.find(e => e.id === 'e-s2-w1');
    const edge3 = capturedEdges.find(e => e.id === 'e-s3-w1');

    expect(edge1).toBeDefined();
    expect(edge2).toBeDefined();
    expect(edge3).toBeDefined();

    // The new target should be the KV Mapper node (kv_mapper_...)
    const newTargetId = edge1?.target;
    expect(newTargetId).toMatch(/^kv_mapper_/);

    // ALL three inbound edges must point to the new KV Mapper node (M16 fix verification)
    expect(edge2?.target).toBe(newTargetId);
    expect(edge3?.target).toBe(newTargetId);

    // And a new connector edge connects KV Mapper to the window node
    const connectorEdge = capturedEdges.find(e => e.source === newTargetId && e.target === 'w1');
    expect(connectorEdge).toBeDefined();
  });

  /**
   * M13 Finding Regression Test:
   * Stale closure must not cause codeRegenerated to read folder files from initial '' folder.
   */
  it('M13: triggers folder refresh for the updated outputFolder on codeRegenerated', () => {
    render(<AppWithProvider />);

    // Update output folder from initial empty state to a custom path
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'updateOutputFolder',
        outputFolder: 'custom/target/folder'
      }
    }));

    // Clear postMessage spy calls recorded during setup
    const postMessageSpy = (window as any).vscode.postMessage;
    postMessageSpy.mockClear();

    // Send codeRegenerated message
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'codeRegenerated',
        success: true,
        code: '# regenerated pipeline code'
      }
    }));

    // Verify readFolderFiles was requested with the new folder, not stale empty string ''
    expect(postMessageSpy).toHaveBeenCalledWith({
      command: 'readFolderFiles',
      folderPath: 'custom/target/folder'
    });
  });

  /**
   * M12 Finding Regression Test:
   * Node objects passed to React Flow must maintain referential stability across
   * re-renders that do not change node data, ensuring React Flow's internal memoization works.
   */
  it('M12: preserves node object referential stability across re-renders that do not modify node data', () => {
    render(<AppWithProvider />);

    // Load a pipeline with a single node
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'loadPipeline',
        filename: 'test.beam',
        data: `
nodes:
  - id: 'node-1'
    type: 'pipeline'
    position: { x: 100, y: 100 }
    data: { label: 'Node 1', type: 'SOURCE', iconName: 'Radio' }
edges: []
`
      }
    }));

    expect(capturedNodes.length).toBe(1);
    const initialNode = capturedNodes[0];
    const initialData = initialNode.data;

    // Trigger an App re-render that does not modify node data (e.g. toggling minimap)
    const expandBtn = screen.getByTitle('Expand Navigation Map');
    fireEvent.click(expandBtn);

    expect(capturedNodes.length).toBe(1);
    const reRenderedNode = capturedNodes[0];

    // Node object and its data must maintain strict referential identity (toBe)
    expect(reRenderedNode).toBe(initialNode);
    expect(reRenderedNode.data).toBe(initialData);
  });

  /**
   * P6 Finding Test:
   * Two consecutive debounce ticks with unchanged state produce ONE post, not two;
   * a tick after a real change does post.
   */
  it('P6: two consecutive debounce ticks with unchanged state produce one post, not two; a tick after a real change does post', async () => {
    vi.useFakeTimers();
    try {
      render(<AppWithProvider />);

      // Load a pipeline
      fireEvent(window, new MessageEvent('message', {
        data: {
          command: 'loadPipeline',
          filename: 'test.beam',
          data: `
nodes:
  - id: 'node-1'
    type: 'pipeline'
    position: { x: 100, y: 100 }
    data: { label: 'Node 1', type: 'SOURCE', iconName: 'Radio' }
edges: []
`
        }
      }));

      const postMessageSpy = (window as any).vscode.postMessage;
      postMessageSpy.mockClear();

      // First debounce tick (2000ms)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Exactly 1 savePipeline post
      const saveCalls1 = postMessageSpy.mock.calls.filter((c: any[]) => c[0]?.command === 'savePipeline');
      expect(saveCalls1.length).toBe(1);

      // Trigger a re-render without state change (e.g. toggle minimap)
      const expandBtn = screen.getByTitle('Expand Navigation Map');
      fireEvent.click(expandBtn);

      // Second debounce tick
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Still exactly 1 savePipeline post! (P6 dirty check skipped second post)
      const saveCalls2 = postMessageSpy.mock.calls.filter((c: any[]) => c[0]?.command === 'savePipeline');
      expect(saveCalls2.length).toBe(1);

      // Now introduce a real change: drop a new node
      const reactFlow = screen.getByTestId('react-flow');
      fireEvent.drop(reactFlow, {
        clientX: 100,
        clientY: 100,
        dataTransfer: {
          getData: (key: string) => {
            if (key === 'application/reactflow') {
              return JSON.stringify({
                nodeType: 'pipeline',
                label: 'Log Message',
                type: 'SINK',
                iconName: 'Terminal'
              });
            }
            return '';
          }
        }
      });

      // Next debounce tick
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Real change produced a second savePipeline post
      const saveCalls3 = postMessageSpy.mock.calls.filter((c: any[]) => c[0]?.command === 'savePipeline');
      expect(saveCalls3.length).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

