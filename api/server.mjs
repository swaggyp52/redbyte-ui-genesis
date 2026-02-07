import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const RUNS_DIR = join(REPO_ROOT, "packages/ops/labs/runs");
const TMP_DIR = join(REPO_ROOT, "packages/ops/labs/tmp");
const FIXTURES_DIR = join(REPO_ROOT, "packages/ops/labs/fixtures");
const CONTRACTS_VERSION = 2;
const HOST = "127.0.0.1";
const PORT = 3001;
const AUTH_TOKEN = process.env.RB_API_TOKEN || null; // Set RB_API_TOKEN env var to enable auth
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB max upload size
const REQUEST_TIMEOUT = 30000; // 30 seconds

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

function text(res, code, bodyText) {
  const body = Buffer.from(String(bodyText ?? ""), "utf8");
  res.writeHead(code, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": body.length,
    "access-control-allow-origin": "*",
  });
  res.end(body);
}

function readBody(req, maxSize = MAX_UPLOAD_SIZE) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;

    req.on("data", (chunk) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        reject(new Error(`Upload size exceeds limit of ${Math.floor(maxSize / 1024 / 1024)}MB`));
        req.destroy(); // Stop reading
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function isSafeFixtureName(name) {
  if (typeof name !== "string") return false;
  if (name.length < 1 || name.length > 200) return false;
  if (name.includes("..") || name.includes("/") || name.includes("\\")) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name);
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

/**
 * Authentication middleware - validates Bearer token
 * @param {string} path - Request path
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @returns {boolean} - True if authenticated or auth disabled, false otherwise
 */
function requireAuth(path, req, res) {
  // Skip auth if token not configured
  if (!AUTH_TOKEN) return true;

  // Skip auth for health endpoint
  if (path === "/health" || path === "/") return true;

  // Check Authorization header
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token !== AUTH_TOKEN) {
    json(res, 401, {
      error: "Authentication required",
      message: "Please provide a valid authorization token. Contact your instructor if you need help."
    });
    return false;
  }

  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    });
    return res.end();
  }

  // Health check (no auth required)
  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { status: "ok", timestamp: Date.now(), authEnabled: Boolean(AUTH_TOKEN) });
  }

  // Root redirect to health
  if (req.method === "GET" && url.pathname === "/") {
    return json(res, 200, { status: "ok", timestamp: Date.now(), authEnabled: Boolean(AUTH_TOKEN) });
  }

  // Protect all /api/* routes with authentication
  if (url.pathname.startsWith("/api/")) {
    if (!requireAuth(url.pathname, req, res)) {
      return; // Auth failed, response already sent
    }
  }

  // POST /api/labs/ingest - Accept raw zip bytes
  if (req.method === "POST" && url.pathname === "/api/labs/ingest") {
    req.setTimeout(REQUEST_TIMEOUT, () => {
      json(res, 408, {
        error: "Request timeout",
        message: "Upload took too long. Please try again or contact support if the problem persists."
      });
      req.destroy();
    });

    try {
      const contentType = req.headers["content-type"] || "";
      if (!contentType.includes("application/zip") && !contentType.includes("application/octet-stream")) {
        return json(res, 400, { error: "Content-Type must be application/zip or application/octet-stream" });
      }

      const body = await readBody(req);
      const tmpRunId = `run-${randomUUID()}`;
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

      // Persist original submission ZIP for reproducibility/diff/regrade
      try {
        const runDir = join(RUNS_DIR, runId);
        if (!existsSync(runDir)) mkdirSync(runDir, { recursive: true });
        writeFileSync(join(runDir, "submission.rb-lab.zip"), body);
      } catch (e) {
        return json(res, 500, { error: `Failed to persist submission archive for run ${runId}` });
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

  // POST /api/labs/diff - Compare a submitted run to a golden fixture (deterministic)
  if (req.method === "POST" && url.pathname === "/api/labs/diff") {
    try {
      const contentType = req.headers["content-type"] || "";
      if (!contentType.includes("application/json")) {
        return json(res, 400, { error: "Content-Type must be application/json" });
      }

      const body = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(body.toString("utf8"));
      } catch {
        return json(res, 400, { error: "Invalid JSON body" });
      }

      const runId = payload?.run_id;
      const goldenFixture = payload?.golden_fixture ?? "lab-traffic-light-minimal";
      const strictHash = Boolean(payload?.strict_hash);

      if (typeof runId !== "string" || !/^run-\d+$/.test(runId)) {
        return json(res, 400, { error: "run_id must be a string like run-<timestamp>" });
      }
      if (!isSafeFixtureName(goldenFixture)) {
        return json(res, 400, { error: "golden_fixture must be a safe fixture name (no slashes or ..)" });
      }

      const runDir = join(RUNS_DIR, runId);
      if (!existsSync(runDir)) {
        return json(res, 404, { error: "Run not found" });
      }

      const submissionZipPath = join(runDir, "submission.rb-lab.zip");
      if (!existsSync(submissionZipPath)) {
        return json(res, 409, { error: "submission.rb-lab.zip not found for run; re-ingest required" });
      }

      const fixturesDirAbs = resolve(FIXTURES_DIR);
      const fixtureCandidateAbs = resolve(FIXTURES_DIR, goldenFixture);
      if (!(fixtureCandidateAbs === fixturesDirAbs || fixtureCandidateAbs.startsWith(fixturesDirAbs + sep))) {
        return json(res, 400, { error: "golden_fixture resolves outside fixtures dir" });
      }

      const fixtureZipAbs = resolve(FIXTURES_DIR, `${goldenFixture}.rb-lab.zip`);
      const fixtureIsDir = existsSync(fixtureCandidateAbs) && statSync(fixtureCandidateAbs).isDirectory();
      const fixtureIsZip = existsSync(fixtureZipAbs) && statSync(fixtureZipAbs).isFile();
      if (!fixtureIsDir && !fixtureIsZip) {
        return json(res, 404, { error: `Golden fixture not found: ${goldenFixture}` });
      }

      const diffScript = join(REPO_ROOT, "packages/rb-fpga-proof-core/scripts/lab-diff.js");
      if (!existsSync(diffScript)) {
        return json(res, 500, { error: "Diff engine not found (packages/rb-fpga-proof-core/scripts/lab-diff.js)" });
      }

      const goldenPath = fixtureIsDir ? fixtureCandidateAbs : fixtureZipAbs;
      const diffErrPath = join(runDir, "diff-error.txt");
      const diffOutPath = join(runDir, "diff-stdout.txt");
      const diffTimeoutMs = 30_000;
      let diffOutput = "";
      let diffError = "";
      const proc = spawn(
        "node",
        [
          diffScript,
          "--submission",
          submissionZipPath,
          "--golden",
          goldenPath,
          ...(strictHash ? ["--strict-hash"] : []),
        ],
        {
          cwd: REPO_ROOT,
          shell: true,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      proc.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        diffOutput += text;
      });

      proc.stderr.on("data", (chunk) => {
        diffError += chunk.toString();
      });

      const exitCode = await new Promise((resolvePromise, reject) => {
        const timeout = setTimeout(() => {
          try {
            proc.kill("SIGKILL");
          } catch {
            // ignore
          }
          resolvePromise(2);
        }, diffTimeoutMs);

        proc.on("close", (code) => {
          clearTimeout(timeout);
          resolvePromise(code ?? 2);
        });
        proc.on("error", reject);
      });

      const lines = diffOutput.split(/\r?\n/).filter(Boolean);
      const jsonLine = [...lines].reverse().find((l) => l.startsWith("[DIFF_JSON] "));
      if (!jsonLine) {
        try {
          writeFileSync(diffOutPath, diffOutput || "", "utf8");
          writeFileSync(
            diffErrPath,
            `Diff engine did not emit [DIFF_JSON]\nexit_code=${exitCode}\n\nSTDERR:\n${diffError || ""}\n`,
            "utf8",
          );
        } catch {
          // ignore secondary persistence failures
        }
        return json(res, 500, { error: "Diff engine did not emit [DIFF_JSON]" });
      }

      let diff;
      try {
        const parsed = JSON.parse(jsonLine.slice("[DIFF_JSON] ".length));
        diff = parsed?.diff;
      } catch (e) {
        try {
          writeFileSync(diffOutPath, diffOutput || "", "utf8");
          writeFileSync(
            diffErrPath,
            `Failed to parse [DIFF_JSON] payload\nexit_code=${exitCode}\n\nSTDERR:\n${diffError || ""}\n`,
            "utf8",
          );
        } catch {
          // ignore
        }
        return json(res, 500, { error: "Failed to parse [DIFF_JSON] payload" });
      }

      if (!diff || typeof diff !== "object") {
        try {
          writeFileSync(diffOutPath, diffOutput || "", "utf8");
          writeFileSync(
            diffErrPath,
            `Diff engine returned invalid diff payload\nexit_code=${exitCode}\n\nSTDERR:\n${diffError || ""}\n`,
            "utf8",
          );
        } catch {
          // ignore
        }
        return json(res, 500, { error: "Diff engine returned invalid diff payload" });
      }

      const diffRecord = {
        ok: true,
        run_id: runId,
        golden_fixture: goldenFixture,
        strict_hash: strictHash,
        summary: {
          verdict: diff.verdict,
          exit_code: diff.exitCode,
          summary: diff.summary,
        },
        diff: diff,
      };

      writeFileSync(join(runDir, "diff.json"), JSON.stringify(diffRecord, null, 2) + "\n");
      writeFileSync(
        join(runDir, "diff.md"),
        [
          "# Diff Report",
          "",
          `Run: ${runId}`,
          `Fixture: ${goldenFixture}`,
          `Strict Hash: ${strictHash ? "true" : "false"}`,
          "",
          `Verdict: ${diff.verdict}`,
          `Exit Code: ${diff.exitCode}`,
          "",
          diff.summary ? `Summary: ${diff.summary}` : "",
          "",
        ].join("\n"),
      );

      // Persist stdout/stderr for debugging when diff engine exits unexpectedly (or returns INVALID)
      if (exitCode !== 0 && exitCode !== 1) {
        try {
          writeFileSync(diffOutPath, diffOutput || "", "utf8");
          writeFileSync(diffErrPath, diffError || "", "utf8");
        } catch {
          // ignore
        }
        return json(res, 500, { error: "Diff engine failed", run_id: runId, golden_fixture: goldenFixture });
      }

      if (diff.exitCode === 2) {
        try {
          writeFileSync(diffOutPath, diffOutput || "", "utf8");
          writeFileSync(
            diffErrPath,
            `Diff verdict INVALID (exit_code=2)\n\nSTDERR:\n${diffError || ""}\n`,
            "utf8",
          );
        } catch {
          // ignore
        }
      }

      return json(res, 200, diffRecord);
    } catch (err) {
      console.error("[diff error]", err);
      return json(res, 500, { error: err.message });
    }
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
    const allowlist = [
      "grade.json",
      "grade.md",
      "diff.json",
      "diff.md",
      "diff-error.txt",
      "diff-stdout.txt",
      "manifest.json",
      "capsule.json",
      "events.ndjson",
      "activity.json",
    ];
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
          : ext === "txt"
            ? "text/plain"
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
