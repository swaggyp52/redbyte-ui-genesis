/**
 * path-utils.js
 * 
 * Shared path resolution utilities for vector-runner, diff-capsules, and proof-replay.
 * Enforces consistent repo-root-relative semantics across all FPGA bridge tools.
 */

import { execSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Find git repository root by walking upward from script directory.
 * @returns {string} Absolute path to repo root
 */
export function findRepoRoot() {
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: __dirname
    }).trim();
    return root;
  } catch (err) {
    throw new Error('Not in a git repository');
  }
}

/**
 * Resolve a path to absolute form, enforcing repo-root-relative semantics.
 * Non-negotiable invariant: all file IO uses resolved absolute paths.
 * 
 * @param {string} input - Raw path (may have quotes, forward/backslashes)
 * @returns {string} Absolute path
 */
export function resolveRepoPath(input) {
  // Strip surrounding quotes
  let clean = input.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) ||
      (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1);
  }

  // Reject path traversal
  if (clean.includes('..')) {
    throw new Error(`Path traversal not allowed: ${clean}`);
  }

  // Normalize slashes to backslashes (Windows)
  const normalized = clean.replace(/\//g, '\\');

  // If already absolute (has drive letter), return as-is
  if (/^[A-Za-z]:/.test(normalized)) {
    return normalized;
  }

  // Otherwise, treat as repo-root-relative
  const REPO_ROOT = findRepoRoot();
  const repoRootNorm = REPO_ROOT.replace(/\//g, '\\');
  return repoRootNorm + '\\' + normalized;
}
