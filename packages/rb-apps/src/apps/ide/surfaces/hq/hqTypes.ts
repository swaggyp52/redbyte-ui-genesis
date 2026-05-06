export interface HqHealth {
  status: string;
  server: {
    host: string;
    port: number;
    repo_root: string;
  };
  agent: {
    name: string;
    model: string;
    ollama_base_url: string;
    ollama_online: boolean;
  };
  memory: {
    allow_obsidian_writes: boolean;
    index_available: boolean;
    chunk_count: number | null;
    embedded_chunk_count: number | null;
  };
  git: {
    clean: boolean;
    status_short: string;
    latest_commit: string;
  };
}

export interface HqBenchTarget {
  target_id: string;
  evidence_level: 'E0' | 'E1' | 'E2' | 'E3';
  observed_behavior_status: string;
  warning_classes: string[];
}

export interface HqBenchEvidence {
  available: boolean;
  run_folder?: string;
  generated_at?: string;
  warning?: string | null;
  counts?: {
    E0: number;
    E1: number;
    E2: number;
    E3: number;
  };
  targets?: HqBenchTarget[];
  message?: string;
}

export interface HqBenchTimelineRun {
  runFolder: string;
  generatedAt: string | null;
  targetCount: number;
  counts: {
    E0: number;
    E1: number;
    E2: number;
    E3: number;
  };
  warningClasses: Record<string, number>;
  hasClassification: boolean;
}

export interface HqBenchTimeline {
  available: boolean;
  runs: HqBenchTimelineRun[];
  targets: Array<HqBenchTarget & {
    blockers?: string[];
    recommended_next_action?: string | null;
  }>;
  counts: {
    E0: number;
    E1: number;
    E2: number;
    E3: number;
  };
  warningClasses: Record<string, number>;
  latestRunFolder: string | null;
  currentBlockerSummary: string;
  manualObservationNeededCount: number;
  message?: string;
}

export interface HqBenchTimelineResponse {
  ok: boolean;
  timeline: HqBenchTimeline;
}

export interface HqSnapshot {
  generated_at: string;
  blocked_task: string;
  bench_evidence: HqBenchEvidence;
  claims_trace_summary?: {
    proven?: number;
    partially_proven?: number;
    documented_only?: number;
    stale_conflicted?: number;
    unknown?: number;
  } | null;
  control_next?: {
    recommended_next_product_slice?: string;
    why_this_task_matters?: string;
  } | null;
}

export interface HqChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type HqSourceKind =
  | 'repo_doc'
  | 'obsidian_memory'
  | 'generated_run'
  | 'bench_evidence'
  | 'git_state'
  | 'tool_output'
  | 'fallback';

export type HqSourceFreshness = 'current' | 'stale_possible' | 'generated' | 'unknown';

export type HqSourceAuthority = 'canonical' | 'supporting' | 'memory' | 'generated' | 'fallback';

export type HqEvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3';

export type HqSourceConfidence = 'high' | 'medium' | 'low' | 'degraded';

export interface HqSourceRecord {
  id: string;
  kind: HqSourceKind;
  title: string;
  path: string | null;
  excerpt: string | null;
  freshness: HqSourceFreshness;
  authority: HqSourceAuthority;
}

export interface HqChatResponse {
  ok: boolean;
  mode?: HqChatMode;
  degraded: boolean;
  reply: string;
  toolsUsed?: Array<{
    name: string;
    ok: boolean;
    summary: string;
  }>;
  sources?: HqSourceRecord[];
  evidenceLevel?: HqEvidenceLevel;
  sourceConfidence?: HqSourceConfidence;
  warnings?: string[];
  generatedFiles?: string[];
  recommendedNextAction?: string;
  requiresApproval?: boolean;
  error?: string;
  agent_name?: string;
  source_hints?: string[];
  packetId?: string | null;
}

export type HqChatMode = 'ask' | 'explain-state' | 'problem-packet' | 'trace-claim' | 'coding-plan';

export interface HqCodingPlanRequest {
  raw_user_request: string;
  target_surface?: string;
  urgency?: string;
  constraints?: string;
}

export interface HqChatRequestOptions {
  mode?: HqChatMode;
  allowTools?: boolean;
  maxToolCalls?: number;
}

export interface HqCommandResponse {
  ok: boolean;
  mode?: HqChatMode;
  reply?: string;
  toolsUsed?: Array<{
    name: string;
    ok: boolean;
    summary: string;
  }>;
  sources?: HqSourceRecord[];
  evidenceLevel?: HqEvidenceLevel;
  sourceConfidence?: HqSourceConfidence;
  warnings?: string[];
  generatedFiles?: string[];
  recommendedNextAction?: string;
  requiresApproval?: boolean;
  degraded?: boolean;
  output?: string;
  error?: string | null;
  packetId?: string | null;
}

export type HqPacketType =
  | 'chat_answer'
  | 'coding_plan'
  | 'problem_packet'
  | 'trace_report'
  | 'bench_summary'
  | 'control_snapshot'
  | 'fallback_report';

export interface HqPacketHeader {
  id: string;
  createdAt: string;
  type: HqPacketType;
  title: string;
  evidenceLevel: HqEvidenceLevel;
  sourceConfidence: HqSourceConfidence;
  warningCount: number;
  generatedFileCount: number;
  degraded: boolean;
}

export interface HqPacket extends HqPacketHeader {
  summary: string;
  prompt: string;
  reply: string;
  mode: string;
  toolsUsed: Array<{ name: string; ok: boolean; summary: string }>;
  sources: HqSourceRecord[];
  generatedFiles: string[];
  warnings: string[];
  recommendedAction?: string;
  requiresApproval: boolean;
  path: string;
  tags: string[];
}

export interface HqPacketListResponse {
  ok: boolean;
  packets: HqPacketHeader[];
  total: number;
}

export interface HqPacketReadResponse {
  ok: boolean;
  packet: HqPacket;
}

export type HqTaskStatus = 'candidate' | 'ready' | 'blocked' | 'in_progress' | 'done' | 'archived';

export interface HqTaskHeader {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  status: HqTaskStatus;
  sourcePacketId: string;
  productArea: string;
  evidenceLevel: HqEvidenceLevel;
  sourceConfidence: HqSourceConfidence;
  blockerCount: number;
}

export interface HqTask extends HqTaskHeader {
  summary: string;
  recommendedAction: string;
  blockers: string[];
  doNotTouch: string[];
  tests: string[];
  codexPrompt: string;
  generatedFiles: string[];
  sources: HqSourceRecord[];
}

export interface HqTaskListResponse {
  ok: boolean;
  tasks: HqTaskHeader[];
  total: number;
}

export interface HqTaskReadResponse {
  ok: boolean;
  task: HqTask;
}

export interface HqTaskMutationResponse {
  ok: boolean;
  task: HqTask;
  error?: string;
}

export type HqSessionEventType =
  | 'user_message'
  | 'marcus_reply'
  | 'tool_call'
  | 'tool_result'
  | 'warning'
  | 'degraded_mode'
  | 'packet_saved'
  | 'coding_plan_generated'
  | 'source_grounding'
  | 'runtime_status'
  | 'error';

export type HqSessionEventSeverity = 'info' | 'warn' | 'error' | 'success';

export interface HqSessionEvent {
  id: string;
  createdAt: string;
  type: HqSessionEventType;
  title: string;
  summary: string;
  severity: HqSessionEventSeverity;
  toolName?: string | null;
  packetId?: string | null;
  generatedFiles?: string[];
  sources?: HqSourceRecord[];
  evidenceLevel?: HqEvidenceLevel | null;
  degraded?: boolean;
  metadata?: Record<string, unknown>;
}

export interface HqSessionEventsResponse {
  ok: boolean;
  events: HqSessionEvent[];
  total: number;
}
