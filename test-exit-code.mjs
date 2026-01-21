import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

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

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-toolchain-"));
const srcDir = path.join(tempDir, "src");
const outDir = path.join(tempDir, "out");
fs.mkdirSync(srcDir, { recursive: true });
fs.writeFileSync(path.join(srcDir, "student_top.v"), validSource, "utf8");

const scriptPath = path.resolve(process.cwd(), "tools", "toolchain", "rb-fpga-toolchain.mjs");
console.log("Script path:", scriptPath);
console.log("Script exists:", fs.existsSync(scriptPath));

const result = spawnSync(process.execPath, [scriptPath, "build", "--board", "basys3", "--src", srcDir, "--top", "student_top", "--out", outDir, "--skip-vivado"], {
    encoding: "utf8",
    env: process.env,
});

console.log("Exit code:", result.status);
console.log("Error:", result.error);
console.log("Stdout:", result.stdout?.substring(0, 200));
console.log("Stderr:", result.stderr?.substring(0, 200));
