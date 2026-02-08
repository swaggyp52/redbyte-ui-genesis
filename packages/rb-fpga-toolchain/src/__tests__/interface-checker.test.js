import { describe, expect, it } from "vitest";
import { checkTopInterface } from "../interface-checker.js";
const validSource = `
module student_top (
  input clk,
  input [15:0] sw,
  input [4:0] btn,
  output [15:0] led,
  output [6:0] seg,
  output [3:0] an,
  output dp
);
endmodule
`;
const missingPort = `
module student_top (
  input clk,
  input [15:0] sw,
  input [4:0] btn,
  output [15:0] led,
  output [6:0] seg,
  output [3:0] an
);
endmodule
`;
const wrongWidth = `
module student_top (
  input clk,
  input [7:0] sw,
  input [4:0] btn,
  output [15:0] led,
  output [6:0] seg,
  output [3:0] an,
  output dp
);
endmodule
`;
describe("interface checker", () => {
    it("accepts a valid student top", () => {
        const result = checkTopInterface({ sources: [validSource], topName: "student_top" });
        expect(result.ok).toBe(true);
    });
    it("rejects missing ports", () => {
        const result = checkTopInterface({ sources: [missingPort], topName: "student_top" });
        expect(result.ok).toBe(false);
        expect(result.missing).toContain("dp");
    });
    it("rejects wrong widths", () => {
        const result = checkTopInterface({ sources: [wrongWidth], topName: "student_top" });
        expect(result.ok).toBe(false);
        expect(result.invalid[0].name).toBe("sw");
    });
});
