import '@testing-library/jest-dom';
import { vi } from 'vitest';

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

