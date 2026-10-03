import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

// Property panels are code-split and loaded via dynamic import() (see
// catalog/propertyFormRegistry.ts). Under vitest the FIRST import of a panel module also
// pays its on-demand transform cost, which can exceed Testing Library's default 1s budget
// for findBy*/waitFor on a loaded machine. Give async queries more headroom suite-wide.
configure({ asyncUtilTimeout: 5000 });

// Mock ResizeObserver as a class to support 'new ResizeObserver'
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);

// Mock window.acquireVsCodeApi globally for all tests
const mockPostMessage = vi.fn();
(window as any).acquireVsCodeApi = () => ({
  postMessage: mockPostMessage
});

