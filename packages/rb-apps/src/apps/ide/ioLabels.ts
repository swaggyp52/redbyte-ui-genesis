export interface StudentFacingIoLabelRow {
  id?: string;
  label?: string;
  port?: string;
}

export interface IoSignalKeyRow extends StudentFacingIoLabelRow {
  nodeId?: string;
  direction?: 'in' | 'out';
}

export function getStudentFacingIoLabel(
  row: StudentFacingIoLabelRow | null | undefined,
  fallback = ''
): string {
  const label = typeof row?.label === 'string' ? row.label.trim() : '';
  if (isStudentFacingIoToken(label)) return label;

  const port = typeof row?.port === 'string' ? row.port.trim() : '';
  if (port.length > 0) return port;

  const id = typeof row?.id === 'string' ? row.id.trim() : '';
  if (isStudentFacingIoToken(id)) return id;

  return fallback.trim();
}

function isStudentFacingIoToken(value: string): boolean {
  if (value.length === 0) return false;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'input' || normalized === 'output') {
    return false;
  }

  return !/^node(?:[-_]?v?\d+)+(?:[-_]\d+)*$/i.test(normalized);
}

export function normalizeIoSignalKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9_.]/g, '');
}

// Prefer human-facing labels only while they remain unique inside the same IO direction.
export function getCanonicalIoSignalKey(
  row: IoSignalKeyRow | null | undefined,
  rows: readonly IoSignalKeyRow[] = []
): string {
  const scope = getIoSignalScope(row, rows);
  const studentLabelKey = normalizeIoSignalKey(getStudentFacingIoLabel(row));
  const idKey = normalizeIoSignalKey(typeof row?.id === 'string' ? row.id : '');
  const nodeIdKey = normalizeIoSignalKey(typeof row?.nodeId === 'string' ? row.nodeId : '');
  const portKey = normalizeIoSignalKey(typeof row?.port === 'string' ? row.port : '');

  if (studentLabelKey && countIoSignalMatches(scope, studentLabelKey, getStudentFacingIoLabel) === 1) {
    return studentLabelKey;
  }
  if (idKey && countIoSignalMatches(scope, idKey, (candidate) => candidate?.id ?? '') === 1) {
    return idKey;
  }
  if (nodeIdKey) return nodeIdKey;
  return studentLabelKey || idKey || portKey || '';
}

// Exclude ambiguous labels from lookup resolution so machine-facing matching stays deterministic.
export function getIoSignalLookupKeys(
  row: IoSignalKeyRow | null | undefined,
  rows: readonly IoSignalKeyRow[] = []
): string[] {
  const scope = getIoSignalScope(row, rows);
  const keys: string[] = [];
  const studentLabelKey = normalizeIoSignalKey(getStudentFacingIoLabel(row));

  if (studentLabelKey && countIoSignalMatches(scope, studentLabelKey, getStudentFacingIoLabel) === 1) {
    keys.push(studentLabelKey);
  }

  const idKey = normalizeIoSignalKey(typeof row?.id === 'string' ? row.id : '');
  if (idKey) {
    keys.push(idKey);
  }

  const nodeIdKey = normalizeIoSignalKey(typeof row?.nodeId === 'string' ? row.nodeId : '');
  if (nodeIdKey) {
    keys.push(nodeIdKey);
  }

  const portKey = normalizeIoSignalKey(typeof row?.port === 'string' ? row.port : '');
  if (portKey && keys.length === 0) {
    keys.push(portKey);
  }

  return keys.filter((entry, index, source) => entry.length > 0 && source.indexOf(entry) === index);
}

function getIoSignalScope(
  row: IoSignalKeyRow | null | undefined,
  rows: readonly IoSignalKeyRow[]
): readonly IoSignalKeyRow[] {
  if (rows.length === 0) {
    return row ? [row] : [];
  }
  if (!row?.direction) {
    return rows;
  }
  const sameDirection = rows.filter((candidate) => candidate.direction === row.direction);
  return sameDirection.length > 0 ? sameDirection : rows;
}

function countIoSignalMatches(
  rows: readonly IoSignalKeyRow[],
  target: string,
  readValue: (row: IoSignalKeyRow | null | undefined) => string
): number {
  return rows.reduce((count, candidate) => {
    return count + (normalizeIoSignalKey(readValue(candidate)) === target ? 1 : 0);
  }, 0);
}
