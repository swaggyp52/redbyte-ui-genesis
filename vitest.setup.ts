import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';

// jsdom does not provide several browser APIs we rely on in UI components.
// Stub them globally to avoid per-test mocks and worker-crashing unhandled errors.
if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserver;
}

if (typeof (globalThis as any).IntersectionObserver === 'undefined') {
  class IntersectionObserver {
    constructor(_callback: any) {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (globalThis as any).IntersectionObserver = IntersectionObserver;
}

if (typeof (globalThis as any).matchMedia === 'undefined') {
  (globalThis as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Pre-register all apps for search tests
// This allows searchRegistry.ts to find apps via listApps()
let appsRegistered = false;
let registerPromise: Promise<void> | null = null;

async function registerTestApps() {
  if (appsRegistered) return;
  if (!registerPromise) {
    registerPromise = (async () => {
      try {
        const { registerAllApps } = await import('./packages/rb-apps/src/index.ts');
        await registerAllApps();
        appsRegistered = true;
      } catch {
        // Module may not be loaded in all tests
      }
    })();
  }
  await registerPromise;
}

// Mock requestAnimationFrame to prevent uiTickStore animation loops in tests
const originalRAF = globalThis.requestAnimationFrame;
const originalCAF = globalThis.cancelAnimationFrame;

beforeAll(async () => {
  if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
    // Polyfill Blob.arrayBuffer for Node test environments
    Blob.prototype.arrayBuffer = async function arrayBuffer() {
      const anyBlob = this as any;
      if (anyBlob?.buffer instanceof ArrayBuffer) {
        return anyBlob.buffer;
      }
      if (anyBlob?._buffer) {
        const raw = anyBlob._buffer;
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
          return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        }
        if (raw instanceof ArrayBuffer) {
          return raw;
        }
      }
      if (typeof anyBlob?.text === 'function') {
        const text = await anyBlob.text();
        return new TextEncoder().encode(text).buffer;
      }
      return new Uint8Array(0).buffer;
    };
  }

  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.OPEN;
    url: string;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    private listeners: Record<string, Array<(event: any) => void>> = {};

    constructor(url: string) {
      this.url = url;
      queueMicrotask(() => {
        const event = typeof Event !== 'undefined' ? new Event('open') : ({ type: 'open' } as Event);
        this.onopen?.(event);
        this.emit('open', event);
      });
    }

    send(_data: any) {
      // no-op for tests
    }

    close() {
      this.readyState = MockWebSocket.CLOSED;
      const event = typeof CloseEvent !== 'undefined'
        ? new CloseEvent('close')
        : ({ type: 'close' } as CloseEvent);
      this.onclose?.(event);
      this.emit('close', event);
    }

    addEventListener(type: string, listener: (event: any) => void) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(listener);
    }

    removeEventListener(type: string, listener: (event: any) => void) {
      const stack = this.listeners[type];
      if (!stack) return;
      this.listeners[type] = stack.filter((l) => l !== listener);
    }

    private emit(type: string, event: any) {
      const stack = this.listeners[type];
      if (!stack) return;
      stack.forEach((listener) => listener(event));
    }
  }

  (globalThis as any).WebSocket = MockWebSocket;

  await registerTestApps();
}, 90000);

beforeEach(async () => {
  // Replace RAF with a no-op that returns a valid ID but never invokes callback
  globalThis.requestAnimationFrame = vi.fn(() => 1);
  globalThis.cancelAnimationFrame = vi.fn();
});

afterEach(async () => {
  cleanup();

  // Restore original RAF
  globalThis.requestAnimationFrame = originalRAF;
  globalThis.cancelAnimationFrame = originalCAF;
  vi.useRealTimers();
  vi.clearAllMocks();

  if (typeof window !== 'undefined') {
    window.localStorage?.clear();
    window.sessionStorage?.clear();
    window.history.replaceState(null, '', '/');
  }

  if (typeof document !== 'undefined') {
    document.body.replaceChildren();
  }

  // Stop uiTickStore animation loop and reset state after each test
  try {
    const { useUiTickStore } = await import('./packages/rb-utils/src/index.ts');
    const state = useUiTickStore.getState();
    if (state.running) {
      state.stop();
    }
    // Reset to initial state
    useUiTickStore.setState({ uiTick: 0, running: false });
  } catch {
    // Module may not be loaded in all tests
  }

  // Reset fileSystemStore to prevent test pollution
  try {
    const { useFileSystemStore } = await import('./packages/rb-apps/src/index.ts');
    useFileSystemStore.getState().resetAll();
  } catch {
    // Module may not be loaded in all tests
  }
});

// Suppress Three.js multiple instances warning in tests
// This occurs because rb-logic-3d and other packages import Three.js independently
// See: https://discourse.threejs.org/t/warning-multiple-instances-of-three-js/33115
const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  // Allow only the specific Three.js multiple instances warning
  if (message.includes('Multiple instances of Three.js')) {
    return;
  }
  originalConsoleWarn(...args);
};
