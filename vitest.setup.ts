import '@testing-library/jest-dom';

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
