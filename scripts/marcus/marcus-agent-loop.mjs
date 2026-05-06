function parseToolArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeToolCall(call) {
  const fn = call?.function || call;
  const name = fn?.name;
  if (typeof name !== 'string' || !name) return null;
  return {
    name,
    args: parseToolArgs(fn.arguments),
  };
}

function determineFallbackTools(mode) {
  switch (mode) {
    case 'explain-state':
      return ['get_product_snapshot', 'control_next', 'bench_evidence'];
    case 'problem-packet':
      return ['problem_intake'];
    case 'trace-claim':
      return ['trace_claim'];
    case 'coding-plan':
      return ['git_status', 'control_next', 'memory_search', 'generate_codex_packet'];
    case 'patch-proposal':
      return ['git_status', 'control_next', 'code_search', 'generate_patch_proposal'];
    case 'ask':
    default:
      return ['get_product_snapshot'];
  }
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

function mergeConfidence(current, next) {
  const order = ['degraded', 'low', 'medium', 'high'];
  const currentIndex = order.indexOf(current);
  const nextIndex = order.indexOf(next);
  return order[Math.max(currentIndex, nextIndex, 0)] || 'low';
}

function pushUniqueSources(target, sources) {
  const seen = new Set(target.map((source) => source.id));
  for (const source of sources || []) {
    if (!source || typeof source !== 'object' || !source.id || seen.has(source.id)) continue;
    target.push(source);
    seen.add(source.id);
  }
}

function baselineSources(snapshot, degraded = false) {
  const sources = [
    {
      id: 'baseline-current-truth',
      kind: 'repo_doc',
      title: 'RedByte Current Truth',
      path: 'docs/product/RED_BYTE_CURRENT_TRUTH.md',
      excerpt: snapshot?.blocked_task || 'Current RedByte product truth.',
      freshness: 'current',
      authority: 'canonical',
    },
  ];

  if (snapshot?.control_next) {
    sources.push({
      id: 'baseline-control-next',
      kind: 'generated_run',
      title: 'Latest control-next output',
      path: '.redbyte/agent/runs/control-next-latest.json',
      excerpt: snapshot.control_next.why_this_task_matters || snapshot.blocked_task,
      freshness: 'generated',
      authority: 'generated',
    });
  }

  if (snapshot?.bench_evidence?.run_folder) {
    sources.push({
      id: 'baseline-bench-evidence',
      kind: 'bench_evidence',
      title: 'Bench evidence classification',
      path: `${snapshot.bench_evidence.run_folder}/evidence-classification.json`,
      excerpt: snapshot.bench_evidence.message || 'Bench evidence summary available.',
      freshness: 'generated',
      authority: 'generated',
    });
  }

  if (degraded || sources.length === 0) {
    sources.push({
      id: 'baseline-fallback',
      kind: 'fallback',
      title: 'Fallback reasoning',
      path: null,
      excerpt: 'Marcus is using fallback grounding because live tool assistance is limited.',
      freshness: 'unknown',
      authority: 'fallback',
    });
  }

  return sources;
}

function buildSystemPrompt(snapshot, mode) {
  return [
    'You are Marcus, a local RedByte engineering operator.',
    'Protect truth boundaries: E2 is not E3, Map Pins is not Verify proof, Draft Export is not Trusted Export.',
    'Generated outputs are advisory and require human/Codex approval for implementation.',
    'Do not request unsafe commands or file edits. If asked to fix or change code, generate a patch proposal only.',
    `Conversation mode: ${mode}.`,
    `Snapshot: ${JSON.stringify({ blocked_task: snapshot?.blocked_task, bench_evidence: snapshot?.bench_evidence })}`,
  ].join('\n');
}

export async function runMarcusAgentLoop({
  userMessage,
  mode,
  snapshot,
  maxToolCalls,
  allowTools,
  toolRegistry,
  callOllamaChat,
  ollamaOnline,
}) {
  const warnings = [];
  const sources = [];
  const toolsUsed = [];
  const generatedFiles = [];
  let requiresApproval = false;
  let evidenceLevel = 'E0';
  let sourceConfidence = 'low';

  const safeMode = mode || 'ask';
  const maxCalls = Number.isFinite(maxToolCalls) ? Math.max(1, Math.min(8, maxToolCalls)) : 4;

  if (!allowTools) {
    warnings.push('Tools are disabled for this request.');
  }

  if (!ollamaOnline || typeof callOllamaChat !== 'function') {
    warnings.push('Ollama offline or unavailable; fallback reasoning mode used.');
    const fallbackTools = allowTools ? determineFallbackTools(safeMode) : [];
    for (const toolName of fallbackTools.slice(0, maxCalls)) {
      const result = await toolRegistry.executeTool(toolName, {
        query: userMessage,
        claim: userMessage,
        raw_feedback: userMessage,
        raw_user_request: userMessage,
        mode: safeMode,
      });
      toolsUsed.push({ name: toolName, ok: result.ok, summary: result.summary });
      pushUniqueSources(sources, result.sources);
      generatedFiles.push(...(result.generatedFiles || []));
      evidenceLevel = highestEvidenceLevel([evidenceLevel, result.evidenceLevel || 'E0']);
      sourceConfidence = mergeConfidence(sourceConfidence, result.sourceConfidence || 'low');
      if (toolName === 'generate_codex_packet' || toolName === 'generate_patch_proposal') {
        requiresApproval = true;
      }
    }

    pushUniqueSources(sources, baselineSources(snapshot, true));
    evidenceLevel = highestEvidenceLevel([evidenceLevel, snapshot?.bench_evidence?.available ? 'E2' : 'E0']);
    sourceConfidence = mergeConfidence(sourceConfidence, 'degraded');

    return {
      mode: safeMode,
      degraded: true,
      reply:
        safeMode === 'coding-plan'
          ? 'Marcus generated a safe fallback coding packet from control/memory/problem context. Review it before any implementation.'
          : 'Marcus is running in fallback mode using local RedByte tools and snapshot context.',
      toolsUsed,
      sources,
      warnings,
      generatedFiles: Array.from(new Set(generatedFiles)),
      evidenceLevel,
      sourceConfidence,
      recommendedNextAction:
        safeMode === 'coding-plan'
          ? 'Review generated coding packet and approve Codex execution steps.'
          : 'Start or verify Ollama for richer tool-calling responses, or continue with local fallback outputs.',
      requiresApproval,
    };
  }

  const systemPrompt = buildSystemPrompt(snapshot, safeMode);
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  let toolCalls = [];
  try {
    const initial = await callOllamaChat({
      messages,
      tools: allowTools ? toolRegistry.listToolsForModel() : undefined,
    });

    const calls = Array.isArray(initial?.message?.tool_calls) ? initial.message.tool_calls : [];
    toolCalls = calls.map(normalizeToolCall).filter(Boolean);

    if (toolCalls.length === 0 && allowTools) {
      const fallbackTools = determineFallbackTools(safeMode).slice(0, maxCalls);
      for (const fallbackTool of fallbackTools) {
        toolCalls.push({ name: fallbackTool, args: { query: userMessage, claim: userMessage, raw_feedback: userMessage, raw_user_request: userMessage, mode: safeMode } });
      }
      warnings.push('Model returned no tool calls; deterministic fallback tool route applied.');
    } else if (toolCalls.length === 0) {
      warnings.push('No tools were used; answer may be less grounded.');
    }
  } catch (error) {
    warnings.push(`Tool-call planning failed; fallback mode used: ${error instanceof Error ? error.message : String(error)}`);
    toolCalls = determineFallbackTools(safeMode).slice(0, maxCalls).map((name) => ({
      name,
      args: { query: userMessage, claim: userMessage, raw_feedback: userMessage, raw_user_request: userMessage, mode: safeMode },
    }));
  }

  const loopCalls = toolCalls.slice(0, maxCalls);
  if (toolCalls.length > maxCalls) {
    warnings.push(`maxToolCalls enforced: executed ${maxCalls} of ${toolCalls.length} requested tools.`);
  }

  const toolMessages = [];

  for (const call of loopCalls) {
    if (!toolRegistry.hasTool(call.name)) {
      const unknown = {
        ok: false,
        name: call.name,
        summary: `Unknown tool rejected: ${call.name}`,
        error: 'unknown-tool',
      };
      toolsUsed.push({ name: call.name, ok: false, summary: unknown.summary });
      toolMessages.push({
        role: 'tool',
        content: JSON.stringify(unknown),
      });
      warnings.push(`Unknown tool request blocked: ${call.name}`);
      continue;
    }

    const result = await toolRegistry.executeTool(call.name, call.args);
    toolsUsed.push({ name: call.name, ok: result.ok, summary: result.summary });
    pushUniqueSources(sources, result.sources);
    generatedFiles.push(...(result.generatedFiles || []));
    evidenceLevel = highestEvidenceLevel([evidenceLevel, result.evidenceLevel || 'E0']);
    sourceConfidence = mergeConfidence(sourceConfidence, result.sourceConfidence || 'low');
    if (call.name === 'generate_codex_packet' || call.name === 'generate_patch_proposal') {
      requiresApproval = true;
    }

    toolMessages.push({
      role: 'tool',
      content: JSON.stringify({ name: call.name, result }),
    });
  }

  if (toolsUsed.length === 0) {
    warnings.push('No tools were used; answer may be less grounded.');
  }

  pushUniqueSources(sources, baselineSources(snapshot, false));
  if (snapshot?.bench_evidence?.available) {
    evidenceLevel = highestEvidenceLevel([evidenceLevel, 'E2']);
  }
  if (sources.some((source) => source.authority === 'canonical')) {
    sourceConfidence = mergeConfidence(sourceConfidence, 'high');
  }

  let finalReply = 'Marcus completed tool-assisted analysis.';
  try {
    const final = await callOllamaChat({
      messages: [
        ...messages,
        ...toolMessages,
        {
          role: 'user',
          content: 'Summarize findings with exact truth boundaries, warnings, and next action in concise form.',
        },
      ],
    });
    const content = final?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      finalReply = content;
    } else {
      warnings.push('Final model response was empty; fallback summary used.');
    }
  } catch (error) {
    warnings.push(`Final model synthesis failed; fallback summary used: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    mode: safeMode,
    degraded: false,
    reply: finalReply,
    toolsUsed,
    sources,
    warnings,
    generatedFiles: Array.from(new Set(generatedFiles)),
    evidenceLevel,
    sourceConfidence,
    recommendedNextAction:
      safeMode === 'coding-plan'
        ? 'Review generated coding plan and approve execution before making repo edits.'
        : 'Run focused validation gates for any proposed engineering action.',
    requiresApproval,
  };
}
