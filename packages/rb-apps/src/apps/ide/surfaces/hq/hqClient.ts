import type {
  HqBenchEvidence,
  HqChatMode,
  HqChatMessage,
  HqChatRequestOptions,
  HqChatResponse,
  HqCodingPlanRequest,
  HqCommandResponse,
  HqHealth,
  HqSnapshot,
} from './hqTypes';

const HQ_BASE_URL = import.meta.env.VITE_REDBYTE_HQ_URL || 'http://127.0.0.1:4255';

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HQ request failed (${response.status}): ${text || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function getHqHealth(): Promise<HqHealth> {
  const response = await fetch(`${HQ_BASE_URL}/health`);
  return parseJson<HqHealth>(response);
}

export async function getHqSnapshot(): Promise<HqSnapshot> {
  const response = await fetch(`${HQ_BASE_URL}/snapshot`);
  return parseJson<HqSnapshot>(response);
}

export async function getHqBenchEvidence(): Promise<HqBenchEvidence> {
  const response = await fetch(`${HQ_BASE_URL}/bench-evidence`);
  return parseJson<HqBenchEvidence>(response);
}

export async function sendMarcusChat(
  message: string,
  history: HqChatMessage[],
  options?: HqChatRequestOptions,
): Promise<HqChatResponse> {
  const response = await fetch(`${HQ_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      mode: options?.mode ?? 'ask',
      allowTools: options?.allowTools ?? true,
      maxToolCalls: options?.maxToolCalls ?? 4,
    }),
  });
  return parseJson<HqChatResponse>(response);
}

export async function generateMarcusCodingPlan(payload: HqCodingPlanRequest): Promise<HqCommandResponse> {
  const response = await fetch(`${HQ_BASE_URL}/coding-plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<HqCommandResponse>(response);
}

export async function runProblemIntake(rawFeedback: string): Promise<HqCommandResponse> {
  const response = await fetch(`${HQ_BASE_URL}/problem-intake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ raw_feedback: rawFeedback }),
  });
  return parseJson<HqCommandResponse>(response);
}

export async function runTraceClaim(claim: string): Promise<HqCommandResponse> {
  const response = await fetch(`${HQ_BASE_URL}/trace-claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ claim }),
  });
  return parseJson<HqCommandResponse>(response);
}

export async function runMemorySearch(query: string): Promise<HqCommandResponse> {
  const response = await fetch(`${HQ_BASE_URL}/memory-search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return parseJson<HqCommandResponse>(response);
}
