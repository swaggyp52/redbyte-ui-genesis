import React, { Suspense, useState, useEffect } from 'react';
import { LogicPlaygroundComponent } from '../apps/LogicPlaygroundApp';

// Simple error boundary
class ErrorBoundaryComponent extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    console.error('[GOLDEN_ERROR_BOUNDARY]', error);
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: 20, fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          [GOLDEN_PATH] Error: {String(this.state.error)}
          <br />
          {this.state.error?.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

// Suspense fallback with timeout escalator
function SuspenseFallback() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    console.log('[SUSPENSE_FALLBACK] Rendered - waiting for LogicPlaygroundComponent');
    const timer = setTimeout(() => {
      console.log('[SUSPENSE_STUCK] fallback still showing after 2000ms - promise likely pending forever');
      (window as any).__RB_SUSPENSE_STUCK__ = true;
      setStuck(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ 
      color: stuck ? 'red' : 'yellow', 
      padding: 20, 
      fontSize: 16,
      background: stuck ? '#330000' : undefined,
      whiteSpace: 'pre-wrap',
      fontFamily: 'monospace'
    }} 
    data-testid="suspense-fallback">
      [GOLDEN_PATH] Loading in Suspense...
      {stuck && <div style={{ marginTop: 20, fontSize: 12 }}>⚠️ STUCK: Promise not resolving after 2000ms</div>}
    </div>
  );
}

// Stub props if strictly required, but LogicPlaygroundComponent seems to handle optional props well.
export function PlaygroundGoldenPath() {
    console.log("[GOLDEN_PATH] enabled");
    console.log("[GOLDEN_PATH] about to render JSX");
    const [hasError, setHasError] = useState<string | null>(null);

    useEffect(() => {
        console.log('[GOLDEN_PATH] useEffect fired');
        return () => {
            console.log('[GOLDEN_PATH] useEffect cleanup');
        };
    }, []);

    if (hasError) {
        return <div style={{ color: 'red', padding: 20 }}>Error: {hasError}</div>;
    }

    console.log("[GOLDEN_PATH] about to return main div");
    const result = (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#1e1e1e' }}>
            <ErrorBoundaryComponent>
                <Suspense fallback={<SuspenseFallback />}>
                    <div>
                        {/* 
                    Mounting directly. 
                    Passing dummy IDs to satisfy any potential internal checks, 
                    though most props appear optional in the definition.
                 */}
                        <LogicPlaygroundComponent
                            windowId="golden-path-window"
                        />
                    </div>
                </Suspense>
            </ErrorBoundaryComponent>
        </div>
    );
    console.log("[GOLDEN_PATH] returning JSX");
    return result;
}
