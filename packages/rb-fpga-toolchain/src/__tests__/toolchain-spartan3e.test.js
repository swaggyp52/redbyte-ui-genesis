import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
function writeSource(dir, content) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "student_top.v"), content, "utf8");
}
function runBuild(args, env) {
    // Locate the script in the repo root tools/ directory
    // __dirname is packages/rb-fpga-toolchain/src/__tests__
    const scriptPath = path.resolve(__dirname, "../../../../tools", "toolchain", "rb-fpga-toolchain.mjs");
    return spawnSync(process.execPath, [scriptPath, "build", ...args], {
        encoding: "utf8",
        env: env || process.env,
    });
}
describe("rb-fpga-toolchain spartan3e stub", () => {
    it("generates deterministic spartan3e stub outputs", () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-toolchain-"));
        const srcDir = path.join(tempDir, "src");
        const outDir = path.join(tempDir, "out");
        writeSource(srcDir, validSource);
        const first = runBuild([
            "--board",
            "spartan3e-starter",
            "--src",
            srcDir,
            "--top",
            "student_top",
            "--out",
            outDir,
            "--skip-ise",
        ]);
        expect(first.status).toBe(0);
        const wrapper1 = fs.readFileSync(path.join(outDir, "rb_wrapper_top.v"), "utf8");
        const constraints1 = fs.readFileSync(path.join(outDir, "constraints.ucf"), "utf8");
        const manifest1 = fs.readFileSync(path.join(outDir, "manifest.json"), "utf8");
        const second = runBuild([
            "--board",
            "spartan3e-starter",
            "--src",
            srcDir,
            "--top",
            "student_top",
            "--out",
            outDir,
            "--skip-ise",
        ]);
        expect(second.status).toBe(0);
        const wrapper2 = fs.readFileSync(path.join(outDir, "rb_wrapper_top.v"), "utf8");
        const constraints2 = fs.readFileSync(path.join(outDir, "constraints.ucf"), "utf8");
        const manifest2 = fs.readFileSync(path.join(outDir, "manifest.json"), "utf8");
        expect(wrapper1).toBe(wrapper2);
        expect(constraints1).toBe(constraints2);
        expect(manifest1).toBe(manifest2);
        const manifest = JSON.parse(manifest1);
        expect(manifest.toolchain.kind).toBe("ise");
        expect(manifest.toolchain.status).toBe("skipped");
        expect(manifest.toolchain.reason).toBe("skip_ise");
    });
    it("fails with pinmap_missing for spartan3e", () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-toolchain-"));
        const srcDir = path.join(tempDir, "src");
        const outDir = path.join(tempDir, "out");
        writeSource(srcDir, validSource);
        const env = { ...process.env, RB_FPGA_PINMAP_PATH: path.join(tempDir, "missing.ucf") };
        const result = runBuild([
            "--board",
            "spartan3e-starter",
            "--src",
            srcDir,
            "--top",
            "student_top",
            "--out",
            outDir,
            "--skip-ise",
        ], env);
        expect(result.status).toBe(2);
        const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
        expect(manifest.error_code).toBe("pinmap_missing");
    });
});
