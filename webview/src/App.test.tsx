import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppWithProvider from './App.tsx';

// Mock window.acquireVsCodeApi
const mockPostMessage = vi.fn();
(window as any).acquireVsCodeApi = () => ({
  postMessage: mockPostMessage
});

// Mock React Flow
vi.mock('reactflow', async () => {
  const actual = await vi.importActual('reactflow');
  return {
    ...actual,
    default: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
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
});
