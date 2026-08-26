/**
 * ThemeContext Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates theme switching across all 4 modes (dark, light, hc-dark, hc-light),
 * local storage synchronization, DOM class toggles, and VS Code body mutation observer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme, THEME_OPTIONS, STORAGE_THEME_KEY } from './ThemeContext';

// Simple in-memory localStorage mock for node/jsdom environments
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

const mockStorage = new LocalStorageMock();
Object.defineProperty(window, 'localStorage', {
  value: mockStorage,
  writable: true,
});

const TestComponent: React.FC = () => {
  const { theme, setTheme, isDark, isLight, isHighContrast } = useTheme();

  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="is-dark">{isDark ? 'true' : 'false'}</span>
      <span data-testid="is-light">{isLight ? 'true' : 'false'}</span>
      <span data-testid="is-hc">{isHighContrast ? 'true' : 'false'}</span>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('hc-dark')}>Set HC Dark</button>
      <button onClick={() => setTheme('hc-light')}>Set HC Light</button>
    </div>
  );
};

describe('ThemeContext & ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    document.body.className = '';
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('provides dark theme as default when no storage exists', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(screen.getByTestId('is-dark').textContent).toBe('true');
    expect(screen.getByTestId('is-light').textContent).toBe('false');
    expect(screen.getByTestId('is-hc').textContent).toBe('false');
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.body.classList.contains('vscode-dark')).toBe(true);
  });

  it('loads saved theme preference from localStorage', () => {
    window.localStorage.setItem(STORAGE_THEME_KEY, 'hc-dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme').textContent).toBe('hc-dark');
    expect(screen.getByTestId('is-dark').textContent).toBe('true');
    expect(screen.getByTestId('is-hc').textContent).toBe('true');
    expect(document.body.classList.contains('vscode-high-contrast')).toBe(true);
    expect(document.body.classList.contains('theme-hc-dark')).toBe(true);
  });

  it('switches between all 4 theme modes and updates DOM classes and storage', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Switch to Light
    fireEvent.click(screen.getByText('Set Light'));
    expect(screen.getByTestId('current-theme').textContent).toBe('light');
    expect(screen.getByTestId('is-light').textContent).toBe('true');
    expect(screen.getByTestId('is-dark').textContent).toBe('false');
    expect(window.localStorage.getItem(STORAGE_THEME_KEY)).toBe('light');
    expect(document.body.classList.contains('vscode-light')).toBe(true);
    expect(document.body.classList.contains('theme-light')).toBe(true);

    // Switch to HC Light
    fireEvent.click(screen.getByText('Set HC Light'));
    expect(screen.getByTestId('current-theme').textContent).toBe('hc-light');
    expect(screen.getByTestId('is-light').textContent).toBe('true');
    expect(screen.getByTestId('is-hc').textContent).toBe('true');
    expect(window.localStorage.getItem(STORAGE_THEME_KEY)).toBe('hc-light');
    expect(document.body.classList.contains('vscode-high-contrast-light')).toBe(true);
    expect(document.body.classList.contains('theme-hc-light')).toBe(true);

    // Switch to HC Dark
    fireEvent.click(screen.getByText('Set HC Dark'));
    expect(screen.getByTestId('current-theme').textContent).toBe('hc-dark');
    expect(screen.getByTestId('is-dark').textContent).toBe('true');
    expect(screen.getByTestId('is-hc').textContent).toBe('true');
    expect(window.localStorage.getItem(STORAGE_THEME_KEY)).toBe('hc-dark');
    expect(document.body.classList.contains('vscode-high-contrast')).toBe(true);
    expect(document.body.classList.contains('theme-hc-dark')).toBe(true);

    // Switch back to Dark
    fireEvent.click(screen.getByText('Set Dark'));
    expect(screen.getByTestId('current-theme').textContent).toBe('dark');
    expect(screen.getByTestId('is-dark').textContent).toBe('true');
    expect(screen.getByTestId('is-light').textContent).toBe('false');
    expect(window.localStorage.getItem(STORAGE_THEME_KEY)).toBe('dark');
    expect(document.body.classList.contains('vscode-dark')).toBe(true);
    expect(document.body.classList.contains('theme-dark')).toBe(true);
  });

  it('exports all 4 standard theme options in THEME_OPTIONS', () => {
    expect(THEME_OPTIONS).toHaveLength(4);
    const ids = THEME_OPTIONS.map((t) => t.id);
    expect(ids).toEqual(['dark', 'light', 'hc-dark', 'hc-light']);
  });

  it('throws error when useTheme is called outside ThemeProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => render(<TestComponent />)).toThrow('useTheme must be used within a ThemeProvider');
    
    consoleSpy.mockRestore();
  });
});
