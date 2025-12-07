import { describe, expect, it } from "vitest";
import { __rbPlaceholder } from "./index";

describe("placeholder", () => {
  it("exports placeholder", () => {
    expect(__rbPlaceholder).toBe(true);
  });
});
