import { execFileSync } from 'node:child_process';

function git(...args) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

try {
  const branch = git('branch', '--show-current') || '(detached)';
  const sha = git('rev-parse', 'HEAD');
  console.log(`[RedByte dev] branch=${branch}`);
  console.log(`[RedByte dev] sha=${sha}`);
  console.log('[RedByte dev] url=http://localhost:5173');
} catch (error) {
  console.error('[RedByte dev] unable to resolve git identity');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
