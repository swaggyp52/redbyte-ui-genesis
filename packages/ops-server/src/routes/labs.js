/**
 * Lab Ingest Routes
 *
 * POST /api/labs/ingest - Upload and ingest a submission
 * GET /api/labs/runs - List all runs
 * GET /api/labs/runs/:run_id - Get a specific run
 */
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runAgentIngest, loadRun, listRuns } from './agentRunner';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../');
// Multer storage (save to temp, then move to run dir)
const upload = multer({
    dest: path.join(repoRoot, 'packages/ops/labs/tmp'),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'submission' && (file.originalname.endsWith('.zip') || file.originalname.endsWith('.rb-lab.zip'))) {
            cb(null, true);
        }
        else {
            cb(new Error('Only .zip/.rb-lab.zip files accepted'));
        }
    },
});
const router = Router();
/**
 * POST /api/labs/ingest
 * Upload a submission bundle and run the ingest pipeline
 */
router.post('/api/labs/ingest', upload.single('submission'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No submission file provided' });
            return;
        }
        const submissionPath = req.file.path;
        // Parse query options
        const strictHash = req.query.strict_hash === 'true';
        const golden = req.query.golden;
        // Run the agent pipeline
        const result = await runAgentIngest(submissionPath, { strictHash, golden });
        // Move uploaded file to run directory for auditability
        const runSubmissionPath = path.join(result.paths.run_dir, 'submission.rb-lab.zip');
        try {
            await fs.mkdir(result.paths.run_dir, { recursive: true });
            await fs.copyFile(submissionPath, runSubmissionPath);
            await fs.unlink(submissionPath); // Clean up temp file
        }
        catch (e) {
            // If copy fails, don't block the response (agent already succeeded)
            console.warn(`Failed to archive submission: ${e}`);
        }
        res.json({
            run_id: result.run_id,
            verdict: result.verdict,
            lab_id: result.lab_id,
            student_id: result.student_id,
            timestamp: result.timestamp,
            paths: result.paths,
            grade: result.grade,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Ingest error: ${message}`);
        res.status(500).json({ error: message });
    }
});
/**
 * GET /api/labs/runs
 * List all runs (latest first)
 */
router.get('/api/labs/runs', async (req, res) => {
    try {
        const runs = await listRuns();
        res.json(runs);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`List runs error: ${message}`);
        res.status(500).json({ error: message });
    }
});
/**
 * GET /api/labs/runs/:run_id
 * Get a specific run's grade and metadata
 */
router.get('/api/labs/runs/:run_id', async (req, res) => {
    try {
        const { run_id } = req.params;
        // Validate run_id format to prevent path traversal
        if (!run_id.match(/^run-\d+$/)) {
            res.status(400).json({ error: 'Invalid run_id format' });
            return;
        }
        const run = await loadRun(run_id);
        if (!run) {
            res.status(404).json({ error: 'Run not found' });
            return;
        }
        // Load grade.md content
        let gradeMd = '';
        try {
            gradeMd = await fs.readFile(run.paths.grade_md, 'utf8');
        }
        catch {
            // grade.md might not exist for very old runs
        }
        res.json({
            run_id: run.run_id,
            verdict: run.verdict,
            timestamp: run.timestamp,
            paths: run.paths,
            grade_json: run.grade,
            grade_md: gradeMd,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Get run error: ${message}`);
        res.status(500).json({ error: message });
    }
});
export default router;
