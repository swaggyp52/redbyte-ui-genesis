#!/usr/bin/env node

import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_DIR = path.resolve(
  SCRIPT_DIR,
  "..",
  "buildpacks",
  "basys3-open-toolchain-0.1.0-dev"
);
const MANIFEST_FILE = "buildpack.json";

function toPosixPath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function normalizeRelativePath(rootDir, absolutePath) {
  const relative = path.relative(rootDir, absolutePath);
  return toPosixPath(relative).replace(/^\.\/+/g, "");
}

function hashFileSha256(filePath) {
  const data = fs.readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

export function listBuildpackFiles(buildpackDir, options = {}) {
  const root = path.resolve(buildpackDir);
  const includeManifest = options.includeManifest === true;
  const allFiles = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = fs
      .readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = normalizeRelativePath(root, absolutePath);
      if (!includeManifest && relativePath === MANIFEST_FILE) continue;
      allFiles.push({
        path: relativePath,
        absolutePath,
      });
    }
  }
  return allFiles.sort((left, right) => left.path.localeCompare(right.path));
}

export function collectBuildpackFileHashes(buildpackDir, options = {}) {
  return listBuildpackFiles(buildpackDir, options).map((entry) => ({
    path: entry.path,
    sha256: hashFileSha256(entry.absolutePath),
  }));
}

export function updateBuildpackManifestHashes(buildpackDir, options = {}) {
  const root = path.resolve(buildpackDir);
  const manifestPath = path.join(root, MANIFEST_FILE);
  const rawManifest = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(rawManifest);
  const files = collectBuildpackFileHashes(root, { includeManifest: options.includeManifest === true });
  manifest.files = files;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return {
    manifestPath,
    manifest,
    files,
  };
}

function quoteForPowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function quoteForSh(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function createZipCommandHints(buildpackDir, zipPath) {
  const sourcePattern = `${path.resolve(buildpackDir)}${path.sep}*`;
  const zipAbsolutePath = path.resolve(zipPath);
  const folderName = path.basename(path.resolve(buildpackDir));
  const parentDir = path.dirname(path.resolve(buildpackDir));
  const zipName = path.basename(zipAbsolutePath);
  return {
    windows: `Compress-Archive -Path ${quoteForPowerShell(sourcePattern)} -DestinationPath ${quoteForPowerShell(
      zipAbsolutePath
    )} -Force`,
    unix: `(cd ${quoteForSh(parentDir)} && zip -r ${quoteForSh(zipName)} ${quoteForSh(folderName)})`,
  };
}

function resolveDefaultZipPath(manifest, buildpackDir) {
  const name = typeof manifest?.name === "string" && manifest.name.trim().length > 0 ? manifest.name.trim() : "buildpack";
  const version =
    typeof manifest?.version === "string" && manifest.version.trim().length > 0 ? manifest.version.trim() : "dev";
  const platform =
    typeof manifest?.platformKey === "string" && manifest.platformKey.trim().length > 0
      ? manifest.platformKey.trim()
      : "unknown";
  const zipName = `${name}-${version}-${platform}.zip`;
  return path.join(path.dirname(path.resolve(buildpackDir)), zipName);
}

export function parseBuildpackHashArgs(argv = []) {
  const args = Array.isArray(argv) ? [...argv] : [];
  let buildpackDir = null;
  let zipPath = null;
  let includeManifest = false;
  for (let index = 0; index < args.length; index += 1) {
    const token = String(args[index]);
    if (token === "--include-manifest") {
      includeManifest = true;
      continue;
    }
    if (token === "--zip") {
      zipPath = args[index + 1] ? String(args[index + 1]) : null;
      index += 1;
      continue;
    }
    if (!buildpackDir) {
      buildpackDir = token;
    }
  }
  return {
    buildpackDir: buildpackDir ? path.resolve(buildpackDir) : DEFAULT_FIXTURE_DIR,
    zipPath: zipPath ? path.resolve(zipPath) : null,
    includeManifest,
  };
}

export function runBuildpackHashCli(argv = process.argv.slice(2)) {
  const parsed = parseBuildpackHashArgs(argv);
  if (!fs.existsSync(parsed.buildpackDir) || !fs.statSync(parsed.buildpackDir).isDirectory()) {
    throw new Error(`buildpack_dir_not_found: ${parsed.buildpackDir}`);
  }
  const updated = updateBuildpackManifestHashes(parsed.buildpackDir, {
    includeManifest: parsed.includeManifest,
  });
  const zipPath = parsed.zipPath || resolveDefaultZipPath(updated.manifest, parsed.buildpackDir);
  const commands = createZipCommandHints(parsed.buildpackDir, zipPath);

  console.log(`[buildpack-hash] updated manifest: ${updated.manifestPath}`);
  console.log(`[buildpack-hash] hashed files: ${updated.files.length}`);
  console.log(`[buildpack-hash] zip (windows): ${commands.windows}`);
  console.log(`[buildpack-hash] zip (unix): ${commands.unix}`);
  if (fs.existsSync(zipPath) && fs.statSync(zipPath).isFile()) {
    const packSha = hashFileSha256(zipPath);
    console.log(`[buildpack-hash] zip path: ${zipPath}`);
    console.log(`[buildpack-hash] zip sha256: ${packSha}`);
  } else {
    console.log(`[buildpack-hash] zip path (not found yet): ${zipPath}`);
  }

  return {
    manifestPath: updated.manifestPath,
    files: updated.files,
    zipPath,
  };
}

const invokedScriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isDirectInvocation = invokedScriptPath ? pathToFileURL(invokedScriptPath).href === import.meta.url : false;
if (isDirectInvocation) {
  try {
    runBuildpackHashCli(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[buildpack-hash] error: ${message}`);
    process.exitCode = 1;
  }
}
