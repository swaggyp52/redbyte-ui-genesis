declare const __GIT_SHA__: string;
declare const __BUILD_DATE__: string;

export interface IdeBuildIdentity {
  fullSha: string;
  shortSha: string;
  buildDate: string | null;
  envLabel: string;
  title: string;
}

interface ResolveIdeBuildIdentityInput {
  gitSha?: string;
  buildDate?: string;
  mode?: string;
}

export function resolveIdeBuildIdentity(
  input: ResolveIdeBuildIdentityInput = {}
): IdeBuildIdentity {
  const appEnv = (import.meta as ImportMeta & {
    env?: {
      MODE?: string;
      VITE_GIT_SHA?: string;
    };
  }).env;

  const fullSha =
    normalizeToken(input.gitSha) ??
    normalizeToken(appEnv?.VITE_GIT_SHA) ??
    normalizeToken(readGlobalToken(() => (typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : ''))) ??
    'dev';
  const buildDate =
    normalizeToken(input.buildDate) ??
    normalizeToken(readGlobalToken(() => (typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : ''))) ??
    null;
  const rawMode = normalizeToken(input.mode) ?? normalizeToken(appEnv?.MODE) ?? 'dev';
  const envLabel = rawMode === 'production' ? 'prod' : rawMode === 'development' ? 'dev' : rawMode;
  const shortSha = fullSha === 'dev' ? 'dev' : fullSha.slice(0, 7);
  const titleParts = [`Build ${shortSha}`, `env ${envLabel}`];
  if (buildDate) {
    titleParts.push(`built ${buildDate}`);
  }

  return {
    fullSha,
    shortSha,
    buildDate,
    envLabel,
    title: titleParts.join(' · '),
  };
}

function readGlobalToken(reader: () => string): string | undefined {
  try {
    return reader();
  } catch {
    return undefined;
  }
}

function normalizeToken(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
