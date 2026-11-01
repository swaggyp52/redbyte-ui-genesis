declare const __GIT_SHA__: string;
declare const __GIT_BRANCH__: string;
declare const __BUILD_DATE__: string;
declare const __NODE_VERSION__: string;
declare const __DEV_URL__: string;

export interface IdeBuildIdentity {
  fullSha: string;
  shortSha: string;
  buildDate: string | null;
  envLabel: string;
  branch: string;
  runtime: string;
  devUrl: string;
  title: string;
}

interface ResolveIdeBuildIdentityInput {
  gitSha?: string;
  buildDate?: string;
  mode?: string;
  branch?: string;
  runtime?: string;
  devUrl?: string;
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
  const branch = normalizeToken(input.branch) ?? normalizeToken(readGlobalToken(() => (typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : ''))) ?? 'unknown';
  const runtime = normalizeToken(input.runtime) ?? normalizeToken(readGlobalToken(() => (typeof __NODE_VERSION__ !== 'undefined' ? __NODE_VERSION__ : ''))) ?? 'unknown';
  const devUrl = normalizeToken(input.devUrl) ?? normalizeToken(readGlobalToken(() => (typeof __DEV_URL__ !== 'undefined' ? __DEV_URL__ : ''))) ?? 'unknown';
  const shortSha = fullSha === 'dev' ? 'dev' : fullSha.slice(0, 7);
  const titleParts = [`Build ${shortSha}`, `branch ${branch}`, `runtime ${runtime}`, `env ${envLabel}`];
  if (buildDate) {
    titleParts.push(`built ${buildDate}`);
  }

  return {
    fullSha,
    shortSha,
    buildDate,
    envLabel,
    branch,
    runtime,
    devUrl,
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
