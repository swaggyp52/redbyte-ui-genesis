/**
 * Agent Runner Adapter
 *
 * Calls the existing lab-ingest.js pipeline and parses results
 * Keeps grading logic centralized (not duplicated in server)
 */
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../');
/**
 * Call the lab-ingest.js agent pipeline
 * Returns parsed results + artifact paths
 */
export async function runAgentIngest(submissionPath, options = {}) {
    return new Promise((resolve, reject) => {
        // Build pnpm agent:lab command
        const args = ['agent:lab', '--', '--submission', submissionPath];
        if (options.strictHash)
            args.push('--strict-hash');
        if (options.golden)
            args.push('--golden', options.golden);
        // Spawn pnpm agent:lab in repo root
        const proc = spawn('pnpm', args, {
            cwd: repoRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true, // Use shell for PowerShell on Windows
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        proc.on('close', async (code) => {
            try {
                // Parse [FINAL] line from output
                const finalMatch = stdout.match(/\[FINAL\].*?run_id=([^\s]+)/);
                if (!finalMatch || !finalMatch[1]) {
                    reject(new Error(`Agent pipeline failed: ${stderr || stdout}`));
                    return;
                }
                const runId = finalMatch[1];
                const runDir = path.join(repoRoot, 'packages/ops/labs/runs', runId);
                // Load grade.json
                const gradeJsonPath = path.join(runDir, 'grade.json');
                const gradeJsonText = await fs.readFile(gradeJsonPath, 'utf8');
                const gradeJson = JSON.parse(gradeJsonText);
                // Load grade.md
                const gradeMdPath = path.join(runDir, 'grade.md');
                // Extract verdict from [FINAL] line
                const verdictMatch = stdout.match(/verdict=([A-Z]+)/);
                const verdict = (verdictMatch?.[1] || 'INVALID');
                // Extract lab_id and student_id
                const labIdMatch = stdout.match(/lab_id=([^\s]+)/);
                const studentIdMatch = stdout.match(/student_id=([^\s]+)/);
                const labId = labIdMatch?.[1] || 'unknown';
                const studentId = studentIdMatch?.[1] || 'unknown';
                const result = {
                    run_id: runId,
                    verdict,
                    lab_id: labId,
                    student_id: studentId,
                    timestamp: gradeJson.timestamp || new Date().toISOString(),
                    paths: {
                        run_dir: runDir,
                        grade_json: gradeJsonPath,
                        grade_md: gradeMdPath,
                    },
                    grade: gradeJson,
                };
                resolve(result);
            }
            catch (err) {
                reject(new Error(`Failed to parse agent results: ${err instanceof Error ? err.message : String(err)}`));
            }
        });
    });
}
/**
 * Load a run's grade from disk
 */
export async function loadRun(runId) {
    try {
        const runDir = path.join(repoRoot, 'packages/ops/labs/runs', runId);
        const gradeJsonPath = path.join(runDir, 'grade.json');
        const gradeMdPath = path.join(runDir, 'grade.md');
        // Check if run exists
        try {
            await fs.access(gradeJsonPath);
        }
        catch {
            return null;
        }
        const gradeJsonText = await fs.readFile(gradeJsonPath, 'utf8');
        const gradeJson = JSON.parse(gradeJsonText);
        return {
            run_id: runId,
            verdict: (gradeJson.verdict || 'INVALID'),
            lab_id: 'unknown', // Would need to parse from manifest if needed
            student_id: 'unknown',
            timestamp: gradeJson.timestamp,
            paths: {
                run_dir: runDir,
                grade_json: gradeJsonPath,
                grade_md: gradeMdPath,
            },
            grade: gradeJson,
        };
    }
    catch {
        return null;
    }
}
/**
 * List all runs (latest first)
 */
export async function listRuns() {
    try {
        const runsDir = path.join(repoRoot, 'packages/ops/labs/runs');
        const entries = await fs.readdir(runsDir, { withFileTypes: true });
        const runs = await Promise.all(entries
            .filter((e) => e.isDirectory() && e.name.startsWith('run-'))
            .map(async (e) => {
            const run = await loadRun(e.name);
            return run ? { run_id: run.run_id, timestamp: run.timestamp, verdict: run.verdict } : null;
        }));
        return runs.filter((r) => r !== null).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    catch {
        return [];
    }
}
