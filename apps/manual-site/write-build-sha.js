// This script writes the current HEAD commit SHA to public/build.txt during build
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getHeadSha() {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch (e) {
    return 'unknown';
  }
}

const sha = getHeadSha();
const outPath = path.join(__dirname, 'public', 'build.txt');
fs.writeFileSync(outPath, sha + '\n');
console.log('Wrote build.txt with SHA:', sha);
