import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const execFileAsync = promisify(execFile);

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const BUILDPACK_MANIFEST_NAME = "buildpack.json";

function normalizePathValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^"(.*)"$/, "$1");
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeToolId(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function normalizeVersion(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRelativePath(value) {
  const raw = normalizePathValue(value);
  if (!raw) return null;
  const normalized = raw.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return null;
  const segments = normalized
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) return null;
  if (segments.some((segment) => segment === "." || segment === "..")) return null;
  return segments.join("/");
}

function isPathWithinRoot(candidatePath, rootPath) {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedRoot = path.resolve(rootPath);
  if (resolvedCandidate === resolvedRoot) return true;
  return resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

function hashBufferSha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function hashFileSha256(filePath, { readFileSync = fs.readFileSync } = {}) {
  return hashBufferSha256(readFileSync(filePath));
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
    chmodSync(filePath, mode | 0o755);
    return { ok: true, changed: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function sanitizeSegment(value) {
  const safe = String(value || "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return safe.length > 0 ? safe : "unknown";
}

function uniqueStable(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = stableStringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function normalizeBuildpackManifestFiles(rawFiles) {
  if (!Array.isArray(rawFiles)) {
    throw new Error("buildpack_manifest_files_required");
  }
  const files = rawFiles.map((entry) => {
    const relPath = normalizeRelativePath(entry?.path);
    const sha256 = normalizePathValue(entry?.sha256)?.toLowerCase() || null;
    if (!relPath || !sha256 || !SHA256_PATTERN.test(sha256)) {
      throw new Error("buildpack_manifest_file_invalid");
    }
    return { path: relPath, sha256 };
  });

  return uniqueStable(files).sort((left, right) => left.path.localeCompare(right.path));
}

function normalizeBuildpackManifestTools(rawTools) {
  if (!Array.isArray(rawTools)) {
    throw new Error("buildpack_manifest_tools_required");
  }

  const tools = rawTools.map((entry) => {
    const nameRaw = normalizePathValue(entry?.name);
    const name = normalizeToolId(nameRaw);
    const relPath = normalizeRelativePath(entry?.relPath ?? entry?.path);
    const version = normalizeVersion(entry?.version);
    if (!name || !relPath) {
      throw new Error("buildpack_manifest_tool_invalid");
    }
    return {
      name,
      relPath,
      ...(version ? { version } : {}),
    };
  });

  return uniqueStable(tools).sort((left, right) => {
    if (left.name !== right.name) return left.name.localeCompare(right.name);
    if (left.relPath !== right.relPath) return left.relPath.localeCompare(right.relPath);
    return String(left.version || "").localeCompare(String(right.version || ""));
  });
}

export function getBuildpackPlatformKey({
  platform = os.platform(),
  arch = os.arch(),
} = {}) {
  return `${String(platform).trim()}-${String(arch).trim()}`;
}

export function getBuildpackStoreRoot({
  env = process.env,
  platform = os.platform(),
  homedir = os.homedir(),
} = {}) {
  const override = normalizePathValue(env?.RB_FPGA_BUILDPACKS_DIR);
  if (override) {
    return path.resolve(override);
  }

  if (platform === "win32") {
    const localAppData = normalizePathValue(env?.LOCALAPPDATA) || path.join(homedir, "AppData", "Local");
    return path.join(localAppData, "redbyte", "buildpacks");
  }
  if (platform === "darwin") {
    return path.join(homedir, "Library", "Application Support", "redbyte", "buildpacks");
  }
  return path.join(homedir, ".local", "share", "redbyte", "buildpacks");
}

export function getBuildpackInstallDir({
  name,
  version,
  storeRoot,
}) {
  return path.join(storeRoot, sanitizeSegment(name), sanitizeSegment(version));
}

export function parseBuildpackManifest(rawManifest) {
  const source = typeof rawManifest === "string" ? JSON.parse(rawManifest) : rawManifest;
  if (!source || typeof source !== "object") {
    throw new Error("buildpack_manifest_invalid");
  }

  const name = normalizePathValue(source.name);
  const version = normalizeVersion(source.version);
  const platformKey = normalizeVersion(source.platformKey);
  const contractId = normalizeVersion(source.contractId);
  if (!name || !version || !platformKey) {
    throw new Error("buildpack_manifest_identity_invalid");
  }

  const files = normalizeBuildpackManifestFiles(source.files);
  const tools = normalizeBuildpackManifestTools(source.tools);

  return {
    name,
    version,
    platformKey,
    ...(contractId ? { contractId } : {}),
    files,
    tools,
  };
}

export function verifyBuildpackManifestFiles({
  manifest,
  installDir,
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
}) {
  const normalizedManifest = parseBuildpackManifest(manifest);
  for (const fileEntry of normalizedManifest.files) {
    const absolutePath = path.resolve(installDir, fileEntry.path);
    if (!isPathWithinRoot(absolutePath, installDir)) {
      return {
        ok: false,
        error: "buildpack_file_outside_root",
        path: fileEntry.path,
      };
    }
    if (!existsSync(absolutePath)) {
      return {
        ok: false,
        error: "buildpack_file_missing",
        path: fileEntry.path,
      };
    }
    const actualSha256 = hashFileSha256(absolutePath, { readFileSync });
    if (actualSha256 !== fileEntry.sha256) {
      return {
        ok: false,
        error: "buildpack_file_sha256_mismatch",
        path: fileEntry.path,
      };
    }
  }
  return { ok: true, error: null, path: null };
}

function readBuildpackManifestFromPath(manifestPath, { readFileSync = fs.readFileSync } = {}) {
  const raw = readFileSync(manifestPath, "utf8");
  return parseBuildpackManifest(raw);
}

function listChildDirectories(rootPath, { existsSync = fs.existsSync, readdirSync = fs.readdirSync, statSync = fs.statSync } = {}) {
  if (!existsSync(rootPath)) return [];
  const names = readdirSync(rootPath).sort((a, b) => a.localeCompare(b));
  return names
    .map((name) => {
      const fullPath = path.join(rootPath, name);
      try {
        const stat = statSync(fullPath);
        return stat.isDirectory() ? { name, fullPath } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function listInstalledBuildpacks({
  env = process.env,
  platform = os.platform(),
  homedir = os.homedir(),
  existsSync = fs.existsSync,
  readdirSync = fs.readdirSync,
  statSync = fs.statSync,
  readFileSync = fs.readFileSync,
} = {}) {
  const storeRoot = getBuildpackStoreRoot({ env, platform, homedir });
  const names = listChildDirectories(storeRoot, { existsSync, readdirSync, statSync });
  const buildpacks = [];

  for (const nameDir of names) {
    const versions = listChildDirectories(nameDir.fullPath, { existsSync, readdirSync, statSync });
    for (const versionDir of versions) {
      const manifestPath = path.join(versionDir.fullPath, BUILDPACK_MANIFEST_NAME);
      if (!existsSync(manifestPath)) {
        buildpacks.push({
          name: nameDir.name,
          version: versionDir.name,
          installDir: versionDir.fullPath,
          manifestPath,
          ok: false,
          integrity: "corrupt",
          error: "buildpack_manifest_missing",
          tools: [],
        });
        continue;
      }
      try {
        const manifest = readBuildpackManifestFromPath(manifestPath, { readFileSync });
        buildpacks.push({
          name: manifest.name,
          version: manifest.version,
          installDir: versionDir.fullPath,
          manifestPath,
          manifest,
          ok: true,
          integrity: "verified",
          ...(manifest.contractId ? { contractId: manifest.contractId } : {}),
          tools: manifest.tools.map((tool) => ({
            name: tool.name,
            relPath: tool.relPath,
            ...(tool.version ? { version: tool.version } : {}),
          })),
        });
      } catch (error) {
        buildpacks.push({
          name: nameDir.name,
          version: versionDir.name,
          installDir: versionDir.fullPath,
          manifestPath,
          ok: false,
          integrity: "corrupt",
          error: "buildpack_manifest_invalid",
          details: error instanceof Error ? error.message : String(error),
          tools: [],
        });
      }
    }
  }

  return buildpacks.sort((left, right) => {
    if (left.name !== right.name) return left.name.localeCompare(right.name);
    return left.version.localeCompare(right.version);
  });
}

function findToolFileEntry(manifest, relPath) {
  const normalizedPath = normalizeRelativePath(relPath);
  if (!normalizedPath) return null;
  return manifest.files.find((entry) => entry.path === normalizedPath) || null;
}

export function resolveBuildpackToolCandidates({
  toolId,
  platform = os.platform(),
  arch = os.arch(),
  env = process.env,
  homedir = os.homedir(),
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  statSync = fs.statSync,
  chmodSync = fs.chmodSync,
} = {}) {
  const normalizedToolId = normalizeToolId(toolId);
  if (!normalizedToolId) return [];
  const platformKey = getBuildpackPlatformKey({ platform, arch });
  const installed = listInstalledBuildpacks({
    env,
    platform,
    homedir,
    existsSync,
    readFileSync,
    statSync,
  });

  const candidates = [];
  for (const pack of installed) {
    if (!pack.ok || !pack.manifest) {
      continue;
    }
    if (pack.manifest.platformKey !== platformKey) {
      continue;
    }
    const tool = pack.manifest.tools.find((entry) => entry.name === normalizedToolId);
    if (!tool) continue;
    const toolFile = findToolFileEntry(pack.manifest, tool.relPath);
    if (!toolFile) {
      candidates.push({
        ok: false,
        source: "buildpack",
        status: "missing",
        integrity: "corrupt",
        error: "buildpack_tool_file_hash_missing",
        version: tool.version || pack.manifest.version,
        suggestedFix: `Repair buildpack ${pack.name}@${pack.version} and reinstall.`,
      });
      continue;
    }

    const absolutePath = path.resolve(pack.installDir, tool.relPath);
    if (!isPathWithinRoot(absolutePath, pack.installDir)) {
      candidates.push({
        ok: false,
        source: "buildpack",
        status: "missing",
        integrity: "corrupt",
        error: "buildpack_tool_path_outside_root",
        version: tool.version || pack.manifest.version,
        suggestedFix: `Repair buildpack ${pack.name}@${pack.version} and reinstall.`,
      });
      continue;
    }

    if (!existsSync(absolutePath)) {
      candidates.push({
        ok: false,
        source: "buildpack",
        status: "missing",
        integrity: "corrupt",
        error: "buildpack_tool_missing",
        version: tool.version || pack.manifest.version,
        suggestedFix: `Repair buildpack ${pack.name}@${pack.version} and reinstall.`,
      });
      continue;
    }

    const actualHash = hashFileSha256(absolutePath, { readFileSync });
    if (actualHash !== toolFile.sha256) {
      candidates.push({
        ok: false,
        source: "buildpack",
        status: "missing",
        integrity: "corrupt",
        error: "buildpack_tool_sha256_mismatch",
        version: tool.version || pack.manifest.version,
        path: absolutePath,
        suggestedFix: `Repair buildpack ${pack.name}@${pack.version} and reinstall.`,
      });
      continue;
    }

    const executable = ensureExecutableBit({
      filePath: absolutePath,
      platform,
      statSync,
      chmodSync,
    });
    if (!executable.ok) {
      candidates.push({
        ok: false,
        source: "buildpack",
        status: "missing",
        integrity: "corrupt",
        error: "buildpack_tool_not_executable",
        version: tool.version || pack.manifest.version,
        path: absolutePath,
        suggestedFix: `Repair buildpack ${pack.name}@${pack.version} and reinstall.`,
      });
      continue;
    }

    candidates.push({
      ok: true,
      source: "buildpack",
      status: "ok",
      integrity: "verified",
      path: absolutePath,
      version: tool.version || pack.manifest.version,
      buildpackName: pack.name,
      buildpackVersion: pack.version,
      ...(pack.manifest.contractId ? { buildpackContractId: pack.manifest.contractId } : {}),
    });
  }

  return candidates.sort((left, right) => {
    if (left.version !== right.version) {
      return String(right.version || "").localeCompare(String(left.version || ""));
    }
    if (left.path !== right.path) {
      return String(left.path || "").localeCompare(String(right.path || ""));
    }
    return String(left.error || "").localeCompare(String(right.error || ""));
  });
}

function toPowerShellSingleQuoted(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function extractZipArchive({ archivePath, destinationDir, platform = os.platform() }) {
  fs.mkdirSync(destinationDir, { recursive: true });
  if (platform === "win32") {
    const command = `Expand-Archive -Path ${toPowerShellSingleQuoted(archivePath)} -DestinationPath ${toPowerShellSingleQuoted(destinationDir)} -Force`;
    await execFileAsync("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      command,
    ], {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 16,
    });
    return;
  }
  await execFileAsync("unzip", ["-oq", archivePath, "-d", destinationDir], {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
}

function copyDirectoryRecursive(sourceDir, destinationDir) {
  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destinationDir), { recursive: true });
  fs.cpSync(sourceDir, destinationDir, { recursive: true });
}

function findManifestRootDirectory(extractedDir) {
  const direct = path.join(extractedDir, BUILDPACK_MANIFEST_NAME);
  if (fs.existsSync(direct)) return extractedDir;

  const stack = [extractedDir];
  while (stack.length > 0) {
    const current = stack.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === BUILDPACK_MANIFEST_NAME) {
        return path.dirname(fullPath);
      }
    }
  }
  return null;
}

function parseBuildpackSourceUrl(sourceUrl) {
  const trimmed = normalizePathValue(sourceUrl);
  if (!trimmed) {
    throw new Error("buildpack_url_required");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { kind: "http", href: trimmed };
  }
  if (trimmed.startsWith("file://")) {
    const url = new URL(trimmed);
    let filePath = decodeURIComponent(url.pathname || "");
    if (/^\/[a-zA-Z]:\//.test(filePath)) {
      filePath = filePath.slice(1);
    }
    if (url.host && url.host.trim().length > 0) {
      filePath = `//${url.host}${filePath}`;
    }
    return {
      kind: "file",
      path: path.normalize(filePath),
    };
  }
  if (/^[a-zA-Z]:\\/.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return {
      kind: "file",
      path: path.resolve(trimmed),
    };
  }
  throw new Error("buildpack_url_unsupported_scheme");
}

async function downloadArchiveToFile({ href, destinationPath }) {
  if (typeof fetch !== "function") {
    throw new Error("fetch_unavailable");
  }
  const response = await fetch(href);
  if (!response.ok) {
    throw new Error(`download_http_${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destinationPath, buffer);
}

function normalizeSha256(value) {
  const normalized = normalizePathValue(value)?.toLowerCase() || null;
  if (!normalized) return null;
  if (!SHA256_PATTERN.test(normalized)) return null;
  return normalized;
}

export async function installBuildpackPayload({
  name,
  version,
  url,
  sha256,
  runId,
  platform = os.platform(),
  arch = os.arch(),
  env = process.env,
  homedir = os.homedir(),
  log = () => {},
}) {
  const safeName = normalizeVersion(name);
  const safeVersion = normalizeVersion(version);
  if (!safeName || !safeVersion) {
    throw new Error("buildpack_name_version_required");
  }

  const expectedSha256 = normalizeSha256(sha256);
  const source = parseBuildpackSourceUrl(url);
  const storeRoot = getBuildpackStoreRoot({ env, platform, homedir });
  const installDir = getBuildpackInstallDir({ name: safeName, version: safeVersion, storeRoot });
  const stagingRoot = path.join(storeRoot, ".staging", sanitizeSegment(runId || `${safeName}-${safeVersion}`));
  const archivePath = path.join(stagingRoot, "buildpack.zip");
  const extractDir = path.join(stagingRoot, "extract");

  fs.rmSync(stagingRoot, { recursive: true, force: true });
  fs.mkdirSync(stagingRoot, { recursive: true });
  fs.mkdirSync(extractDir, { recursive: true });
  fs.mkdirSync(path.dirname(installDir), { recursive: true });

  log("info", "[bridge] buildpack: install started", {
    name: safeName,
    version: safeVersion,
    source: source.kind,
  });

  if (source.kind === "http") {
    log("info", "[bridge] buildpack: downloading archive");
    await downloadArchiveToFile({ href: source.href, destinationPath: archivePath });
    log("info", "[bridge] buildpack: download complete");
  } else {
    const sourcePath = source.path;
    if (!fs.existsSync(sourcePath)) {
      throw new Error("buildpack_source_not_found");
    }
    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      if (expectedSha256) {
        throw new Error("buildpack_sha256_requires_archive");
      }
      log("info", "[bridge] buildpack: copying directory source");
      copyDirectoryRecursive(sourcePath, extractDir);
    } else if (stat.isFile()) {
      fs.copyFileSync(sourcePath, archivePath);
      log("info", "[bridge] buildpack: copied archive source");
    } else {
      throw new Error("buildpack_source_invalid");
    }
  }

  if (fs.existsSync(archivePath)) {
    if (expectedSha256) {
      const actual = hashFileSha256(archivePath);
      if (actual !== expectedSha256) {
        throw new Error("buildpack_archive_sha256_mismatch");
      }
      log("info", "[bridge] buildpack: archive checksum verified");
    }

    const extension = path.extname(archivePath).toLowerCase();
    if (extension !== ".zip") {
      throw new Error("buildpack_archive_format_unsupported");
    }
    log("info", "[bridge] buildpack: extracting archive");
    await extractZipArchive({ archivePath, destinationDir: extractDir, platform });
    log("info", "[bridge] buildpack: extract complete");
  }

  const manifestRoot = findManifestRootDirectory(extractDir);
  if (!manifestRoot) {
    throw new Error("buildpack_manifest_missing");
  }

  const manifestPath = path.join(manifestRoot, BUILDPACK_MANIFEST_NAME);
  const manifest = readBuildpackManifestFromPath(manifestPath);
  const platformKey = getBuildpackPlatformKey({ platform, arch });
  if (manifest.name !== safeName || manifest.version !== safeVersion) {
    throw new Error("buildpack_manifest_identity_mismatch");
  }
  if (manifest.platformKey !== platformKey) {
    throw new Error("buildpack_platform_mismatch");
  }

  const verified = verifyBuildpackManifestFiles({ manifest, installDir: manifestRoot });
  if (!verified.ok) {
    throw new Error(verified.error || "buildpack_verification_failed");
  }
  log("info", "[bridge] buildpack: file checksums verified");

  fs.rmSync(installDir, { recursive: true, force: true });
  copyDirectoryRecursive(manifestRoot, installDir);
  fs.rmSync(stagingRoot, { recursive: true, force: true });

  return {
    ok: true,
    storeRoot,
    installDir,
    manifest,
  };
}

export function removeBuildpackPayload({
  name,
  version,
  env = process.env,
  platform = os.platform(),
  homedir = os.homedir(),
}) {
  const safeName = normalizeVersion(name);
  const safeVersion = normalizeVersion(version);
  if (!safeName || !safeVersion) {
    return { ok: false, error: "buildpack_name_version_required" };
  }
  const storeRoot = getBuildpackStoreRoot({ env, platform, homedir });
  const installDir = getBuildpackInstallDir({ name: safeName, version: safeVersion, storeRoot });
  if (!fs.existsSync(installDir)) {
    return { ok: true, removed: false, storeRoot, installDir };
  }
  fs.rmSync(installDir, { recursive: true, force: true });
  return { ok: true, removed: true, storeRoot, installDir };
}
