import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';

// Pre-register all apps for search tests
// This allows searchRegistry.ts to find apps via listApps()
async function registerTestApps() {
  try {
    const { registerAllApps } = await import('./packages/rb-apps/src/index.ts');
    await registerAllApps();
  } catch {
    // Module may not be loaded in all tests
  }
}

// Mock requestAnimationFrame to prevent uiTickStore animation loops in tests
const originalRAF = globalThis.requestAnimationFrame;
const originalCAF = globalThis.cancelAnimationFrame;

beforeEach(async () => {
  // Pre-register apps for search/launcher tests
  await registerTestApps();

  // Replace RAF with a no-op that returns a valid ID but never invokes callback
  globalThis.requestAnimationFrame = vi.fn(() => 1);
  globalThis.cancelAnimationFrame = vi.fn();
});

afterEach(async () => {
  // Restore original RAF
  globalThis.requestAnimationFrame = originalRAF;
  globalThis.cancelAnimationFrame = originalCAF;

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
