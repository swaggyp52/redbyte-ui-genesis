import * as os from "os";
import * as path from "path";
import { createHash } from "crypto";
import * as fs from "fs";
import {
  resolveBuildpackToolCandidates,
} from "./toolchain-buildpack.js";

const BUNDLED_TOOLS_ENV_KEYS = ["RB_FPGA_BUNDLED_TOOLS_DIR", "RB_FPGA_TOOLS_DIR"];
const BUNDLED_MANIFEST_FILENAME = "manifest.json";
const DEFAULT_BRIDGE_TOOLS_ROOT_SEGMENTS = ["packages", "rb-fpga-bridge", "tools"];

function normalizeToolId(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function normalizePathValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^"(.*)"$/, "$1");
  return trimmed.length > 0 ? trimmed : null;
}

function parsePathList(value) {
  if (typeof value !== "string") return [];
  return value
    .split(path.delimiter)
    .map((entry) => normalizePathValue(entry))
    .filter(Boolean);
}

function uniqueStable(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = String(value).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function getToolPlatformKey({
  platform = os.platform(),
  arch = os.arch(),
} = {}) {
  return `${String(platform).trim()}-${String(arch).trim()}`;
}

function getBundledManifestRootCandidates({
  repoRoot,
  env = process.env,
}) {
  const roots = [];

  for (const envKey of BUNDLED_TOOLS_ENV_KEYS) {
    const rawValue = env?.[envKey];
    const entries = parsePathList(rawValue);
    for (const entry of entries) {
      roots.push(entry);
    }
  }

  if (repoRoot && typeof repoRoot === "string") {
    roots.push(path.join(repoRoot, ...DEFAULT_BRIDGE_TOOLS_ROOT_SEGMENTS));
    roots.push(path.join(repoRoot, ".redbyte", "tools"));
  }

  return uniqueStable(roots);
}

export function getBundledToolRootCandidates({
  repoRoot,
  platform = os.platform(),
  env = process.env,
}) {
  const roots = [];
  const manifestRoots = getBundledManifestRootCandidates({ repoRoot, env });
  for (const root of manifestRoots) {
    roots.push(path.join(root, platform));
    roots.push(root);
  }
  return uniqueStable(roots);
}

function buildExecutableNameCandidates({ executableName, platform }) {
  const names = [];
  const normalized = normalizePathValue(executableName);
  if (normalized) {
    names.push(normalized);
    if (platform === "win32" && !normalized.toLowerCase().endsWith(".exe")) {
      names.push(`${normalized}.exe`);
    }
  }
  return uniqueStable(names);
}

function buildRelativeToolPathCandidates({ toolId, executableNames }) {
  const relPaths = [];
  for (const executableName of executableNames) {
    relPaths.push(executableName);
    relPaths.push(path.join("bin", executableName));
    if (toolId) {
      relPaths.push(path.join(toolId, executableName));
      relPaths.push(path.join(toolId, "bin", executableName));
    }
  }
  return uniqueStable(relPaths);
}

function normalizeSha256(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) return null;
  return normalized;
}

function hashFileSha256(filePath, { readFileSync = fs.readFileSync } = {}) {
  const bytes = readFileSync(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

function ensureExecutableBit({
  filePath,
  platform = os.platform(),
  statSync = fs.statSync,
  chmodSync = fs.chmodSync,
}) {
  if (platform === "win32") return { ok: true, changed: false };
  try {
    const stat = statSync(filePath);
    const mode = Number(stat?.mode || 0);
    if ((mode & 0o111) !== 0) {
      return { ok: true, changed: false };
    }
    const updatedMode = mode | 0o755;
    chmodSync(filePath, updatedMode);
    return { ok: true, changed: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function findManifestToolEntry(manifestTools, toolId) {
  if (!manifestTools || typeof manifestTools !== "object") return null;
  const direct = manifestTools[toolId];
  if (direct && typeof direct === "object") return direct;

  const target = normalizeToolId(toolId);
  for (const [key, value] of Object.entries(manifestTools)) {
    if (normalizeToolId(key) === target && value && typeof value === "object") {
      return value;
    }
  }
  return null;
}

function isPathWithinRoot(absolutePath, rootPath) {
  const resolvedPath = path.resolve(absolutePath);
  const resolvedRoot = path.resolve(rootPath);
  if (resolvedPath === resolvedRoot) return true;
  return resolvedPath.startsWith(`${resolvedRoot}${path.sep}`);
}

export function loadBundledToolsManifest({
  repoRoot,
  env = process.env,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
}) {
  const roots = getBundledManifestRootCandidates({ repoRoot, env });
  for (const root of roots) {
    const manifestPath = path.join(root, BUNDLED_MANIFEST_FILENAME);
    if (!existsSync(manifestPath)) continue;
    try {
      const raw = readFileSync(manifestPath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.tools || typeof parsed.tools !== "object") {
        return {
          root,
          manifestPath,
          manifest: null,
          error: "bundled_manifest_invalid",
        };
      }
      return {
        root,
        manifestPath,
        manifest: parsed,
        error: null,
      };
    } catch (error) {
      return {
        root,
        manifestPath,
        manifest: null,
        error: "bundled_manifest_parse_error",
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return null;
}

export function resolveBundledToolExecutable({
  repoRoot,
  platform = os.platform(),
  arch = os.arch(),
  toolId,
  executableName,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  statSync = fs.statSync,
  chmodSync = fs.chmodSync,
  env = process.env,
}) {
  const checkExists = typeof existsSync === "function" ? existsSync : fs.existsSync;
  const manifestResult = loadBundledToolsManifest({
    repoRoot,
    env,
    existsSync: checkExists,
    readFileSync,
  });

  if (manifestResult) {
    if (manifestResult.error) {
      return {
        source: "bundled",
        status: "missing",
        integrity: "corrupt",
        error: manifestResult.error,
        manifestPath: manifestResult.manifestPath,
        ...(manifestResult.details ? { details: manifestResult.details } : {}),
      };
    }

    const platformKey = getToolPlatformKey({ platform, arch });
    const toolEntry = findManifestToolEntry(manifestResult.manifest.tools, toolId);
    if (toolEntry) {
      const bins = toolEntry.bins && typeof toolEntry.bins === "object" ? toolEntry.bins : null;
      const targetBin = bins ? bins[platformKey] : null;
      if (!targetBin || typeof targetBin !== "object") {
        return null;
      }

      const relativePath = normalizePathValue(targetBin.path);
      const expectedSha256 = normalizeSha256(targetBin.sha256);
      if (!relativePath || !expectedSha256) {
        return {
          source: "bundled",
          status: "missing",
          integrity: "corrupt",
          error: "bundled_manifest_invalid",
          platformKey,
          version: typeof toolEntry.version === "string" ? toolEntry.version : null,
        };
      }

      const absolutePath = path.resolve(manifestResult.root, relativePath);
      if (!isPathWithinRoot(absolutePath, manifestResult.root)) {
        return {
          source: "bundled",
          status: "missing",
          integrity: "corrupt",
          error: "bundled_path_outside_root",
          platformKey,
          version: typeof toolEntry.version === "string" ? toolEntry.version : null,
        };
      }

      if (!checkExists(absolutePath)) {
        return {
          source: "bundled",
          status: "missing",
          integrity: "corrupt",
          error: "bundled_binary_missing",
          platformKey,
          version: typeof toolEntry.version === "string" ? toolEntry.version : null,
        };
      }

      const actualSha256 = hashFileSha256(absolutePath, { readFileSync });
      if (actualSha256 !== expectedSha256) {
        return {
          source: "bundled",
          status: "missing",
          integrity: "corrupt",
          error: "bundled_sha256_mismatch",
          platformKey,
          version: typeof toolEntry.version === "string" ? toolEntry.version : null,
        };
      }

      const executableResult = ensureExecutableBit({
        filePath: absolutePath,
        platform,
        statSync,
        chmodSync,
      });
      if (!executableResult.ok) {
        return {
          source: "bundled",
          status: "missing",
          integrity: "corrupt",
          error: "bundled_binary_not_executable",
          platformKey,
          version: typeof toolEntry.version === "string" ? toolEntry.version : null,
          details: executableResult.error,
        };
      }

      return {
        source: "bundled",
        status: "ok",
        integrity: "verified",
        path: absolutePath,
        platformKey,
        version: typeof toolEntry.version === "string" ? toolEntry.version : null,
      };
    }
  }

  const roots = getBundledToolRootCandidates({ repoRoot, platform, env });
  const executableNames = buildExecutableNameCandidates({ executableName, platform });
  const relPaths = buildRelativeToolPathCandidates({
    toolId: typeof toolId === "string" ? toolId.trim() : "",
    executableNames,
  });

  for (const root of roots) {
    for (const relativePath of relPaths) {
      const candidate = path.join(root, relativePath);
      if (checkExists(candidate)) {
        return {
          source: "bundled",
          status: "ok",
          integrity: "unknown",
          path: candidate,
          platformKey: getToolPlatformKey({ platform, arch }),
          version: null,
        };
      }
    }
  }

  return null;
}

export function resolveManagedToolCandidates({
  repoRoot,
  platform = os.platform(),
  arch = os.arch(),
  toolId,
  executableName,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  statSync = fs.statSync,
  chmodSync = fs.chmodSync,
  env = process.env,
  homedir = os.homedir(),
}) {
  const candidates = [];
  const bundled = resolveBundledToolExecutable({
    repoRoot,
    platform,
    arch,
    toolId,
    executableName,
    existsSync,
    readFileSync,
    statSync,
    chmodSync,
    env,
  });
  if (bundled?.source === "bundled") {
    candidates.push(bundled);
  }

  const buildpack = resolveBuildpackToolCandidates({
    toolId,
    platform,
    arch,
    env,
    homedir,
    existsSync,
    readFileSync,
    statSync,
    chmodSync,
  });
  if (Array.isArray(buildpack) && buildpack.length > 0) {
    candidates.push(...buildpack);
  }

  return candidates;
}
