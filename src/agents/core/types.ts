export type AgentKind = "system" | "devtool" | "assistant";

export interface AgentDefinition {
  id: string;
  name: string;
  kind: AgentKind;
  description?: string;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  input: string;
  createdAt: number;
  status: "pending" | "running" | "complete" | "error";
}
