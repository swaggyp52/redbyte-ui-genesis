import archiver from "archiver";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";

function normalizeArchiveName(name) {
  return String(name || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\.+/g, "_")
    .replace(/\/\/+/g, "/");
}

function resolveRepoPath(repoRoot, candidatePath) {
  if (typeof candidatePath !== "string" || candidatePath.trim().length === 0) return null;
  const root = path.resolve(repoRoot);
  const resolved = path.resolve(root, candidatePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

function addFileIfPresent(entries, repoRoot, candidatePath, archiveName) {
  const resolvedPath = resolveRepoPath(repoRoot, candidatePath);
  if (!resolvedPath) return;
  if (!fs.existsSync(resolvedPath)) return;
  if (!fs.statSync(resolvedPath).isFile()) return;
  entries.push({
    kind: "file",
    sourcePath: resolvedPath,
    archiveName: normalizeArchiveName(archiveName),
  });
}

function sourceFileEntries(repoRoot, sourcePaths) {
  if (!Array.isArray(sourcePaths)) return [];
  const normalized = sourcePaths
    .map((item) => (typeof item === "string" ? item : ""))
    .filter((item) => item.trim().length > 0)
    .sort((left, right) => left.localeCompare(right));
  const entries = [];
  for (const sourcePath of normalized) {
    const resolved = resolveRepoPath(repoRoot, sourcePath);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) continue;
    entries.push({
      kind: "file",
      sourcePath: resolved,
      archiveName: normalizeArchiveName(path.posix.join("sources", sourcePath.replace(/\\/g, "/"))),
    });
  }
  return entries;
}

function hashBufferSha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeSourceDescriptors(artifact) {
  if (Array.isArray(artifact?.sources)) {
    return artifact.sources
      .map((source) => ({
        path: typeof source?.path === "string" ? normalizeArchiveName(source.path) : "",
        storedPath: typeof source?.storedPath === "string" ? source.storedPath : "",
      }))
      .filter((source) => source.path.length > 0 && source.storedPath.trim().length > 0)
      .sort((left, right) => left.path.localeCompare(right.path));
  }
  if (Array.isArray(artifact?.sourcePaths)) {
    return artifact.sourcePaths
      .map((sourcePath) => {
        const pathValue = typeof sourcePath === "string" ? sourcePath : "";
        return {
          path: normalizeArchiveName(path.posix.basename(pathValue.replace(/\\/g, "/"))),
          storedPath: pathValue,
        };
      })
      .filter((source) => source.path.length > 0 && source.storedPath.trim().length > 0)
      .sort((left, right) => left.path.localeCompare(right.path));
  }
  return [];
}

function buildSourceBundleEntries({ repoRoot, descriptors, includeSources }) {
  const files = [];
  const manifest = [];
  for (const descriptor of descriptors) {
    const resolved = resolveRepoPath(repoRoot, descriptor.storedPath);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      manifest.push({
        path: descriptor.path,
        sha256: null,
        bytes: null,
        present: false,
        included: false,
      });
      continue;
    }
    const bytes = fs.readFileSync(resolved);
    const sha256 = hashBufferSha256(bytes);
    const included = includeSources === true;
    manifest.push({
      path: descriptor.path,
      sha256,
      bytes: bytes.length,
      present: true,
      included,
    });
    if (included) {
      files.push({
        kind: "file",
        sourcePath: resolved,
        archiveName: normalizeArchiveName(path.posix.join("sources", descriptor.path)),
      });
    }
  }
  return { files, manifest };
}

export function prepareSynthArtifactBundle({
  repoRoot,
  runId,
  status,
  includeSources = false,
}) {
  const artifact = status?.artifact && typeof status.artifact === "object" ? status.artifact : {};
  const outputs = artifact?.outputs && typeof artifact.outputs === "object" ? artifact.outputs : {};
  const artifactId =
    typeof status?.artifactId === "string" && status.artifactId.trim().length > 0
      ? status.artifactId.trim()
      : runId;

  const entries = [];
  addFileIfPresent(entries, repoRoot, outputs.netlistVerilog, "netlist.v");
  addFileIfPresent(entries, repoRoot, outputs.statText, "stat.txt");
  addFileIfPresent(entries, repoRoot, outputs.statsJson, "stats.json");
  addFileIfPresent(entries, repoRoot, outputs.runScript, "run.ys");
  const sourceDescriptors = normalizeSourceDescriptors(artifact);
  const sourceBundle = buildSourceBundleEntries({
    repoRoot,
    descriptors: sourceDescriptors,
    includeSources,
  });
  entries.push(...sourceBundle.files);
  if (sourceDescriptors.length === 0 && includeSources) {
    entries.push(...sourceFileEntries(repoRoot, artifact.sourcePaths));
  }

  const logs = Array.isArray(status?.logs)
    ? status.logs.map((entry) => ({
        run_id: entry?.run_id,
        ts: entry?.ts,
        step: entry?.step,
        level: entry?.level,
        msg: entry?.msg,
        ...(entry?.data && typeof entry.data === "object" ? { data: entry.data } : {}),
      }))
    : [];

  const meta = {
    schema_version: "toolchain_synth_artifact_bundle_v1",
    runId,
    artifactId,
    state: status?.state || "error",
    ok: status?.ok === true,
    exitCode: typeof status?.exitCode === "number" ? status.exitCode : null,
    error: typeof status?.error === "string" ? status.error : null,
    board: artifact?.board || null,
    top: artifact?.top || null,
    buildPath:
      artifact?.buildPath && typeof artifact.buildPath === "object"
        ? {
            planId: typeof artifact.buildPath.planId === "string" ? artifact.buildPath.planId : null,
            backend: typeof artifact.buildPath.backend === "string" ? artifact.buildPath.backend : null,
          }
        : null,
    yosysVersion: artifact?.yosysVersion ?? null,
    scriptVersion: artifact?.scriptVersion || null,
    includeSources,
    files: entries.map((entry) => entry.archiveName),
  };

  const textEntries = [
    {
      kind: "text",
      archiveName: "meta.json",
      content: JSON.stringify(meta, null, 2),
    },
    {
      kind: "text",
      archiveName: "logs.json",
      content: JSON.stringify(logs, null, 2),
    },
    {
      kind: "text",
      archiveName: "sources_manifest.json",
      content: JSON.stringify(
        {
          schema_version: "toolchain_synth_sources_manifest_v1",
          includeSources: includeSources === true,
          entries: sourceBundle.manifest,
        },
        null,
        2
      ),
    },
  ];

  if (typeof status?.error === "string" && status.error.trim().length > 0) {
    textEntries.push({
      kind: "text",
      archiveName: "error.txt",
      content: `${status.error}\n`,
    });
  }

  const safeArtifactId = artifactId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `rb-synth-${safeArtifactId}.zip`;
  return {
    filename,
    entries: [...entries, ...textEntries].sort((left, right) => left.archiveName.localeCompare(right.archiveName)),
  };
}

export async function createSynthArtifactsZipBuffer(bundle) {
  const entries = Array.isArray(bundle?.entries) ? bundle.entries : [];
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks = [];
    archive.on("warning", (error) => {
      if (error?.code === "ENOENT") return;
      reject(error);
    });
    archive.on("error", (error) => {
      reject(error);
    });
    archive.on("data", (chunk) => {
      chunks.push(chunk);
    });
    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    for (const entry of entries) {
      if (entry.kind === "file") {
        archive.file(entry.sourcePath, { name: entry.archiveName });
        continue;
      }
      archive.append(entry.content || "", { name: entry.archiveName });
    }
    archive.finalize();
  });
}
