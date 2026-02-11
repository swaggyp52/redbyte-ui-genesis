#!/usr/bin/env node

import assert from "assert/strict";
import {
  parseOpenFPGALoaderDetectOutput,
  selectOpenFPGALoaderDetectCommands,
} from "../src/toolchain-board-detect.js";

function runCommandSelectionTest() {
  const helpText = `
    Usage: openFPGALoader [options]
      --scan
      --list-cables
      --detect
  `;
  const commands = selectOpenFPGALoaderDetectCommands(helpText);
  assert.deepEqual(commands, [["--scan"], ["--detect"], ["--list-cables"]]);
}

function runParseOutputTest() {
  const output = `
    cable[0]: Digilent USB Device (FT2232) serial=210203A
    device: xc7a35t
    board: Basys3
  `;
  const boards = parseOpenFPGALoaderDetectOutput(output);
  assert.equal(boards.length, 1);
  assert.deepEqual(boards.map((board) => board.type), ["basys3"]);
  assert.equal(boards[0].detectedBy, "openFPGALoader");
  assert.equal(boards[0].transport, "usb-jtag");
  assert.equal(typeof boards[0].details?.raw, "string");
}

function runNoMatchTest() {
  const output = `
    cable[0]: Generic USB Cable
    board: unknown
  `;
  const boards = parseOpenFPGALoaderDetectOutput(output);
  assert.deepEqual(boards, []);
}

runCommandSelectionTest();
runParseOutputTest();
runNoMatchTest();
console.log("[TEST] toolchain board detect parser passed");
