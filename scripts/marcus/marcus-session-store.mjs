#!/usr/bin/env node
/**
 * marcus-session-store.mjs
 *
 * Local JSONL-backed store for Marcus HQ session events.
 * Events are written under .redbyte/agent/runs/hq/session/events.jsonl
 * This directory is gitignored. No database. No cloud sync. No Obsidian writes.
 *
 * Write failures are warn-only and never crash the main action.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ALLOWED_EVENT_TYPES = new Set([
  'user_message',
  'marcus_reply',
  'tool_call',
  'tool_result',
  'warning',
  'degraded_mode',
  'packet_saved',
  'coding_plan_generated',
  'source_grounding',
  'runtime_status',
  'error',
]);

const ALLOWED_SEVERITIES = new Set(['info', 'warn', 'error', 'success']);

/** Sanitize an event type to an allowlisted value. */
export function sanitizeEventType(type) {
  return ALLOWED_EVENT_TYPES.has(String(type || '')) ? String(type) : 'runtime_status';
}

/** Sanitize a severity to an allowlisted value. */
export function sanitizeSeverity(severity) {
  return ALLOWED_SEVERITIES.has(String(severity || '')) ? String(severity) : 'info';
}

/** Generate a unique event ID. */
export function generateEventId(type) {
  const safeType = sanitizeEventType(type);
  const ts = new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15);
  const rand = crypto.randomBytes(3).toString('hex');
  return `${safeType}-${ts}-${rand}`;
}

/** Ensure the session directory exists. */
export function ensureSessionDir(sessionDir) {
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
}

/**
 * Append one session event to events.jsonl.
 * Returns the normalized event.
 *
 * @param {object} event
 * @param {string} sessionDir - Absolute path to session directory
 * @returns {object} normalized event
 */
export function appendEvent(event, sessionDir) {
  ensureSessionDir(sessionDir);

  const eventsFile = path.join(sessionDir, 'events.jsonl');

  // Safety: resolved path must stay inside sessionDir
  const resolved = path.resolve(eventsFile);
  const resolvedDir = path.resolve(sessionDir);
  if (!resolved.startsWith(resolvedDir + path.sep) && resolved !== resolvedDir) {
    throw new Error(`Session event path escaped allowed directory: ${resolved}`);
  }

  const type = sanitizeEventType(event.type);
  const id = event.id || generateEventId(type);
  const createdAt = event.createdAt || new Date().toISOString();
  const severity = sanitizeSeverity(event.severity);

  const normalized = {
    id,
    createdAt,
    type,
    title: String(event.title || type).slice(0, 200),
    summary: String(event.summary || '').slice(0, 500),
    severity,
    toolName: event.toolName ? String(event.toolName).slice(0, 80) : null,
    packetId: event.packetId ? String(event.packetId).slice(0, 120) : null,
    generatedFiles: Array.isArray(event.generatedFiles) ? event.generatedFiles.slice(0, 10).map(String) : [],
    sources: Array.isArray(event.sources) ? event.sources.slice(0, 5) : [],
    evidenceLevel: event.evidenceLevel || null,
    degraded: Boolean(event.degraded),
    metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {},
  };

  const line = JSON.stringify(normalized) + '\n';
  fs.appendFileSync(eventsFile, line, 'utf8');
  return normalized;
}

/**
 * List the latest session events.
 * Returns events newest-first.
 *
 * @param {{ limit?: number, type?: string }} options
 * @param {string} sessionDir
 * @returns {object[]}
 */
export function listEvents({ limit = 20, type } = {}, sessionDir) {
  const eventsFile = path.join(sessionDir, 'events.jsonl');
  if (!fs.existsSync(eventsFile)) return [];

  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 20;

  const lines = fs.readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean);

  const events = [];
  for (const line of lines) {
    try {
      const ev = JSON.parse(line);
      if (!ev || typeof ev !== 'object') continue;
      if (type && ev.type !== type) continue;
      events.push(ev);
    } catch {
      // skip malformed lines
    }
  }

  // Return newest-first, limited to safeLimit
  return events.slice(-safeLimit).reverse();
}

/**
 * Clear all session events. Overwrites events.jsonl with empty content.
 *
 * @param {string} sessionDir
 */
export function clearEvents(sessionDir) {
  const eventsFile = path.join(sessionDir, 'events.jsonl');
  if (fs.existsSync(eventsFile)) {
    fs.writeFileSync(eventsFile, '', 'utf8');
  }
}
