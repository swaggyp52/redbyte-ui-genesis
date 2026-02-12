import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../src/App";

vi.mock("@redbyte/rb-shell", () => ({
  Shell: () => <div data-testid="shell-root">shell</div>,
}));

vi.mock("@redbyte/rb-apps/apps/ToolchainSetupApp", () => ({
  ToolchainSetupComponent: () => <div data-testid="toolchain-route-page">toolchain setup</div>,
}));

describe("App toolchain route", () => {
  afterEach(() => {
    cleanup();
    window.history.pushState({}, "", "/");
  });

  it("renders toolchain setup page for /toolchain", () => {
    window.history.pushState({}, "", "/toolchain");
    render(<App />);
    expect(screen.getByTestId("toolchain-route-page")).toBeTruthy();
  });

  it("renders shell for default routes", () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(screen.getByTestId("shell-root")).toBeTruthy();
  });
});
