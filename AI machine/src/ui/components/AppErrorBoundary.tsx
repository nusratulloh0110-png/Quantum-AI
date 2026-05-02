import { Component, ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="loading-screen px-6 text-center">
          <div className="error-panel">
            <div className="text-sm font-medium text-crimson">Application error</div>
            <div className="mt-2 text-sm text-slate-600">The interface caught a rendering error instead of showing a blank page.</div>
            <pre className="error-trace">{this.state.error.message}</pre>
            <button className="primary-button mt-4" type="button" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
