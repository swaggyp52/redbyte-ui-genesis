import { render } from "@testing-library/react";
import React from "react";
import { AndIcon, WindowCloseIcon } from "./index";

describe("rb-icons", () => {
  it("renders window icon", () => {
    const { getByRole } = render(<WindowCloseIcon aria-label="close" />);
    expect(getByRole("img")).toBeInTheDocument();
  });

  it("renders logic icon", () => {
    const { container } = render(<AndIcon aria-label="and" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
