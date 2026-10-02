/**
 * ErrorBoundary Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * React error boundary component that isolates component render/lifecycle crashes,
 * preventing unhandled exceptions in property forms or sidebars from unmounting
 * the entire canvas/diagram tree.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Props for the {@link ErrorBoundary} component.
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

/**
 * Internal state for the {@link ErrorBoundary} component tracking captured errors.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React ErrorBoundary component that isolates rendering errors within subtree boundaries.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  /**
   * Updates component state upon catching an error in a child component.
   *
   * @param error The thrown error instance.
   * @returns Updated error boundary state with the caught error.
   */
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Catches errors in descendant components and logs diagnostic details.
   *
   * @param error The thrown error instance.
   * @param errorInfo Component stack traces associated with the error.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[@ErrorBoundary] Caught component error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  /**
   * Renders fallback error UI when an error is caught or child elements when healthy.
   *
   * @returns Rendered fallback alert or child elements.
   */
  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-950/40 border border-red-500/50 rounded-lg text-red-200 text-sm flex flex-col gap-2 m-2">
          <div className="flex items-center gap-2 font-bold text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{this.props.fallbackTitle || 'Component Error'}</span>
          </div>
          <p className="text-xs text-red-300/80 font-mono break-words">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-1.5 self-start text-xs bg-red-900/60 hover:bg-red-800 text-white px-2.5 py-1.5 rounded transition-colors mt-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
