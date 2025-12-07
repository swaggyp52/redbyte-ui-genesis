import { describe, expect, it, vi } from "vitest";
import { applyTheme, getActiveTheme } from "./index";

const createRoot = (): HTMLElement => {
  return document.createElement("div");
};

describe("applyTheme", () => {
  it("sets css vars on the root element", () => {
    const root = createRoot();
    applyTheme(root, "dark-neon", { persist: false });
    expect(root.style.getPropertyValue("--rb-color-accent-500")).not.toBe("");
  });

  it("overwrites css vars when switching themes", () => {
    const root = createRoot();
    applyTheme(root, "dark-neon", { persist: false });
    const firstValue = root.style.getPropertyValue("--rb-color-surface-50");
    applyTheme(root, "light-frost", { persist: false });
    expect(root.style.getPropertyValue("--rb-color-surface-50")).not.toBe(firstValue);
  });

  it("persists the theme selection when window is available", () => {
    const root = createRoot();
    applyTheme(root, "light-frost");
    expect(getActiveTheme()).toBe("light-frost");
  });

  it("is SSR safe", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error intentional undefined for test
    globalThis.window = undefined;
    const root = createRoot();
    expect(() => applyTheme(root, "dark-neon", { persist: true })).not.toThrow();
    expect(getActiveTheme()).toBeNull();
    globalThis.window = originalWindow;
  });
});
