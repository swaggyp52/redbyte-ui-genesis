import type {
  HqBenchEvidence,
  HqBenchTimelineResponse,
  HqChatMode,
  HqChatMessage,
  HqChatRequestOptions,
  HqChatResponse,
  HqCodingPlanRequest,
  HqCommandResponse,
  HqHealth,
  HqPacketListResponse,
  HqPacketReadResponse,
  HqPatchProposalListResponse,
  HqPatchProposalMutationResponse,
  HqPatchProposalReadResponse,
  HqSessionEventsResponse,
  HqSnapshot,
  HqTaskListResponse,
  HqTaskMutationResponse,
  HqTaskReadResponse,
  HqTaskStatus,
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

export async function getHqBenchTimeline(): Promise<HqBenchTimelineResponse> {
  const response = await fetch(`${HQ_BASE_URL}/bench-timeline`);
  return parseJson<HqBenchTimelineResponse>(response);
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

export async function listHqPackets(options?: { limit?: number; type?: string }): Promise<HqPacketListResponse> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.type) params.set('type', options.type);
  const qs = params.toString();
  const response = await fetch(`${HQ_BASE_URL}/packets${qs ? `?${qs}` : ''}`);
  return parseJson<HqPacketListResponse>(response);
}

export async function readHqPacket(id: string): Promise<HqPacketReadResponse> {
  const response = await fetch(`${HQ_BASE_URL}/packets/${encodeURIComponent(id)}`);
  return parseJson<HqPacketReadResponse>(response);
}

export async function listHqTasks(options?: { limit?: number; status?: HqTaskStatus }): Promise<HqTaskListResponse> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.status) params.set('status', options.status);
  const qs = params.toString();
  const response = await fetch(`${HQ_BASE_URL}/tasks${qs ? `?${qs}` : ''}`);
  return parseJson<HqTaskListResponse>(response);
}

export async function readHqTask(id: string): Promise<HqTaskReadResponse> {
  const response = await fetch(`${HQ_BASE_URL}/tasks/${encodeURIComponent(id)}`);
  return parseJson<HqTaskReadResponse>(response);
}

export async function promoteHqPacketToTask(packetId: string): Promise<HqTaskMutationResponse> {
  const response = await fetch(`${HQ_BASE_URL}/tasks/from-packet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ packetId }),
  });
  return parseJson<HqTaskMutationResponse>(response);
}

export async function updateHqTaskStatus(id: string, status: HqTaskStatus): Promise<HqTaskMutationResponse> {
  const response = await fetch(`${HQ_BASE_URL}/tasks/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return parseJson<HqTaskMutationResponse>(response);
}

export async function listHqPatchProposals(options?: { limit?: number }): Promise<HqPatchProposalListResponse> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  const qs = params.toString();
  const response = await fetch(`${HQ_BASE_URL}/patch-proposals${qs ? `?${qs}` : ''}`);
  return parseJson<HqPatchProposalListResponse>(response);
}

export async function readHqPatchProposal(id: string): Promise<HqPatchProposalReadResponse> {
  const response = await fetch(`${HQ_BASE_URL}/patch-proposals/${encodeURIComponent(id)}`);
  return parseJson<HqPatchProposalReadResponse>(response);
}

export async function draftHqPatchProposal(payload: {
  taskId?: string | null;
  packetId?: string | null;
  rawRequest?: string;
}): Promise<HqPatchProposalMutationResponse> {
  const response = await fetch(`${HQ_BASE_URL}/patch-proposals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<HqPatchProposalMutationResponse>(response);
}

export async function listHqSessionEvents(options?: { limit?: number; type?: string }): Promise<HqSessionEventsResponse> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.type) params.set('type', options.type);
  const qs = params.toString();
  const response = await fetch(`${HQ_BASE_URL}/session/events${qs ? `?${qs}` : ''}`);
  return parseJson<HqSessionEventsResponse>(response);
}

export async function clearHqSession(): Promise<{ ok: boolean }> {
  const response = await fetch(`${HQ_BASE_URL}/session/clear`, { method: 'POST' });
  return parseJson<{ ok: boolean }>(response);
}
