#!/usr/bin/env node
/**
 * marcus-task-queue.mjs
 *
 * Local file-backed operator task queue for Marcus HQ.
 * Tasks are generated planning artifacts under .redbyte/agent/runs/hq/tasks/.
 * They are not canonical product truth and never edit repo files.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ALLOWED_STATUSES = new Set(['candidate', 'ready', 'blocked', 'in_progress', 'done', 'archived']);

export function sanitizeTaskStatus(status) {
  const value = String(status || '').trim();
  return ALLOWED_STATUSES.has(value) ? value : 'candidate';
}

export function sanitizeTaskId(id) {
  const value = String(id || '').trim();
  if (!/^[a-zA-Z0-9_\-.]{1,120}$/.test(value)) {
    throw new Error(`Invalid task id: ${JSON.stringify(value)}`);
  }
  if (value.includes('..') || value.includes('/') || value.includes('\\')) {
    throw new Error(`Task id contains path traversal: ${JSON.stringify(value)}`);
  }
  return value;
}

export function generateTaskId(sourcePacketId = '') {
  const stem = String(sourcePacketId || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36) || 'task';
  const ts = new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15);
  return `${stem}-${ts}-${crypto.randomBytes(3).toString('hex')}`;
}

export function ensureTaskDir(taskDir) {
  if (!fs.existsSync(taskDir)) {
    fs.mkdirSync(taskDir, { recursive: true });
  }
}

export function assertPathInside(baseDir, targetPath) {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  if (!resolved.startsWith(resolvedBase + path.sep)) {
    throw new Error(`Task path escaped allowed directory: ${resolved}`);
  }
}

function clip(value, limit) {
  return String(value || '').slice(0, limit);
}

function detectProductArea(packet) {
  const text = `${packet?.title || ''} ${packet?.prompt || ''} ${packet?.reply || ''}`.toLowerCase();
  if (text.includes('export') || text.includes('vivado')) return 'Export / Vivado handoff';
  if (text.includes('map pins') || text.includes('hardware') || text.includes('basys3')) return 'Map Pins / Hardware';
  if (text.includes('verify') || text.includes('proof') || text.includes('evidence')) return 'Verify / Evidence';
  if (text.includes('design')) return 'Design';
  if (text.includes('project')) return 'Project';
  if (text.includes('hq') || text.includes('marcus')) return 'HQ / Marcus';
  return 'RedByte product control';
}

function arrayOfStrings(value, limit = 20) {
  return Array.isArray(value) ? value.slice(0, limit).map((item) => String(item).slice(0, 280)) : [];
}

export function createTaskFromPacket(packet, taskDir) {
  if (!packet || typeof packet !== 'object') {
    throw new Error('Valid packet is required.');
  }
  if (!packet.id) {
    throw new Error('Packet id is required.');
  }

  ensureTaskDir(taskDir);

  const id = generateTaskId(packet.id);
  const createdAt = new Date().toISOString();
  const task = {
    id,
    createdAt,
    updatedAt: createdAt,
    title: clip(packet.title || packet.prompt || `Task from ${packet.id}`, 160),
    status: packet.requiresApproval ? 'candidate' : 'ready',
    sourcePacketId: String(packet.id),
    summary: clip(packet.summary || packet.reply || '', 700),
    recommendedAction: clip(packet.recommendedAction || packet.recommendedNextAction || 'Review packet evidence, then create a bounded Codex execution prompt.', 700),
    productArea: detectProductArea(packet),
    evidenceLevel: packet.evidenceLevel || 'E0',
    sourceConfidence: packet.sourceConfidence || 'low',
    blockers: arrayOfStrings(packet.warnings, 12),
    doNotTouch: [
      'Do not let generated packets override repo truth.',
      'Do not write to Obsidian from Marcus v1.',
      'Do not enable direct file editing, git commit, git push, or arbitrary shell execution.',
    ],
    tests: arrayOfStrings(packet.tests || packet.testsAndGates, 20),
    codexPrompt: clip(packet.codexPrompt || packet.prompt || packet.reply || '', 5000),
    generatedFiles: arrayOfStrings(packet.generatedFiles, 20),
    sources: Array.isArray(packet.sources) ? packet.sources.slice(0, 20) : [],
  };

  const filePath = path.join(taskDir, `${id}.json`);
  assertPathInside(taskDir, filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(task, null, 2)}\n`, 'utf8');
  return task;
}

export function listTasks({ limit = 20, status } = {}, taskDir) {
  if (!fs.existsSync(taskDir)) return [];
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const files = fs.readdirSync(taskDir).filter((file) => file.endsWith('.json')).sort().reverse();
  const tasks = [];
  for (const file of files) {
    if (tasks.length >= safeLimit) break;
    const filePath = path.join(taskDir, file);
    try {
      assertPathInside(taskDir, filePath);
      const task = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (status && task.status !== status) continue;
      tasks.push({
        id: task.id,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        title: task.title,
        status: task.status,
        sourcePacketId: task.sourcePacketId,
        productArea: task.productArea,
        evidenceLevel: task.evidenceLevel,
        sourceConfidence: task.sourceConfidence,
        blockerCount: Array.isArray(task.blockers) ? task.blockers.length : 0,
      });
    } catch {
      // skip malformed local task files
    }
  }
  return tasks;
}

export function readTask(id, taskDir) {
  const safeId = sanitizeTaskId(id);
  const filePath = path.join(taskDir, `${safeId}.json`);
  assertPathInside(taskDir, filePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Task not found: ${safeId}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function updateTaskStatus(id, status, taskDir) {
  const task = readTask(id, taskDir);
  task.status = sanitizeTaskStatus(status);
  task.updatedAt = new Date().toISOString();
  const filePath = path.join(taskDir, `${task.id}.json`);
  assertPathInside(taskDir, filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(task, null, 2)}\n`, 'utf8');
  return task;
}
