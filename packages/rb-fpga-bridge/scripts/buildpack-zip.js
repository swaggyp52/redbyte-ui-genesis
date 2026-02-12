#!/usr/bin/env node

import archiver from "archiver";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { listBuildpackFiles, updateBuildpackManifestHashes } from "./buildpack-hash.js";
import { runBuildpackReleaseCheck } from "./buildpack-release-check.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_DIR = path.resolve(
  SCRIPT_DIR,
  "..",
  "buildpacks",
  "basys3-open-toolchain-0.1.0-dev"
);

function sanitizeSegment(value, fallback) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  const sanitized = raw.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return sanitized.length > 0 ? sanitized : fallback;
}

function hashBufferSha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function createDeterministicZipBuffer(entries) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks = [];
    archive.on("warning", (error) => {
      if (error && error.code === "ENOENT") return;
      reject(error);
    });
    archive.on("error", (error) => reject(error));
    archive.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    const orderedEntries = [...entries].sort((left, right) => left.path.localeCompare(right.path));
    for (const entry of orderedEntries) {
      archive.file(entry.absolutePath, {
        name: entry.path,
        date: new Date(0),
        mode: 0o100644,
      });
    }
    archive.finalize();
  });
}

function normalizeOutDir(outDir, buildpackDir) {
  if (typeof outDir === "string" && outDir.trim().length > 0) return path.resolve(outDir.trim());
  return path.resolve(path.join(path.dirname(path.resolve(buildpackDir)), "dist"));
}

function resolveZipFilename(manifest) {
  const name = sanitizeSegment(manifest?.name, "buildpack");
  const version = sanitizeSegment(manifest?.version, "dev");
  const platformKey = sanitizeSegment(manifest?.platformKey, "unknown");
  return `${name}-${version}-${platformKey}.zip`;
}

export function parseBuildpackZipArgs(argv = []) {
  const args = Array.isArray(argv) ? [...argv] : [];
  let buildpackDir = null;
  let outDir = null;
  let includeManifest = false;
  let release = false;
  let releaseToolTimeoutMs = null;
  for (let index = 0; index < args.length; index += 1) {
    const token = String(args[index]);
    if (token === "--out-dir") {
      outDir = args[index + 1] ? String(args[index + 1]) : null;
      index += 1;
      continue;
    }
    if (token === "--include-manifest") {
      includeManifest = true;
      continue;
    }
    if (token === "--release") {
      release = true;
      continue;
    }
    if (token === "--release-tool-timeout-ms") {
      releaseToolTimeoutMs = args[index + 1] ? Number(args[index + 1]) : null;
      index += 1;
      continue;
    }
    if (!buildpackDir) {
      buildpackDir = token;
    }
  }
  const resolvedBuildpackDir = buildpackDir ? path.resolve(buildpackDir) : DEFAULT_FIXTURE_DIR;
  return {
    buildpackDir: resolvedBuildpackDir,
    outDir: normalizeOutDir(outDir, resolvedBuildpackDir),
    includeManifest,
    release,
    releaseToolTimeoutMs: Number.isFinite(releaseToolTimeoutMs) && releaseToolTimeoutMs > 0 ? Math.floor(releaseToolTimeoutMs) : null,
  };
}

export async function createBuildpackZip(input) {
  const buildpackDir = path.resolve(input?.buildpackDir || DEFAULT_FIXTURE_DIR);
  if (!fs.existsSync(buildpackDir) || !fs.statSync(buildpackDir).isDirectory()) {
    throw new Error(`buildpack_dir_not_found: ${buildpackDir}`);
  }
  const outDir = normalizeOutDir(input?.outDir, buildpackDir);
  const includeManifest = input?.includeManifest === true;
  const updateResult = updateBuildpackManifestHashes(buildpackDir, { includeManifest });
  let releaseCheck = null;
  if (input?.release === true) {
    releaseCheck = await runBuildpackReleaseCheck({
      buildpackDir,
      toolTimeoutMs: input?.releaseToolTimeoutMs ?? 5000,
    });
    if (!releaseCheck.ok) {
      const firstError = releaseCheck.errors[0];
      const summary = firstError?.msg ? `${firstError.code || "release_check_failed"}: ${firstError.msg}` : "release_check_failed";
      throw new Error(`buildpack_release_check_failed: ${summary}`);
    }
  }
  const entries = listBuildpackFiles(buildpackDir, { includeManifest: true });
  const zipFileName = resolveZipFilename(updateResult.manifest);
  const zipPath = path.join(outDir, zipFileName);
  fs.mkdirSync(outDir, { recursive: true });
  const zipBuffer = await createDeterministicZipBuffer(entries);
  fs.writeFileSync(zipPath, zipBuffer);
  const zipSha256 = hashBufferSha256(zipBuffer);
  const installUrl = pathToFileURL(path.resolve(zipPath)).href;
  return {
    buildpackDir,
    outDir,
    zipFileName,
    zipPath,
    zipSha256,
    installUrl,
    filesCount: entries.length,
    manifestPath: updateResult.manifestPath,
    ...(releaseCheck ? { releaseCheck } : {}),
  };
}

export async function runBuildpackZipCli(argv = process.argv.slice(2)) {
  const parsed = parseBuildpackZipArgs(argv);
  const result = await createBuildpackZip(parsed);
  console.log(`[buildpack-zip] manifest updated: ${result.manifestPath}`);
  console.log(`[buildpack-zip] files packed: ${result.filesCount}`);
  console.log(`[buildpack-zip] zip path: ${result.zipPath}`);
  console.log(`[buildpack-zip] zip sha256: ${result.zipSha256}`);
  console.log(`[buildpack-zip] install url: ${result.installUrl}`);
  if (result.releaseCheck) {
    console.log(
      `[buildpack-zip] release check: PASS (${result.releaseCheck.summary.errors} errors, ${result.releaseCheck.summary.warnings} warnings)`
    );
  }
  return result;
}

const invokedScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isDirectInvocation = invokedScriptPath ? pathToFileURL(invokedScriptPath).href === import.meta.url : false;
if (isDirectInvocation) {
  runBuildpackZipCli(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[buildpack-zip] error: ${message}`);
    process.exitCode = 1;
  });
}
