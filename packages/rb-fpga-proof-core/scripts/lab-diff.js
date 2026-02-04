#!/usr/bin/env node
/**
 * Lab Diff Engine
 *
 * Deterministic capsule diff between:
 * - a submitted bundle (.rb-lab.zip or folder), and
 * - a golden fixture (.rb-lab.zip or folder)
 *
 * Output:
 *   [DIFF_JSON] {...}
 *
 * Exit codes follow canonical FPGA semantics:
 *   0 = MATCH
 *   1 = DIVERGED
 *   2 = INVALID/ERROR
 */

import fs from "fs/promises";
import path from "path";
import { parseArgs } from "util";
import { Readable } from "stream";
import unzipper from "unzipper";
import { parseCapsule, loadEventsNdjson, diffCapsules } from "../dist/index.js";

function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") errors.push("manifest must be an object");
  if (!manifest.schema_version) errors.push("Missing schema_version");
  if (manifest.schema_version !== "v1") errors.push(`Unsupported schema_version: ${manifest.schema_version}`);
  if (!manifest.lab_id) errors.push("Missing lab_id");
  if (!manifest.proof?.capsule_path) errors.push("Missing proof.capsule_path");
  return errors;
}

async function loadBundleFromZip(zipPath) {
  let zipBuffer;
  try {
    zipBuffer = await fs.readFile(zipPath);
  } catch (e) {
    throw new Error(`Failed to read ZIP file: ${e instanceof Error ? e.message : String(e)}`);
  }

  const filesIndex = new Map();
  let manifestText = "";

  await new Promise((resolve, reject) => {
    Readable.from([zipBuffer])
      .pipe(unzipper.Parse())
      .on("entry", (entry) => {
        const fileName = String(entry.path).replace(/\\/g, "/");
        const chunks = [];

        entry.on("data", (chunk) => chunks.push(chunk));
        entry.on("end", () => {
          const buffer = Buffer.concat(chunks);
          filesIndex.set(fileName, buffer);
          if (fileName === "manifest.json") {
            manifestText = buffer.toString("utf8");
          }
        });
        entry.on("error", (err) => reject(new Error(`Failed to read entry ${fileName}: ${err.message}`)));
      })
      .on("error", (err) => reject(new Error(`ZIP parsing error: ${err.message}`)))
      .on("finish", resolve);
  });

  if (!manifestText) throw new Error("manifest.json not found in ZIP");

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (e) {
    throw new Error(`Invalid manifest.json: ${e instanceof Error ? e.message : String(e)}`);
  }

  const manifestErrors = validateManifest(manifest);
  if (manifestErrors.length > 0) {
    throw new Error(`Manifest validation failed: ${manifestErrors.join("; ")}`);
  }

  const capsulePath = String(manifest.proof.capsule_path);
  const capsuleBuf = filesIndex.get(capsulePath);
  if (!capsuleBuf) throw new Error(`Capsule file not found at ${capsulePath}`);

  const eventsPath = manifest.proof?.events_path ? String(manifest.proof.events_path) : "";
  const eventsBuf = eventsPath ? filesIndex.get(eventsPath) : null;

  const capsule = parseCapsule(capsuleBuf.toString("utf8"));
  const eventsText = eventsBuf ? eventsBuf.toString("utf8") : "";
  const events = loadEventsNdjson(eventsText);

  return { manifest, capsule, events, eventsText };
}

async function loadBundleFromFolder(folderPath) {
  const manifestPath = path.join(folderPath, "manifest.json");
  let manifestText;
  try {
    manifestText = await fs.readFile(manifestPath, "utf8");
  } catch (e) {
    throw new Error(`manifest.json not found at ${manifestPath}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (e) {
    throw new Error(`Invalid manifest.json: ${e instanceof Error ? e.message : String(e)}`);
  }

  const manifestErrors = validateManifest(manifest);
  if (manifestErrors.length > 0) {
    throw new Error(`Manifest validation failed: ${manifestErrors.join("; ")}`);
  }

  const capsulePath = path.join(folderPath, String(manifest.proof.capsule_path));
  let capsuleText;
  try {
    capsuleText = await fs.readFile(capsulePath, "utf8");
  } catch {
    throw new Error(`Capsule file not found at ${capsulePath}`);
  }

  const eventsRef = manifest.proof?.events_path ? String(manifest.proof.events_path) : "";
  const eventsPath = eventsRef ? path.join(folderPath, eventsRef) : "";
  const eventsText = eventsPath ? await fs.readFile(eventsPath, "utf8").catch(() => "") : "";

  const capsule = parseCapsule(capsuleText);
  const events = loadEventsNdjson(eventsText);

  return { manifest, capsule, events, eventsText };
}

async function loadBundle(inputPath) {
  const isZip = inputPath.endsWith(".zip") || inputPath.endsWith(".rb-lab.zip");
  if (isZip) return loadBundleFromZip(inputPath);
  return loadBundleFromFolder(inputPath);
}

async function main() {
  const options = {
    submission: { type: "string" },
    golden: { type: "string" },
    "strict-hash": { type: "boolean", default: false },
  };
  const { values: args } = parseArgs({ options, allowPositionals: true });

  if (!args.submission || typeof args.submission !== "string") {
    console.error("[ERROR] --submission is required");
    process.exit(2);
  }
  if (!args.golden || typeof args.golden !== "string") {
    console.error("[ERROR] --golden is required");
    process.exit(2);
  }

  const submission = await loadBundle(args.submission);
  const golden = await loadBundle(args.golden);
  const strictHash = Boolean(args["strict-hash"]);

  const diff = diffCapsules(submission.capsule, golden.capsule, submission.events, golden.events, strictHash);

  const out = {
    ok: true,
    strict_hash: strictHash,
    submission: {
      lab_id: submission.manifest.lab_id,
      student_id: submission.manifest.student?.id ?? "unknown",
    },
    golden: {
      lab_id: golden.manifest.lab_id,
    },
    diff,
  };

  console.log(`[DIFF_JSON] ${JSON.stringify(out)}`);
  process.exit(diff.exitCode);
}

main().catch((e) => {
  console.error(`[ERROR] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
});

