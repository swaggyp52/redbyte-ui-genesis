import type { AgentExecution } from "./types";
import { agents } from "./registry";

export interface AgentHostResult {
  execution: AgentExecution;
  agentName: string | null;
}

export function createExecution(agentId: string, input: string): AgentHostResult {
  const agent = agents.find((a) => a.id === agentId) ?? null;

  const execution: AgentExecution = {
    id: `exec_${Date.now()}`,
    agentId,
    input,
    createdAt: Date.now(),
    status: "pending",
  };

  return {
    execution,
    agentName: agent?.name ?? null,
  };
}

