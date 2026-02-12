#!/usr/bin/env node

import assert from "assert/strict";
import {
  detectVivado,
  parseVivadoVersion,
} from "../src/toolchain-vivado-detect.js";

function createExecCommandMock(outputs) {
  return async (command) => {
    const key = String(command).trim();
    if (!(key in outputs)) {
      throw new Error(`unexpected_command:${key}`);
    }
    const value = outputs[key];
    if (value instanceof Error) throw value;
    return value;
  };
}

async function runPathDetectionTest() {
  const result = await detectVivado({
    platform: "win32",
    execCommand: createExecCommandMock({
      "vivado.bat -version": "Vivado v2024.1 (64-bit)\r\n",
      "where vivado.bat": "C:\\Xilinx\\Vivado\\2024.1\\bin\\vivado.bat\r\n",
    }),
    existsSync: () => false,
    readdirSync: () => [],
  });
  assert.ok(result);
  assert.equal(result.status, "ok");
  assert.equal(result.foundInPath, true);
  assert.equal(result.version, "2024.1");
  assert.equal(result.path, "C:\\Xilinx\\Vivado\\2024.1\\bin\\vivado.bat");
}

async function runFoundNotInPathTest() {
  const existingPaths = new Set([
    "C:\\Xilinx\\Vivado",
    "C:\\Xilinx\\Vivado\\2024.1\\bin\\vivado.bat",
  ]);
  const result = await detectVivado({
    platform: "win32",
    execCommand: createExecCommandMock({
      "vivado.bat -version": new Error("not_found"),
      "\"C:\\Xilinx\\Vivado\\2024.1\\bin\\vivado.bat\" -version": "Vivado v2024.1 (64-bit)\r\n",
    }),
    existsSync: (candidate) => existingPaths.has(candidate),
    readdirSync: (candidate) => {
      if (candidate === "C:\\Xilinx\\Vivado") return ["2024.1"];
      return [];
    },
    searchPathsByPlatform: {
      win32: ["C:\\Xilinx\\Vivado"],
    },
  });
  assert.ok(result);
  assert.equal(result.status, "found_not_in_path");
  assert.equal(result.foundInPath, false);
  assert.equal(result.version, "2024.1");
  assert.match(result.suggestedFix || "", /found outside PATH/i);
  assert.match(result.suggestedFix || "", /2024\.1\\bin/i);
}

function runVersionParseTest() {
  assert.equal(parseVivadoVersion("Vivado v2023.2 (64-bit)"), "2023.2");
  assert.equal(parseVivadoVersion("random output"), null);
}

await runPathDetectionTest();
await runFoundNotInPathTest();
runVersionParseTest();
console.log("[TEST] toolchain vivado detect passed");

