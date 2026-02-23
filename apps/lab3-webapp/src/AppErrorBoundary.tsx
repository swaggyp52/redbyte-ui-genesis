import React from 'react';

interface State { hasError: boolean; error: Error | null; }

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
          <div className="max-w-lg text-center space-y-4">
            <h1 className="text-2xl font-bold text-red-400">Something went wrong</h1>
            <p className="text-slate-300 text-sm font-mono">{this.state.error?.message}</p>
            <p className="text-slate-400 text-sm">
              Your work is auto-saved. Try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}
