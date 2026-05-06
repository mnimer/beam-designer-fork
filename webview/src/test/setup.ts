import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver as a class to support 'new ResizeObserver'
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);
