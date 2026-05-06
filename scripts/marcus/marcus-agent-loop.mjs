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
    case 'ask':
    default:
      return ['get_product_snapshot'];
  }
}

function buildSystemPrompt(snapshot, mode) {
  return [
    'You are Marcus, a local RedByte engineering operator.',
    'Protect truth boundaries: E2 is not E3, Map Pins is not Verify proof, Draft Export is not Trusted Export.',
    'Generated outputs are advisory and require human/Codex approval for implementation.',
    'Do not request unsafe commands or file edits.',
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
      sources.push(toolName);
      if (result?.data?.artifacts?.markdownPath) {
        generatedFiles.push(result.data.artifacts.markdownPath);
      }
      if (toolName === 'generate_codex_packet') {
        requiresApproval = true;
      }
    }

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
      generatedFiles,
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
    sources.push(call.name);

    if (result?.data?.artifacts?.markdownPath) {
      generatedFiles.push(result.data.artifacts.markdownPath);
    }
    if (call.name === 'generate_codex_packet') {
      requiresApproval = true;
    }

    toolMessages.push({
      role: 'tool',
      content: JSON.stringify({ name: call.name, result }),
    });
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
    sources: Array.from(new Set(sources)),
    warnings,
    generatedFiles,
    recommendedNextAction:
      safeMode === 'coding-plan'
        ? 'Review generated coding plan and approve execution before making repo edits.'
        : 'Run focused validation gates for any proposed engineering action.',
    requiresApproval,
  };
}
