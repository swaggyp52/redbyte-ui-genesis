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

function hashBufferSha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeOutputFileName(value) {
  const normalized = normalizeArchiveName(value || "");
  return normalized.length > 0 ? normalized : null;
}

export function classifyImplementOutputKind(output) {
  const kindRaw = typeof output?.kind === "string" ? output.kind.trim().toLowerCase() : "";
  if (kindRaw === "bitstream" || kindRaw === "report" || kindRaw === "output") {
    return kindRaw;
  }
  const pathHint = String(output?.pathHint || "").toLowerCase();
  const name = String(output?.name || "").toLowerCase();
  const storedPath = String(output?.storedPath || "").toLowerCase();
  if (pathHint.endsWith(".bit") || name.includes("bitstream") || storedPath.endsWith(".bit")) {
    return "bitstream";
  }
  if (
    pathHint.endsWith(".rpt") ||
    pathHint.endsWith(".log") ||
    pathHint.endsWith(".txt") ||
    name.includes("report") ||
    storedPath.endsWith(".rpt")
  ) {
    return "report";
  }
  return "output";
}

export function buildImplementOutputsManifest({ repoRoot, outputs }) {
  const descriptors = Array.isArray(outputs) ? outputs.slice() : [];
  descriptors.sort((left, right) => {
    const leftHint = String(left?.pathHint || left?.storedPath || left?.name || "");
    const rightHint = String(right?.pathHint || right?.storedPath || right?.name || "");
    return leftHint.localeCompare(rightHint);
  });

  const manifest = [];
  for (const output of descriptors) {
    if (!output || typeof output !== "object") continue;
    const filename =
      normalizeOutputFileName(output.pathHint) ||
      normalizeOutputFileName(output.storedPath) ||
      normalizeOutputFileName(output.name) ||
      "output.bin";
    const storedPath = typeof output?.storedPath === "string" ? output.storedPath : "";
    const resolved = resolveRepoPath(repoRoot, storedPath);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      manifest.push({
        kind: classifyImplementOutputKind(output),
        filename,
        sha256: null,
        bytes: null,
        present: false,
      });
      continue;
    }
    const bytes = fs.readFileSync(resolved);
    manifest.push({
      kind: classifyImplementOutputKind(output),
      filename,
      sha256: hashBufferSha256(bytes),
      bytes: bytes.length,
      present: true,
    });
  }
  return manifest;
}

function buildImplementOutputDescriptor(output) {
  if (!output || typeof output !== "object") return null;
  const storedPath = typeof output.storedPath === "string" ? output.storedPath : "";
  const pathHint = normalizeOutputFileName(output.pathHint) || normalizeOutputFileName(storedPath);
  if (!pathHint || !storedPath) return null;
  const name = typeof output.name === "string" && output.name.trim().length > 0 ? output.name.trim() : path.posix.basename(pathHint);
  const kind = classifyImplementOutputKind({
    kind: output.kind,
    name,
    pathHint,
    storedPath,
  });
  return {
    name,
    kind,
    filename: pathHint,
    storedPath,
  };
}

export function findImplementBitstreamArtifact({ repoRoot, artifact }) {
  const outputs = Array.isArray(artifact?.outputs) ? artifact.outputs : [];
  const candidates = outputs
    .map((output) => buildImplementOutputDescriptor(output))
    .filter((entry) => entry && entry.kind === "bitstream")
    .sort((left, right) => left.filename.localeCompare(right.filename));
  for (const output of candidates) {
    const resolved = resolveRepoPath(repoRoot, output.storedPath);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) continue;
    return {
      ...output,
      absolutePath: resolved,
    };
  }
  return null;
}

export function readImplementBitstreamArtifact({ repoRoot, artifact }) {
  const output = findImplementBitstreamArtifact({ repoRoot, artifact });
  if (!output) return null;
  const bytes = fs.readFileSync(output.absolutePath);
  return {
    kind: output.kind,
    name: output.name,
    filename: output.filename,
    storedPath: output.storedPath,
    sha256: hashBufferSha256(bytes),
    bytes: bytes.length,
    dataBase64: bytes.toString("base64"),
  };
}

function buildSourceBundleEntries({ repoRoot, sources, includeSources }) {
  const files = [];
  const manifest = [];
  const descriptors = Array.isArray(sources) ? sources.slice() : [];
  descriptors.sort((left, right) => String(left?.path || "").localeCompare(String(right?.path || "")));
  for (const source of descriptors) {
    const sourcePath = typeof source?.path === "string" ? normalizeArchiveName(source.path) : "";
    const storedPath = typeof source?.storedPath === "string" ? source.storedPath : "";
    if (!sourcePath || !storedPath) continue;
    const resolved = resolveRepoPath(repoRoot, storedPath);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      manifest.push({
        path: sourcePath,
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
      path: sourcePath,
      sha256,
      bytes: bytes.length,
      present: true,
      included,
    });
    if (included) {
      files.push({
        kind: "file",
        sourcePath: resolved,
        archiveName: normalizeArchiveName(path.posix.join("sources", sourcePath)),
      });
    }
  }
  return { files, manifest };
}

function buildOutputEntries({ repoRoot, outputs }) {
  const entries = [];
  const outputList = Array.isArray(outputs) ? outputs.slice() : [];
  outputList.sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || "")));
  for (const output of outputList) {
    const outputName = typeof output?.name === "string" ? output.name : "output";
    const storedPath = typeof output?.storedPath === "string" ? output.storedPath : "";
    if (!storedPath) continue;
    const resolved = resolveRepoPath(repoRoot, storedPath);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) continue;
    const ext = path.extname(storedPath) || "";
    const archiveName = normalizeArchiveName(path.posix.join("outputs", `${outputName}${ext}`));
    entries.push({
      kind: "file",
      sourcePath: resolved,
      archiveName,
    });
  }
  return entries;
}

export function prepareImplementArtifactBundle({
  repoRoot,
  runId,
  status,
  includeSources = false,
}) {
  const artifact = status?.artifact && typeof status.artifact === "object" ? status.artifact : {};
  const artifactId =
    typeof status?.artifactId === "string" && status.artifactId.trim().length > 0
      ? status.artifactId.trim()
      : runId;
  const outputEntries = buildOutputEntries({
    repoRoot,
    outputs: artifact.outputs,
  });
  const outputsManifest = buildImplementOutputsManifest({
    repoRoot,
    outputs: artifact.outputs,
  });
  const sourceBundle = buildSourceBundleEntries({
    repoRoot,
    sources: artifact.sources,
    includeSources,
  });
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
  const commands = Array.isArray(artifact.commands)
    ? artifact.commands.map((command) => ({
        step: command?.step,
        argv: Array.isArray(command?.argv) ? command.argv.map((item) => String(item)) : [],
        envKeysUsed: Array.isArray(command?.envKeysUsed)
          ? command.envKeysUsed.map((item) => String(item)).sort((a, b) => a.localeCompare(b))
          : [],
      }))
    : [];
  const meta = {
    schema_version: "toolchain_implement_artifact_bundle_v1",
    runId,
    artifactId,
    state: status?.state || "error",
    ok: status?.ok === true,
    exitCode: typeof status?.exitCode === "number" ? status.exitCode : null,
    error: typeof status?.error === "string" ? status.error : null,
    board: artifact?.board || null,
    top: artifact?.top || null,
    planId: artifact?.planId || null,
    backend: artifact?.backend || null,
    constraintsHash: artifact?.constraintsHash || null,
    includeSources: includeSources === true,
    outputCount: outputsManifest.length,
    sourceCount: sourceBundle.manifest.length,
  };

  const entries = [
    ...outputEntries,
    ...sourceBundle.files,
    {
      kind: "text",
      archiveName: "meta.json",
      content: JSON.stringify(meta, null, 2),
    },
    {
      kind: "text",
      archiveName: "commands.json",
      content: JSON.stringify(commands, null, 2),
    },
    {
      kind: "text",
      archiveName: "logs.json",
      content: JSON.stringify(logs, null, 2),
    },
    {
      kind: "text",
      archiveName: "outputs_manifest.json",
      content: JSON.stringify(
        {
          schema_version: "toolchain_implement_outputs_manifest_v1",
          runId,
          artifactId,
          outputs: outputsManifest,
        },
        null,
        2
      ),
    },
    {
      kind: "text",
      archiveName: "sources_manifest.json",
      content: JSON.stringify(
        {
          schema_version: "toolchain_implement_sources_manifest_v1",
          includeSources: includeSources === true,
          entries: sourceBundle.manifest,
        },
        null,
        2
      ),
    },
  ];

  if (typeof status?.error === "string" && status.error.trim().length > 0) {
    entries.push({
      kind: "text",
      archiveName: "error.txt",
      content: `${status.error}\n`,
    });
  }

  entries.sort((left, right) => left.archiveName.localeCompare(right.archiveName));
  const safeArtifactId = artifactId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return {
    filename: `rb-implement-${safeArtifactId}.zip`,
    entries,
  };
}

export async function createImplementArtifactsZipBuffer(bundle) {
  const entries = Array.isArray(bundle?.entries) ? bundle.entries : [];
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks = [];
    archive.on("warning", (error) => {
      if (error?.code === "ENOENT") return;
      reject(error);
    });
    archive.on("error", (error) => reject(error));
    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    for (const entry of entries) {
      if (entry.kind === "file") {
        archive.file(entry.sourcePath, { name: entry.archiveName });
      } else {
        archive.append(entry.content || "", { name: entry.archiveName });
      }
    }
    archive.finalize();
  });
}
