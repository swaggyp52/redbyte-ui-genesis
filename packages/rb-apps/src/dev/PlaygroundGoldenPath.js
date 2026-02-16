import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { Suspense, useState, useEffect } from 'react';
const LogicPlaygroundComponent = React.lazy(async () => {
  const mod = await import('../apps/LogicPlaygroundApp');
  return { default: mod.LogicPlaygroundComponent };
});

// Error boundary class component
class ErrorBoundaryComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    console.error('[GOLDEN_ERROR_BOUNDARY]', error);
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return _jsx("div", {
        style: { color: 'red', padding: 20, fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'monospace' },
        children: _jsxs(_Fragment, {
          children: [
            "[GOLDEN_PATH] Error: ",
            String(this.state.error),
            _jsx("br", {}),
            this.state.error?.stack
          ]
        })
      });
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
      (window).__RB_SUSPENSE_STUCK__ = true;
      setStuck(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return _jsx("div", {
    style: {
      color: stuck ? 'red' : 'yellow',
      padding: 20,
      fontSize: 16,
      background: stuck ? '#330000' : undefined,
      whiteSpace: 'pre-wrap',
      fontFamily: 'monospace'
    },
    "data-testid": "suspense-fallback",
    children: _jsxs(_Fragment, {
      children: [
        "[GOLDEN_PATH] Loading in Suspense...",
        stuck && _jsx("div", { style: { marginTop: 20, fontSize: 12 }, children: "\u26a0\ufe0f STUCK: Promise not resolving after 2000ms" })
      ]
    })
  });
}

export function PlaygroundGoldenPath() {
    console.log("[GOLDEN_PATH] enabled");
    console.log("[GOLDEN_PATH] about to render JSX");
    const [hasError, setHasError] = useState(null);

    useEffect(() => {
        console.log('[GOLDEN_PATH] useEffect fired');
        return () => {
            console.log('[GOLDEN_PATH] useEffect cleanup');
        };
    }, []);

    if (hasError) {
        return _jsx("div", { style: { color: 'red', padding: 20 }, children: "Error: " + hasError });
    }

    console.log("[GOLDEN_PATH] about to return main div");
    const result = _jsx("div", {
        style: { width: '100vw', height: '100vh', overflow: 'hidden', background: '#1e1e1e' },
        children: _jsxs(_Fragment, {
            children: [
                _jsx("div", {
                    style: { position: 'fixed', top: 0, left: 0, color: 'cyan', fontSize: 10, zIndex: 99999, maxWidth: '300px', wordBreak: 'break-all' },
                    children: "[GOLDEN_PATH] OUTER DIV RENDERED NOW"
                }),
                _jsx(ErrorBoundaryComponent, {
                    children: _jsx(Suspense, {
                        fallback: _jsx(SuspenseFallback, {}),
                        children: _jsxs("div", {
                            children: [
                                _jsx("div", {
                                    style: { position: 'absolute', top: 10, left: 10, color: 'yellow', zIndex: 9999 },
                                    children: "[GOLDEN_PATH] Div rendered"
                                }),
                                _jsx(LogicPlaygroundComponent, {
                                    windowId: "golden-path-window"
                                })
                            ]
                        })
                    })
                })
            ]
        })
    });
    console.log("[GOLDEN_PATH] returning JSX");
    return result;
}
