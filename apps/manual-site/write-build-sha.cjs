// This script writes the current HEAD commit SHA to public/build.txt during build
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getHeadSha() {
  try {
    // stdio: 'pipe' prevents the error from leaking to console if git is missing/fails
    return execSync('git rev-parse HEAD', { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    return 'zip-install';
  }
}

const sha = getHeadSha();

// Ensure public dir exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const outPath = path.join(publicDir, 'build.txt');
fs.writeFileSync(outPath, sha + '\n');
console.log('Wrote build.txt with SHA:', sha);
