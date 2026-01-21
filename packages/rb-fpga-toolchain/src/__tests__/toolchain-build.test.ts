import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { spawnSync } from "child_process";

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

function writeSource(dir: string, content: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "student_top.v"), content, "utf8");
}

function runBuild(args: string[], env?: NodeJS.ProcessEnv) {
  const scriptPath = path.resolve(process.cwd(), "tools", "toolchain", "rb-fpga-toolchain.mjs");
  return spawnSync(process.execPath, [scriptPath, "build", ...args], {
    encoding: "utf8",
    env: env || process.env,
  });
}

describe("rb-fpga-toolchain build script", () => {
  it("generates deterministic wrapper/tcl/manifest bytes", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-toolchain-"));
    const srcDir = path.join(tempDir, "src");
    const outDir = path.join(tempDir, "out");
    writeSource(srcDir, validSource);

    const first = runBuild(["--board", "basys3", "--src", srcDir, "--top", "student_top", "--out", outDir, "--skip-vivado"]);
    expect(first.status).toBe(0);

    const wrapper1 = fs.readFileSync(path.join(outDir, "rb_wrapper_top.v"), "utf8");
    const tcl1 = fs.readFileSync(path.join(outDir, "build_vivado.tcl"), "utf8");
    const manifest1 = fs.readFileSync(path.join(outDir, "manifest.json"), "utf8");

    const second = runBuild(["--board", "basys3", "--src", srcDir, "--top", "student_top", "--out", outDir, "--skip-vivado"]);
    expect(second.status).toBe(0);

    const wrapper2 = fs.readFileSync(path.join(outDir, "rb_wrapper_top.v"), "utf8");
    const tcl2 = fs.readFileSync(path.join(outDir, "build_vivado.tcl"), "utf8");
    const manifest2 = fs.readFileSync(path.join(outDir, "manifest.json"), "utf8");

    expect(wrapper1).toBe(wrapper2);
    expect(tcl1).toBe(tcl2);
    expect(manifest1).toBe(manifest2);
  });

  it("fails with interface mismatch error code", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-toolchain-"));
    const srcDir = path.join(tempDir, "src-bad");
    const outDir = path.join(tempDir, "out-bad");
    writeSource(srcDir, invalidSource);

    const result = runBuild(["--board", "basys3", "--src", srcDir, "--top", "student_top", "--out", outDir, "--skip-vivado"]);
    expect(result.status).toBe(2);

    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
    expect(manifest.error_code).toBe("student_top_interface_mismatch");
    expect(manifest.interface_check.invalid[0].name).toBe("sw");
  });

  it("fails with pinmap_missing when pinmap path is invalid", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-toolchain-"));
    const srcDir = path.join(tempDir, "src");
    const outDir = path.join(tempDir, "out");
    writeSource(srcDir, validSource);

    const env = { ...process.env, RB_FPGA_PINMAP_PATH: path.join(tempDir, "missing.xdc") };
    const result = runBuild(["--board", "basys3", "--src", srcDir, "--top", "student_top", "--out", outDir, "--skip-vivado"], env);
    expect(result.status).toBe(2);

    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
    expect(manifest.error_code).toBe("pinmap_missing");
  });
});
