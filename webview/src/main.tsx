/**
 * Main Webview Entry Point
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Bootstraps the React root for the Apache Beam Designer webview extension,
 * wrapping the application in StrictMode and the VS Code Agent Flow ThemeProvider.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
