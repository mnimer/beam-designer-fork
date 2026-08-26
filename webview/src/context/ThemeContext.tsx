/**
 * ThemeContext Component & Provider
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Provides application-wide theme state management adhering to the VS Code Agent Flow
 * Visual & Theming Design System. Supports 4 discrete theme modes (dark, light, hc-dark, hc-light),
 * automatic synchronization with native VS Code webview body classes, and localStorage persistence.
 * 
 * Architectural Decisions:
 * - Supports 4 modes: 'dark' (VS Code Dark+), 'light' (VS Code Light+), 'hc-dark' (High Contrast Dark WCAG AAA), 'hc-light' (High Contrast Light WCAG AAA).
 * - Observes document.body class changes to seamlessly follow the parent VS Code editor theme.
 * - Injects both custom theme utility classes (.theme-*) and standard VS Code body classes (.vscode-*).
 * - Adheres strictly to the 8pt grid system and modern React Context patterns.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'dark' | 'light' | 'hc-dark' | 'hc-light';

export interface ThemeOption {
  id: AppTheme;
  name: string;
  category: 'Dark' | 'Light' | 'High Contrast';
  icon: string;
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'dark',
    name: 'VS Code Dark+ (Default)',
    category: 'Dark',
    icon: '🌙',
    description: 'Classic Dark Theme with deep slate contrast',
  },
  {
    id: 'light',
    name: 'VS Code Light+ (Modern Light)',
    category: 'Light',
    icon: '☀️',
    description: 'Clean crisp Light Theme with high legibility',
  },
  {
    id: 'hc-dark',
    name: 'High Contrast Dark (WCAG AAA)',
    category: 'High Contrast',
    icon: '🔲',
    description: 'Pure black canvas with high-contrast neon borders',
  },
  {
    id: 'hc-light',
    name: 'High Contrast Light (WCAG AAA)',
    category: 'High Contrast',
    icon: '🔳',
    description: 'Pure white canvas with high-contrast sharp borders',
  },
];

export interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  isDark: boolean;
  isLight: boolean;
  isHighContrast: boolean;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

export const STORAGE_THEME_KEY = 'vscode_agent_flow_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_THEME_KEY);
        if (saved && ['dark', 'light', 'hc-dark', 'hc-light'].includes(saved)) {
          return saved as AppTheme;
        }
      }
    } catch (e) {
      console.warn('Failed to load theme preference:', e);
    }
    return 'dark';
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_THEME_KEY, newTheme);
      }
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  };

  // Sync DOM classes when theme state changes
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    const allClasses = [
      'theme-dark',
      'theme-light',
      'theme-hc-dark',
      'theme-hc-light',
      'vscode-dark',
      'vscode-light',
      'vscode-high-contrast',
      'vscode-high-contrast-light',
    ];

    root.classList.remove(...allClasses);
    body.classList.remove(...allClasses);

    // Apply custom theme class
    root.classList.add(`theme-${theme}`);
    body.classList.add(`theme-${theme}`);

    // Apply native VS Code classes for seamless webview interop
    if (theme === 'dark') {
      root.classList.add('vscode-dark');
      body.classList.add('vscode-dark');
    } else if (theme === 'light') {
      root.classList.add('vscode-light');
      body.classList.add('vscode-light');
    } else if (theme === 'hc-dark') {
      root.classList.add('vscode-high-contrast', 'vscode-dark');
      body.classList.add('vscode-high-contrast', 'vscode-dark');
    } else if (theme === 'hc-light') {
      root.classList.add('vscode-high-contrast-light', 'vscode-light');
      body.classList.add('vscode-high-contrast-light', 'vscode-light');
    }
  }, [theme]);

  // Auto-detect native VS Code theme changes from body class mutations
  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(() => {
      const isVsCodeLight = document.body.classList.contains('vscode-light');
      const isVsCodeHc = document.body.classList.contains('vscode-high-contrast');
      const isVsCodeHcLight = document.body.classList.contains('vscode-high-contrast-light');

      if (isVsCodeHcLight) {
        setThemeState('hc-light');
      } else if (isVsCodeHc) {
        setThemeState('hc-dark');
      } else if (isVsCodeLight) {
        setThemeState('light');
      } else if (document.body.classList.contains('vscode-dark')) {
        setThemeState('dark');
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const isDark = theme === 'dark' || theme === 'hc-dark';
  const isLight = theme === 'light' || theme === 'hc-light';
  const isHighContrast = theme === 'hc-dark' || theme === 'hc-light';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, isLight, isHighContrast }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
