import type { HardwareBoardResourceType, HardwareTimingRole } from '@redbyte/rb-utils';
import {
  getBasys3BoardResource,
  resolveBasys3BoardAlias,
  type Basys3BoardResource,
} from './basys3Pins';

export interface Basys3SignalBindingCandidate {
  id?: string;
  label?: string;
  pin?: string;
  direction?: 'in' | 'out';
  timingRole?: HardwareTimingRole;
  boardResourceType?: HardwareBoardResourceType;
}

export interface Basys3ResolvedSignalBinding {
  alias: string;
  packagePin: string;
  resource: Basys3BoardResource;
  role: 'clock' | 'reset' | 'input' | 'output';
}

export function resolveBasys3SignalBinding(
  candidate: Basys3SignalBindingCandidate
): Basys3ResolvedSignalBinding | null {
  const resolvedAlias =
    resolveAliasCandidate(candidate.pin) ??
    resolveAliasCandidate(candidate.label) ??
    resolveAliasCandidate(candidate.id) ??
    resolveAliasFromMetadata(candidate);

  if (!resolvedAlias) return null;

  const resource = getBasys3BoardResource(resolvedAlias);
  if (!resource) return null;

  return {
    alias: resource.alias,
    packagePin: resource.packagePin,
    resource,
    role: resolveSignalRole(candidate, resource),
  };
}

function resolveAliasCandidate(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return resolveBasys3BoardAlias(trimmed);
}

function resolveAliasFromMetadata(candidate: Basys3SignalBindingCandidate): string | null {
  if (candidate.boardResourceType && candidate.boardResourceType !== 'clock_pin') {
    // Explicit physical-resource metadata wins over a logical timing role. A
    // switch/button may intentionally clock a manual-event lab; an unassigned
    // row must not be silently rebound to the W5 oscillator merely because it
    // also carries timingRole="clock".
    return null;
  }
  if (candidate.boardResourceType === 'clock_pin' || candidate.timingRole === 'clock') {
    return 'CLK100MHZ';
  }
  return null;
}

function resolveSignalRole(
  candidate: Basys3SignalBindingCandidate,
  resource: Basys3BoardResource
): Basys3ResolvedSignalBinding['role'] {
  if (candidate.direction === 'out' || resource.direction === 'out') {
    return 'output';
  }

  if (
    resource.category === 'clock' ||
    candidate.boardResourceType === 'clock_pin' ||
    candidate.timingRole === 'clock'
  ) {
    return 'clock';
  }

  if (
    candidate.timingRole === 'reset' ||
    normalizeToken(candidate.label).includes('reset') ||
    normalizeToken(candidate.label) === 'rst' ||
    normalizeToken(candidate.id) === 'rst'
  ) {
    return 'reset';
  }

  return 'input';
}

function normalizeToken(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '');
}
