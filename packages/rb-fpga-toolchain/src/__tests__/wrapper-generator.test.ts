import { describe, expect, it } from "vitest";
import { generateWrapperVerilog, hashText } from "../wrapper.js";

describe("wrapper generator", () => {
  it("generates deterministic wrapper output for identical inputs", () => {
    const options = {
      boardModelId: "basys3",
      studentTop: "student_top",
      pinmapHash: "sha256:deadbeef",
      designHash: "sha256:abc123",
      buildId: "build-abc123",
      wrapperVersion: "0.1.0",
    };

    const first = generateWrapperVerilog(options);
    const second = generateWrapperVerilog(options);

    expect(hashText(first)).toEqual(hashText(second));
    expect(first).toContain('board_model_id: basys3');
    expect(first).toContain("module rb_wrapper_top");
  });

  it("changes when the student top changes", () => {
    const base = {
      boardModelId: "basys3",
      pinmapHash: "sha256:deadbeef",
      designHash: "sha256:abc123",
      buildId: "build-abc123",
      wrapperVersion: "0.1.0",
    };

    const first = generateWrapperVerilog({ ...base, studentTop: "student_a" });
    const second = generateWrapperVerilog({ ...base, studentTop: "student_b" });

    expect(hashText(first)).not.toEqual(hashText(second));
  });
});
