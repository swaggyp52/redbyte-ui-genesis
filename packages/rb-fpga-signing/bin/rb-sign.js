#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { etc, sign } from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";

etc.sha512Sync = (...messages) => sha512(...messages);

function usage() {
  console.log("Usage: rb-sign <zip> --key <privateKeyHex> [--inplace]");
}

function normalizePath(inputPath) {
  let normalized = inputPath.replace(/\\/g, "/");
  while (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const trimmed = hex.trim().toLowerCase().replace(/^0x/, "");
  if (trimmed.length === 0 || trimmed.length % 2 !== 0) {
    throw new Error("Invalid hex string length.");
  }
  const out = new Uint8Array(trimmed.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = trimmed.slice(i * 2, i * 2 + 2);
    const value = Number.parseInt(byte, 16);
    if (Number.isNaN(value)) {
      throw new Error("Invalid hex string.");
    }
    out[i] = value;
  }
  return out;
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto unavailable for SHA-256.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

async function buildCapsule(inputs) {
  const files = [];
  for (const entry of inputs) {
    const hash = await sha256Hex(entry.bytes);
    files.push({ path: entry.path, hash });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const capsule = { algo: "sha256", files };
  const json = JSON.stringify(capsule);
  const capsuleJsonUtf8 = new TextEncoder().encode(json);
  return { capsule, capsuleJsonUtf8 };
}

function getOutputPath(inputPath) {
  if (inputPath.toLowerCase().endsWith(".zip")) {
    return inputPath.replace(/\.zip$/i, ".signed.zip");
  }
  return `${inputPath}.signed`;
}

async function main() {
  const args = process.argv.slice(2);
  let zipPath = "";
  let privateKeyHex = "";
  let inplace = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--key") {
      privateKeyHex = args[i + 1] ?? "";
      i += 1;
    } else if (arg === "--inplace") {
      inplace = true;
    } else if (!zipPath) {
      zipPath = arg;
    } else {
      usage();
      process.exit(1);
    }
  }

  if (!zipPath || !privateKeyHex) {
    usage();
    process.exit(1);
  }

  const zipBytes = await fs.readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBytes);

  const fileEntries = [];
  const reads = [];

  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    const normalized = normalizePath(relativePath);
    if (normalized === "integrity/signature.sig" || normalized === "integrity/capsule.json") {
      return;
    }
    reads.push(
      file.async("uint8array").then((bytes) => {
        fileEntries.push({ path: normalized, bytes });
      })
    );
  });

  await Promise.all(reads);

  const { capsuleJsonUtf8 } = await buildCapsule(fileEntries);
  zip.file("integrity/capsule.json", capsuleJsonUtf8);

  const privateKey = hexToBytes(privateKeyHex);
  const signature = await sign(capsuleJsonUtf8, privateKey);
  zip.file("integrity/signature.sig", signature);

  const outputBytes = await zip.generateAsync({ type: "uint8array" });
  const outputPath = inplace ? zipPath : getOutputPath(zipPath);
  await fs.writeFile(outputPath, outputBytes);

  console.log(`[rb-sign] Wrote ${path.resolve(outputPath)}`);
}

main().catch((err) => {
  console.error("[rb-sign] Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
