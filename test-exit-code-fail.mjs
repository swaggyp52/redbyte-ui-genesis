import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const invalidSource = `
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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-toolchain-"));
const srcDir = path.join(tempDir, "src-bad");
const outDir = path.join(tempDir, "out-bad");
fs.mkdirSync(srcDir, { recursive: true });
fs.writeFileSync(path.join(srcDir, "student_top.v"), invalidSource, "utf8");

const scriptPath = path.resolve(process.cwd(), "tools", "toolchain", "rb-fpga-toolchain.mjs");

const result = spawnSync(process.execPath, [scriptPath, "build", "--board", "basys3", "--src", srcDir, "--top", "student_top", "--out", outDir, "--skip-vivado"], {
    encoding: "utf8",
    env: process.env,
});

console.log("Exit code:", result.status);
console.log("Stdout:", result.stdout?.substring(0, 300));
console.log("Stderr:", result.stderr?.substring(0, 300));

const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
console.log("Error code:", manifest.error_code);
console.log("Invalid port:", manifest.interface_check.invalid[0]?.name);
