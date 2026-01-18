import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const RUNS_DIR = join(REPO_ROOT, "packages/ops/labs/runs");
const TMP_DIR = join(REPO_ROOT, "packages/ops/labs/tmp");
const CONTRACTS_VERSION = 2;
const HOST = "127.0.0.1";
const PORT = 3001;

// Ensure directories exist
if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

function json(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "access-control-allow-origin": "*",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function findLatestRun() {
  if (!existsSync(RUNS_DIR)) return null;
  const entries = readdirSync(RUNS_DIR)
    .filter((name) => name.startsWith("run-"))
    .map((name) => ({ name, path: join(RUNS_DIR, name), mtime: statSync(join(RUNS_DIR, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return entries.length > 0 ? entries[0].name : null;
}

function loadGradeJson(runId) {
  const path = join(RUNS_DIR, runId, "grade.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function loadGradeMd(runId) {
  const path = join(RUNS_DIR, runId, "grade.md");
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function listRuns() {
  if (!existsSync(RUNS_DIR)) return [];
  const entries = readdirSync(RUNS_DIR)
    .filter((name) => name.startsWith("run-"))
    .map((name) => {
      const grade = loadGradeJson(name);
      return {
        run_id: name,
        created_at: grade?.timestamp || new Date(statSync(join(RUNS_DIR, name)).mtime).toISOString(),
        verdict: grade?.verdict || "UNKNOWN",
        lab_id: grade?.lab_id || "unknown",
        student_id: grade?.student_id || "unknown",
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return entries;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { status: "ok", timestamp: Date.now() });
  }

  // Convenience: map root to health to reduce confusion when hitting /
  if (req.method === "GET" && url.pathname === "/") {
    return json(res, 200, { status: "ok", timestamp: Date.now() });
  }

  // POST /api/labs/ingest - Accept raw zip bytes
  if (req.method === "POST" && url.pathname === "/api/labs/ingest") {
    try {
      const contentType = req.headers["content-type"] || "";
      if (!contentType.includes("application/zip") && !contentType.includes("application/octet-stream")) {
        return json(res, 400, { error: "Content-Type must be application/zip or application/octet-stream" });
      }

      const body = await readBody(req);
      const tmpRunId = `run-${Date.now()}`;
      const tmpPath = join(TMP_DIR, `${tmpRunId}.rb-lab.zip`);
      writeFileSync(tmpPath, body);

      // Spawn agent:lab and capture stdout to parse run_id from [FINAL] line
      let agentOutput = '';
      const proc = spawn("pnpm", ["agent:lab", "--submission", tmpPath], {
        cwd: REPO_ROOT,
        shell: true,
        stdio: ["ignore", "pipe", "inherit"],
      });

      proc.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        process.stdout.write(text); // Echo to console
        agentOutput += text;
      });

      await new Promise((resolve, reject) => {
        proc.on("close", (code) => {
          if (code === null) reject(new Error("Agent process killed"));
          else resolve(code);
        });
        proc.on("error", reject);
      });

      // Prefer [FINAL_JSON]; fallback to [FINAL] text line
      let runId = tmpRunId;
      let finalExitCode = null;
      let finalRecord = null;
      try {
        const lines = agentOutput.split(/\r?\n/).filter(Boolean);
        const jsonLine = [...lines].reverse().find((l) => l.startsWith('[FINAL_JSON] '));
        if (jsonLine) {
          const payload = jsonLine.slice('[FINAL_JSON] '.length);
          const parsed = JSON.parse(payload);
          if (parsed && typeof parsed.run_id === 'string') runId = parsed.run_id;
          if (parsed && parsed.exit_code !== undefined) {
            const candidate = typeof parsed.exit_code === 'number' ? parsed.exit_code : Number(parsed.exit_code);
            finalExitCode = Number.isNaN(candidate) ? parsed.exit_code : candidate;
          }
          finalRecord = parsed || null;
        } else {
          const finalMatch = [...lines].reverse().find((l) => l.startsWith('[FINAL] '));
          if (finalMatch) {
            const idMatch = finalMatch.match(/run_id=(run-\d+)/);
            if (idMatch) runId = idMatch[1];
            const exitMatch = finalMatch.match(/exit_code=([\d-]+)/);
            if (exitMatch) finalExitCode = Number(exitMatch[1]);
            finalRecord = { task: 'lab-ingest', run_id: runId, exit_code: finalExitCode };
          }
        }
      } catch (e) {
        // fall back to tmpRunId and null exit code
      }

      // Load grade from the actual run directory created by agent
      const grade = loadGradeJson(runId);
      if (!grade) {
        return json(res, 500, { error: `grade.json not found in run directory: ${runId}` });
      }

      const exitCodeIsInt = Number.isInteger(finalExitCode);
      const normalizedExitCode = exitCodeIsInt ? finalExitCode : 2;
      const verdict = normalizedExitCode === 0 ? "PASS" : normalizedExitCode === 1 ? "FAIL" : "INVALID";
      const gradeExitMatches = grade.exit_code === normalizedExitCode;
      const contract = {
        exitCodeIsInt,
        verdictMappingConsistent: verdict === (normalizedExitCode === 0 ? 'PASS' : normalizedExitCode === 1 ? 'FAIL' : 'INVALID'),
        gradeExitMatches,
      };

      return json(res, 200, {
        run_id: runId,
        exit_code: normalizedExitCode,
        verdict: verdict,
        lab_id: grade.lab_id || "unknown",
        student_id: grade.student_id || "unknown",
        created_at: grade.timestamp || new Date().toISOString(),
        contracts: { ...contract, version: CONTRACTS_VERSION },
        contractsVersion: CONTRACTS_VERSION,
        final: finalRecord,
      });
    } catch (err) {
      console.error("[ingest error]", err);
      return json(res, 500, { error: err.message });
    }
  }

  // GET /api/labs/runs - List all runs
  if (req.method === "GET" && url.pathname === "/api/labs/runs") {
    return json(res, 200, listRuns());
  }

  // GET /api/labs/runs/:id - Get run detail
  const runMatch = url.pathname.match(/^\/api\/labs\/runs\/(run-\d+)$/);
  if (req.method === "GET" && runMatch) {
    const runId = runMatch[1];
    const grade = loadGradeJson(runId);
    if (!grade) {
      return json(res, 404, { error: "Run not found" });
    }
    const gradeMd = loadGradeMd(runId);
    return json(res, 200, {
      run_id: runId,
      created_at: grade.timestamp || new Date().toISOString(),
      verdict: grade.verdict || "UNKNOWN",
      lab_id: grade.lab_id || "unknown",
      student_id: grade.student_id || "unknown",
      grade_json: grade,
      grade_md: gradeMd,
    });
  }

  // GET /api/labs/runs/:id/artifacts/:name - Serve artifacts
  const artifactMatch = url.pathname.match(/^\/api\/labs\/runs\/(run-\d+)\/artifacts\/([^\/]+)$/);
  if (req.method === "GET" && artifactMatch) {
    const [, runId, artifactName] = artifactMatch;
    const allowlist = ["grade.json", "grade.md", "manifest.json", "capsule.json", "events.ndjson", "activity.json"];
    if (!allowlist.includes(artifactName)) {
      return json(res, 400, { error: "Artifact not in allowlist" });
    }
    if (artifactName.includes("..") || artifactName.includes("/") || artifactName.includes("\\")) {
      return json(res, 400, { error: "Invalid artifact name" });
    }

    let artifactPath = join(RUNS_DIR, runId, artifactName);
    if (!existsSync(artifactPath) && (artifactName === "capsule.json" || artifactName === "events.ndjson")) {
      artifactPath = join(RUNS_DIR, runId, "proofs", artifactName);
    }

    if (!existsSync(artifactPath)) {
      return json(res, 404, { error: "Artifact not found" });
    }

    const content = readFileSync(artifactPath);
    const ext = artifactName.split(".").pop()?.toLowerCase();
    const contentType =
      ext === "json"
        ? "application/json"
        : ext === "md"
        ? "text/markdown"
        : ext === "ndjson"
        ? "application/x-ndjson"
        : "application/octet-stream";

    res.writeHead(200, {
      "content-type": contentType,
      "content-length": content.length,
      "access-control-allow-origin": "*",
    });
    return res.end(content);
  }

  return json(res, 404, { error: "not_found", path: url.pathname });
});

server.listen(PORT, HOST, () => {
  console.log(`[ops] listening on http://${HOST}:${PORT}`);
});

  // Keep process alive and log errors
  process.on("uncaughtException", (e) => {
    console.error("[ops] uncaught exception:", e);
  });

  process.on("unhandledRejection", (e) => {
    console.error("[ops] unhandled rejection:", e);
  });
