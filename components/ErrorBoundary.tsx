'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-900 p-8">
          <div className="max-w-md w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">Something went wrong</h1>
            <p className="text-neutral-600 dark:text-neutral-300 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-[#082b4a] dark:bg-[#00adf0] text-white rounded-lg hover:bg-[#061d33] dark:hover:bg-[#0099d6] transition-colors"
            >
              Reload Page
            </button>
            {this.state.error && (
              <details className="mt-4">
                <summary className="text-sm text-neutral-400 cursor-pointer">Error Details</summary>
                <pre className="mt-2 text-xs bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 p-4 rounded overflow-auto border border-neutral-300 dark:border-neutral-700">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;


