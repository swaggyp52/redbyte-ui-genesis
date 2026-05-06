#!/usr/bin/env node
/**
 * marcus-packet-store.mjs
 *
 * Local file-backed store for Marcus workbench history packets.
 * Packets are written under .redbyte/agent/runs/hq/packets/ as JSON files.
 * This directory is gitignored. No database. No cloud sync. No Obsidian writes.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ALLOWED_TYPES = new Set([
  'chat_answer',
  'coding_plan',
  'problem_packet',
  'trace_report',
  'bench_summary',
  'control_snapshot',
  'fallback_report',
]);

/** Sanitize a packet type to an allowlisted value. */
export function sanitizePacketType(type) {
  return ALLOWED_TYPES.has(String(type || '')) ? String(type) : 'chat_answer';
}

/** Sanitize a packet ID to safe characters only. Rejects traversal patterns. */
export function sanitizePacketId(id) {
  const s = String(id || '').trim();
  // Allow: alphanumeric, hyphens, underscores, dots — nothing else
  if (!/^[a-zA-Z0-9_\-.]{1,120}$/.test(s)) {
    throw new Error(`Invalid packet id: ${JSON.stringify(s)}`);
  }
  // Reject any path traversal fragment
  if (s.includes('..') || s.includes('/') || s.includes('\\')) {
    throw new Error(`Packet id contains path traversal: ${JSON.stringify(s)}`);
  }
  return s;
}

/** Generate a stable packet ID: {type}-{timestamp}-{6-char-random} */
export function generatePacketId(type) {
  const safeType = sanitizePacketType(type);
  const ts = new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15); // e.g. 20260506T045900
  const rand = crypto.randomBytes(3).toString('hex'); // 6 hex chars
  return `${safeType}-${ts}-${rand}`;
}

/** Ensure the packet directory exists. */
export function ensurePacketDir(packetDir) {
  if (!fs.existsSync(packetDir)) {
    fs.mkdirSync(packetDir, { recursive: true });
  }
}

/**
 * Save a packet to disk.
 * Returns the saved packet with id, path, and createdAt filled in.
 *
 * @param {object} packet - Packet fields (type, title, summary, prompt, reply, etc.)
 * @param {string} packetDir - Absolute path to packet directory
 * @returns {object} saved packet
 */
export function savePacket(packet, packetDir) {
  ensurePacketDir(packetDir);

  const type = sanitizePacketType(packet.type);
  const id = packet.id || generatePacketId(type);
  const createdAt = packet.createdAt || new Date().toISOString();
  const fileName = `${id}.json`;
  const filePath = path.join(packetDir, fileName);

  // Safety: confirm resolved path stays inside packetDir
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(packetDir);
  if (!resolved.startsWith(resolvedDir + path.sep) && resolved !== resolvedDir) {
    throw new Error(`Packet path escaped allowed directory: ${resolved}`);
  }

  const full = {
    id,
    createdAt,
    type,
    title: String(packet.title || '').slice(0, 200) || `${type} ${createdAt}`,
    summary: String(packet.summary || '').slice(0, 280),
    prompt: String(packet.prompt || '').slice(0, 600),
    reply: String(packet.reply || '').slice(0, 8000),
    mode: String(packet.mode || type),
    toolsUsed: Array.isArray(packet.toolsUsed) ? packet.toolsUsed : [],
    sources: Array.isArray(packet.sources) ? packet.sources : [],
    evidenceLevel: packet.evidenceLevel || 'E0',
    sourceConfidence: packet.sourceConfidence || 'low',
    generatedFiles: Array.isArray(packet.generatedFiles) ? packet.generatedFiles : [],
    warnings: Array.isArray(packet.warnings) ? packet.warnings : [],
    recommendedAction: String(packet.recommendedAction || packet.recommendedNextAction || '').slice(0, 700),
    requiresApproval: Boolean(packet.requiresApproval),
    degraded: Boolean(packet.degraded),
    path: `packets/${fileName}`,
    tags: Array.isArray(packet.tags) ? packet.tags : [],
  };

  fs.writeFileSync(filePath, JSON.stringify(full, null, 2), 'utf8');
  return full;
}

/**
 * List packets from disk, newest-first.
 *
 * @param {{ limit?: number; type?: string }} options
 * @param {string} packetDir
 * @returns {object[]} packet headers (id, createdAt, type, title, evidenceLevel, sourceConfidence, warningCount, generatedFileCount)
 */
export function listPackets({ limit = 20, type } = {}, packetDir) {
  if (!fs.existsSync(packetDir)) return [];

  const files = fs
    .readdirSync(packetDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const results = [];
  for (const file of files) {
    try {
      const filePath = path.join(packetDir, file);
      const resolved = path.resolve(filePath);
      const resolvedDir = path.resolve(packetDir);
      if (!resolved.startsWith(resolvedDir + path.sep)) continue; // skip anything outside

      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (type && raw.type !== type) continue;

      results.push({
        id: raw.id,
        createdAt: raw.createdAt,
        type: raw.type,
        title: raw.title,
        evidenceLevel: raw.evidenceLevel,
        sourceConfidence: raw.sourceConfidence,
        warningCount: Array.isArray(raw.warnings) ? raw.warnings.length : 0,
        generatedFileCount: Array.isArray(raw.generatedFiles) ? raw.generatedFiles.length : 0,
        degraded: raw.degraded || false,
      });
    } catch {
      // skip malformed packet files
    }
  }
  return results
    .sort((a, b) => {
      const created = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      return created !== 0 ? created : String(b.id || '').localeCompare(String(a.id || ''));
    })
    .slice(0, limit);
}

/**
 * Read a full packet by ID.
 * Throws if id is invalid or packet not found.
 *
 * @param {string} id
 * @param {string} packetDir
 * @returns {object} full packet
 */
export function readPacket(id, packetDir) {
  const safeId = sanitizePacketId(id); // throws on invalid
  const fileName = `${safeId}.json`;
  const filePath = path.join(packetDir, fileName);

  // Path traversal check
  const resolved = path.resolve(filePath);
  const resolvedDir = path.resolve(packetDir);
  if (!resolved.startsWith(resolvedDir + path.sep)) {
    throw new Error(`Packet path escaped allowed directory: ${resolved}`);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Packet not found: ${safeId}`);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
