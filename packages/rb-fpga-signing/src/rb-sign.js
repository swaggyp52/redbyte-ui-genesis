#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { buildCapsule, normalizeCapsulePath, signCapsule } from "./index.js";
function usage() {
    console.log("Usage: rb-sign <zip> --key <privateKeyHex> [--inplace]");
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
        }
        else if (arg === "--inplace") {
            inplace = true;
        }
        else if (!zipPath) {
            zipPath = arg;
        }
        else {
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
        if (file.dir)
            return;
        const normalized = normalizeCapsulePath(relativePath);
        if (normalized === "integrity/signature.sig" || normalized === "integrity/capsule.json") {
            return;
        }
        reads.push(file.async("uint8array").then((bytes) => {
            fileEntries.push({ path: normalized, bytes });
        }));
    });
    await Promise.all(reads);
    const { capsuleJsonUtf8 } = await buildCapsule(fileEntries);
    zip.file("integrity/capsule.json", capsuleJsonUtf8);
    const signature = await signCapsule(capsuleJsonUtf8, privateKeyHex);
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
