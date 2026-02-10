import React, { ReactNode, ReactElement } from 'react';
import { CircuitEditor } from '../circuit-editor';
import useLabStore from '../store/labStore';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ProErrorBoundary: Error boundary for Circuit Designer Pro
 * Falls back to Classic circuit editor if Pro crashes
 * Emits pro_crash_fallback event on error
 */
export class ProErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
    // Emit event to store
    const store = useLabStore.getState();
    store.emitEvent('pro_crash_fallback', {
      error: error.toString(),
      message: error.message,
    });

    console.error('Pro crashed:', error);
  }

  render(): ReactElement {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-full bg-slate-950">
          {/* Error banner */}
          <div className="bg-red-900 border-b border-red-700 px-4 py-3 text-red-200 text-sm font-tech">
            <span className="font-bold">⚠️ Pro crashed</span> — fell back to Classic. Error: {this.state.error?.message}
          </div>

          {/* Classic editor fallback */}
          <div className="flex-1 overflow-auto">
            <CircuitEditor />
          </div>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
