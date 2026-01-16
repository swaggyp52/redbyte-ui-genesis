/**
 * Proof Capsule - Enhanced proof format with board/vector metadata
 * 
 * Extends base proof format to include:
 * - board_id and registry snapshot
 * - vector test metadata
 * - git/node version at test time
 * - event stream reference
 * 
 * Format is backward-compatible with proof:replay.
 */

/**
 * Proof capsule structure
 * 
 * Base fields (from proof-runner):
 * - session_id
 * - timestamp
 * - test_suite (health_endpoint, websocket_events, seq_ordering)
 * - events (raw event objects)
 * 
 * Enhanced fields (from vector-runner):
 * - board_id
 * - board_snapshot (full registry entry)
 * - vector_file_hash (sha256 of test vector file)
 * - git_sha
 * - node_version
 * - started_at, ended_at (ISO strings)
 * - test_summary (total, passed, failed)
 * - results (per-vector pass/fail + expected vs observed)
 * - events_ndjson_path (reference to external NDJSON file)
 */

export const ProofCapsuleSchema = {
  session_id: 'string',
  timestamp: 'string (ISO)',
  board_id: 'string (optional)',
  board_snapshot: 'object (optional, full board definition)',
  vector_file_hash: 'string (optional, sha256 hex)',
  git_sha: 'string (optional)',
  node_version: 'string (optional)',
  started_at: 'string (optional, ISO)',
  ended_at: 'string (optional, ISO)',
  test_suite: 'object (health_endpoint, websocket_events, seq_ordering bools)',
  test_summary: 'object (optional, {total, passed, failed})',
  results: 'array (optional, per-test result objects)',
  events: 'array (event objects)',
  events_ndjson_path: 'string (optional, path to external NDJSON)'
};

/**
 * Merge vector capsule with existing proof format
 * 
 * Takes output from vector-runner and proof-runner,
 * combines them into a single capsule.
 */
export function mergeCapsules(proofCapsule, vectorCapsule) {
  return {
    ...proofCapsule,
    board_id: vectorCapsule.board_id || proofCapsule.board_id,
    board_snapshot: vectorCapsule.board_snapshot || proofCapsule.board_snapshot,
    vector_file_hash: vectorCapsule.vector_file_hash,
    git_sha: vectorCapsule.git_sha || proofCapsule.git_sha,
    node_version: vectorCapsule.node_version,
    started_at: vectorCapsule.started_at,
    ended_at: vectorCapsule.ended_at,
    test_summary: vectorCapsule.test_summary,
    results: vectorCapsule.results,
    events_ndjson_path: vectorCapsule.events_ndjson_path
  };
}

/**
 * Validate proof capsule has required fields for replay
 */
export function validateCapsuleForReplay(capsule) {
  // Must have either events inline or path to NDJSON
  const hasEvents = Array.isArray(capsule.events) && capsule.events.length > 0;
  const hasPath = typeof capsule.events_ndjson_path === 'string';
  
  if (!hasEvents && !hasPath) {
    throw new Error('Capsule must have events array or events_ndjson_path');
  }

  // Must have session_id and timestamp
  if (!capsule.session_id || !capsule.timestamp) {
    throw new Error('Capsule must have session_id and timestamp');
  }

  return true;
}
