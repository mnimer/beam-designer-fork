import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppWithProvider from './App.tsx';

// Mock window.acquireVsCodeApi
const mockPostMessage = vi.fn();
(window as any).acquireVsCodeApi = () => ({
  postMessage: mockPostMessage
});

let capturedEdges: any[] = [];

// Mock React Flow
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    default: ({ nodes = [], edges = [], onNodeClick, onEdgeClick, children, onDrop }: any) => (
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
    ),
    MiniMap: () => <div data-testid="mini-map" />,
    Controls: () => <div data-testid="controls" />,
    Background: () => <div data-testid="background" />,
    useReactFlow: () => ({ project: (p: any) => p }),
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

    expect(screen.getByText('Nodes')).toBeInTheDocument();
    expect(screen.getByText('DEPLOYMENT')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('connects Parse Message step to PubSub source on drop', () => {
    render(<AppWithProvider />);

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

    // Verify that the edge was created.
    expect(capturedEdges.length).toBe(3); // 2 initial + 1 new
    const newEdge = capturedEdges.find(e => e.source === '1' && e.target !== '2');
    expect(newEdge).toBeTruthy();
  });

  it('deletes selected edge on Delete key press', () => {
    render(<AppWithProvider />);

    // Find the edge element (rendered by our mock)
    const edge = screen.getByTestId('edge-e1-2');
    
    // Click the edge to select it
    fireEvent.click(edge);
    
    // Simulate Delete key press on window
    fireEvent.keyDown(window, { key: 'Delete' });
    
    // Verify that the edge was removed from capturedEdges
    expect(capturedEdges.length).toBe(1);
    expect(capturedEdges.find(e => e.id === 'e1-2')).toBeFalsy();
  });
});
