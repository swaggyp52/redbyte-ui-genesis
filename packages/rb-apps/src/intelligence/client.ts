export type IntelligenceStage = 'build' | 'simulate' | 'hardware' | 'submit';

export interface IntelligenceAnalyzePayload {
  projectId?: string;
  labId: string;
  stage: IntelligenceStage;
  projectSummary: string;
  traces?: {
    sim?: string;
    hw?: string;
  };
  gates?: Array<{
    code?: string;
    severity?: string;
    title?: string;
    message?: string;
  }>;
  userIntent: string;
}

export interface IntelligenceAction {
  label: string;
  title?: string;
  why?: string;
  fixIntent?: string;
  severity?: 'blocking' | 'warning';
  intent?: string;
  targetStage?: IntelligenceStage;
  targetTestId?: string;
}

export interface IntelligenceAnalyzeResult {
  summary: string;
  actions: IntelligenceAction[];
  confidence: number;
  citations?: string[];
  debug: Record<string, unknown>;
}

interface RuntimeConfig {
  enabled: boolean;
  baseUrl: string;
}

const REQUEST_TIMEOUT_MS = 2000;
const RETRIES = 1;
const resultCache = new Map<string, IntelligenceAnalyzeResult>();

function readEnv(name: string): string {
  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env[name] === 'string') {
      return process.env[name] ?? '';
    }
  } catch {
    // ignore
  }

  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    return env?.[name] ?? '';
  } catch {
    return '';
  }
}

function getRuntimeConfig(): RuntimeConfig {
  const enabledRaw = readEnv('RB_INTEL_ENABLED') || readEnv('VITE_RB_INTEL_ENABLED');
  const enabled = /^(1|true|yes)$/i.test(enabledRaw.trim());

  const baseUrl =
    readEnv('RB_INTEL_URL')
    || readEnv('VITE_RB_INTEL_URL')
    || '';

  return {
    enabled,
    baseUrl: baseUrl.trim().replace(/\/$/, ''),
  };
}

function fallbackResult(reason: string): IntelligenceAnalyzeResult {
  return {
    summary: 'RedByte Intelligence is unavailable. Continue with the current stage checklist and submission gates.',
    actions: [],
    confidence: 0.5,
    citations: [],
    debug: {
      fallback: true,
      reason,
    },
  };
}

function normalizeResult(data: unknown): IntelligenceAnalyzeResult {
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    summary: typeof raw.summary === 'string' && raw.summary.trim().length > 0
      ? raw.summary
      : 'No summary returned.',
    actions: Array.isArray(raw.actions)
      ? raw.actions
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          label: typeof item.label === 'string' ? item.label : 'Open current stage',
          title: typeof item.title === 'string' ? item.title : undefined,
          why: typeof item.why === 'string' ? item.why : undefined,
          fixIntent: typeof item.fixIntent === 'string' ? item.fixIntent : undefined,
          severity: item.severity === 'blocking' || item.severity === 'warning' ? item.severity : undefined,
          intent: typeof item.intent === 'string' ? item.intent : 'open-stage',
          targetStage: item.targetStage as IntelligenceStage | undefined,
          targetTestId: typeof item.targetTestId === 'string' ? item.targetTestId : undefined,
        }))
      : [],
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
    citations: Array.isArray(raw.citations) ? raw.citations.filter((entry): entry is string => typeof entry === 'string') : [],
    debug: typeof raw.debug === 'object' && raw.debug ? (raw.debug as Record<string, unknown>) : {},
  };
}

function buildCacheKey(payload: IntelligenceAnalyzePayload): string {
  const gateHash = JSON.stringify((payload.gates ?? []).map((gate) => ({
    code: gate.code ?? '',
    severity: gate.severity ?? '',
    title: gate.title ?? '',
    message: gate.message ?? '',
  })));
  const projectSummary = payload.projectSummary ?? '';
  return [
    payload.projectId ?? '',
    payload.labId,
    payload.stage,
    payload.userIntent,
    projectSummary,
    gateHash,
  ].join('::');
}

export async function analyze(payload: IntelligenceAnalyzePayload): Promise<IntelligenceAnalyzeResult> {
  const cacheKey = buildCacheKey(payload);
  const cached = resultCache.get(cacheKey);
  if (cached) return cached;

  const config = getRuntimeConfig();
  if (!config.enabled) {
    const fallback = fallbackResult('disabled');
    resultCache.set(cacheKey, fallback);
    return fallback;
  }
  if (!config.baseUrl) {
    const fallback = fallbackResult('missing-url');
    resultCache.set(cacheKey, fallback);
    return fallback;
  }

  const targetUrl = `${config.baseUrl}/v1/analyze`;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`intel_http_${response.status}`);
      }

      const data = await response.json();
      const normalized = normalizeResult(data);
      resultCache.set(cacheKey, normalized);
      return normalized;
    } catch (error) {
      lastError = error;
      if (attempt >= RETRIES) break;
    } finally {
      clearTimeout(timer);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : 'network-error';
  const fallback = fallbackResult(reason);
  resultCache.set(cacheKey, fallback);
  return fallback;
}
