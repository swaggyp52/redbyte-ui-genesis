// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { SerializedCircuitV1, CircuitNode, CircuitConnection } from '../types';
import type { CheckpointDef, CheckpointResult } from '../lab/LabDefinition';

/**
 * BridgeClient: TypeScript adapter for communicating with FPGA Bridge Service
 * 
 * H2.2: Provides type-safe wrapper around WebSocket protocol for checkpoint
 * evaluation requests, with request-response tracking and error handling.
 */

export interface BridgeConfig {
  /** Bridge WebSocket URL (e.g., ws://localhost:3001) */
  url: string;
  /** Timeout in milliseconds for waiting on responses */
  timeout?: number;
}

export interface EvaluateCheckpointRequest {
  type: 'evaluate-checkpoint';
  requestId: string;
  circuit: SerializedCircuitV1;
  checkpoint: CheckpointDef;
}

export interface EvaluateCheckpointResponse {
  type: 'evaluate-checkpoint-result';
  requestId: string;
  result: CheckpointResult;
}

export interface ErrorResponse {
  type: 'error';
  error: string;
  requestId?: string;
}

export type BridgeMessage = EvaluateCheckpointResponse | ErrorResponse;

/**
 * BridgeClient manages WebSocket connections and checkpoint evaluation
 */
export class BridgeClient {
  private ws: WebSocket | null = null;
  private url: string;
  private timeout: number;
  private requestMap: Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timer: number }> = new Map();
  private nextRequestId = 0;

  constructor(config: BridgeConfig) {
    this.url = config.url;
    this.timeout = config.timeout ?? 10000;
  }

  /**
   * Connect to the FPGA Bridge Service
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[BridgeClient] Connected to FPGA Bridge');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as BridgeMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error('[BridgeClient] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (event) => {
          console.error('[BridgeClient] WebSocket error:', event);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('[BridgeClient] Connection closed');
          this.ws = null;
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect from the bridge
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a ping to verify connection is alive
   */
  async ping(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Bridge client not connected');
    }

    return this.sendRequest({ type: 'ping' } as any);
  }

  /**
   * Evaluate a checkpoint against a circuit
   * 
   * @param circuit - The circuit to evaluate
   * @param checkpoint - The checkpoint definition with test vectors
   * @returns Evaluation result with pass/fail status and feedback
   */
  async evaluateCheckpoint(circuit: SerializedCircuitV1, checkpoint: CheckpointDef): Promise<CheckpointResult> {
    if (!this.isConnected()) {
      throw new Error('Bridge client not connected');
    }

    const requestId = this.generateRequestId();

    const request: EvaluateCheckpointRequest = {
      type: 'evaluate-checkpoint',
      requestId,
      circuit,
      checkpoint,
    };

    const response = await this.sendRequest(request);

    if (response.type === 'evaluate-checkpoint-result') {
      return response.result;
    }

    throw new Error(`Unexpected response type: ${response.type}`);
  }

  /**
   * Send a request and wait for response
   */
  private async sendRequest(message: any): Promise<any> {
    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    const requestId = message.requestId || this.generateRequestId();
    message.requestId = requestId;

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.requestMap.delete(requestId);
        reject(new Error(`Request ${requestId} timed out after ${this.timeout}ms`));
      }, this.timeout);

      this.requestMap.set(requestId, { resolve, reject, timer });

      try {
        this.ws!.send(JSON.stringify(message));
      } catch (error) {
        this.requestMap.delete(requestId);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming message from bridge
   */
  private handleMessage(message: BridgeMessage): void {
    const { requestId } = message as any;

    if (!requestId) {
      console.warn('[BridgeClient] Received message without requestId:', message);
      return;
    }

    const pending = this.requestMap.get(requestId);
    if (!pending) {
      console.warn('[BridgeClient] Received response for unknown request:', requestId);
      return;
    }

    this.requestMap.delete(requestId);
    clearTimeout(pending.timer);

    if (message.type === 'error') {
      pending.reject(new Error((message as ErrorResponse).error));
    } else {
      pending.resolve(message);
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${++this.nextRequestId}-${Date.now()}`;
  }
}

/**
 * Global bridge client instance (singleton)
 */
let globalBridgeClient: BridgeClient | null = null;

/**
 * Get or create the global bridge client
 */
export function getBridgeClient(config?: BridgeConfig): BridgeClient {
  if (!globalBridgeClient) {
    const bridgeUrl = config?.url ?? (typeof window !== 'undefined' ? 'ws://localhost:3001' : 'ws://localhost:3001');
    globalBridgeClient = new BridgeClient({ url: bridgeUrl, ...config });
  }

  return globalBridgeClient;
}

/**
 * Reset the global bridge client (for testing)
 */
export function resetBridgeClient(): void {
  if (globalBridgeClient) {
    globalBridgeClient.disconnect();
    globalBridgeClient = null;
  }
}
