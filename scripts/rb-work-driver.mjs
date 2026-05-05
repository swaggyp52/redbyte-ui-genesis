import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

function fail(message, details = []) {
  process.stderr.write(`${message}\n`);
  for (const detail of details) {
    if (detail) {
      process.stderr.write(`${detail}\n`);
    }
  }
  process.exit(1);
}

function resolveRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail('rb-work-driver must run inside a git repository.', [
      `Current directory: ${process.cwd()}`,
      reason,
    ]);
  }
}

const ROOT = resolveRepoRoot();
const OUTPUT_DIR = path.join(ROOT, '.redbyte', 'work');
const NEXT_PACKET = path.join(OUTPUT_DIR, 'NEXT_WORK_PACKET.md');
const HANDOFF_DRAFT = path.join(OUTPUT_DIR, 'HANDOFF_DRAFT.md');
const HANDOFF_NOTES_MARKER = '<!-- HANDOFF_NOTES -->';

const DOCS = {
  aiState: 'AI_STATE.md',
  activeWork: 'docs/ACTIVE_WORK.md',
  releaseReadiness: 'docs/STUDENT_RELEASE_READINESS.md',
  manual: 'docs/manuals/RedByte_Product_Manual.md',
  contract: 'docs/contracts/RedByte_Product_Contract.md',
  aiUsageRules: 'docs/ai-usage-rules.md',
  currentTruth: 'docs/product/RED_BYTE_CURRENT_TRUTH.md',
  agentRules: 'docs/product/RED_BYTE_AGENT_OPERATING_RULES.md',
  workQueue: 'docs/product/RED_BYTE_WORK_QUEUE.md',
  obsidianSync: 'docs/product/RED_BYTE_OBSIDIAN_SYNC_RULES.md',
  flowModel: 'docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md',
  projectSpec: 'docs/ide/01-project.md',
  exportSpec: 'docs/ide/04-export.md',
  debtRegister: 'docs/IDE_PRODUCT_DEBT_REGISTER.md',
};

const STATUS_DOCS = [
  DOCS.aiState,
  DOCS.activeWork,
  DOCS.releaseReadiness,
  DOCS.manual,
  DOCS.contract,
  DOCS.currentTruth,
  DOCS.agentRules,
  DOCS.workQueue,
  DOCS.obsidianSync,
];

const PROFILE_MAP = {
  reconcile: {
    key: 'reconcile',
    title: 'Reconcile dirty or concurrent working tree',
    commitMessage: 'chore(repo): reconcile current RedByte worktree slice',
    requiredDocs: [
      DOCS.aiState,
      DOCS.activeWork,
      DOCS.currentTruth,
      DOCS.agentRules,
      DOCS.aiUsageRules,
      DOCS.obsidianSync,
    ],
    allowedPatterns: [
      'Only files already present in `git status` after explicit slice coordination.',
      'Repo coordination files when needed for the slice: AI_STATE.md, docs/ACTIVE_WORK.md, docs/product/*.md, package.json, scripts/*.mjs',
      'Read-only review of current dirty files before staging anything.',
    ],
    forbiddenPatterns: [
      'Do not start new product-surface work while unrelated dirty files remain unresolved.',
      'Do not edit Obsidian files unless this is the explicit bookkeeping slice.',
      'Do not touch services/redbyte-intelligence or external integrations for this coordination step.',
      'Do not push.',
    ],
    validationCommands: [
      'git status --short',
      'git diff --stat',
      'git diff --check -- <intended files>',
    ],
    doneCriteria: [
      'The intended slice is isolated from unrelated dirty files.',
      'Only the files for the active slice are staged or edited.',
      'The next implementation packet can be generated without guessing through concurrent work.',
    ],
    handoffRequirements: [
      'Record the isolation outcome in AI_STATE.md if a meaningful coordination slice lands.',
      'Mention any skipped Session Log update if the log is already dirty.',
      'State the exact next implementation slice once the worktree is safely isolated.',
    ],
    promptFocus: 'Reconcile the dirty tree and isolate one bounded RedByte slice without touching unrelated concurrent work.',
  },
  fp1: {
    key: 'fp1',
    title: 'Project F-P1 next-action semantics',
    commitMessage: 'ide(project): fix next-action semantics',
    requiredDocs: [
      DOCS.aiState,
      DOCS.activeWork,
      DOCS.currentTruth,
      DOCS.agentRules,
      DOCS.flowModel,
      DOCS.projectSpec,
      DOCS.debtRegister,
    ],
    allowedPatterns: [
      'packages/rb-apps/src/apps/ide/**/*',
      'tests/e2e/ide-surface-baselines.spec.ts',
      'docs/ide/01-project.md',
      'AI_STATE.md',
    ],
    forbiddenPatterns: [
      'Do not edit Verify, Hardware, or Export surface behavior in this slice.',
      'Do not touch Obsidian files unless the current slice explicitly requires a clean handoff note.',
      'Do not broaden into website, examples, or pilot work.',
      'Do not push.',
    ],
    validationCommands: [
      'pnpm ide:gate:project-overview-contract',
      'pnpm ide:gate:project-readiness-contract',
      'pnpm ide:gate:project-continue-cta-contract',
      'pnpm --filter @redbyte/playground build',
    ],
    doneCriteria: [
      'Project next-action headline, status framing, and CTA tell one story.',
      'Focused Project gates pass.',
      'The change is isolated to Project-surface semantics and supporting docs.',
    ],
    handoffRequirements: [
      'Add a factual AI_STATE.md change log entry.',
      'Update docs/ide/01-project.md if the user-visible Project behavior changes materially.',
      'If Session Log remains dirty from another slice, mention the skipped update in the closeout summary.',
    ],
    promptFocus: 'Fix the Project next-action semantics without broad UX rewrites or unrelated surface work.',
  },
  proof: {
    key: 'proof',
    title: 'Finish honest proof closure',
    commitMessage: 'docs(release): close current RedByte proof gap',
    requiredDocs: [
      DOCS.aiState,
      DOCS.activeWork,
      DOCS.releaseReadiness,
      DOCS.currentTruth,
      DOCS.agentRules,
    ],
    allowedPatterns: [
      'docs/STUDENT_RELEASE_READINESS.md',
      'docs/release/**/*',
      'AI_STATE.md',
      'out/vivado-cert/**/* when generated locally for proof capture',
    ],
    forbiddenPatterns: [
      'Do not change product UI or surface code in a proof-closure slice.',
      'Do not broaden public claims beyond the matrix evidence.',
      'Do not push.',
    ],
    validationCommands: [
      'pnpm rb:doc:validate',
      'git diff --check -- <proof files>',
    ],
    doneCriteria: [
      'Evidence paths are captured and honest.',
      'Release-readiness truth matches the proof matrix.',
      'No unsupported public claims are introduced.',
    ],
    handoffRequirements: [
      'Update AI_STATE.md with the new proof slice.',
      'Update STUDENT_RELEASE_READINESS and the relevant proof docs together.',
      'Record the next proof gap still open.',
    ],
    promptFocus: 'Close one proof gap honestly and update the release truth without touching product surfaces.',
  },
  exportTrust: {
    key: 'exportTrust',
    title: 'Export F-E1 / F-E2 trust language',
    commitMessage: 'ide(export): tighten trust language',
    requiredDocs: [
      DOCS.aiState,
      DOCS.activeWork,
      DOCS.currentTruth,
      DOCS.agentRules,
      DOCS.flowModel,
      DOCS.exportSpec,
      DOCS.debtRegister,
    ],
    allowedPatterns: [
      'packages/rb-apps/src/apps/ide/**/*',
      'docs/ide/04-export.md',
      'AI_STATE.md',
    ],
    forbiddenPatterns: [
      'Do not alter proof policy or board-clock semantics in this slice.',
      'Do not broaden into Hardware or Project UX cleanup.',
      'Do not push.',
    ],
    validationCommands: [
      'pnpm ide:gate:export-summary-contract',
      'pnpm ide:gate:export-ready-contract',
      'pnpm --filter @redbyte/playground build',
    ],
    doneCriteria: [
      'Export presents one primary trust story and one primary fix path.',
      'Focused export gates pass.',
      'Only Export trust-language files are touched.',
    ],
    handoffRequirements: [
      'Update AI_STATE.md with the bounded export-language slice.',
      'Update docs/ide/04-export.md if the UI semantics changed.',
      'State the next queued follow-up after Export trust language.',
    ],
    promptFocus: 'Tighten Export trust language without changing export pipeline semantics or touching unrelated surfaces.',
  },
  hardwareTrust: {
    key: 'hardwareTrust',
    title: 'Map Pins F-H2 / F-H3 trust language',
    commitMessage: 'ide(hardware): tighten mapping trust language',
    requiredDocs: [
      DOCS.aiState,
      DOCS.activeWork,
      DOCS.currentTruth,
      DOCS.agentRules,
      DOCS.flowModel,
      DOCS.exportSpec,
      DOCS.debtRegister,
    ],
    allowedPatterns: [
      'packages/rb-apps/src/apps/ide/**/*',
      'AI_STATE.md',
    ],
    forbiddenPatterns: [
      'Do not alter Verify or Export runtime semantics in this slice.',
      'Do not broaden into website, examples, or pilot work.',
      'Do not push.',
    ],
    validationCommands: [
      'pnpm ide:gate:hardware-checklist-contract',
      'pnpm ide:gate:student-loop-contract',
      'pnpm --filter @redbyte/playground build',
    ],
    doneCriteria: [
      'Complete mappings no longer show stale guidance.',
      'The remaining review state explains the real fix path.',
      'Focused hardware gates pass.',
    ],
    handoffRequirements: [
      'Update AI_STATE.md with the bounded hardware-language slice.',
      'Update the relevant surface spec if the user-facing hardware semantics changed.',
      'Record the next queued slice after Hardware trust language.',
    ],
    promptFocus: 'Tighten the Map Pins trust language without changing hardware/export runtime semantics.',
  },
  docs: {
    key: 'docs',
    title: 'Curate current RedByte docs truth',
    commitMessage: 'docs(redbyte): update current truth layer',
    requiredDocs: [
      DOCS.aiState,
      DOCS.activeWork,
      DOCS.currentTruth,
      DOCS.agentRules,
      DOCS.obsidianSync,
    ],
    allowedPatterns: [
      'docs/**/*.md',
      'AI_STATE.md',
      'scripts/*.mjs when the docs driver itself changes',
    ],
    forbiddenPatterns: [
      'Do not change product UI in a docs-only slice.',
      'Do not touch Obsidian files unless the slice explicitly requires it.',
      'Do not push.',
    ],
    validationCommands: [
      'pnpm rb:doc:validate',
      'git diff --check -- <touched docs>',
    ],
    doneCriteria: [
      'Docs reflect current truth without reopening stale roadmap work.',
      'Documentation validation passes.',
      'The diff stays bounded to the intended docs slice.',
    ],
    handoffRequirements: [
      'Update AI_STATE.md with the docs slice.',
      'Mention any intentionally skipped Session Log update when the log is already dirty.',
      'Record the next concrete implementation slice.',
    ],
    promptFocus: 'Update the RedByte truth layer without changing product behavior or pulling in stale roadmap work.',
  },
};

function git(command, { allowFailure = false } = {}) {
  try {
    return execSync(`git ${command}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return '';
    }

    const stderr = error && typeof error === 'object' && 'stderr' in error
      ? String(error.stderr || '').trim()
      : '';
    const reason = stderr || (error instanceof Error ? error.message : String(error));
    fail(`Git command failed: git ${command}`, [reason]);
  }
}

function readDoc(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    return { exists: false, content: '' };
  }

  try {
    return { exists: true, content: fs.readFileSync(fullPath, 'utf8') };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Failed to read ${relativePath}`, [reason]);
  }
}

function escRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function section(content, heading) {
  const regex = new RegExp(`## ${escRe(heading)}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function tableRows(markdown) {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('|') && !line.includes('---'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}

function parseQueueItems(markdown) {
  const queueSection = section(markdown, 'Queue');
  const rows = tableRows(queueSection);

  return rows
    .filter((row) => /^\d+$/.test(row[0] || ''))
    .map((row) => ({
      number: Number(row[0]),
      slice: row[1],
      why: row[2],
      sourceDocs: row[3],
      expectedCommitType: row[4],
      doneCriteria: row[5],
    }));
}

function parseNumberedList(markdown, heading) {
  const content = section(markdown, heading);
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line))
    .map((line) => line.replace(/^\d+\.\s*/, '').trim());
}

function firstParagraph(markdown, heading) {
  const content = section(markdown, heading);
  if (!content) {
    return '';
  }

  const paragraphs = content.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  return paragraphs[0] || '';
}

function listItems(markdown, heading) {
  return section(markdown, heading)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

function timestamp() {
  const value = new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  const seconds = String(value.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function workingTreeLines() {
  return git('status --short')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
}

function workingTreeSummary(lines) {
  if (lines.length === 0) {
    return 'clean';
  }

  return `${lines.length} uncommitted path(s)`;
}

function latestCommitHash() {
  return git('rev-parse --short HEAD') || 'unknown';
}

function currentBranch() {
  return git('rev-parse --abbrev-ref HEAD') || 'unknown';
}

function normalizeInlineCode(value) {
  return value.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
}

function normalizeGitPath(value) {
  return value.replace(/^"|"$/g, '').replace(/\\"/g, '"');
}

function resolveProfile(recommendedItem) {
  const text = `${recommendedItem.slice} ${recommendedItem.why}`.toLowerCase();

  if (recommendedItem.number === 1 || text.includes('dirty') || text.includes('concurrent')) {
    return PROFILE_MAP.reconcile;
  }
  if (text.includes('f-p1') || text.includes('project')) {
    return PROFILE_MAP.fp1;
  }
  if (text.includes('proof closure') || text.includes('certification')) {
    return PROFILE_MAP.proof;
  }
  if (text.includes('f-e1') || text.includes('f-e2') || text.includes('export')) {
    return PROFILE_MAP.exportTrust;
  }
  if (text.includes('f-h2') || text.includes('f-h3') || text.includes('map pins') || text.includes('hardware')) {
    return PROFILE_MAP.hardwareTrust;
  }

  return PROFILE_MAP.docs;
}

function buildDirtyFilePatterns(lines) {
  if (lines.length === 0) {
    return [];
  }

  return lines.map((line) => {
    const pathPart = line.slice(3).trim();
    return normalizeGitPath(pathPart || line);
  });
}

function buildContext() {
  const docs = Object.fromEntries(
    Object.entries(DOCS).map(([key, relativePath]) => [key, { path: relativePath, ...readDoc(relativePath) }]),
  );

  const queueItems = parseQueueItems(docs.workQueue.content);
  const defaultNextMoves = parseNumberedList(docs.currentTruth.content, '6. Default next move after this control pass');
  const dirtyLines = workingTreeLines();
  const dirtyFiles = buildDirtyFilePatterns(dirtyLines);
  const criticalDocs = missingCriticalDocs(docs);

  let recommendedItem = queueItems[0] || {
    number: 0,
    slice: 'No queue item found',
    why: 'The work queue could not be parsed from docs/product/RED_BYTE_WORK_QUEUE.md.',
    sourceDocs: DOCS.workQueue,
    expectedCommitType: 'n/a',
    doneCriteria: 'Restore the work queue doc before using the driver.',
  };

  if (dirtyLines.length === 0 && defaultNextMoves.length > 0) {
    const nextMove = defaultNextMoves[0];
    const matchingQueueItem = queueItems.find((item) => item.slice.toLowerCase().includes(nextMove.toLowerCase()));
    if (matchingQueueItem) {
      recommendedItem = matchingQueueItem;
    } else {
      recommendedItem = {
        number: 0,
        slice: nextMove,
        why: 'Pulled from RED_BYTE_CURRENT_TRUTH.md default next move after the control pass.',
        sourceDocs: DOCS.currentTruth,
        expectedCommitType: 'fix: or ide:',
        doneCriteria: 'Follow the current-truth default next move with a bounded slice.',
      };
    }
  }

  const profile = resolveProfile(recommendedItem);
  const thesis = normalizeInlineCode(firstParagraph(docs.currentTruth.content, '2. Current product thesis'));
  const blockers = listItems(docs.currentTruth.content, '4. Current live blockers');

  return {
    branch: currentBranch(),
    commit: latestCommitHash(),
    dirtyLines,
    dirtyFiles,
    docs,
    criticalDocs,
    queueItems,
    defaultNextMoves,
    recommendedItem,
    profile,
    thesis,
    blockers,
  };
}

function markdownList(items) {
  if (items.length === 0) {
    return '- none';
  }

  return items.map((item) => `- ${item}`).join('\n');
}

function checkedList(items) {
  if (items.length === 0) {
    return '- [ ] none';
  }

  return items.map((item) => `- [ ] ${item}`).join('\n');
}

function docsFoundMissing() {
  const found = [];
  const missing = [];

  for (const relativePath of STATUS_DOCS) {
    if (fs.existsSync(path.join(ROOT, relativePath))) {
      found.push(relativePath);
    } else {
      missing.push(relativePath);
    }
  }

  return { found, missing };
}

function missingCriticalDocs(docs) {
  return [docs.currentTruth, docs.agentRules, docs.workQueue]
    .filter((doc) => !doc.exists)
    .map((doc) => doc.path);
}

function buildStatusMarkdown(context) {
  const { found, missing } = docsFoundMissing();
  const queuePreview = context.queueItems.slice(0, 3).map((item) => `${item.number}. ${item.slice}`);
  const warning = context.dirtyLines.length > 0
    ? '> Warning: working tree is dirty. Treat queue item #1 as the next safe coordination slice before broader implementation.'
    : '> Working tree is clean. The default next implementation slice can be taken from the control docs.';
  const criticalWarning = context.criticalDocs.length > 0
    ? '> Critical: required control docs are missing. Do not trust generated next-step guidance until the control pack is restored.'
    : '';

  return [
    '# RedByte Work Driver Status',
    '',
    `- Generated: ${timestamp()}`,
    `- Branch: ${context.branch}`,
    `- Latest commit: ${context.commit}`,
    `- Working tree: ${workingTreeSummary(context.dirtyLines)}`,
    `- Concurrent/uncommitted files exist: ${context.dirtyLines.length > 0 ? 'yes' : 'no'}`,
    '',
    warning,
    ...(criticalWarning ? ['', criticalWarning] : []),
    '',
    '## Current truth',
    '',
    `- Product thesis: ${context.thesis || 'Unavailable from current truth doc.'}`,
    `- Default next move after control pass: ${context.defaultNextMoves[0] || 'Unavailable'}`,
    '',
    '## Source-of-truth docs',
    '',
    '### Found',
    '',
    markdownList(found),
    '',
    '### Missing',
    '',
    markdownList(missing),
    ...(context.criticalDocs.length > 0
      ? ['', '## Missing critical control docs', '', markdownList(context.criticalDocs)]
      : []),
    '',
    '## Work queue preview',
    '',
    markdownList(queuePreview),
    '',
    '## Next safe task',
    '',
    `- Recommended item: ${context.recommendedItem.slice}`,
    `- Why: ${normalizeInlineCode(context.recommendedItem.why)}`,
    `- Expected commit type: ${context.recommendedItem.expectedCommitType}`,
    '',
    '## Dirty files',
    '',
    markdownList(context.dirtyFiles),
  ].join('\n');
}

function buildPromptBlock(context) {
  const requiredDocs = context.profile.requiredDocs.map((item) => `- ${item}`).join('\n');
  const allowed = context.profile.allowedPatterns.map((item) => `- ${item}`).join('\n');
  const forbidden = context.profile.forbiddenPatterns.map((item) => `- ${item}`).join('\n');
  const validation = context.profile.validationCommands.map((item) => `- ${item}`).join('\n');

  return [
    '```text',
    `Work on the bounded RedByte slice: ${context.recommendedItem.slice}`,
    '',
    'Read first:',
    requiredDocs,
    '',
    'Goal:',
    context.profile.promptFocus,
    '',
    'Allowed files/patterns:',
    allowed,
    '',
    'Forbidden files/patterns:',
    forbidden,
    '',
    'Validation to run:',
    validation,
    '',
    'Expected commit message:',
    context.profile.commitMessage,
    '',
    'Rules:',
    '- Keep the slice small and reversible.',
    '- Do not touch unrelated concurrent work.',
    '- Do not push.',
    '```',
  ].join('\n');
}

function buildNextPacketMarkdown(context) {
  const dirtyWarning = context.dirtyLines.length > 0
    ? `> Warning: the working tree is dirty (${context.dirtyLines.length} path(s)). Reconcile or isolate the intended slice before committing.`
    : '> Working tree is clean for the next bounded slice.';

  return [
    '# RedByte Next Work Packet',
    '',
    `- Generated: ${timestamp()}`,
    `- Branch: ${context.branch}`,
    `- Commit: ${context.commit}`,
    '',
    dirtyWarning,
    '',
    '## Recommended work item',
    '',
    `- Queue item: ${context.recommendedItem.number || 'n/a'}`,
    `- Slice: ${context.recommendedItem.slice}`,
    `- Why now: ${normalizeInlineCode(context.recommendedItem.why)}`,
    `- Source docs: ${normalizeInlineCode(context.recommendedItem.sourceDocs)}`,
    '',
    '## Required docs to read first',
    '',
    markdownList(context.profile.requiredDocs),
    '',
    '## Allowed files/patterns to touch',
    '',
    markdownList(context.profile.allowedPatterns),
    '',
    '## Forbidden files/patterns to touch',
    '',
    markdownList(context.profile.forbiddenPatterns),
    '',
    '## Validation commands',
    '',
    markdownList(context.profile.validationCommands),
    '',
    '## Expected commit message',
    '',
    `- ${context.profile.commitMessage}`,
    '',
    '## Done criteria',
    '',
    markdownList(context.profile.doneCriteria),
    '',
    '## Handoff requirements',
    '',
    markdownList(context.profile.handoffRequirements),
    '',
    '## Dirty tree review',
    '',
    markdownList(context.dirtyFiles),
    '',
    '## Claude/Copilot-ready prompt',
    '',
    buildPromptBlock(context),
  ].join('\n');
}

function buildCloseMarkdown(context) {
  const existing = fs.existsSync(HANDOFF_DRAFT) ? fs.readFileSync(HANDOFF_DRAFT, 'utf8') : '';
  const notesSection = existing.includes(HANDOFF_NOTES_MARKER)
    ? existing.slice(existing.indexOf(HANDOFF_NOTES_MARKER)).trim()
    : `${HANDOFF_NOTES_MARKER}\n\nAdd optional human notes below this marker. This section is preserved across regenerations.`;

  return [
    '# RedByte Handoff Draft',
    '',
    `- Generated: ${timestamp()}`,
    `- Branch: ${context.branch}`,
    `- Latest commit: ${context.commit}`,
    `- Git status: ${workingTreeSummary(context.dirtyLines)}`,
    '',
    '## Files changed',
    '',
    markdownList(context.dirtyFiles),
    '',
    '## Validation checklist',
    '',
    checkedList([
      ...context.profile.validationCommands,
      'pnpm rb:doc:validate if docs changed',
      'git diff --check -- <touched files>',
      'Review isolated diff summary before commit',
    ]),
    '',
    '## Reminders',
    '',
    checkedList([
      'Add a factual AI_STATE.md change log entry for any meaningful landed slice.',
      'Decide whether Session Log / Obsidian updates are needed per docs/product/RED_BYTE_OBSIDIAN_SYNC_RULES.md.',
      'If Session Log is already dirty from another slice, mention the skipped update instead of bundling it.',
    ]),
    '',
    '## Next suggested action',
    '',
    `- ${context.recommendedItem.slice}`,
    `- Expected commit message: ${context.profile.commitMessage}`,
    '',
    notesSection,
    '',
  ].join('\n');
}

function writeFile(targetPath, content) {
  try {
    ensureOutputDir();
    fs.writeFileSync(targetPath, content, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`Failed to write ${targetPath}`, [reason]);
  }
}

function assertCriticalDocs(context) {
  if (context.criticalDocs.length === 0) {
    return;
  }

  fail('Missing required control docs for packet generation.', context.criticalDocs);
}

function runStatus() {
  process.stdout.write(`${buildStatusMarkdown(buildContext())}\n`);
}

function runNext() {
  const context = buildContext();
  assertCriticalDocs(context);
  writeFile(NEXT_PACKET, buildNextPacketMarkdown(context));
  process.stdout.write(`# Wrote ${path.relative(ROOT, NEXT_PACKET).replace(/\\/g, '/')}\n`);
}

function runClose() {
  const context = buildContext();
  assertCriticalDocs(context);
  writeFile(HANDOFF_DRAFT, buildCloseMarkdown(context));
  process.stdout.write(`# Wrote ${path.relative(ROOT, HANDOFF_DRAFT).replace(/\\/g, '/')}\n`);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const command = process.argv[2] || 'status';

  if (command === 'status') {
    runStatus();
  } else if (command === 'next') {
    runNext();
  } else if (command === 'close') {
    runClose();
  } else {
    fail(`Unknown command: ${command}`, ['Usage: node scripts/rb-work-driver.mjs <status|next|close>']);
  }
}

export {
  buildNextPacketMarkdown,
  parseQueueItems,
  resolveProfile,
  section,
};