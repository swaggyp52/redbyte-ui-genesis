// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export type StudentErrorCode =
  | 'BRIDGE_UNREACHABLE'
  | 'FIRMWARE_UPLOAD_FAILED'
  | 'DEVICE_VERIFICATION_FAILED'
  | 'SESSION_CONNECT_FAILED'
  | 'EVIDENCE_INVALID'
  | 'UNEXPECTED_ERROR';

export interface RbUserErrorLike {
  code: StudentErrorCode | string;
  title?: string;
  message?: string;
  details?: unknown;
  cause?: unknown;
}

export class RbUserError extends Error implements RbUserErrorLike {
  code: StudentErrorCode | string;
  title?: string;
  details?: unknown;
  cause?: unknown;

  constructor(
    code: StudentErrorCode | string,
    message?: string,
    opts?: { title?: string; details?: unknown; cause?: unknown }
  ) {
    super(message ?? code);
    this.name = 'RbUserError';
    this.code = code;
    this.title = opts?.title;
    this.details = opts?.details;
    this.cause = opts?.cause;
  }
}

export interface StudentFacingError {
  code: StudentErrorCode | string;
  title: string;
  message: string;
  details?: unknown;
  cause?: unknown;
}

function normalizeMessage(msg: string): string {
  return msg.trim().slice(0, 5000);
}

function toMessageString(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function classifyByMessage(message: string): StudentErrorCode | null {
  const m = message.toLowerCase();

  if (
    m.includes('failed to fetch') ||
    m.includes('bridge unreachable') ||
    m.includes('bridge offline') ||
    m.includes('could not connect to bridge')
  ) {
    return 'BRIDGE_UNREACHABLE';
  }

  if (m.includes('upload failed') || m.includes('firmware upload failed')) {
    return 'FIRMWARE_UPLOAD_FAILED';
  }

  if (m.includes('verification failed')) {
    return 'DEVICE_VERIFICATION_FAILED';
  }

  if (m.includes('port busy') || m.includes('permission denied') || m.includes('failed to open session')) {
    return 'SESSION_CONNECT_FAILED';
  }

  if (m.includes('invalid trace') || m.includes('evidence file is invalid') || m.includes('invalid evidence')) {
    return 'EVIDENCE_INVALID';
  }

  return null;
}

export function getStudentFacingMessage(
  code: StudentErrorCode | string,
  opts?: { reason?: string }
): { title: string; message: string } {
  const reason = opts?.reason ? normalizeMessage(opts.reason) : null;

  switch (code) {
    case 'BRIDGE_UNREACHABLE':
      return {
        title: 'Bridge Unreachable',
        message: 'RedByte Bridge Unreachable. Ensure the bridge agent is running on your machine.',
      };
    case 'FIRMWARE_UPLOAD_FAILED':
      return {
        title: 'Firmware Upload Failed',
        message: reason
          ? `Firmware upload failed: ${reason}. Check USB connection and try again.`
          : 'Firmware upload failed. Check USB connection and try again.',
      };
    case 'DEVICE_VERIFICATION_FAILED':
      return {
        title: 'Device Verification Failed',
        message: 'Device Verification Failed. Ensure you have the correct board selected and connected.',
      };
    case 'SESSION_CONNECT_FAILED':
      return {
        title: 'Session Connect Failed',
        message: 'Failed to open session. Port busy or permission denied.',
      };
    case 'EVIDENCE_INVALID':
      return {
        title: 'Evidence File Invalid',
        message: reason
          ? `Evidence file is invalid: ${reason}. Please re-export.`
          : 'Evidence file is invalid. Please re-export.',
      };
    default:
      return {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred. Please try again. If it persists, reload the page.',
      };
  }
}

export function toStudentFacingError(err: unknown): StudentFacingError {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as any).code === 'string') {
    const e = err as RbUserErrorLike;
    const code = e.code;
    const fallback = getStudentFacingMessage(code, {
      reason: typeof e.message === 'string' ? e.message : undefined,
    });
    const rawMessage = typeof e.message === 'string' ? normalizeMessage(e.message) : null;
    const shouldUseRawMessage =
      !!rawMessage &&
      rawMessage !== String(code) &&
      rawMessage !== String((e as any).code);
    return {
      code,
      title: e.title ?? fallback.title,
      message: shouldUseRawMessage ? rawMessage : fallback.message,
      details: e.details,
      cause: e.cause,
    };
  }

  const rawMessage = toMessageString(err);
  const code = classifyByMessage(rawMessage) ?? 'UNEXPECTED_ERROR';
  const mapped = getStudentFacingMessage(code, { reason: rawMessage });
  return {
    code,
    title: mapped.title,
    message: mapped.message,
    details: err,
    cause: err,
  };
}
