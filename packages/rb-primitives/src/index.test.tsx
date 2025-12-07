import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { Button, Menu, Tooltip } from "./index";

describe("rb-primitives", () => {
  it("fires button click", () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Click me</Button>);
    fireEvent.click(screen.getByRole("button", { name: /click me/i }));
    expect(handler).toHaveBeenCalled();
  });

  it("opens menu with keyboard", () => {
    const onSelect = vi.fn();
    render(<Menu label="Menu" items={[{ id: "1", label: "Item", onSelect }]} />);
    const button = screen.getByRole("button", { name: /menu/i });
    button.focus();
    fireEvent.keyDown(button, { key: "ArrowDown" });
    const menuItem = screen.getByRole("menuitem");
    expect(menuItem).toBeVisible();
    fireEvent.keyDown(button, { key: "Enter" });
    expect(onSelect).toHaveBeenCalled();
  });

  it("shows tooltip on hover", () => {
    render(
      <Tooltip label="Hello">
        <Button>Hover me</Button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: /hover me/i });
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Hello");
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
