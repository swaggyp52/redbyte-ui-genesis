#!/usr/bin/env node
/**
 * RedByte Agent Control Loop.
 *
 * Produces source-backed control packets before product work starts.
 * It does not edit product UI, stage, commit, push, or write to Obsidian.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const REQUIRED_SECTIONS = [
  'timestamp',
  'branch',
  'latest_commit',
  'repo_clean_dirty_status',
  'current_product_truth_summary',
  'work_driver_recommendation',
  'memory_recommendation',
  'stale_queue_warning',
  'recommended_next_product_slice',
  'why_this_task_matters',
  'product_spine_surface_affected',
  'supporting_docs',
  'supporting_obsidian_memory',
  'likely_code_files',
  'likely_tests_gates',
  'existing_evidence_level',
  'target_evidence_level',
  'risks',
  'do_not_touch',
  'definition_of_done',
  'claude_codex_execution_prompt',
  'post_work_docs_ai_state_obsidian_sync_requirements',
];

const CONTROL_DOCS = [
  'AI_STATE.md',
  'docs/ACTIVE_WORK.md',
  'docs/product/RED_BYTE_CURRENT_TRUTH.md',
  'docs/product/RED_BYTE_AGENT_OPERATING_RULES.md',
  'docs/product/RED_BYTE_WORK_QUEUE.md',
  'docs/product/RED_BYTE_WORK_DRIVER.md',
  'docs/product/RED_BYTE_OBSIDIAN_MEMORY_BRIDGE.md',
  'docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md',
  'docs/IDE_PRODUCT_DEBT_REGISTER.md',
  'docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md',
];

const CLAIMS_CONFIG = '.redbyte/agent/memory/product-claims.example.json';

function fail(message, details = []) {
  process.stderr.write(`\n[rb-control] ERROR: ${message}\n`);
  for (const detail of details) {
    if (detail) process.stderr.write(`${detail}\n`);
  }
  process.stderr.write('\n');
  process.exit(1);
}

function info(message) {
  process.stdout.write(`[rb-control] ${message}\n`);
}

function resolveRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    fail('rb-control-loop must run inside the redbyte-ui git repository.');
  }
}

const ROOT = resolveRepoRoot();
const RUNS_DIR = path.join(ROOT, '.redbyte', 'agent', 'runs');

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function relFromRoot(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function git(command, { allowFailure = false } = {}) {
  try {
    return execSync(`git ${command}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Git command failed: git ${command}`, [reason]);
  }
}

function run(command, { allowFailure = true } = {}) {
  try {
    return execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 8,
    }).trim();
  } catch (error) {
    if (allowFailure) {
      const stderr = error && typeof error === 'object' && 'stderr' in error
        ? String(error.stderr || '').trim()
        : '';
      const stdout = error && typeof error === 'object' && 'stdout' in error
        ? String(error.stdout || '').trim()
        : '';
      return [stdout, stderr].filter(Boolean).join('\n').trim();
    }
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Command failed: ${command}`, [reason]);
  }
}

function readFile(rel, { missing = '' } = {}) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return missing;
  return fs.readFileSync(abs, 'utf8');
}

function readJson(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail(`Missing JSON file: ${rel}`);
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (error) {
    fail(`Invalid JSON: ${rel}`, [error instanceof Error ? error.message : String(error)]);
  }
}

function ensureGeneratedPath(absPath) {
  if (isGeneratedRunPath(absPath)) {
    return;
  }
  fail('Refusing to write outside .redbyte/agent/runs.', [path.resolve(absPath)]);
}

function isGeneratedRunPath(absPath) {
  const resolved = path.resolve(absPath);
  const allowed = path.resolve(ROOT, '.redbyte', 'agent', 'runs');
  const rel = path.relative(allowed, resolved);
  return !(rel.startsWith('..') || path.isAbsolute(rel));
}

function writeRunFile(filename, content) {
  const dest = path.join(RUNS_DIR, filename);
  ensureGeneratedPath(dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
  return dest;
}

function extractSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
  return markdown.match(re)?.[1]?.trim() || '';
}

function tableRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|') && !line.includes('---'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/~~/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseQueue(markdown) {
  const rows = tableRows(extractSection(markdown, 'Queue'));
  return rows
    .filter((row) => /^\d+$/.test(stripMarkdown(row[0] || '')) || /^~~\d+~~$/.test(row[0] || ''))
    .map((row) => {
      const rawNumber = row[0] || '';
      const done = rawNumber.includes('~~') || /done/i.test(row[5] || '');
      return {
        number: Number(stripMarkdown(rawNumber).replace(/\D/g, '')),
        slice: stripMarkdown(row[1]),
        why: stripMarkdown(row[2]),
        source_docs: stripMarkdown(row[3]),
        expected_commit_type: stripMarkdown(row[4]),
        done_criteria: stripMarkdown(row[5]),
        done,
      };
    })
    .filter((item) => Number.isFinite(item.number));
}

function parseDefaultNextMoves(markdown) {
  const section = extractSection(markdown, '6. Default next move after this control pass');
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line))
    .map((line) => stripMarkdown(line.replace(/^\d+\.\s*/, '')));
}

function parseWorkDriverRecommendation(statusOutput) {
  const item = statusOutput.match(/Recommended item:\s*(.+)/i)?.[1];
  const why = statusOutput.match(/Why:\s*(.+)/i)?.[1];
  return {
    slice: stripMarkdown(item || 'Unavailable'),
    why: stripMarkdown(why || ''),
  };
}

function parseMemoryRecommendation() {
  const md = readFile('.redbyte/agent/runs/next-product-context.md');
  if (!md) return { task: 'Unavailable', source: 'next-product-context.md missing' };
  const task = md.match(/## next product task\s+([\s\S]*?)(?=\n## |$)/i)?.[1]?.trim();
  return {
    task: stripMarkdown(task || 'Unavailable'),
    source: '.redbyte/agent/runs/next-product-context.md',
  };
}

function lineItems(markdown, heading) {
  return extractSection(markdown, heading)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => stripMarkdown(line.slice(2)));
}

function detectCompletedSliceSignals({ queueItems, recentLog, activeWork, aiState }) {
  const completed = [];
  const haystack = `${recentLog}\n${activeWork}\n${aiState.slice(0, 16000)}`.toLowerCase();
  const signals = [
    { key: 'Curate starter and example learning path', match: ['curate starter', 'example learning path', 'learning path'], terms: ['curate v1 learning path', 'feat(examples): curate v1 learning path', '13d77a3b'] },
    { key: 'Project F-P1 next-action semantics', match: ['project f-p1', 'f-p1 next-action', 'project next-action'], terms: ['project next-action semantics', 'f-p1 fix', '34e07ab7'] },
    { key: 'Export F-E1 / F-E2 trust language', match: ['export f-e1', 'f-e1', 'f-e2'], terms: ['f-e1/f-e2', 'fix(export): clarify draft versus trusted export', '4a248098'] },
    { key: 'Map Pins F-H2 / F-H3 trust language', match: ['map pins f-h2', 'f-h2', 'f-h3'], terms: ['f-h2/f-h3', 'fix(hardware): clarify mapping versus verified trust', 'aeda6bc4'] },
    { key: 'Debug chrome hidden from product surfaces', match: ['debug chrome', 'chrome toggles'], terms: ['hide debug chrome toggles', 'eb3cf578'] },
  ];
  for (const item of queueItems) {
    const text = `${item.slice} ${item.done_criteria}`.toLowerCase();
    const signal = signals.find((candidate) => candidate.match.some((term) => text.includes(term)));
    if (item.done || (signal && signal.terms.some((term) => haystack.includes(term.toLowerCase())))) {
      completed.push({
        slice: item.slice,
        reason: item.done ? 'Marked done in queue.' : `Recent docs/commits contain completion signal for ${signal.key}.`,
      });
    }
  }
  return completed;
}

function detectManualProofBlockers(activeWork, currentTruth) {
  const haystack = `${activeWork}\n${currentTruth}`.toLowerCase();
  const blockers = [];
  if (haystack.includes('requires manual board observation') || haystack.includes('connected bench session')) {
    blockers.push('Final E3/custom proof closure is blocked on manual Basys3 board observation.');
  }
  if (haystack.includes('build:unified') && haystack.includes('dist')) {
    blockers.push('build:unified still has a Windows dist lock caveat.');
  }
  return blockers;
}

function currentTruthSummary(currentTruth, activeWork) {
  const thesis = extractSection(currentTruth, '2. Current product thesis')
    .split(/\r?\n/)
    .map((line) => stripMarkdown(line))
    .filter(Boolean)
    .slice(0, 5)
    .join(' ');
  const blockers = lineItems(currentTruth, '4. Current live blockers');
  const top = extractSection(activeWork, 'Top 3 priorities')
    .split(/\r?\n/)
    .map((line) => stripMarkdown(line))
    .filter((line) => /^\d+\./.test(line))
    .join(' ');
  return [thesis, top, blockers.length ? `Live blockers: ${blockers.join('; ')}` : ''].filter(Boolean).join('\n');
}

function firstOpenQueueItem(queueItems) {
  return queueItems.find((item) => !item.done && item.number !== 1) || queueItems.find((item) => !item.done) || null;
}

function chooseRecommendedSlice({ queueItems, workRecommendation, memoryRecommendation, completedSignals, blockers }) {
  const workStale = completedSignals.some((item) => sameSlice(item.slice, workRecommendation.slice));
  const memoryStale = completedSignals.some((item) => sameSlice(item.slice, memoryRecommendation.task));
  const proofItem = queueItems.find((item) => /proof closure/i.test(item.slice) && !item.done);
  const proofBlocked = blockers.some((blocker) => /manual Basys3 board observation/i.test(blocker));
  if (proofItem && proofBlocked) {
    return {
      slice: proofItem.slice,
      recommendation_type: 'blocked_next',
      rationale: 'The honest top priority is proof closure, but it currently requires manual board observation. Do not substitute a UI slice unless the user explicitly chooses a non-bench product-code task.',
      surface: 'Project / Verify / Map Pins / Export proof model',
      blocked: true,
    };
  }
  if (!workStale && workRecommendation.slice && workRecommendation.slice !== 'Unavailable') {
    return {
      slice: workRecommendation.slice,
      recommendation_type: 'work_driver',
      rationale: workRecommendation.why || 'Taken from work-driver output.',
      surface: inferSurface(workRecommendation.slice),
      blocked: false,
    };
  }
  if (!memoryStale && memoryRecommendation.task && memoryRecommendation.task !== 'Unavailable') {
    return {
      slice: memoryRecommendation.task,
      recommendation_type: 'memory',
      rationale: 'Work-driver looked stale; memory recommendation was not flagged as completed.',
      surface: inferSurface(memoryRecommendation.task),
      blocked: false,
    };
  }
  const fallback = firstOpenQueueItem(queueItems);
  return {
    slice: fallback?.slice || 'No open queue item found',
    recommendation_type: 'queue_fallback',
    rationale: 'Stale recommendations were rejected; selected first open queue item from current work queue.',
    surface: inferSurface(fallback?.slice || ''),
    blocked: false,
  };
}

function sameSlice(a, b) {
  const left = stripMarkdown(a).toLowerCase();
  const right = stripMarkdown(b).toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  const important = ['learning path', 'f-p1', 'f-e1', 'f-e2', 'f-h2', 'f-h3', 'debug chrome'];
  return important.some((term) => left.includes(term) && right.includes(term));
}

function inferSurface(slice) {
  const text = String(slice || '').toLowerCase();
  if (text.includes('export')) return 'Export';
  if (text.includes('map pins') || text.includes('hardware')) return 'Map Pins / Hardware';
  if (text.includes('verify') || text.includes('proof')) return 'Verify / Export / Hardware proof chain';
  if (text.includes('project') || text.includes('learning')) return 'Project';
  if (text.includes('import')) return 'Import';
  return 'Product control';
}

function keywordTokens(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9]+/g)?.filter((term) => term.length > 2) || [];
}

function evidenceForClaim(claim) {
  const terms = keywordTokens([
    claim.statement,
    claim.product_area,
    ...(claim.primary_source_docs || []),
  ].join(' '));
  const docs = existingAndMatching(claim.primary_source_docs || [], terms);
  const code = existingAndMatching(claim.likely_code_files || [], terms);
  const tests = existingAndMatching(claim.expected_tests_gates || [], terms, { commandOk: true });
  const status = classifyClaimStatus(claim, { docs, code, tests });
  return {
    claim_id: claim.id,
    statement: claim.statement,
    product_area: claim.product_area,
    expected_status: claim.current_expected_status,
    status,
    evidence_level: evidenceLevel({ docs, code, tests }),
    minimum_evidence_level: claim.minimum_evidence_level,
    docs_found: docs.found,
    docs_missing: docs.missing,
    code_files_found: code.found,
    code_files_missing: code.missing,
    tests_gates_found: tests.found,
    tests_gates_missing: tests.missing,
    stale_memory_risk: claim.stale_memory_risk,
    recommended_next_action: recommendedTraceAction(status, claim),
  };
}

function existingAndMatching(items, terms, { commandOk = false } = {}) {
  const found = [];
  const missing = [];
  for (const item of items) {
    if (commandOk && /^pnpm\s/.test(item)) {
      found.push(item);
      continue;
    }
    const rel = item.replace(/^\.\//, '').replace(/^\.\\/, '');
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      missing.push(item);
      continue;
    }
    let score = 0;
    try {
      const stat = fs.statSync(abs);
      if (stat.size < 400000) {
        const text = fs.readFileSync(abs, 'utf8').toLowerCase();
        for (const term of terms) {
          if (text.includes(term)) score += 1;
        }
      }
    } catch {
      score = 0;
    }
    found.push(score > 0 ? `${item} (matched ${score})` : item);
  }
  return { found, missing };
}

function evidenceLevel({ docs, code, tests }) {
  if (tests.found.some((item) => item.includes('pnpm ide:gate') || item.includes('tests/e2e/'))) return 'L3';
  if (tests.found.length > 0) return 'L2';
  if (code.found.length > 0) return 'L1';
  if (docs.found.length > 0) return 'L0';
  return 'unknown';
}

function levelNumber(level) {
  const match = String(level || '').match(/L(\d)/);
  return match ? Number(match[1]) : -1;
}

function classifyClaimStatus(claim, evidence) {
  const docsOk = evidence.docs.found.length > 0;
  const codeOk = evidence.code.found.length > 0;
  const testsOk = evidence.tests.found.length > 0;
  const levelOk = levelNumber(evidenceLevel(evidence)) >= levelNumber(claim.minimum_evidence_level);
  if (docsOk && codeOk && testsOk && levelOk) return 'proven';
  if (docsOk && (codeOk || testsOk)) return 'partially proven';
  if (docsOk) return 'documented only';
  return 'unknown';
}

function recommendedTraceAction(status, claim) {
  if (status === 'proven') return 'Keep the claim scoped to the cited evidence and rerun trace after behavior changes.';
  if (status === 'partially proven') return `Find or add the missing tests/gates needed to reach ${claim.minimum_evidence_level}.`;
  if (status === 'documented only') return 'Do not make this a public product claim until code and tests/gates are identified.';
  return 'Decide whether this claim is current product truth, target contract, or stale memory before using it.';
}

function buildControlNext() {
  const currentTruth = readFile('docs/product/RED_BYTE_CURRENT_TRUTH.md');
  const activeWork = readFile('docs/ACTIVE_WORK.md');
  const workQueue = readFile('docs/product/RED_BYTE_WORK_QUEUE.md');
  const aiState = readFile('AI_STATE.md');
  const recentLog = git('log --oneline -15', { allowFailure: true });
  const status = git('status --short', { allowFailure: true });
  const branch = git('rev-parse --abbrev-ref HEAD', { allowFailure: true }) || 'unknown';
  const latestCommit = git('log -1 --oneline', { allowFailure: true }) || 'unknown';
  const queueItems = parseQueue(workQueue);
  const defaultNextMoves = parseDefaultNextMoves(currentTruth);
  const workStatus = run('node scripts/rb-work-driver.mjs status');
  const workRecommendation = parseWorkDriverRecommendation(workStatus);
  const memoryRecommendation = parseMemoryRecommendation();
  const completedSignals = detectCompletedSliceSignals({ queueItems, recentLog, activeWork, aiState });
  const blockers = detectManualProofBlockers(activeWork, currentTruth);
  const recommended = chooseRecommendedSlice({
    queueItems,
    workRecommendation,
    memoryRecommendation,
    completedSignals,
    blockers,
  });
  const staleWarnings = [];
  if (completedSignals.some((item) => sameSlice(item.slice, workRecommendation.slice))) {
    staleWarnings.push(`Work-driver recommendation appears stale: ${workRecommendation.slice}`);
  }
  if (completedSignals.some((item) => sameSlice(item.slice, memoryRecommendation.task))) {
    staleWarnings.push(`Memory recommendation appears stale: ${memoryRecommendation.task}`);
  }
  if (defaultNextMoves.some((move) => sameSlice(move, 'Curate starter and example learning path'))) {
    staleWarnings.push('Current-truth default next move still references the completed curated learning path.');
  }
  const evidence = findTaskEvidence(recommended.slice);
  return {
    timestamp: new Date().toISOString(),
    branch,
    latest_commit: latestCommit,
    repo_clean_dirty_status: status || 'clean',
    current_product_truth_summary: currentTruthSummary(currentTruth, activeWork),
    work_driver_recommendation: workRecommendation,
    memory_recommendation: memoryRecommendation,
    stale_queue_warning: staleWarnings.length ? staleWarnings : ['none'],
    recommended_next_product_slice: recommended.slice,
    recommendation_type: recommended.recommendation_type,
    why_this_task_matters: recommended.rationale,
    product_spine_surface_affected: recommended.surface,
    supporting_docs: evidence.docs,
    supporting_obsidian_memory: evidence.memory,
    likely_code_files: evidence.code,
    likely_tests_gates: evidence.tests,
    existing_evidence_level: evidence.existing_level,
    target_evidence_level: recommended.blocked ? 'L4 for proof closure; L2/L3 for non-bench control/tooling slices' : 'L2/L3 before implementation; L4 only for hardware/manual proof claims',
    risks: [
      ...blockers,
      'Memory and work-driver outputs can be stale; repo truth and recent commits win.',
      'Do not treat generated run files as canonical product docs.',
    ],
    do_not_touch: [
      'Do not edit product UI from the control loop.',
      'Do not write to the Obsidian vault.',
      'Do not stage, commit, or push from rb:control:* commands.',
      'Do not reopen completed learning-path, F-P1, F-E1/F-E2, F-H2/F-H3, or debug-chrome work without new evidence.',
    ],
    definition_of_done: [
      'Read AI_STATE.md, ACTIVE_WORK.md, current truth, work queue, and relevant surface specs.',
      'Translate any product complaint into the product-hardening ticket fields before coding.',
      'Name exact files and tests before edits.',
      'Run focused tests/gates and `pnpm --filter @redbyte/playground build` for product code.',
      'Update AI_STATE.md and impacted current-truth docs after meaningful work.',
      'Commit one logical slice; do not push unless explicitly instructed.',
    ],
    claude_codex_execution_prompt: executionPrompt(recommended, evidence),
    post_work_docs_ai_state_obsidian_sync_requirements: [
      'Add a concise AI_STATE.md change-log entry for meaningful landed work.',
      'Update ACTIVE_WORK.md and RED_BYTE_WORK_QUEUE.md when priority or queue status changes.',
      'Update surface specs and traceability docs if product behavior or claim evidence changes.',
      'Run `pnpm rb:memory:sync-plan`; apply Obsidian updates manually only after user authorization.',
    ],
    completed_slice_signals: completedSignals,
  };
}

function findTaskEvidence(task) {
  const text = String(task || '').toLowerCase();
  const docs = [
    'AI_STATE.md',
    'docs/ACTIVE_WORK.md',
    'docs/product/RED_BYTE_CURRENT_TRUTH.md',
    'docs/product/RED_BYTE_WORK_QUEUE.md',
    'docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md',
  ];
  const memory = [];
  if (fs.existsSync(path.join(ROOT, '.redbyte/agent/memory/index/chunks.jsonl'))) {
    memory.push('.redbyte/agent/memory/index/chunks.jsonl (keyword index available; generated and ignored)');
  }
  if (fs.existsSync(path.join(ROOT, '08 Agents + Prompts/Session Log.md'))) {
    memory.push('08 Agents + Prompts/Session Log.md (Obsidian memory candidate)');
  }
  if (text.includes('proof')) {
    return {
      docs: [...docs, 'docs/STUDENT_RELEASE_READINESS.md', 'docs/release/vivado-basys3-certification-matrix.md'],
      memory,
      code: ['scripts/vivado/README.md', 'scripts/vivado/run-hw-probe.mjs'],
      tests: ['pnpm rb:doc:validate', 'git diff --check', 'manual Basys3 E2/E3 observation procedure'],
      existing_level: 'L3 for existing code/gates; L4 missing for final manual board observations',
    };
  }
  if (text.includes('export')) {
    return {
      docs: [...docs, 'docs/ide/04-export.md', 'docs/IDE_PRODUCT_DEBT_REGISTER.md', 'docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md'],
      memory,
      code: ['packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx', 'packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts'],
      tests: ['pnpm ide:gate:export-ready-contract', 'pnpm ide:gate:export-blockers-contract', 'pnpm --filter @redbyte/playground build'],
      existing_level: 'L2/L3 depending on the exact Export claim',
    };
  }
  if (text.includes('map pins') || text.includes('hardware')) {
    return {
      docs: [...docs, 'docs/ide/SURFACE_CONFORMANCE.md', 'docs/ide/03-verify.md', 'docs/ide/04-export.md'],
      memory,
      code: ['packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx', 'packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts'],
      tests: ['pnpm ide:gate:hardware-checklist-contract', 'pnpm ide:gate:student-loop-contract', 'pnpm --filter @redbyte/playground build'],
      existing_level: 'L2/L3 depending on the exact Hardware claim',
    };
  }
  return {
    docs,
    memory,
    code: ['scripts/rb-work-driver.mjs', 'scripts/rb-obsidian-memory.mjs', 'scripts/rb-control-loop.mjs'],
    tests: ['pnpm rb:control:test', 'pnpm rb:memory:test', 'pnpm rb:doc:validate'],
    existing_level: 'L1/L2 for tooling unless browser or hardware gates are involved',
  };
}

function executionPrompt(recommended, evidence) {
  return [
    `Work on this bounded RedByte slice: ${recommended.slice}`,
    '',
    'Before editing:',
    '1. Run `pnpm rb:control:next` and confirm this recommendation still matches repo truth.',
    '2. Run `git status --short` and stop on unrelated dirty product UI files.',
    '3. Read the supporting docs listed in the generated packet.',
    '',
    'Scope:',
    `- Product surface affected: ${recommended.surface}`,
    `- Likely files: ${evidence.code.join(', ') || 'none identified'}`,
    `- Likely tests/gates: ${evidence.tests.join(', ') || 'none identified'}`,
    '',
    'Rules:',
    '- Do not let Obsidian memory override current repo truth.',
    '- Do not make public/product claims above the cited evidence level.',
    '- Keep one logical change per commit.',
    '- Do not push unless explicitly instructed.',
  ].join('\n');
}

function markdownFromControl(payload) {
  const lines = ['# RedByte Agent Control Loop - Next Product Slice', ''];
  for (const key of REQUIRED_SECTIONS) {
    lines.push(`## ${key.replace(/_/g, ' ')}`);
    lines.push('');
    const value = payload[key];
    if (Array.isArray(value)) {
      lines.push(value.length ? value.map((item) => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n') : '- none');
    } else if (value && typeof value === 'object') {
      lines.push('```json');
      lines.push(JSON.stringify(value, null, 2));
      lines.push('```');
    } else {
      lines.push(String(value ?? ''));
    }
    lines.push('');
  }
  lines.push('## completed slice signals');
  lines.push('');
  lines.push(payload.completed_slice_signals?.length
    ? payload.completed_slice_signals.map((item) => `- ${item.slice}: ${item.reason}`).join('\n')
    : '- none');
  lines.push('');
  return lines.join('\n');
}

function loadClaims() {
  const json = readJson(CLAIMS_CONFIG);
  if (!Array.isArray(json.claims)) fail(`Claims config must contain a claims array: ${CLAIMS_CONFIG}`);
  return json.claims;
}

function buildClaimsTrace() {
  const claims = loadClaims();
  const results = claims.map(evidenceForClaim);
  const summary = {
    proven: results.filter((item) => item.status === 'proven').length,
    partially_proven: results.filter((item) => item.status === 'partially proven').length,
    documented_only: results.filter((item) => item.status === 'documented only').length,
    stale_conflicted: results.filter((item) => item.status === 'stale/conflicted').length,
    unknown: results.filter((item) => item.status === 'unknown').length,
  };
  return {
    timestamp: new Date().toISOString(),
    branch: git('rev-parse --abbrev-ref HEAD', { allowFailure: true }) || 'unknown',
    latest_commit: git('log -1 --oneline', { allowFailure: true }) || 'unknown',
    claims_config: CLAIMS_CONFIG,
    summary,
    claims: results,
  };
}

function markdownFromClaims(payload) {
  const lines = [
    '# RedByte Canonical Product Claims Trace',
    '',
    `- Generated: ${payload.timestamp}`,
    `- Branch: ${payload.branch}`,
    `- Latest commit: ${payload.latest_commit}`,
    `- Claims config: ${payload.claims_config}`,
    '',
    '## Summary',
    '',
    ...Object.entries(payload.summary).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`),
    '',
    '## Claims',
    '',
  ];
  for (const claim of payload.claims) {
    lines.push(`### ${claim.claim_id} - ${claim.statement}`);
    lines.push('');
    lines.push(`- Status: ${claim.status}`);
    lines.push(`- Evidence level: ${claim.evidence_level}`);
    lines.push(`- Minimum evidence level: ${claim.minimum_evidence_level}`);
    lines.push(`- Product area: ${claim.product_area}`);
    lines.push(`- Stale-memory risk: ${claim.stale_memory_risk}`);
    lines.push(`- Recommended next action: ${claim.recommended_next_action}`);
    lines.push('');
    lines.push('Docs found:');
    lines.push(claim.docs_found.length ? claim.docs_found.map((item) => `- ${item}`).join('\n') : '- none');
    lines.push('');
    lines.push('Code files found:');
    lines.push(claim.code_files_found.length ? claim.code_files_found.map((item) => `- ${item}`).join('\n') : '- none');
    lines.push('');
    lines.push('Tests/gates found:');
    lines.push(claim.tests_gates_found.length ? claim.tests_gates_found.map((item) => `- ${item}`).join('\n') : '- none');
    lines.push('');
    if (claim.docs_missing.length || claim.code_files_missing.length || claim.tests_gates_missing.length) {
      lines.push('Missing evidence candidates:');
      for (const item of [...claim.docs_missing, ...claim.code_files_missing, ...claim.tests_gates_missing]) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

function cmdNext() {
  const payload = buildControlNext();
  const jsonPath = writeRunFile('control-next-latest.json', `${JSON.stringify(payload, null, 2)}\n`);
  const mdPath = writeRunFile('control-next-latest.md', markdownFromControl(payload));
  info(`[ok] JSON written: ${relFromRoot(jsonPath)}`);
  info(`[ok] Markdown written: ${relFromRoot(mdPath)}`);
  process.stdout.write(`${markdownFromControl(payload)}\n`);
}

function cmdTraceClaims() {
  const payload = buildClaimsTrace();
  const jsonPath = writeRunFile('product-claims-trace-latest.json', `${JSON.stringify(payload, null, 2)}\n`);
  const mdPath = writeRunFile('product-claims-trace-latest.md', markdownFromClaims(payload));
  info(`[ok] JSON written: ${relFromRoot(jsonPath)}`);
  info(`[ok] Markdown written: ${relFromRoot(mdPath)}`);
  process.stdout.write(`${markdownFromClaims(payload)}\n`);
}

function usage() {
  process.stdout.write(
    '\nRedByte Agent Control Loop\n\n' +
    'Usage:\n' +
    '  pnpm rb:control:next\n' +
    '  pnpm rb:control:trace-claims\n\n'
  );
}

const COMMANDS = {
  next: cmdNext,
  'trace-claims': cmdTraceClaims,
};

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const command = process.argv[2];
  if (!command || !COMMANDS[command]) {
    usage();
    process.exit(command ? 1 : 0);
  }
  COMMANDS[command]();
}

export {
  buildClaimsTrace,
  buildControlNext,
  classifyClaimStatus,
  detectCompletedSliceSignals,
  ensureGeneratedPath,
  evidenceForClaim,
  isGeneratedRunPath,
  markdownFromClaims,
  markdownFromControl,
  parseQueue,
  REQUIRED_SECTIONS,
};
