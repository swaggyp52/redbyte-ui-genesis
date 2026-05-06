import fs from 'node:fs';
import path from 'node:path';

function clipExcerpt(value, limit = 220) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit) || null;
}

function sourceRecord({ id, kind, title, path: filePath = null, excerpt = null, freshness, authority }) {
  return {
    id,
    kind,
    title,
    path: filePath,
    excerpt,
    freshness,
    authority,
  };
}

function highestEvidenceLevel(levels) {
  const order = ['E0', 'E1', 'E2', 'E3'];
  let best = 'E0';
  for (const level of levels) {
    if (order.indexOf(level) > order.indexOf(best)) {
      best = level;
    }
  }
  return best;
}

function safeJsonParse(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

export function createMarcusToolRegistry(deps) {
  const {
    repoRoot,
    sanitizeUserText,
    runAllowlistedCommand,
    buildSnapshot,
    loadBenchEvidenceSummary,
    gitSummary,
    searchCode,
    readCodeFile,
    generatePatchProposal,
    listPatchProposals,
  } = deps;

  const hqRunsDir = path.join(repoRoot, '.redbyte', 'agent', 'runs', 'hq');
  const controlNextPath = '.redbyte/agent/runs/control-next-latest.json';
  const problemPacketPath = '.redbyte/agent/runs/problems/problem-latest.json';
  const memoryManifestPath = '.redbyte/agent/memory/index/manifest.json';

  function finalizeResult({ summary, data, sources = [], warnings = [], evidenceLevel = 'E0', generatedFiles = [], authority = 'supporting', sourceConfidence = 'medium' }) {
    return {
      summary,
      data,
      sources,
      warnings,
      evidenceLevel,
      generatedFiles,
      authority,
      sourceConfidence,
    };
  }

  function writeCodingPlanArtifacts(plan) {
    fs.mkdirSync(hqRunsDir, { recursive: true });
    const mdPath = path.join(hqRunsDir, 'marcus-coding-plan-latest.md');
    const jsonPath = path.join(hqRunsDir, 'marcus-coding-plan-latest.json');
    const md = [
      '# Marcus Coding Plan',
      '',
      `- generated_at: ${new Date().toISOString()}`,
      `- mode: ${plan.mode}`,
      '',
      '## Product interpretation',
      plan.productInterpretation,
      '',
      '## Relevant claims',
      ...plan.relevantClaims.map((claim) => `- ${claim}`),
      '',
      '## Likely files',
      ...plan.likelyFiles.map((file) => `- ${file}`),
      '',
      '## Tests and gates',
      ...plan.testsAndGates.map((gate) => `- ${gate}`),
      '',
      '## Do not touch',
      ...plan.doNotTouch.map((item) => `- ${item}`),
      '',
      '## Implementation phases',
      ...plan.phases.map((phase, index) => `${index + 1}. ${phase}`),
      '',
      '## Definition of done',
      ...plan.definitionOfDone.map((item) => `- ${item}`),
      '',
      '## Codex prompt',
      '```text',
      plan.codexPrompt,
      '```',
      '',
    ].join('\n');

    fs.writeFileSync(mdPath, md, 'utf8');
    fs.writeFileSync(jsonPath, JSON.stringify(plan, null, 2), 'utf8');

    return {
      markdownPath: path.relative(repoRoot, mdPath).replace(/\\/g, '/'),
      jsonPath: path.relative(repoRoot, jsonPath).replace(/\\/g, '/'),
    };
  }

  const toolList = [
    {
      name: 'code_search',
      description: 'Search allowlisted RedByte repo code/docs paths with bounded read-only snippets.',
      safetyLevel: 'safe-read',
      access: 'read',
      timeoutMs: 30000,
      allowedCommands: [],
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        if (typeof searchCode !== 'function') throw new Error('code search unavailable');
        const query = sanitizeUserText(args.query || 'RedByte');
        const result = searchCode(query, { maxSnippets: 12 });
        return finalizeResult({
          summary: `Code search returned ${result.results.length} result(s) for: ${query}`,
          data: result,
          sources: result.results.slice(0, 8).map((entry, index) => sourceRecord({
            id: `code-search-${index}`,
            kind: 'tool_output',
            title: entry.title || entry.path,
            path: entry.path,
            excerpt: clipExcerpt(entry.snippet),
            freshness: 'current',
            authority: 'supporting',
          })),
          warnings: result.warnings || [],
          authority: 'supporting',
          sourceConfidence: result.results.length ? 'medium' : 'low',
        });
      },
    },
    {
      name: 'code_read',
      description: 'Read a bounded preview from an allowlisted RedByte repo text file.',
      safetyLevel: 'safe-read',
      access: 'read',
      timeoutMs: 30000,
      allowedCommands: [],
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
      handler: async (args) => {
        if (typeof readCodeFile !== 'function') throw new Error('code read unavailable');
        const filePath = sanitizeUserText(args.path || '');
        const result = readCodeFile(filePath, { maxChars: 5000 });
        return finalizeResult({
          summary: `Read safe code preview: ${result.path}`,
          data: result,
          sources: [
            sourceRecord({
              id: `code-read-${result.path}`,
              kind: 'tool_output',
              title: result.path,
              path: result.path,
              excerpt: clipExcerpt(result.content),
              freshness: 'current',
              authority: 'supporting',
            }),
          ],
          warnings: result.truncated ? ['Code preview was truncated.'] : [],
          authority: 'supporting',
          sourceConfidence: 'medium',
        });
      },
    },
    {
      name: 'generate_patch_proposal',
      description: 'Generate a proposal-only patch plan from a task, packet, or raw request. Does not edit files.',
      safetyLevel: 'safe-write-generated',
      access: 'write-generated',
      timeoutMs: 60000,
      allowedCommands: [],
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          packetId: { type: 'string' },
          rawRequest: { type: 'string' },
        },
      },
      handler: async (args) => {
        if (typeof generatePatchProposal !== 'function') throw new Error('patch proposal generation unavailable');
        const proposal = generatePatchProposal({
          taskId: sanitizeUserText(args.taskId || ''),
          packetId: sanitizeUserText(args.packetId || ''),
          rawRequest: sanitizeUserText(args.rawRequest || args.query || ''),
        });
        return finalizeResult({
          summary: `Generated proposal-only patch plan: ${proposal.title}`,
          data: {
            proposal,
            requiresApproval: true,
            applyStatus: 'proposal_only',
          },
          sources: [
            sourceRecord({
              id: 'patch-proposal-generated',
              kind: 'generated_run',
              title: proposal.title,
              path: proposal.generatedFiles?.[0] || null,
              excerpt: clipExcerpt(proposal.patchSketch),
              freshness: 'generated',
              authority: 'generated',
            }),
            sourceRecord({
              id: 'code-intelligence-contract',
              kind: 'repo_doc',
              title: 'Marcus Code Intelligence',
              path: 'docs/product/RED_BYTE_MARCUS_CODE_INTELLIGENCE.md',
              excerpt: 'A patch proposal is not an applied change.',
              freshness: 'current',
              authority: 'canonical',
            }),
          ],
          warnings: ['Patch proposal only. Marcus did not edit files.'],
          generatedFiles: proposal.generatedFiles || [],
          authority: 'generated',
          sourceConfidence: 'medium',
        });
      },
    },
    {
      name: 'list_patch_proposals',
      description: 'List recent generated patch proposal artifacts.',
      safetyLevel: 'safe-read',
      access: 'read',
      timeoutMs: 15000,
      allowedCommands: [],
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        if (typeof listPatchProposals !== 'function') throw new Error('patch proposal list unavailable');
        const proposals = listPatchProposals({ limit: 10 });
        return finalizeResult({
          summary: `Found ${proposals.length} patch proposal(s).`,
          data: { proposals },
          sources: proposals.slice(0, 5).map((proposal) => sourceRecord({
            id: `patch-proposal-${proposal.id}`,
            kind: 'generated_run',
            title: proposal.title,
            path: proposal.generatedFiles?.[0] || null,
            excerpt: proposal.applyStatus,
            freshness: 'generated',
            authority: 'generated',
          })),
          warnings: [],
          authority: 'generated',
          sourceConfidence: proposals.length ? 'medium' : 'low',
        });
      },
    },
    {
      name: 'get_product_snapshot',
      description: 'Read current RedByte control snapshot and product state summary.',
      safetyLevel: 'safe-read',
      access: 'read',
      timeoutMs: 30000,
      allowedCommands: ['control-next'],
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const snapshot = await buildSnapshot();
        const evidenceLevel = snapshot?.bench_evidence?.counts
          ? highestEvidenceLevel(
              Object.entries(snapshot.bench_evidence.counts)
                .filter(([, count]) => Number(count) > 0)
                .map(([level]) => level),
            )
          : 'E0';

        return finalizeResult({
          summary: `Blocked task: ${snapshot.blocked_task}`,
          data: snapshot,
          sources: [
            sourceRecord({
              id: 'current-truth',
              kind: 'repo_doc',
              title: 'RedByte Current Truth',
              path: 'docs/product/RED_BYTE_CURRENT_TRUTH.md',
              excerpt: clipExcerpt(snapshot.blocked_task),
              freshness: 'current',
              authority: 'canonical',
            }),
            sourceRecord({
              id: 'control-next-generated',
              kind: 'generated_run',
              title: 'Latest control-next report',
              path: controlNextPath,
              excerpt: clipExcerpt(snapshot?.control_next?.why_this_task_matters || snapshot?.blocked_task),
              freshness: 'generated',
              authority: 'generated',
            }),
          ],
          warnings: snapshot?.bench_evidence?.available ? [] : ['Bench evidence unavailable in current snapshot.'],
          evidenceLevel,
          authority: 'canonical',
          sourceConfidence: 'high',
        });
      },
    },
    {
      name: 'control_next',
      description: 'Run control-next and return current recommended product slice.',
      safetyLevel: 'safe-read',
      access: 'read',
      timeoutMs: 60000,
      allowedCommands: ['control-next'],
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const result = runAllowlistedCommand('control-next');
        return finalizeResult({
          summary: result.ok ? 'control-next completed' : 'control-next reported failure',
          data: {
            ok: result.ok,
            output: result.stdout.trim(),
            error: result.stderr.trim() || null,
          },
          sources: [
            sourceRecord({
              id: 'control-next-output',
              kind: 'generated_run',
              title: 'control-next latest output',
              path: controlNextPath,
              excerpt: clipExcerpt(result.stdout),
              freshness: 'generated',
              authority: 'generated',
            }),
            sourceRecord({
              id: 'work-queue-doc',
              kind: 'repo_doc',
              title: 'RedByte Work Queue',
              path: 'docs/product/RED_BYTE_WORK_QUEUE.md',
              excerpt: 'Control output is advisory and must not override repo truth.',
              freshness: 'current',
              authority: 'canonical',
            }),
          ],
          warnings: result.ok ? [] : ['control-next reported failure; generated output may be incomplete.'],
          authority: 'supporting',
          sourceConfidence: result.ok ? 'medium' : 'low',
        });
      },
    },
    {
      name: 'trace_claim',
      description: 'Trace a product claim through memory/control trace tools.',
      safetyLevel: 'safe-read',
      access: 'read',
      timeoutMs: 60000,
      allowedCommands: ['trace-claim', 'control-trace-claims'],
      parameters: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
        },
        required: ['claim'],
      },
      handler: async (args) => {
        const claim = sanitizeUserText(args.claim || 'Draft export is not trusted export');
        const result = runAllowlistedCommand('trace-claim', claim);
        return finalizeResult({
          summary: result.ok ? `Claim traced: ${claim}` : `Trace failed for claim: ${claim}`,
          data: {
            claim,
            ok: result.ok,
            output: result.stdout.trim(),
            error: result.stderr.trim() || null,
          },
          sources: [
            sourceRecord({
              id: 'trace-claim-tool-output',
              kind: 'tool_output',
              title: 'Claim trace output',
              path: null,
              excerpt: clipExcerpt(result.stdout || claim),
              freshness: 'generated',
              authority: 'supporting',
            }),
            sourceRecord({
              id: 'traceability-model',
              kind: 'repo_doc',
              title: 'RedByte Product Traceability Model',
              path: 'docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md',
              excerpt: clipExcerpt(claim),
              freshness: 'current',
              authority: 'canonical',
            }),
          ],
          warnings: result.ok ? [] : ['Claim trace command failed; grounding is partial.'],
          authority: 'supporting',
          sourceConfidence: result.ok ? 'medium' : 'low',
        });
      },
    },
    {
      name: 'memory_search',
      description: 'Search RedByte memory index and return relevant entries.',
      safetyLevel: 'safe-read',
      access: 'read',
      timeoutMs: 60000,
      allowedCommands: ['memory-search'],
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const query = sanitizeUserText(args.query || 'RedByte current truth');
        const result = runAllowlistedCommand('memory-search', query);
        return finalizeResult({
          summary: result.ok ? `Memory search completed for: ${query}` : `Memory search failed for: ${query}`,
          data: {
            query,
            ok: result.ok,
            output: result.stdout.trim(),
            error: result.stderr.trim() || null,
          },
          sources: [
            sourceRecord({
              id: 'memory-search-output',
              kind: 'obsidian_memory',
              title: 'Obsidian memory search',
              path: memoryManifestPath,
              excerpt: clipExcerpt(result.stdout || query),
              freshness: 'stale_possible',
              authority: 'memory',
            }),
          ],
          warnings: result.ok ? ['Obsidian memory is supporting context, not canonical truth.'] : ['Memory search failed; no supporting memory context available.'],
          authority: 'memory',
          sourceConfidence: result.ok ? 'low' : 'degraded',
        });
      },
    },
    {
      name: 'problem_intake',
      description: 'Generate a problem intake packet from raw product feedback.',
      safetyLevel: 'safe-write-generated',
      access: 'write-generated',
      timeoutMs: 60000,
      allowedCommands: ['problem-intake', 'problem-trace', 'problem-prompt'],
      parameters: {
        type: 'object',
        properties: {
          raw_feedback: { type: 'string' },
        },
        required: ['raw_feedback'],
      },
      handler: async (args) => {
        const raw = sanitizeUserText(args.raw_feedback || 'No feedback provided.');
        const intake = runAllowlistedCommand('problem-intake', raw);
        const trace = runAllowlistedCommand('problem-trace');
        const prompt = runAllowlistedCommand('problem-prompt');
        return finalizeResult({
          summary: intake.ok ? 'Problem intake packet generated' : 'Problem intake failed',
          data: {
            raw_feedback: raw,
            intake_ok: intake.ok,
            trace_ok: trace.ok,
            prompt_ok: prompt.ok,
            stderr: [intake.stderr, trace.stderr, prompt.stderr].filter(Boolean).join('\n').trim() || null,
          },
          sources: [
            sourceRecord({
              id: 'problem-packet-generated',
              kind: 'generated_run',
              title: 'Problem intake packet',
              path: problemPacketPath,
              excerpt: clipExcerpt(raw),
              freshness: 'generated',
              authority: 'generated',
            }),
            sourceRecord({
              id: 'problem-loop-doc',
              kind: 'repo_doc',
              title: 'RedByte Product Problem Intake',
              path: 'docs/product/RED_BYTE_PRODUCT_PROBLEM_INTAKE.md',
              excerpt: 'Raw user feedback is preserved before interpretation.',
              freshness: 'current',
              authority: 'canonical',
            }),
          ],
          warnings: intake.ok ? [] : ['Problem intake command failed; generated packet may be missing.'],
          authority: 'generated',
          sourceConfidence: intake.ok ? 'medium' : 'low',
        });
      },
    },
    {
      name: 'bench_evidence',
      description: 'Read E0/E1/E2/E3 bench evidence summary.',
      safetyLevel: 'safe-read',
      access: 'read',
      timeoutMs: 30000,
      allowedCommands: ['bench-evidence-classify'],
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const classify = runAllowlistedCommand('bench-evidence-classify');
        const summary = loadBenchEvidenceSummary();
        const runPath = summary?.run_folder ? `${summary.run_folder}/evidence-classification.json` : null;
        const evidenceLevel = summary?.available
          ? highestEvidenceLevel((summary.targets || []).map((target) => target.evidence_level))
          : 'E0';
        const warnings = [];
        if (!classify.ok) warnings.push('bench-evidence-classify command failed.');
        if (!summary.available) warnings.push(summary.message || 'Bench evidence unavailable.');

        return finalizeResult({
          summary: summary.available ? 'Bench evidence loaded' : 'Bench evidence unavailable',
          data: {
            classify_ok: classify.ok,
            classify_error: classify.stderr.trim() || null,
            evidence: summary,
          },
          sources: summary.available
            ? [
                sourceRecord({
                  id: 'bench-evidence-generated',
                  kind: 'bench_evidence',
                  title: 'Bench evidence classification',
                  path: runPath,
                  excerpt: clipExcerpt(`Counts: ${JSON.stringify(summary.counts || {})}`),
                  freshness: 'generated',
                  authority: 'generated',
                }),
              ]
            : [
                sourceRecord({
                  id: 'bench-evidence-fallback',
                  kind: 'fallback',
                  title: 'Bench evidence unavailable',
                  path: null,
                  excerpt: clipExcerpt(summary.message || 'No bench runs found.'),
                  freshness: 'unknown',
                  authority: 'fallback',
                }),
              ],
          warnings,
          evidenceLevel,
          authority: 'generated',
          sourceConfidence: summary.available ? 'medium' : 'degraded',
        });
      },
    },
    {
      name: 'git_status',
      description: 'Read git status summary only.',
      safetyLevel: 'safe-read',
      access: 'read',
      timeoutMs: 15000,
      allowedCommands: ['git-status-short'],
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const summary = gitSummary();
        return finalizeResult({
          summary: summary.clean ? 'Repo is clean' : 'Repo has local changes',
          data: summary,
          sources: [
            sourceRecord({
              id: 'git-status',
              kind: 'git_state',
              title: 'Git status',
              path: null,
              excerpt: clipExcerpt(summary.status_short || summary.latest_commit),
              freshness: 'current',
              authority: 'supporting',
            }),
          ],
          warnings: summary.clean ? [] : ['Repository has local changes.'],
          authority: 'supporting',
          sourceConfidence: 'high',
        });
      },
    },
    {
      name: 'validate_docs',
      description: 'Run RedByte documentation validation checks.',
      safetyLevel: 'safe-check',
      access: 'read',
      timeoutMs: 120000,
      allowedCommands: ['validate-docs'],
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const result = runAllowlistedCommand('validate-docs');
        return finalizeResult({
          summary: result.ok ? 'Doc validation passed' : 'Doc validation failed',
          data: {
            ok: result.ok,
            output: result.stdout.trim(),
            error: result.stderr.trim() || null,
          },
          sources: [
            sourceRecord({
              id: 'doc-validate-output',
              kind: 'tool_output',
              title: 'Documentation validation output',
              path: null,
              excerpt: clipExcerpt(result.stdout || result.stderr),
              freshness: 'generated',
              authority: 'supporting',
            }),
          ],
          warnings: result.ok ? [] : ['Documentation validation failed.'],
          authority: 'supporting',
          sourceConfidence: result.ok ? 'medium' : 'low',
        });
      },
    },
    {
      name: 'encoding_check',
      description: 'Run encoding sanity checks.',
      safetyLevel: 'safe-check',
      access: 'read',
      timeoutMs: 120000,
      allowedCommands: ['encoding-check'],
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const result = runAllowlistedCommand('encoding-check');
        return finalizeResult({
          summary: result.ok ? 'Encoding check passed' : 'Encoding check failed',
          data: {
            ok: result.ok,
            output: result.stdout.trim(),
            error: result.stderr.trim() || null,
          },
          sources: [
            sourceRecord({
              id: 'encoding-check-output',
              kind: 'tool_output',
              title: 'Encoding check output',
              path: null,
              excerpt: clipExcerpt(result.stdout || result.stderr),
              freshness: 'generated',
              authority: 'supporting',
            }),
          ],
          warnings: result.ok ? [] : ['Encoding check failed.'],
          authority: 'supporting',
          sourceConfidence: result.ok ? 'medium' : 'low',
        });
      },
    },
    {
      name: 'generate_codex_packet',
      description: 'Generate a Codex-safe coding plan packet without editing product files.',
      safetyLevel: 'safe-write-generated',
      access: 'write-generated',
      timeoutMs: 120000,
      allowedCommands: ['problem-intake', 'problem-trace', 'problem-prompt', 'control-next', 'memory-search', 'git-status-short'],
      parameters: {
        type: 'object',
        properties: {
          raw_user_request: { type: 'string' },
          target_surface: { type: 'string' },
          urgency: { type: 'string' },
          constraints: { type: 'string' },
          mode: { type: 'string' },
        },
        required: ['raw_user_request'],
      },
      handler: async (args) => {
        const rawRequest = sanitizeUserText(args.raw_user_request || 'No request provided.');
        runAllowlistedCommand('problem-intake', rawRequest);
        const traceResult = runAllowlistedCommand('problem-trace');
        const promptResult = runAllowlistedCommand('problem-prompt');
        const controlResult = runAllowlistedCommand('control-next');
        const memoryResult = runAllowlistedCommand('memory-search', rawRequest);
        const git = gitSummary();

        const plan = {
          generatedAt: new Date().toISOString(),
          mode: sanitizeUserText(args.mode || 'coding-plan'),
          rawUserRequest: rawRequest,
          targetSurface: sanitizeUserText(args.target_surface || 'unspecified'),
          urgency: sanitizeUserText(args.urgency || 'normal'),
          constraints: sanitizeUserText(args.constraints || 'No additional constraints provided.'),
          productInterpretation:
            'Marcus v1 produces a safe, approval-gated coding packet. It does not edit files directly and does not run arbitrary shell commands.',
          relevantClaims: [
            'E2 board programming is not E3 observed behavior.',
            'Map Pins assignment does not replace Verify proof.',
            'Draft Export is not Trusted Export.',
            'Generated agent output is advisory until validated by tests and docs.',
          ],
          likelyFiles: [
            'scripts/rb-hq-server.mjs',
            'scripts/marcus/marcus-tool-registry.mjs',
            'scripts/marcus/marcus-agent-loop.mjs',
            'packages/rb-apps/src/apps/ide/surfaces/HqSurface.tsx',
            'packages/rb-apps/src/apps/ide/surfaces/hq/hqClient.ts',
            'packages/rb-apps/src/apps/ide/surfaces/hq/hqTypes.ts',
          ],
          testsAndGates: [
            'pnpm rb:hq:test',
            'pnpm rb:hq:doctor',
            'pnpm rb:doc:validate',
            'pnpm rb:encoding:check',
            'pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/hqSurface.workstation.test.tsx',
          ],
          doNotTouch: [
            'Do not edit student spine surfaces unless required by HQ mode only.',
            'Do not run arbitrary shell commands.',
            'Do not write to Obsidian vault.',
            'Do not commit or push from Marcus endpoint flows.',
          ],
          phases: [
            'Analyze current backend connectivity and endpoint wiring.',
            'Define tool-assisted agent behavior and safety boundaries.',
            'Gather evidence from control/memory/problem traces.',
            'Generate patch/work packet and list validation checks.',
            'Require human approval before implementation execution.',
          ],
          definitionOfDone: [
            'Connectivity and degraded fallback are explicit and test-backed.',
            'Tool registry enforces allowlist and denies unknown tools.',
            'Chat/coding-plan responses include warnings, sources, and next action.',
            'No product files are edited by Marcus endpoints directly.',
          ],
          codexPrompt: promptResult.stdout.trim() || 'See latest problem codex prompt packet under .redbyte/agent/runs/problems/.',
          sourceOutputs: {
            trace: traceResult.stdout.trim(),
            control: controlResult.stdout.trim(),
            memory: memoryResult.stdout.trim(),
            git,
          },
        };

        const artifact = writeCodingPlanArtifacts(plan);

        return finalizeResult({
          summary: 'Generated coding plan packet for human-approved Codex execution.',
          data: {
            requiresApproval: true,
            dirtyRepoWarning: !git.clean,
            artifacts: artifact,
          },
          sources: [
            sourceRecord({
              id: 'coding-plan-md',
              kind: 'generated_run',
              title: 'Marcus coding plan markdown',
              path: artifact.markdownPath,
              excerpt: 'Approval-gated coding plan packet.',
              freshness: 'generated',
              authority: 'generated',
            }),
            sourceRecord({
              id: 'coding-plan-json',
              kind: 'generated_run',
              title: 'Marcus coding plan json',
              path: artifact.jsonPath,
              excerpt: clipExcerpt(rawRequest),
              freshness: 'generated',
              authority: 'generated',
            }),
            sourceRecord({
              id: 'agent-engine-doc',
              kind: 'repo_doc',
              title: 'Marcus Agent Engine',
              path: 'docs/product/RED_BYTE_MARCUS_AGENT_ENGINE.md',
              excerpt: 'Generated agent output is advisory until validated by tests and docs.',
              freshness: 'current',
              authority: 'canonical',
            }),
          ],
          warnings: !git.clean ? ['Repository has local changes. Review coding packet cautiously.'] : [],
          generatedFiles: [artifact.markdownPath, artifact.jsonPath],
          authority: 'generated',
          sourceConfidence: 'medium',
        });
      },
    },
  ];

  const toolsByName = new Map(toolList.map((tool) => [tool.name, tool]));

  function listToolsForModel() {
    return toolList.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  async function executeTool(name, rawArgs) {
    const tool = toolsByName.get(name);
    if (!tool) {
      return {
        ok: false,
        name,
        summary: `Unknown tool: ${name}`,
        error: 'unknown-tool',
        sources: [],
        warnings: [`Unknown tool rejected: ${name}`],
        evidenceLevel: 'E0',
        generatedFiles: [],
        authority: 'fallback',
        sourceConfidence: 'degraded',
      };
    }

    const parsed = normalizeObject(safeJsonParse(rawArgs));
    try {
      const result = await tool.handler(parsed);
      return {
        ok: true,
        name,
        safetyLevel: tool.safetyLevel,
        access: tool.access,
        summary: result.summary,
        data: result.data,
        sources: result.sources || [],
        warnings: result.warnings || [],
        evidenceLevel: result.evidenceLevel || 'E0',
        generatedFiles: result.generatedFiles || [],
        authority: result.authority || 'supporting',
        sourceConfidence: result.sourceConfidence || 'medium',
      };
    } catch (error) {
      return {
        ok: false,
        name,
        safetyLevel: tool.safetyLevel,
        access: tool.access,
        summary: `Tool failed: ${name}`,
        error: error instanceof Error ? error.message : String(error),
        sources: [
          sourceRecord({
            id: `${name}-failure`,
            kind: 'fallback',
            title: `Tool failure: ${name}`,
            path: null,
            excerpt: clipExcerpt(error instanceof Error ? error.message : String(error)),
            freshness: 'unknown',
            authority: 'fallback',
          }),
        ],
        warnings: [`Tool failed: ${name}`],
        evidenceLevel: 'E0',
        generatedFiles: [],
        authority: 'fallback',
        sourceConfidence: 'degraded',
      };
    }
  }

  function hasTool(name) {
    return toolsByName.has(name);
  }

  return {
    listToolsForModel,
    executeTool,
    hasTool,
    catalog: toolList.map((tool) => ({
      name: tool.name,
      description: tool.description,
      safetyLevel: tool.safetyLevel,
      access: tool.access,
      timeoutMs: tool.timeoutMs,
      allowedCommands: tool.allowedCommands,
      parameters: tool.parameters,
    })),
  };
}
