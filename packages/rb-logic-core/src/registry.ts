import type { NodeDefinition } from "./types";

const registry = new Map<string, NodeDefinition>();

export function registerNode(def: NodeDefinition): void {
  registry.set(def.type, def);
}

export function getNodeDefinition(type: string): NodeDefinition {
  const def = registry.get(type);
  if (!def) {
    throw new Error(`Unknown node type: ${type}`);
  }
  return def;
}

export function clearRegistry() {
  registry.clear();
}

/** No-op for tests, auto-import happens below */
export function registerBuiltinNodes() {}

/* -------------------------------------------
   IMPORTANT: Load built-in nodes LAST so that
   registerNode() exists before nodes.ts executes
-------------------------------------------- */
import "./nodes";
