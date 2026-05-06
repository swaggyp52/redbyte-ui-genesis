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
  counts?: {
    E0: number;
    E1: number;
    E2: number;
    E3: number;
  };
  targets?: HqBenchTarget[];
  message?: string;
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

export interface HqChatResponse {
  ok: boolean;
  offline: boolean;
  reply: string;
  error?: string;
  agent_name?: string;
  source_hints?: string[];
}

export interface HqCommandResponse {
  ok: boolean;
  output?: string;
  error?: string | null;
}
