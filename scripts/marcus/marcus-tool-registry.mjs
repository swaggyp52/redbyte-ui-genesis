import fs from 'node:fs';
import path from 'node:path';

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
  } = deps;

  const hqRunsDir = path.join(repoRoot, '.redbyte', 'agent', 'runs', 'hq');

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
        return {
          summary: `Blocked task: ${snapshot.blocked_task}`,
          data: snapshot,
        };
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
        return {
          summary: result.ok ? 'control-next completed' : 'control-next reported failure',
          data: {
            ok: result.ok,
            output: result.stdout.trim(),
            error: result.stderr.trim() || null,
          },
        };
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
        return {
          summary: result.ok ? `Claim traced: ${claim}` : `Trace failed for claim: ${claim}`,
          data: {
            claim,
            ok: result.ok,
            output: result.stdout.trim(),
            error: result.stderr.trim() || null,
          },
        };
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
        return {
          summary: result.ok ? `Memory search completed for: ${query}` : `Memory search failed for: ${query}`,
          data: {
            query,
            ok: result.ok,
            output: result.stdout.trim(),
            error: result.stderr.trim() || null,
          },
        };
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
        return {
          summary: intake.ok ? 'Problem intake packet generated' : 'Problem intake failed',
          data: {
            raw_feedback: raw,
            intake_ok: intake.ok,
            trace_ok: trace.ok,
            prompt_ok: prompt.ok,
            stderr: [intake.stderr, trace.stderr, prompt.stderr].filter(Boolean).join('\n').trim() || null,
          },
        };
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
        return {
          summary: summary.available ? 'Bench evidence loaded' : 'Bench evidence unavailable',
          data: {
            classify_ok: classify.ok,
            classify_error: classify.stderr.trim() || null,
            evidence: summary,
          },
        };
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
        return {
          summary: summary.clean ? 'Repo is clean' : 'Repo has local changes',
          data: summary,
        };
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
        return {
          summary: result.ok ? 'Doc validation passed' : 'Doc validation failed',
          data: {
            ok: result.ok,
            output: result.stdout.trim(),
            error: result.stderr.trim() || null,
          },
        };
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
        return {
          summary: result.ok ? 'Encoding check passed' : 'Encoding check failed',
          data: {
            ok: result.ok,
            output: result.stdout.trim(),
            error: result.stderr.trim() || null,
          },
        };
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

        return {
          summary: 'Generated coding plan packet for human-approved Codex execution.',
          data: {
            requiresApproval: true,
            dirtyRepoWarning: !git.clean,
            artifacts: artifact,
          },
        };
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
      };
    } catch (error) {
      return {
        ok: false,
        name,
        safetyLevel: tool.safetyLevel,
        access: tool.access,
        summary: `Tool failed: ${name}`,
        error: error instanceof Error ? error.message : String(error),
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
