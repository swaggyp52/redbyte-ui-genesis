import { execSync } from 'node:child_process';

function run(command, label) {
  console.log(`\n[preclass] ${label}`);
  execSync(command, { stdio: 'inherit' });
}

async function fetchVersion(versionUrl) {
  const response = await fetch(versionUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function main() {
  run('pnpm -s verify:gates:classroom', 'Running classroom truth gates');

  const hasPurgeEnv = Boolean(process.env.CF_API_TOKEN) && Boolean(process.env.CF_ZONE_ID);
  if (hasPurgeEnv) {
    run('pnpm -s cloudflare:purge', 'Purging Cloudflare cache');
  } else {
    console.log('\n[preclass] Skipping cache purge (set CF_API_TOKEN and CF_ZONE_ID to enable)');
  }

  const versionUrl = process.env.REDBYTE_VERSION_URL ?? 'https://redbyteapps.dev/os/version.json';
  try {
    const payload = await fetchVersion(versionUrl);
    const sha = String(payload.sha ?? 'unknown');
    const builtAt = String(payload.builtAt ?? 'unknown');
    console.log(`\n[preclass] deployed sha: ${sha}`);
    console.log(`[preclass] deployed builtAt: ${builtAt}`);
  } catch (error) {
    console.log(`\n[preclass] Could not fetch ${versionUrl}: ${error instanceof Error ? error.message : String(error)}`);
    if (process.env.REDBYTE_PRECLASS_STRICT === '1') {
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error('[preclass] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
