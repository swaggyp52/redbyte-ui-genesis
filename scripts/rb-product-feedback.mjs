#!/usr/bin/env node
/**
 * RedByte Product Problem Intake Loop.
 *
 * Converts raw product feedback into source-backed problem packets before
 * implementation starts. It does not edit product UI, write to Obsidian,
 * stage, commit, or push.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const REQUIRED_PROBLEM_KEYS = [
  'raw_feedback',
  'normalized_problem',
  'product_surface',
  'workflow_step',
  'problem_type',
  'severity',
  'evidence_sources',
  'related_claims',
  'related_docs',
  'likely_code_files',
  'related_tests_gates',
  'obsidian_memory_hits',
  'stale_memory_risks',
  'minimal_fix_options',
  'overengineering_risks',
  'do_not_build',
  'recommended_next_action',
  'definition_of_done',
  'codex_execution_prompt',
];

const DEFAULT_CONFIG = {
  defaultSeverityScale: ['low', 'medium', 'high', 'critical'],
  allowedProblemTypes: [
    'workflow confusion',
    'visual/professionalism issue',
    'proof/trust issue',
    'overengineering issue',
    'product-definition drift',
    'stale docs/memory issue',
    'test/evidence gap',
    'scope creep',
    'classroom/lab overframing',
    'app behavior bug',
    'UX friction',
  ],
  productSpine: ['Project', 'Design', 'Verify', 'Map Pins / Hardware', 'Export'],
  sourcePriority: [
    'AI_STATE.md',
    'docs/ACTIVE_WORK.md',
    'docs/product/RED_BYTE_CURRENT_TRUTH.md',
    'docs/product/RED_BYTE_AGENT_OPERATING_RULES.md',
    'docs/product/RED_BYTE_WORK_QUEUE.md',
    'docs/product/RED_BYTE_AGENT_CONTROL_LOOP.md',
    'docs/product/RED_BYTE_OBSIDIAN_MEMORY_BRIDGE.md',
    'docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md',
    'docs/contracts/RedByte_Product_Contract.md',
    'docs/manuals/RedByte_Product_Manual.md',
    'docs/ide/**',
    'Obsidian memory',
  ],
  maxMemoryHits: 8,
  maxCodeFileHints: 12,
  outputDir: '.redbyte/agent/runs/problems',
  allowObsidianWrites: false,
  requireTraceability: true,
  requireDefinitionOfDone: true,
};

const CONFIG_EXAMPLE = '.redbyte/agent/problem/config.example.json';
const CONFIG_PRIVATE = '.redbyte/agent/problem/config.json';
const CLAIMS_CONFIG = '.redbyte/agent/memory/product-claims.example.json';
const MEMORY_INDEX = '.redbyte/agent/memory/index/chunks.jsonl';

const SURFACE_RULES = [
  {
    surface: 'Export',
    workflow_step: 'Export',
    terms: ['export', 'draft', 'trusted', 'vivado', 'download', 'package', 'heading', 'artifact'],
    docs: ['docs/ide/04-export.md', 'docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md'],
    code: [
      'packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx',
      'packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts',
      'packages/rb-apps/src/apps/ide/projectHealth.ts',
    ],
    tests: [
      'pnpm ide:gate:export-ready-contract',
      'pnpm ide:gate:export-blockers-contract',
      'pnpm ide:gate:export-download-contract',
    ],
  },
  {
    surface: 'Map Pins / Hardware',
    workflow_step: 'Map Pins / Hardware',
    terms: ['map pins', 'hardware', 'pin', 'pins', 'basys', 'board', 'switch', 'led', 'xdc'],
    docs: ['docs/ide/SURFACE_CONFORMANCE.md', 'docs/ide/03-verify.md', 'docs/ide/04-export.md'],
    code: [
      'packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx',
      'packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts',
    ],
    tests: [
      'pnpm ide:gate:hardware-checklist-contract',
      'pnpm ide:gate:student-loop-contract',
      'packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.trust-clarity.test.tsx',
    ],
  },
  {
    surface: 'Verify',
    workflow_step: 'Verify',
    terms: ['verify', 'proof', 'pass', 'compare', 'waveform', 'evidence', 'testbench', 'truth table'],
    docs: ['docs/ide/03-verify.md', 'docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md'],
    code: [
      'packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx',
      'packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts',
    ],
    tests: [
      'pnpm ide:gate:verify-contract',
      'pnpm ide:gate:verify-workbench-contract',
      'pnpm ide:gate:evidence-capsule-contract',
    ],
  },
  {
    surface: 'Design',
    workflow_step: 'Design',
    terms: ['design', 'canvas', 'wire', 'gate', 'circuit', 'schematic', 'inspect', 'palette'],
    docs: ['docs/ide/02-design.md', 'docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md'],
    code: [
      'packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx',
      'packages/rb-apps/src/apps/ide/components/DesignCanvas.tsx',
    ],
    tests: [
      'pnpm ide:gate:design-workbench-contract',
      'pnpm ide:gate:design-correctness-contract',
      'pnpm ide:gate:design-wire-interaction-contract',
    ],
  },
  {
    surface: 'Project',
    workflow_step: 'Project',
    terms: ['project', 'home', 'overview', 'status', 'continue', 'start', 'orientation'],
    docs: ['docs/ide/01-project.md', 'docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md'],
    code: [
      'packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx',
      'packages/rb-apps/src/apps/ide/projectHealth.ts',
    ],
    tests: [
      'pnpm ide:gate:project-overview-contract',
      'pnpm ide:gate:project-readiness-contract',
      'pnpm ide:gate:project-continue-cta-contract',
    ],
  },
  {
    surface: 'Import',
    workflow_step: 'Import utility',
    terms: ['import', 'zip', 'hdl', 'vhdl', 'verilog ingest'],
    docs: ['docs/ide/05-import.md', 'docs/product/RED_BYTE_CURRENT_TRUTH.md'],
    code: ['packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx'],
    tests: [
      'pnpm ide:gate:import-renders-schematic',
      'pnpm ide:gate:import-actionable-targets-contract',
      'pnpm ide:gate:zip-import-contract',
    ],
  },
  {
    surface: 'Examples / Labs',
    workflow_step: 'Project entry path',
    terms: ['example', 'examples', 'lab', 'classroom', 'starter', 'learning path', 'worksheet'],
    docs: ['docs/product/RED_BYTE_CURATED_LEARNING_PATH_SPEC.md', 'docs/product/RED_BYTE_STUDIO_PRODUCT_BRIEF.md'],
    code: [
      'packages/rb-apps/src/apps/ide/examplesCatalog.ts',
      'packages/rb-apps/src/apps/ide/labStarters.ts',
    ],
    tests: [
      'packages/rb-apps/src/apps/ide/__tests__/examplesCatalog.learningPath.test.ts',
      'pnpm ui:lab-starter-load-gate',
    ],
  },
  {
    surface: 'Product control',
    workflow_step: 'Whole product spine',
    terms: ['overbuilt', 'redesign', 'lost', 'meant', 'mess', 'toy', 'serious', 'workbench', 'workflow', 'original', 'drift', 'agent'],
    docs: [
      'docs/product/RED_BYTE_CURRENT_TRUTH.md',
      'docs/product/RED_BYTE_AGENT_CONTROL_LOOP.md',
      'docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md',
    ],
    code: ['scripts/rb-control-loop.mjs', 'scripts/rb-obsidian-memory.mjs'],
    tests: ['pnpm rb:control:test', 'pnpm rb:memory:test', 'pnpm rb:doc:validate'],
  },
];

const TYPE_RULES = [
  { type: 'workflow confusion', terms: ['confusing', 'confusion', 'two different', 'where', 'action', 'supposed', 'workflow', 'lost'] },
  { type: 'visual/professionalism issue', terms: ['sloppy', 'toy', 'baby', 'professional', 'serious', 'polish', 'mess', 'ugly', 'chrome'] },
  { type: 'proof/trust issue', terms: ['proof', 'trust', 'trusted', 'verify', 'pass', 'evidence', 'honest', 'claim'] },
  { type: 'overengineering issue', terms: ['overbuilt', 'elaborate', 'huge', 'redesign', 'too much', 'simple issue'] },
  { type: 'product-definition drift', terms: ['not what i meant', 'original', 'drift', 'toy', 'product', 'serious engineering'] },
  { type: 'stale docs/memory issue', terms: ['stale', 'memory', 'obsidian', 'old docs', 'queue', 'lost in translation'] },
  { type: 'test/evidence gap', terms: ['test', 'gate', 'prove', 'proof', 'evidence', 'validated'] },
  { type: 'scope creep', terms: ['scope', 'huge', 'redesign', 'everything', 'broad', 'elaborate'] },
  { type: 'classroom/lab overframing', terms: ['classroom', 'lab', 'worksheet', 'student toy', 'learning platform', 'baby'] },
  { type: 'app behavior bug', terms: ['bug', 'broken', 'repeats', 'duplicate', 'does not', "doesn't", 'fails'] },
  { type: 'UX friction', terms: ['feels wrong', 'i do not know', "i don't know", 'hard to', 'unclear', 'action'] },
];

const CORE_DOCS = [
  'AI_STATE.md',
  'docs/ACTIVE_WORK.md',
  'docs/product/RED_BYTE_CURRENT_TRUTH.md',
  'docs/product/RED_BYTE_AGENT_OPERATING_RULES.md',
  'docs/product/RED_BYTE_WORK_QUEUE.md',
  'docs/product/RED_BYTE_AGENT_CONTROL_LOOP.md',
  'docs/product/RED_BYTE_OBSIDIAN_MEMORY_BRIDGE.md',
  'docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md',
  'docs/product/RED_BYTE_STUDIO_PRODUCT_BRIEF.md',
  'docs/contracts/RedByte_Product_Contract.md',
  'docs/manuals/RedByte_Product_Manual.md',
  'docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md',
  'docs/IDE_PRODUCT_DEBT_REGISTER.md',
  'docs/IDE_SYSTEM_MAP.md',
  'docs/ide/00-ide-layout.md',
  'docs/ide/01-project.md',
  'docs/ide/02-design.md',
  'docs/ide/03-verify.md',
  'docs/ide/04-export.md',
  'docs/ide/05-import.md',
  'docs/ide/SURFACE_CONFORMANCE.md',
];

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'this',
  'with',
  'what',
  'when',
  'where',
  'from',
  'into',
  'like',
  'does',
  'not',
  'you',
  'are',
  'was',
  'were',
  'have',
  'has',
  'had',
  'but',
  'all',
  'any',
  'can',
  'should',
  'would',
  'could',
  'about',
  'after',
  'before',
  'same',
  'each',
  'every',
]);

function fail(message, details = []) {
  process.stderr.write(`\n[rb-problem] ERROR: ${message}\n`);
  for (const detail of details) {
    if (detail) process.stderr.write(`${detail}\n`);
  }
  process.stderr.write('\n');
  process.exit(1);
}

function info(message) {
  process.stdout.write(`[rb-problem] ${message}\n`);
}

function resolveRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    fail('rb-product-feedback must run inside the redbyte-ui git repository.');
  }
}

const ROOT = resolveRepoRoot();

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
      maxBuffer: 1024 * 1024 * 8,
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Git command failed: git ${command}`, [reason]);
  }
}

function run(command, { allowFailure = true, timeoutMs = 120000 } = {}) {
  try {
    return execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 12,
      timeout: timeoutMs,
    }).trim();
  } catch (error) {
    if (allowFailure) {
      const stdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout || '').trim() : '';
      const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr || '').trim() : '';
      return [stdout, stderr].filter(Boolean).join('\n').trim();
    }
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Command failed: ${command}`, [reason]);
  }
}

function readFile(rel, fallback = '') {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return fallback;
  return fs.readFileSync(abs, 'utf8');
}

function readJson(rel, fallback = undefined) {
  const text = readFile(rel, '');
  if (!text) {
    if (fallback !== undefined) return fallback;
    fail(`Missing JSON file: ${rel}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`Invalid JSON: ${rel}`, [error instanceof Error ? error.message : String(error)]);
  }
}

function loadConfig() {
  const example = readJson(CONFIG_EXAMPLE, DEFAULT_CONFIG);
  const privateConfig = fs.existsSync(path.join(ROOT, CONFIG_PRIVATE)) ? readJson(CONFIG_PRIVATE, {}) : {};
  return {
    ...DEFAULT_CONFIG,
    ...example,
    ...privateConfig,
  };
}

function isPathUnder(parent, child) {
  const parentAbs = path.resolve(ROOT, parent);
  const childAbs = path.resolve(ROOT, child);
  const rel = path.relative(parentAbs, childAbs);
  return rel === '' || (!(rel.startsWith('..') || path.isAbsolute(rel)));
}

function outputDir(config = loadConfig()) {
  return path.resolve(ROOT, config.outputDir || DEFAULT_CONFIG.outputDir);
}

function ensureOutputPath(absPath, config = loadConfig()) {
  const allowed = outputDir(config);
  const rel = path.relative(allowed, path.resolve(absPath));
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    fail('Refusing to write outside problem output directory.', [path.resolve(absPath), `Allowed: ${allowed}`]);
  }
}

function writeProblemFile(filename, content, config = loadConfig()) {
  const dest = path.join(outputDir(config), filename);
  ensureOutputPath(dest, config);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, 'utf8');
  return dest;
}

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z0-9]+(?:'[a-z0-9]+)?/g)
    ?.filter((term) => term.length > 2 && !STOP_WORDS.has(term)) || [];
}

function includesTerm(text, term) {
  return String(text || '').toLowerCase().includes(term.toLowerCase());
}

function scoreTerms(text, terms) {
  const lower = String(text || '').toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term.toLowerCase())) score += term.includes(' ') ? 3 : 1;
  }
  return score;
}

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

function mapFeedbackToSurfaces(rawFeedback) {
  const scored = SURFACE_RULES
    .map((rule) => ({ ...rule, score: scoreTerms(rawFeedback, rule.terms) }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score || a.surface.localeCompare(b.surface));
  if (!scored.length) {
    return [SURFACE_RULES.find((rule) => rule.surface === 'Product control')];
  }
  const topScore = scored[0].score;
  const top = scored.filter((rule) => rule.score >= Math.max(1, topScore - 1)).slice(0, 3);
  if (!top.some((rule) => rule.surface === 'Product control') && scoreTerms(rawFeedback, SURFACE_RULES.at(-1).terms) > 0) {
    top.push(SURFACE_RULES.at(-1));
  }
  return top;
}

function classifyFeedback(rawFeedback, config = DEFAULT_CONFIG) {
  const matched = TYPE_RULES
    .map((rule) => ({ type: rule.type, score: scoreTerms(rawFeedback, rule.terms) }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type))
    .map((rule) => rule.type);
  const allowed = config.allowedProblemTypes || DEFAULT_CONFIG.allowedProblemTypes;
  const result = uniq(matched.filter((type) => allowed.includes(type)));
  return result.length ? result : ['UX friction'];
}

function severityFor(rawFeedback, problemTypes) {
  const text = String(rawFeedback || '').toLowerCase();
  if (['broken', 'cannot', 'blocked', 'unsafe', 'trust', 'wrong proof'].some((term) => text.includes(term))) return 'high';
  if (problemTypes.includes('product-definition drift') || problemTypes.includes('overengineering issue')) return 'high';
  if (problemTypes.includes('visual/professionalism issue') || problemTypes.includes('workflow confusion')) return 'medium';
  return 'medium';
}

function loadClaims() {
  return readJson(CLAIMS_CONFIG, { claims: [] }).claims || [];
}

function claimScore(claim, rawFeedback, surfaces, problemTypes) {
  const text = [
    claim.id,
    claim.statement,
    claim.product_area,
    claim.stale_memory_risk,
    ...(claim.primary_source_docs || []),
  ].join(' ');
  let score = scoreTerms(rawFeedback, tokens(text));
  for (const surface of surfaces) {
    if (includesTerm(text, surface.surface) || includesTerm(text, surface.workflow_step)) score += 8;
  }
  if (problemTypes.includes('proof/trust issue') && /trust|verify|proof|export|hardware/i.test(text)) score += 6;
  if (problemTypes.includes('overengineering issue') && /trace|memory|agent|spine/i.test(text)) score += 4;
  if (problemTypes.includes('classroom/lab overframing') && /learning|import|workflow|vivado/i.test(text)) score += 4;
  return score;
}

function relatedClaims(rawFeedback, surfaces, problemTypes) {
  const productControlOnly = surfaces.length === 1 && surfaces[0]?.surface === 'Product control';
  const controlAreas = new Set(['workflow', 'traceability', 'agent-control', 'examples']);
  return loadClaims()
    .filter((claim) => !productControlOnly || controlAreas.has(claim.product_area))
    .map((claim) => ({ ...claim, score: claimScore(claim, rawFeedback, surfaces, problemTypes) }))
    .filter((claim) => claim.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((claim) => ({
      id: claim.id,
      statement: claim.statement,
      product_area: claim.product_area,
      expected_status: claim.current_expected_status,
      minimum_evidence_level: claim.minimum_evidence_level,
      stale_memory_risk: claim.stale_memory_risk,
    }));
}

function readMemoryChunks(limit = 3000) {
  const rel = MEMORY_INDEX;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  const chunks = [];
  const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines.slice(0, limit)) {
    try {
      chunks.push(JSON.parse(line));
    } catch {
      // Skip malformed generated rows; the memory test owns index integrity.
    }
  }
  return chunks;
}

function searchMemory(rawFeedback, surfaces, config = DEFAULT_CONFIG) {
  const queryTerms = uniq([
    ...tokens(rawFeedback),
    ...surfaces.flatMap((surface) => tokens(`${surface.surface} ${surface.workflow_step}`)),
  ]).filter((term) => term.length > 2);
  const max = Number(config.maxMemoryHits || DEFAULT_CONFIG.maxMemoryHits);
  const chunks = readMemoryChunks();
  const hits = chunks
    .map((chunk) => {
      const haystack = [chunk.source_path, chunk.source_role, chunk.title, chunk.heading_path, chunk.text].join(' ');
      const score = queryTerms.reduce((sum, term) => sum + (haystack.toLowerCase().includes(term) ? 1 : 0), 0);
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.chunk.source_path).localeCompare(String(b.chunk.source_path)))
    .slice(0, max)
    .map(({ chunk, score }) => ({
      source_type: chunk.source_type || 'unknown',
      source_path: chunk.source_path || 'unknown',
      source_role: chunk.source_role || 'unknown',
      title: chunk.title || '',
      heading_path: Array.isArray(chunk.heading_path) ? chunk.heading_path.join(' > ') : String(chunk.heading_path || ''),
      excerpt: excerpt(chunk.text || '', queryTerms),
      score,
    }));
  return hits;
}

function searchRepoDocs(rawFeedback, surfaces, max = 8) {
  const queryTerms = uniq([
    ...tokens(rawFeedback),
    ...surfaces.flatMap((surface) => tokens(`${surface.surface} ${surface.workflow_step}`)),
  ]);
  return CORE_DOCS
    .map((rel) => {
      const text = readFile(rel, '');
      const score = queryTerms.reduce((sum, term) => sum + (text.toLowerCase().includes(term) ? 1 : 0), 0);
      return { rel, text, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel))
    .slice(0, max)
    .map((item) => ({
      source_type: 'repo',
      source_path: item.rel,
      source_role: sourceRoleFor(item.rel),
      title: item.rel.split('/').at(-1),
      heading_path: '',
      excerpt: excerpt(item.text, queryTerms),
      score: item.score,
    }));
}

function sourceRoleFor(rel) {
  if (['AI_STATE.md', 'docs/ACTIVE_WORK.md'].includes(rel) || rel.includes('CURRENT_TRUTH') || rel.includes('WORK_QUEUE')) return 'current_truth';
  if (rel.includes('Product_Contract') || rel.includes('V1_RELEASE_SPEC') || rel.includes('STUDIO_PRODUCT_BRIEF')) return 'target_contract';
  if (rel.includes('/ide/') || rel.includes('IDE_')) return 'surface_spec';
  return 'unknown';
}

function excerpt(text, queryTerms) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  const lower = compact.toLowerCase();
  const first = queryTerms.map((term) => lower.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, first - 90);
  return compact.slice(start, start + 280);
}

function normalizeProblem(rawFeedback, surfaces, problemTypes) {
  const surfaceText = surfaces.map((surface) => surface.surface).join(' + ');
  const typeText = problemTypes.join(', ');
  return `Raw feedback indicates a ${typeText} affecting ${surfaceText}. Preserve the complaint as stated, identify the smallest testable product fix, and avoid turning it into a broad redesign.`;
}

function minimalFixOptions(rawFeedback, surfaces, problemTypes) {
  const primary = surfaces[0]?.surface || 'Product control';
  const options = [];
  if (primary === 'Export' && includesTerm(rawFeedback, 'heading')) {
    options.push('Inspect the Export surface copy hierarchy and remove only the duplicate or misleading heading if confirmed.');
  }
  if (primary === 'Map Pins / Hardware') {
    options.push('Clarify the single primary Map Pins action and separate pin binding from Verify proof without changing the whole workflow.');
  }
  if (problemTypes.includes('overengineering issue')) {
    options.push('Reduce the next implementation prompt to one symptom, one surface, one file cluster, and one proof gate.');
  }
  if (problemTypes.includes('visual/professionalism issue')) {
    options.push('Audit the affected surface for toy-like or sloppy language/chrome, then patch the smallest visible cause.');
  }
  if (problemTypes.includes('product-definition drift')) {
    options.push('Reconcile the issue against the product spine and current truth before changing UI behavior.');
  }
  options.push('If the issue is not reproducible from docs or a browser audit, create a narrow product-hardening ticket instead of coding.');
  return uniq(options).slice(0, 4);
}

function overengineeringRisks(rawFeedback, problemTypes) {
  const risks = [
    'Do not convert the complaint into a multi-surface redesign without a problem packet and explicit user approval.',
    'Do not add a new dashboard, tutor, lab flow, or autonomous agent to solve a focused product complaint.',
    'Do not let Obsidian memory override current repo truth or recent commits.',
  ];
  if (problemTypes.includes('overengineering issue') || includesTerm(rawFeedback, 'simple')) {
    risks.unshift('The primary risk is losing the original simple complaint while designing an elaborate replacement system.');
  }
  return uniq(risks);
}

function doNotBuild(problemTypes) {
  const items = [
    'Do not start product UI edits until intake, triage, and trace outputs exist.',
    'Do not rewrite Project -> Design -> Verify -> Map Pins / Hardware -> Export.',
    'Do not make examples/labs the product center.',
    'Do not claim trust or proof without cited tests/gates.',
    'Do not write to Obsidian automatically in v0.',
  ];
  if (problemTypes.includes('overengineering issue')) {
    items.unshift('Do not replace the simple complaint with a broad redesign or framework.');
  }
  return uniq(items);
}

function recommendedNextAction(problemTypes, surfaces) {
  if (problemTypes.includes('workflow confusion') || problemTypes.includes('visual/professionalism issue')) {
    return 'Run a focused browser/product audit of the affected surface, then implement the smallest verified fix with a matching gate.';
  }
  if (problemTypes.includes('overengineering issue')) {
    return 'Use the generated Codex prompt as the scope boundary before any implementation; reject broad redesign proposals.';
  }
  if (surfaces[0]?.surface === 'Product control') {
    return 'Reconcile the feedback against current truth, control-loop output, and Obsidian memory before choosing a product slice.';
  }
  return 'Confirm the issue against repo truth and existing tests, then implement only the smallest testable fix.';
}

function definitionOfDone(packetBase) {
  const tests = packetBase.related_tests_gates.length ? packetBase.related_tests_gates : ['pnpm rb:doc:validate'];
  return [
    'Raw feedback is preserved verbatim in the issue packet and commit notes.',
    'The fix addresses the normalized problem without widening scope to unrelated surfaces.',
    'Related product claims remain at or below their cited evidence level.',
    `Focused validation passes: ${tests.slice(0, 4).join('; ')}.`,
    'AI_STATE.md receives a concise factual change-log entry after meaningful implementation.',
    'Run `pnpm rb:memory:sync-plan` after implementation; do not write to Obsidian automatically.',
  ];
}

function codexPrompt(packetBase) {
  return [
    'You are Codex working in RedByte. Do not start from vibes.',
    '',
    `Raw feedback to preserve: "${packetBase.raw_feedback}"`,
    '',
    `Interpreted problem: ${packetBase.normalized_problem}`,
    `Affected surface: ${packetBase.product_surface.join(', ')}`,
    `Problem type: ${packetBase.problem_type.join(', ')}`,
    '',
    'Implement only after confirming intake, triage, and trace outputs. Use the likely files and tests below as a starting point, not permission for a broad rewrite.',
    '',
    `Likely files: ${packetBase.likely_code_files.join(', ') || 'none identified'}`,
    `Tests/gates: ${packetBase.related_tests_gates.join(', ') || 'none identified'}`,
    '',
    'Do not build:',
    ...packetBase.do_not_build.map((item) => `- ${item}`),
    '',
    'Definition of done:',
    ...definitionOfDone(packetBase).map((item) => `- ${item}`),
  ].join('\n');
}

function buildProblemPacket(rawFeedback, options = {}) {
  const config = options.config || DEFAULT_CONFIG;
  const exact = String(rawFeedback ?? '');
  if (!exact.trim()) fail('intake requires raw feedback text.');
  const surfaces = mapFeedbackToSurfaces(exact);
  const problemTypes = classifyFeedback(exact, config);
  const claims = relatedClaims(exact, surfaces, problemTypes);
  const docs = uniq([
    ...surfaces.flatMap((surface) => surface.docs),
    ...claims.flatMap((claim) => (loadClaims().find((candidate) => candidate.id === claim.id)?.primary_source_docs || [])),
  ]).slice(0, 12);
  const code = uniq(surfaces.flatMap((surface) => surface.code).concat(
    claims.flatMap((claim) => (loadClaims().find((candidate) => candidate.id === claim.id)?.likely_code_files || []))
  )).slice(0, Number(config.maxCodeFileHints || DEFAULT_CONFIG.maxCodeFileHints));
  const tests = uniq(surfaces.flatMap((surface) => surface.tests).concat(
    claims.flatMap((claim) => (loadClaims().find((candidate) => candidate.id === claim.id)?.expected_tests_gates || []))
  )).slice(0, 12);
  const memoryHits = options.memoryHits ?? searchMemory(exact, surfaces, config);
  const repoHits = options.repoHits ?? searchRepoDocs(exact, surfaces, 6);
  const evidenceSources = uniq([
    ...repoHits.map((hit) => `${hit.source_path} (${hit.source_role})`),
    ...memoryHits.map((hit) => `${hit.source_path} (${hit.source_role})`),
  ]).slice(0, 16);
  const staleRisks = uniq([
    ...claims.map((claim) => claim.stale_memory_risk),
    ...memoryHits.filter((hit) => hit.source_role === 'historical').map((hit) => `Historical memory hit may be stale: ${hit.source_path}`),
    'Generated problem packets are evidence candidates, not product truth.',
  ]);
  const base = {
    id: problemId(exact),
    raw_feedback: exact,
    normalized_problem: normalizeProblem(exact, surfaces, problemTypes),
    product_surface: surfaces.map((surface) => surface.surface),
    workflow_step: uniq(surfaces.map((surface) => surface.workflow_step)),
    problem_type: problemTypes,
    severity: severityFor(exact, problemTypes),
    evidence_sources: evidenceSources,
    related_claims: claims,
    related_docs: docs,
    likely_code_files: code,
    related_tests_gates: tests,
    obsidian_memory_hits: memoryHits.filter((hit) => hit.source_type === 'obsidian'),
    repo_memory_hits: memoryHits.filter((hit) => hit.source_type !== 'obsidian').concat(repoHits),
    stale_memory_risks: staleRisks,
    minimal_fix_options: minimalFixOptions(exact, surfaces, problemTypes),
    overengineering_risks: overengineeringRisks(exact, problemTypes),
    do_not_build: doNotBuild(problemTypes),
    recommended_next_action: recommendedNextAction(problemTypes, surfaces),
    definition_of_done: [],
    codex_execution_prompt: '',
    generated_at: new Date().toISOString(),
    source_priority: config.sourcePriority || DEFAULT_CONFIG.sourcePriority,
    obsidian_write_mode: false,
  };
  base.definition_of_done = definitionOfDone(base);
  base.codex_execution_prompt = codexPrompt(base);
  validateProblemPacket(base);
  return base;
}

function problemId(rawFeedback) {
  const hash = simpleHash(rawFeedback);
  const slug = tokens(rawFeedback).slice(0, 5).join('-') || 'feedback';
  return `rb-problem-${slug}-${hash}`;
}

function simpleHash(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).slice(0, 8);
}

function validateProblemPacket(packet) {
  const missing = REQUIRED_PROBLEM_KEYS.filter((key) => !(key in packet));
  if (missing.length) {
    throw new Error(`Problem packet missing required keys: ${missing.join(', ')}`);
  }
  if (typeof packet.raw_feedback !== 'string' || !packet.raw_feedback.trim()) {
    throw new Error('Problem packet raw_feedback must be a non-empty string.');
  }
  for (const key of [
    'product_surface',
    'workflow_step',
    'problem_type',
    'evidence_sources',
    'related_docs',
    'likely_code_files',
    'related_tests_gates',
    'minimal_fix_options',
    'overengineering_risks',
    'do_not_build',
    'definition_of_done',
  ]) {
    if (!Array.isArray(packet[key])) {
      throw new Error(`Problem packet ${key} must be an array.`);
    }
  }
  if (!packet.overengineering_risks.length) throw new Error('Problem packet must include overengineering risks.');
  if (!packet.do_not_build.length) throw new Error('Problem packet must include do_not_build.');
  if (!packet.definition_of_done.length) throw new Error('Problem packet must include definition_of_done.');
  return true;
}

async function tryOllamaStructuredPacket(packet, config = DEFAULT_CONFIG) {
  if (process.env.REDBYTE_PROBLEM_USE_OLLAMA === '0') {
    return { attempted: false, succeeded: false, reason: 'disabled by REDBYTE_PROBLEM_USE_OLLAMA=0' };
  }
  const model = await resolveOllamaModel();
  if (!model) return { attempted: true, succeeded: false, reason: 'no installed Ollama chat model found' };
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const compactPacket = compactForOllama(packet);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        messages: [
          {
            role: 'system',
            content: 'Return valid compact JSON for a RedByte problem packet. Preserve raw_feedback exactly. Do not broaden scope.',
          },
          {
            role: 'user',
            content: `Return exactly this JSON and nothing else:\n${JSON.stringify(compactPacket)}`,
          },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) return { attempted: true, succeeded: false, model, reason: `Ollama HTTP ${response.status}` };
    const json = await response.json();
    const content = json?.message?.content || '';
    const parsed = JSON.parse(content);
    validateProblemPacket(parsed);
    if (parsed.raw_feedback !== packet.raw_feedback) {
      return { attempted: true, succeeded: false, model, reason: 'model changed raw_feedback' };
    }
    return { attempted: true, succeeded: true, model, packet: { ...packet, ...parsed } };
  } catch (error) {
    clearTimeout(timeout);
    return {
      attempted: true,
      succeeded: false,
      model,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function compactForOllama(packet) {
  return {
    raw_feedback: packet.raw_feedback,
    normalized_problem: packet.normalized_problem,
    product_surface: packet.product_surface,
    workflow_step: packet.workflow_step,
    problem_type: packet.problem_type,
    severity: packet.severity,
    evidence_sources: packet.evidence_sources.slice(0, 1),
    related_claims: packet.related_claims.map((claim) => claim.id).slice(0, 1),
    related_docs: packet.related_docs.slice(0, 1),
    likely_code_files: packet.likely_code_files.slice(0, 1),
    related_tests_gates: packet.related_tests_gates.slice(0, 1),
    obsidian_memory_hits: packet.obsidian_memory_hits.map((hit) => hit.source_path).slice(0, 1),
    stale_memory_risks: packet.stale_memory_risks.slice(0, 1),
    minimal_fix_options: packet.minimal_fix_options.slice(0, 1),
    overengineering_risks: packet.overengineering_risks.slice(0, 1),
    do_not_build: packet.do_not_build.slice(0, 1),
    recommended_next_action: packet.recommended_next_action,
    definition_of_done: packet.definition_of_done.slice(0, 1),
    codex_execution_prompt: 'Do not broaden scope.',
  };
}

async function resolveOllamaModel() {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`);
    if (!response.ok) return '';
    const tags = await response.json();
    const names = (tags.models || []).map((model) => model.name).filter(Boolean);
    const preferred = [
      process.env.REDBYTE_AGENT_MODEL,
      'qwen2.5-coder:1.5b',
      'qwen2.5-coder:3b',
      'qwen2.5:3b',
    ].filter(Boolean);
    return preferred.find((name) => names.includes(name)) || names[0] || '';
  } catch {
    return '';
  }
}

function markdownFromPacket(packet, meta = {}) {
  const lines = [
    '# RedByte Product Problem Packet',
    '',
    `- ID: ${packet.id}`,
    `- Generated: ${packet.generated_at}`,
    `- Ollama structured JSON: ${meta.ollama?.succeeded ? `succeeded (${meta.ollama.model})` : meta.ollama?.attempted ? `fallback (${meta.ollama.reason || 'unknown'})` : 'not attempted'}`,
    `- Obsidian writes: ${packet.obsidian_write_mode ? 'enabled' : 'disabled'}`,
    '',
    '## Raw Feedback',
    '',
    packet.raw_feedback,
    '',
    '## Interpreted Product Problem',
    '',
    packet.normalized_problem,
    '',
    '## Classification',
    '',
    `- Product surface: ${packet.product_surface.join(', ')}`,
    `- Workflow step: ${packet.workflow_step.join(', ')}`,
    `- Problem type: ${packet.problem_type.join(', ')}`,
    `- Severity: ${packet.severity}`,
    '',
    '## Evidence Sources',
    '',
    list(packet.evidence_sources),
    '',
    '## Related Claims',
    '',
    packet.related_claims.length
      ? packet.related_claims.map((claim) => `- ${claim.id}: ${claim.statement} (minimum ${claim.minimum_evidence_level})`).join('\n')
      : '- none',
    '',
    '## Related Docs',
    '',
    list(packet.related_docs),
    '',
    '## Likely Code Files',
    '',
    list(packet.likely_code_files),
    '',
    '## Related Tests / Gates',
    '',
    list(packet.related_tests_gates),
    '',
    '## Obsidian Memory Hits',
    '',
    packet.obsidian_memory_hits.length ? packet.obsidian_memory_hits.map(formatHit).join('\n') : '- none',
    '',
    '## Stale Memory Risks',
    '',
    list(packet.stale_memory_risks),
    '',
    '## Minimal Fix Options',
    '',
    list(packet.minimal_fix_options),
    '',
    '## Overengineering Risks',
    '',
    list(packet.overengineering_risks),
    '',
    '## Do Not Build',
    '',
    list(packet.do_not_build),
    '',
    '## Recommended Next Action',
    '',
    packet.recommended_next_action,
    '',
    '## Definition Of Done',
    '',
    list(packet.definition_of_done),
    '',
    '## Codex Execution Prompt',
    '',
    '```text',
    packet.codex_execution_prompt,
    '```',
    '',
  ];
  return lines.join('\n');
}

function list(items) {
  return items?.length ? items.map((item) => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n') : '- none';
}

function formatHit(hit) {
  return `- ${hit.source_path} (${hit.source_role}, score ${hit.score}): ${hit.excerpt}`;
}

function latestPacket(config = loadConfig()) {
  const rel = path.join(config.outputDir || DEFAULT_CONFIG.outputDir, 'problem-latest.json');
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail('No latest problem packet found. Run `pnpm rb:problem:intake -- "raw feedback"` first.');
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function buildTriage(packet) {
  const decisions = [];
  if (packet.problem_type.includes('visual/professionalism issue') || packet.problem_type.includes('UX friction')) {
    decisions.push('needs browser audit');
  }
  if (!packet.likely_code_files.length || packet.product_surface.includes('Product control')) {
    decisions.push('needs doc/control reconciliation');
  }
  if (packet.raw_feedback.toLowerCase().includes('board') || packet.raw_feedback.toLowerCase().includes('basys')) {
    decisions.push('may be blocked by hardware/manual evidence');
  }
  if (packet.evidence_sources.some((source) => /DEBT|WORK_QUEUE|ACTIVE_WORK/i.test(source))) {
    decisions.push('possibly known debt');
  }
  if (!decisions.length) decisions.push('implement now after focused reproduction');
  return {
    packet_id: packet.id,
    raw_feedback: packet.raw_feedback,
    decision: decisions,
    rationale: [
      `Surface: ${packet.product_surface.join(', ')}`,
      `Problem type: ${packet.problem_type.join(', ')}`,
      `Severity: ${packet.severity}`,
    ],
    next_step: decisions.includes('needs browser audit')
      ? 'Audit the affected surface before coding; capture exact symptom and focused gate.'
      : packet.recommended_next_action,
  };
}

function markdownFromTriage(triage) {
  return [
    '# RedByte Problem Triage',
    '',
    `- Packet: ${triage.packet_id}`,
    '',
    '## Raw Feedback',
    '',
    triage.raw_feedback,
    '',
    '## Decision',
    '',
    list(triage.decision),
    '',
    '## Rationale',
    '',
    list(triage.rationale),
    '',
    '## Next Step',
    '',
    triage.next_step,
    '',
  ].join('\n');
}

function evidenceStatusForClaim(claim) {
  const docsFound = (claim.primary_source_docs || []).filter((rel) => fs.existsSync(path.join(ROOT, rel)));
  const codeFound = (claim.likely_code_files || []).filter((rel) => fs.existsSync(path.join(ROOT, rel)));
  const testsFound = (claim.expected_tests_gates || []).filter((item) => item.startsWith('pnpm ') || fs.existsSync(path.join(ROOT, item)));
  let status = 'unknown';
  if (docsFound.length && codeFound.length && testsFound.length) status = 'partially proven';
  if (testsFound.some((item) => item.includes('ide:gate') || item.includes('tests/e2e'))) status = 'proven';
  if (docsFound.length && !codeFound.length && !testsFound.length) status = 'documented only';
  return {
    id: claim.id,
    statement: claim.statement,
    status,
    docs_found: docsFound,
    code_found: codeFound,
    tests_found: testsFound,
    minimum_evidence_level: claim.minimum_evidence_level,
    stale_memory_risk: claim.stale_memory_risk,
  };
}

function buildProblemTrace(packet) {
  const claims = loadClaims();
  const relatedIds = new Set(packet.related_claims.map((claim) => claim.id));
  const related = claims.filter((claim) => relatedIds.has(claim.id)).map(evidenceStatusForClaim);
  return {
    packet_id: packet.id,
    raw_feedback: packet.raw_feedback,
    related_claims: related,
    likely_code_files: packet.likely_code_files,
    related_tests_gates: packet.related_tests_gates,
    missing_evidence: related
      .filter((claim) => claim.status !== 'proven')
      .map((claim) => `${claim.id}: verify code/test evidence before claiming full product proof.`),
  };
}

function markdownFromTrace(trace) {
  const lines = [
    '# RedByte Problem Trace',
    '',
    `- Packet: ${trace.packet_id}`,
    '',
    '## Raw Feedback',
    '',
    trace.raw_feedback,
    '',
    '## Related Product Claims',
    '',
  ];
  if (!trace.related_claims.length) {
    lines.push('- none');
  } else {
    for (const claim of trace.related_claims) {
      lines.push(`- ${claim.id}: ${claim.statement}`);
      lines.push(`  Status: ${claim.status}; minimum evidence: ${claim.minimum_evidence_level}`);
      lines.push(`  Tests/gates: ${claim.tests_found.join(', ') || 'none'}`);
    }
  }
  lines.push('', '## Likely Code Files', '', list(trace.likely_code_files));
  lines.push('', '## Tests / Gates', '', list(trace.related_tests_gates));
  lines.push('', '## Missing Evidence', '', list(trace.missing_evidence));
  lines.push('');
  return lines.join('\n');
}

function markdownFromExecutionPrompt(packet) {
  return [
    '# RedByte Problem Codex Prompt',
    '',
    'Use this exact prompt for the implementation agent after intake, triage, and trace are complete.',
    '',
    '```text',
    packet.codex_execution_prompt,
    '```',
    '',
  ].join('\n');
}

function markdownFromClose(packet) {
  return [
    '# RedByte Problem Closeout Checklist',
    '',
    `- Packet: ${packet.id}`,
    '',
    '## Required Closeout',
    '',
    '- Confirm the raw feedback was preserved through implementation and commit notes.',
    '- Run the tests/gates listed in the problem packet or explain any skipped command.',
    '- Add a concise AI_STATE.md change-log entry for meaningful changes.',
    '- Update relevant product/surface docs only if behavior or claim evidence changed.',
    '- Run `pnpm rb:memory:sync-plan` and apply Obsidian updates manually only after authorization.',
    '- Do not claim generated problem outputs are canonical product truth.',
    '',
    '## Claim Evidence Update',
    '',
    list(packet.related_claims.map((claim) => `${claim.id}: keep claim at or below ${claim.minimum_evidence_level}`)),
    '',
  ].join('\n');
}

function rawFeedbackFromArgs(args) {
  const separator = args.indexOf('--');
  const parts = separator >= 0 ? args.slice(separator + 1) : args;
  return parts.join(' ').trim();
}

async function cmdDoctor() {
  const config = loadConfig();
  const checks = [];
  const add = (ok, label, detail = '') => checks.push({ ok, label, detail });
  add(fs.existsSync(path.join(ROOT, CONFIG_EXAMPLE)), 'problem config.example exists', CONFIG_EXAMPLE);
  add(fs.existsSync(path.join(ROOT, 'scripts/rb-obsidian-memory.mjs')), 'memory bridge script exists', 'scripts/rb-obsidian-memory.mjs');
  add(fs.existsSync(path.join(ROOT, 'scripts/rb-control-loop.mjs')), 'control loop script exists', 'scripts/rb-control-loop.mjs');
  add(config.allowObsidianWrites === false, 'Obsidian write mode disabled', `allowObsidianWrites=${config.allowObsidianWrites}`);
  add(config.requireTraceability === true, 'traceability required', `requireTraceability=${config.requireTraceability}`);
  add(config.requireDefinitionOfDone === true, 'definition of done required', `requireDefinitionOfDone=${config.requireDefinitionOfDone}`);
  const outProbe = path.join(config.outputDir || DEFAULT_CONFIG.outputDir, '.probe');
  add(isPathUnder(config.outputDir || DEFAULT_CONFIG.outputDir, outProbe), 'problem output path stays under configured outputDir', config.outputDir);
  const ignored = git(`check-ignore ${quotePath(config.outputDir || DEFAULT_CONFIG.outputDir)}`, { allowFailure: true });
  add(Boolean(ignored), 'problem output dir is gitignored', ignored || 'not ignored');
  const status = git('status --short', { allowFailure: true });
  const dirtyProduct = status.split(/\r?\n/).filter((line) => /\s(packages\/rb-apps\/src|apps\/|packages\/rb-logic|packages\/rb-fpga)/.test(line));
  add(dirtyProduct.length === 0, 'no product UI/code files dirty', dirtyProduct.join('; '));
  const model = await resolveOllamaModel();
  add(Boolean(model), 'Ollama chat model available or deterministic fallback usable', model || 'no model found; intake remains deterministic');
  for (const check of checks) {
    info(`${check.ok ? '[ok]' : '[warn]'} ${check.label}${check.detail ? ` - ${check.detail}` : ''}`);
  }
  const hardFailures = checks.filter((check) => !check.ok && !/Ollama/.test(check.label));
  if (hardFailures.length) process.exitCode = 1;
}

function quotePath(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

async function cmdIntake(args) {
  const config = loadConfig();
  const raw = rawFeedbackFromArgs(args);
  if (!raw) fail('Usage: pnpm rb:problem:intake -- "raw feedback text"');
  const deterministic = buildProblemPacket(raw, { config });
  const ollama = await tryOllamaStructuredPacket(deterministic, config);
  const packet = {
    ...deterministic,
    ollama_structured_json: {
      attempted: Boolean(ollama.attempted),
      succeeded: Boolean(ollama.succeeded),
      model: ollama.model || '',
      note: ollama.succeeded
        ? 'Structured JSON validation succeeded; deterministic packet kept as the scope lock.'
        : ollama.reason || '',
    },
  };
  validateProblemPacket(packet);
  const jsonPath = writeProblemFile('problem-latest.json', `${JSON.stringify(packet, null, 2)}\n`, config);
  const mdPath = writeProblemFile('problem-latest.md', markdownFromPacket(packet, { ollama }), config);
  if (ollama.attempted && !ollama.succeeded) {
    writeProblemFile('problem-ollama-debug-latest.json', `${JSON.stringify(ollama, null, 2)}\n`, config);
  }
  info(`[ok] JSON written: ${relFromRoot(jsonPath)}`);
  info(`[ok] Markdown written: ${relFromRoot(mdPath)}`);
  if (ollama.attempted && !ollama.succeeded) info(`[warn] Ollama structured JSON fallback used: ${ollama.reason}`);
  process.stdout.write(`${markdownFromPacket(packet, { ollama })}\n`);
}

function cmdTriage() {
  const config = loadConfig();
  const packet = latestPacket(config);
  const triage = buildTriage(packet);
  const mdPath = writeProblemFile('problem-triage-latest.md', markdownFromTriage(triage), config);
  info(`[ok] Markdown written: ${relFromRoot(mdPath)}`);
  process.stdout.write(`${markdownFromTriage(triage)}\n`);
}

function cmdTrace() {
  const config = loadConfig();
  const packet = latestPacket(config);
  const trace = buildProblemTrace(packet);
  const mdPath = writeProblemFile('problem-trace-latest.md', markdownFromTrace(trace), config);
  info(`[ok] Markdown written: ${relFromRoot(mdPath)}`);
  process.stdout.write(`${markdownFromTrace(trace)}\n`);
}

function cmdPrompt() {
  const config = loadConfig();
  const packet = latestPacket(config);
  const triage = path.join(outputDir(config), 'problem-triage-latest.md');
  const trace = path.join(outputDir(config), 'problem-trace-latest.md');
  if (!fs.existsSync(triage) || !fs.existsSync(trace)) {
    fail('Prompt requires intake + triage + trace. Run `pnpm rb:problem:triage` and `pnpm rb:problem:trace` first.');
  }
  const md = markdownFromExecutionPrompt(packet);
  const mdPath = writeProblemFile('problem-codex-prompt-latest.md', md, config);
  info(`[ok] Markdown written: ${relFromRoot(mdPath)}`);
  process.stdout.write(`${md}\n`);
}

function cmdClose() {
  const config = loadConfig();
  const packet = latestPacket(config);
  const md = markdownFromClose(packet);
  const mdPath = writeProblemFile('problem-close-latest.md', md, config);
  info(`[ok] Markdown written: ${relFromRoot(mdPath)}`);
  process.stdout.write(`${md}\n`);
}

function usage() {
  process.stdout.write(
    '\nRedByte Product Problem Intake Loop\n\n' +
    'Usage:\n' +
    '  pnpm rb:problem:doctor\n' +
    '  pnpm rb:problem:intake -- "raw feedback text"\n' +
    '  pnpm rb:problem:triage\n' +
    '  pnpm rb:problem:trace\n' +
    '  pnpm rb:problem:prompt\n' +
    '  pnpm rb:problem:close\n\n'
  );
}

const COMMANDS = {
  doctor: cmdDoctor,
  intake: cmdIntake,
  triage: cmdTriage,
  trace: cmdTrace,
  prompt: cmdPrompt,
  close: cmdClose,
};

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const command = process.argv[2];
  if (!command || !COMMANDS[command]) {
    usage();
    process.exit(command ? 1 : 0);
  }
  await COMMANDS[command](process.argv.slice(3));
}

export {
  buildProblemPacket,
  buildProblemTrace,
  buildTriage,
  classifyFeedback,
  DEFAULT_CONFIG,
  doNotBuild,
  isPathUnder,
  mapFeedbackToSurfaces,
  markdownFromExecutionPrompt,
  minimalFixOptions,
  overengineeringRisks,
  REQUIRED_PROBLEM_KEYS,
  validateProblemPacket,
};
