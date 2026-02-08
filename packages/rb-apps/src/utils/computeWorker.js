// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Web Worker for heavy computation (evidence hashing, serialization).
 *
 * Uses an inline blob worker so no separate file is needed at deploy time.
 * Falls back to main-thread execution when:
 * - Workers are unavailable (SSR, old browsers)
 * - The `web-workers` feature flag is off
 *
 * Supported operations:
 * - hashBytes: SHA-256 of ArrayBuffer → hex string
 * - stableHash: SHA-256 of canonical JSON → hex string
 * - stableSerialize: canonical JSON serialization → string
 */
import { isFeatureEnabled } from '@redbyte/rb-utils';
// ---------------------------------------------------------------------------
// Worker source (inlined as string, turned into blob URL)
// ---------------------------------------------------------------------------
const WORKER_SOURCE = /* js */ `
'use strict';

const EPHEMERAL_KEYS = new Set([
  '_dirty', '_ephemeral', '_cached', '_transient', '_lastRenderTime',
]);

function isEphemeral(key) {
  return key.startsWith('_') || EPHEMERAL_KEYS.has(key);
}

function canonicalize(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const keys = Object.keys(value).sort();
  const result = {};
  for (const key of keys) {
    if (isEphemeral(key)) continue;
    const v = value[key];
    if (v === undefined) continue;
    result[key] = canonicalize(v);
  }
  return result;
}

function stableSerialize(value) {
  return JSON.stringify(canonicalize(value));
}

function toHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

async function sha256Bytes(data) {
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return toHex(buffer);
}

async function sha256String(str) {
  const data = new TextEncoder().encode(str);
  return sha256Bytes(data);
}

self.onmessage = async (e) => {
  const { id, op, payload } = e.data;
  try {
    let result;
    switch (op) {
      case 'hashBytes':
        result = await sha256Bytes(payload);
        break;
      case 'stableHash':
        result = await sha256String(stableSerialize(payload));
        break;
      case 'stableSerialize':
        result = stableSerialize(payload);
        break;
      default:
        throw new Error('Unknown op: ' + op);
    }
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err.message || 'Worker error' });
  }
};
`;
let worker = null;
let msgId = 0;
const pending = new Map();
let workerFailed = false;
function getWorker() {
    if (workerFailed)
        return null;
    if (worker)
        return worker;
    try {
        const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        worker = new Worker(url);
        worker.onmessage = (e) => {
            const { id, result, error } = e.data;
            const p = pending.get(id);
            if (!p)
                return;
            pending.delete(id);
            if (error) {
                p.reject(new Error(error));
            }
            else {
                p.resolve(result);
            }
        };
        worker.onerror = () => {
            // Worker creation or runtime failure — fall back permanently
            workerFailed = true;
            worker = null;
            // Reject all pending
            for (const [, p] of pending) {
                p.reject(new Error('Worker failed'));
            }
            pending.clear();
        };
        return worker;
    }
    catch {
        workerFailed = true;
        return null;
    }
}
function postToWorker(op, payload, transfer) {
    const w = getWorker();
    if (!w)
        return Promise.reject(new Error('No worker'));
    const id = ++msgId;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        w.postMessage({ id, op, payload }, transfer ?? []);
    });
}
// ---------------------------------------------------------------------------
// Feature-flag-gated public API
// ---------------------------------------------------------------------------
function useWorker() {
    if (typeof Worker === 'undefined')
        return false;
    if (workerFailed)
        return false;
    return isFeatureEnabled('web-workers');
}
// Main-thread fallback imports (lazy)
let mainFallback = null;
async function getFallback() {
    if (!mainFallback) {
        mainFallback = await import('./stableSerialize');
    }
    return mainFallback;
}
/**
 * SHA-256 hash of an ArrayBuffer — off main thread when possible.
 */
export async function hashBytesOffThread(data) {
    if (useWorker()) {
        try {
            // Transfer the buffer to avoid copy (caller must not reuse)
            return (await postToWorker('hashBytes', data, [data]));
        }
        catch {
            // Fall through to main thread
        }
    }
    const fb = await getFallback();
    return fb.hashBytes(data);
}
/**
 * SHA-256 of canonical JSON — off main thread when possible.
 */
export async function stableHashOffThread(value) {
    if (useWorker()) {
        try {
            return (await postToWorker('stableHash', value));
        }
        catch {
            // Fall through
        }
    }
    const fb = await getFallback();
    return fb.stableHash(value);
}
/**
 * Canonical JSON serialization — off main thread when possible.
 */
export async function stableSerializeOffThread(value) {
    if (useWorker()) {
        try {
            return (await postToWorker('stableSerialize', value));
        }
        catch {
            // Fall through
        }
    }
    const fb = await getFallback();
    return fb.stableSerialize(value);
}
/**
 * Terminate the worker (for cleanup / memory leak prevention).
 */
export function terminateComputeWorker() {
    if (worker) {
        worker.terminate();
        worker = null;
    }
    for (const [, p] of pending) {
        p.reject(new Error('Worker terminated'));
    }
    pending.clear();
}
