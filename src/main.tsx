import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import './index.css';
import App from './App.tsx';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Unhandled application UI error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  handleReload = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-border-default shadow-sm max-w-md w-full p-6 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-primary flex items-center justify-center border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Something went wrong</h1>
              <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                {this.state.errorMessage || 'Unable to render this view. You can try again or return to the dashboard.'}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl border border-border-default bg-white text-xs font-semibold text-foreground hover:bg-surface-muted transition-colors cursor-pointer"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
