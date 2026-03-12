export interface StudentFacingIoLabelRow {
  id?: string;
  label?: string;
  port?: string;
}

export function getStudentFacingIoLabel(
  row: StudentFacingIoLabelRow | null | undefined,
  fallback = ''
): string {
  const label = typeof row?.label === 'string' ? row.label.trim() : '';
  if (label.length > 0) return label;

  const port = typeof row?.port === 'string' ? row.port.trim() : '';
  if (port.length > 0) return port;

  const id = typeof row?.id === 'string' ? row.id.trim() : '';
  if (id.length > 0) return id;

  return fallback.trim();
}

export function normalizeIoSignalKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9_.]/g, '');
}
