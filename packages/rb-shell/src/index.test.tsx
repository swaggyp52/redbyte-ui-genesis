import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { Desktop } from "./index";

const apps = [{ id: "terminal", name: "Terminal" }];

describe("rb-shell", () => {
  it("opens a window when clicking dock", () => {
    render(<Desktop apps={apps} />);
    fireEvent.click(screen.getByRole("button", { name: /terminal/i }));
    const taskButton = screen.getByRole("button", { name: /terminal/i, hidden: true });
    expect(taskButton).toBeInTheDocument();
  });

  it("updates taskbar on open and close", () => {
    render(<Desktop apps={apps} />);
    fireEvent.click(screen.getByRole("button", { name: /terminal/i }));
    expect(screen.getAllByRole("button", { name: /terminal/i }).length).toBeGreaterThan(0);
    const closeTargets = screen.getAllByLabelText(/close window/i);
    fireEvent.click(closeTargets[0]);
    expect(screen.queryByRole("button", { name: /terminal/i, hidden: true })).toBeNull();
  });
});
