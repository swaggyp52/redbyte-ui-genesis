#!/usr/bin/env node

import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { listBuildpackFiles } from "./buildpack-hash.js";
import { parseBuildpackManifest } from "../src/toolchain-buildpack.js";
import {
  BASYS3_F4PGA_V0_CONTRACT,
  isBasys3BuildpackSignature,
  listBasys3ContractTools,
} from "../src/toolchain-buildpack-contracts.js";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_DIR = path.resolve(
  SCRIPT_DIR,
  "..",
  "buildpacks",
  "basys3-open-toolchain-0.1.0-dev"
);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRelPath(value) {
  const normalized = normalizeString(value).replace(/\\/g, "/");
  if (!normalized) return null;
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return null;
  const parts = normalized
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (parts.length === 0) return null;
  if (parts.some((segment) => segment === "." || segment === "..")) return null;
  return parts.join("/");
}

function stableSortByPath(entries) {
  return [...entries].sort((left, right) => String(left.path).localeCompare(String(right.path)));
}

function hashFileSha256(filePath) {
  const data = fs.readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

function toBytes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function normalizeTimeoutMs(value, fallback = 5000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function runToolCheck(commandPath, args, timeoutMs) {
  try {
    const result = await execFileAsync(commandPath, args, {
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 8,
    });
    return {
      ok: true,
      exitCode: 0,
      stdout: typeof result?.stdout === "string" ? result.stdout : "",
      stderr: typeof result?.stderr === "string" ? result.stderr : "",
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: typeof error?.code === "number" ? error.code : null,
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" ? error.stderr : "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readBuildpackManifest(buildpackDir) {
  const manifestPath = path.join(buildpackDir, "buildpack.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  const parsedRaw = JSON.parse(raw);
  const manifest = parseBuildpackManifest(parsedRaw);
  return {
    manifestPath,
    manifest,
    raw: parsedRaw,
  };
}

function fileIsWithinRoot(rootDir, candidatePath) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedCandidate = path.resolve(candidatePath);
  if (resolvedCandidate === resolvedRoot) return true;
  return resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

function buildFilesCoverage(buildpackDir, manifest) {
  const diskFiles = listBuildpackFiles(buildpackDir, { includeManifest: false });
  const diskPaths = new Set(diskFiles.map((entry) => entry.path));
  const manifestPaths = new Set(manifest.files.map((entry) => entry.path));
  const missingFromManifest = [...diskPaths].filter((entry) => !manifestPaths.has(entry)).sort((a, b) => a.localeCompare(b));
  const extraInManifest = [...manifestPaths].filter((entry) => !diskPaths.has(entry)).sort((a, b) => a.localeCompare(b));
  return {
    diskFiles,
    missingFromManifest,
    extraInManifest,
  };
}

function listLargestFiles(diskFiles, rootDir) {
  const sized = diskFiles
    .map((entry) => {
      const absolutePath = path.resolve(rootDir, entry.path);
      const bytes = fs.existsSync(absolutePath) ? toBytes(fs.statSync(absolutePath).size) : 0;
      return {
        path: entry.path,
        bytes,
      };
    })
    .sort((left, right) => {
      if (left.bytes !== right.bytes) return right.bytes - left.bytes;
      return left.path.localeCompare(right.path);
    });
  return {
    totalBytes: sized.reduce((sum, entry) => sum + entry.bytes, 0),
    largest: sized.slice(0, 10),
  };
}

function normalizeDuplicateManifestPaths(manifest) {
  const duplicates = [];
  const seen = new Set();
  for (const entry of manifest.files) {
    const normalizedPath = normalizeRelPath(entry.path);
    if (!normalizedPath) continue;
    const key = normalizedPath.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(normalizedPath);
      continue;
    }
    seen.add(key);
  }
  return duplicates.sort((a, b) => a.localeCompare(b));
}

function createIssue(code, msg, data = null) {
  return {
    code,
    msg,
    ...(data && typeof data === "object" ? { data } : {}),
  };
}

function formatIssue(issue) {
  const suffix = issue?.data && typeof issue.data === "object" ? ` ${JSON.stringify(issue.data)}` : "";
  return `${issue.code}: ${issue.msg}${suffix}`;
}

function validateRequiredPaths({ buildpackDir, manifest, contract }) {
  const issues = [];
  const manifestPathSet = new Set(manifest.files.map((entry) => entry.path));
  const requiredPaths = Array.isArray(contract?.requiredPaths) ? [...contract.requiredPaths] : [];
  requiredPaths.sort((left, right) => String(left.relPath).localeCompare(String(right.relPath)));
  for (const required of requiredPaths) {
    const relPath = normalizeRelPath(required?.relPath);
    if (!relPath) continue;
    const kind = required?.kind === "file" ? "file" : "dir";
    const absolutePath = path.resolve(buildpackDir, relPath);
    if (!fileIsWithinRoot(buildpackDir, absolutePath)) {
      issues.push(createIssue("required_path_outside_root", `Required path '${relPath}' resolves outside buildpack root.`));
      continue;
    }
    if (!fs.existsSync(absolutePath)) {
      issues.push(createIssue("required_path_missing", `Required ${kind} '${relPath}' is missing.`));
      continue;
    }
    const stat = fs.statSync(absolutePath);
    if (kind === "file" && !stat.isFile()) {
      issues.push(createIssue("required_path_type_mismatch", `Required file '${relPath}' is not a file.`));
      continue;
    }
    if (kind === "dir" && !stat.isDirectory()) {
      issues.push(createIssue("required_path_type_mismatch", `Required dir '${relPath}' is not a directory.`));
      continue;
    }
    if (kind === "file" && !manifestPathSet.has(relPath)) {
      issues.push(createIssue("required_file_not_hashed", `Required file '${relPath}' is missing from files[].`));
      continue;
    }
    if (kind === "dir") {
      const hasHashedChild = manifest.files.some((fileEntry) => fileEntry.path.startsWith(`${relPath}/`));
      if (!hasHashedChild) {
        issues.push(createIssue("required_dir_unhashed", `Required dir '${relPath}' has no hashed files in files[].`));
      }
    }
  }
  return issues;
}

function validateManifestFileHashes({ buildpackDir, manifest }) {
  const issues = [];
  const verified = [];
  for (const fileEntry of stableSortByPath(manifest.files)) {
    const relPath = normalizeRelPath(fileEntry.path);
    if (!relPath) {
      issues.push(createIssue("manifest_path_invalid", "files[] contains invalid path entry.", { path: fileEntry.path }));
      continue;
    }
    const absolutePath = path.resolve(buildpackDir, relPath);
    if (!fileIsWithinRoot(buildpackDir, absolutePath)) {
      issues.push(createIssue("manifest_path_outside_root", `Manifest path '${relPath}' resolves outside buildpack root.`));
      continue;
    }
    if (!fs.existsSync(absolutePath)) {
      issues.push(createIssue("manifest_file_missing", `Manifest path '${relPath}' is missing on disk.`));
      continue;
    }
    if (!fs.statSync(absolutePath).isFile()) {
      issues.push(createIssue("manifest_file_type_invalid", `Manifest path '${relPath}' is not a file.`));
      continue;
    }
    const actualSha256 = hashFileSha256(absolutePath);
    if (actualSha256 !== fileEntry.sha256) {
      issues.push(
        createIssue("manifest_sha_mismatch", `SHA mismatch for '${relPath}'.`, {
          expected: fileEntry.sha256,
          actual: actualSha256,
        })
      );
      continue;
    }
    verified.push({
      path: relPath,
      sha256: actualSha256,
    });
  }
  return { issues, verified };
}

function validateContractAndTools({ buildpackDir, manifest, rawManifest, contract }) {
  const issues = [];
  const manifestTools = Array.isArray(manifest.tools) ? [...manifest.tools] : [];
  manifestTools.sort((left, right) => String(left.name).localeCompare(String(right.name)));
  const signatureOk = isBasys3BuildpackSignature({
    name: manifest.name,
    version: manifest.version,
    contractId: rawManifest?.contractId,
  });
  if (!signatureOk) {
    issues.push(
      createIssue(
        "buildpack_signature_invalid",
        `Buildpack signature does not match ${contract.contractId}.`,
        {
          name: manifest.name,
          version: manifest.version,
          contractId: normalizeString(rawManifest?.contractId) || null,
        }
      )
    );
  }

  if (!contract.allowedPlatformKeys.includes(manifest.platformKey)) {
    issues.push(
      createIssue(
        "platform_not_allowed",
        `platformKey '${manifest.platformKey}' is not allowed for ${contract.contractId}.`,
        { allowed: contract.allowedPlatformKeys }
      )
    );
  }

  const requiredContractTools = listBasys3ContractTools(manifest.platformKey);
  for (const requiredTool of requiredContractTools) {
    const tool = manifestTools.find((entry) => entry.name === requiredTool.name);
    if (!tool) {
      issues.push(createIssue("required_tool_missing", `Required tool '${requiredTool.name}' missing from tools[].`));
      continue;
    }
    if (normalizeRelPath(tool.relPath) !== normalizeRelPath(requiredTool.relPath)) {
      issues.push(
        createIssue(
          "required_tool_path_mismatch",
          `Tool '${requiredTool.name}' relPath must be '${requiredTool.relPath}'.`,
          { actual: tool.relPath }
        )
      );
      continue;
    }
    if (!normalizeString(tool.version)) {
      issues.push(createIssue("required_tool_version_missing", `Tool '${requiredTool.name}' is missing version.`));
      continue;
    }
    const absolutePath = path.resolve(buildpackDir, requiredTool.relPath);
    if (!fileIsWithinRoot(buildpackDir, absolutePath) || !fs.existsSync(absolutePath)) {
      issues.push(createIssue("required_tool_binary_missing", `Tool binary '${requiredTool.relPath}' not found.`));
    }
  }

  return {
    issues,
    requiredContractTools,
  };
}

export function parseBuildpackReleaseCheckArgs(argv = []) {
  const args = Array.isArray(argv) ? [...argv] : [];
  let buildpackDir = null;
  let toolTimeoutMs = 5000;
  let maxSizeBytes = 2 * 1024 * 1024 * 1024;
  let skipToolExec = false;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const token = String(args[index]);
    if (token === "--tool-timeout-ms") {
      toolTimeoutMs = normalizeTimeoutMs(args[index + 1], 5000);
      index += 1;
      continue;
    }
    if (token === "--max-size-bytes") {
      maxSizeBytes = toBytes(args[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--skip-tool-exec") {
      skipToolExec = true;
      continue;
    }
    if (token === "--json") {
      json = true;
      continue;
    }
    if (!buildpackDir) {
      buildpackDir = token;
    }
  }
  return {
    buildpackDir: buildpackDir ? path.resolve(buildpackDir) : DEFAULT_FIXTURE_DIR,
    toolTimeoutMs,
    maxSizeBytes,
    skipToolExec,
    json,
  };
}

export async function runBuildpackReleaseCheck(input = {}, dependencies = {}) {
  const buildpackDir = path.resolve(input?.buildpackDir || DEFAULT_FIXTURE_DIR);
  if (!fs.existsSync(buildpackDir) || !fs.statSync(buildpackDir).isDirectory()) {
    throw new Error(`buildpack_dir_not_found: ${buildpackDir}`);
  }
  const contract = BASYS3_F4PGA_V0_CONTRACT;
  const toolTimeoutMs = normalizeTimeoutMs(input?.toolTimeoutMs, 5000);
  const maxSizeBytes = toBytes(input?.maxSizeBytes || 2 * 1024 * 1024 * 1024);
  const skipToolExec = input?.skipToolExec === true;
  const runToolCommand =
    typeof dependencies?.runToolCommand === "function" ? dependencies.runToolCommand : runToolCheck;

  const { manifestPath, manifest, raw } = readBuildpackManifest(buildpackDir);
  const errors = [];
  const warnings = [];

  const duplicateManifestPaths = normalizeDuplicateManifestPaths(manifest);
  for (const duplicatePath of duplicateManifestPaths) {
    errors.push(createIssue("manifest_path_duplicate", `Duplicate files[] path '${duplicatePath}'.`));
  }

  const coverage = buildFilesCoverage(buildpackDir, manifest);
  for (const missing of coverage.missingFromManifest) {
    errors.push(createIssue("file_not_hashed", `File '${missing}' exists on disk but is missing from files[].`));
  }
  for (const extra of coverage.extraInManifest) {
    errors.push(createIssue("manifest_file_extra", `files[] entry '${extra}' does not exist on disk.`));
  }

  const hashValidation = validateManifestFileHashes({ buildpackDir, manifest });
  errors.push(...hashValidation.issues);

  errors.push(...validateRequiredPaths({ buildpackDir, manifest, contract }));
  const contractValidation = validateContractAndTools({
    buildpackDir,
    manifest,
    rawManifest: raw,
    contract,
  });
  errors.push(...contractValidation.issues);

  const toolChecks = [];
  if (!skipToolExec) {
    for (const tool of contractValidation.requiredContractTools) {
      const absolutePath = path.resolve(buildpackDir, tool.relPath);
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        toolChecks.push({
          name: tool.name,
          path: tool.relPath,
          ok: false,
          error: "tool_binary_missing",
        });
        continue;
      }
      const result = await runToolCommand(absolutePath, tool.verifyArgs, toolTimeoutMs);
      const check = {
        name: tool.name,
        path: tool.relPath,
        args: [...tool.verifyArgs],
        ok: result.ok === true,
        exitCode: typeof result.exitCode === "number" ? result.exitCode : null,
      };
      if (!check.ok) {
        check.error = result.error || `exit_${check.exitCode ?? "unknown"}`;
        errors.push(
          createIssue(
            "tool_exec_failed",
            `Tool '${tool.name}' failed verification command '${tool.verifyArgs.join(" ")}'.`,
            { error: check.error }
          )
        );
      }
      toolChecks.push(check);
    }
  }

  const sizeInfo = listLargestFiles(coverage.diskFiles, buildpackDir);
  if (maxSizeBytes > 0 && sizeInfo.totalBytes > maxSizeBytes) {
    warnings.push(
      createIssue("buildpack_size_warning", "Buildpack size exceeds configured threshold.", {
        totalBytes: sizeInfo.totalBytes,
        maxSizeBytes,
      })
    );
  }

  const folderName = path.basename(buildpackDir);
  if (!folderName.includes(manifest.platformKey)) {
    warnings.push(
      createIssue(
        "platform_key_not_in_folder_name",
        `Folder name '${folderName}' does not contain platformKey '${manifest.platformKey}'.`
      )
    );
  }

  const report = {
    schema_version: "toolchain_buildpack_release_check_v1",
    ok: errors.length === 0,
    buildpack: {
      name: manifest.name,
      version: manifest.version,
      platformKey: manifest.platformKey,
      contractId: normalizeString(raw?.contractId) || null,
      manifestPath,
    },
    summary: {
      errors: errors.length,
      warnings: warnings.length,
      files: coverage.diskFiles.length,
      totalBytes: sizeInfo.totalBytes,
    },
    checks: {
      toolExecSkipped: skipToolExec,
      toolChecks: toolChecks.sort((left, right) => left.name.localeCompare(right.name)),
      largestFiles: sizeInfo.largest,
    },
    errors,
    warnings,
  };
  return report;
}

export async function runBuildpackReleaseCheckCli(argv = process.argv.slice(2)) {
  const parsed = parseBuildpackReleaseCheckArgs(argv);
  const report = await runBuildpackReleaseCheck(parsed);
  if (parsed.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[buildpack-check] buildpack: ${report.buildpack.name}@${report.buildpack.version}`);
    console.log(`[buildpack-check] platform: ${report.buildpack.platformKey}`);
    console.log(`[buildpack-check] files: ${report.summary.files}`);
    console.log(`[buildpack-check] size_bytes: ${report.summary.totalBytes}`);
    for (const warning of report.warnings) {
      console.log(`[buildpack-check] warn: ${formatIssue(warning)}`);
    }
    for (const error of report.errors) {
      console.log(`[buildpack-check] error: ${formatIssue(error)}`);
    }
    console.log(`[buildpack-check] result: ${report.ok ? "PASS" : "FAIL"}`);
  }
  return report;
}

const invokedScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isDirectInvocation = invokedScriptPath ? pathToFileURL(invokedScriptPath).href === import.meta.url : false;
if (isDirectInvocation) {
  runBuildpackReleaseCheckCli(process.argv.slice(2))
    .then((report) => {
      if (!report.ok) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[buildpack-check] error: ${message}`);
      process.exitCode = 1;
    });
}
