export type LogicValue = 0 | 1;

export interface Vec3 {
  x: number;
  y: number;
  z?: number;
}

export interface NodeConfig {
  [key: string]: any;
}

export interface NodeInstance {
  id: string;
  type: string;
  position?: Vec3;
  rotation?: number;
  config?: NodeConfig;
}

export interface RuntimeNode extends NodeInstance {
  state: Record<string, any>;
}

export interface NodePortRef {
  nodeId: string;
  port: string;
}

export interface Connection {
  id: string;
  from: NodePortRef;
  to: NodePortRef;
}

export interface Circuit {
  nodes: RuntimeNode[];
  connections: Connection[];
}

export interface CircuitSchemaV1Node {
  id: string;
  type: string;
  position?: Vec3;
  rotation?: number;
  config?: NodeConfig;
}

export interface CircuitSchemaV1 {
  version: 1;
  nodes: CircuitSchemaV1Node[];
  connections: Connection[];
}
