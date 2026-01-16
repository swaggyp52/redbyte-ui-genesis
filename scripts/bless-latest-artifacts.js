// Bless Latest Proof Artifacts
// Copies timestamped outputs from FPGA proof tests to stable "latest" names
// Run this after: pnpm run test:vectors (or similar proof test suite)
// Usage: node scripts/bless-latest-artifacts.js [source-dir]

const fs = require('fs');
const path = require('path');

// Source directory (argument 1 or default to _ci_phase4_fixed latest)
let sourceDir = process.argv[2];
if (!sourceDir) {
  // Auto-detect latest _ci_phase4_* directory
  const ciDirs = ['_ci_phase4_fixed', '_ci_phase4_artifacts'].filter(d => 
    fs.existsSync(path.join(process.cwd(), d))
  );
  if (ciDirs.length === 0) {
    console.error('ERROR: No CI artifact directory found. Provide source path as argument.');
    process.exit(1);
  }
  sourceDir = ciDirs[0];
}

const proofDirs = fs.readdirSync(sourceDir)
  .filter(f => fs.statSync(path.join(sourceDir, f)).isDirectory())
  .map(d => path.join(sourceDir, d));

if (proofDirs.length === 0) {
  console.error(`ERROR: No proof directories found in ${sourceDir}`);
  process.exit(1);
}

// Use the latest (most recently modified) directory
const latestProofDir = proofDirs.reduce((a, b) => {
  const aTime = fs.statSync(a).mtime;
  const bTime = fs.statSync(b).mtime;
  return aTime > bTime ? a : b;
});

console.log(`Using source: ${latestProofDir}`);

// Target stable directory
const targetDir = path.join('ops', 'proof');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy timestamped files to stable names
const fileMap = {
  'fpga-proof-*.json': 'vector-run-latest.json',
  'fpga-events-*.ndjson': 'vector-events-latest.ndjson',
  'fpga-proof-*.txt': 'vector-run-latest-report.txt',
};

Object.entries(fileMap).forEach(([pattern, targetName]) => {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  const files = fs.readdirSync(latestProofDir).filter(f => regex.test(f));
  
  if (files.length === 0) {
    console.warn(`  ⚠ No match for pattern: ${pattern}`);
    return;
  }

  const sourceFile = path.join(latestProofDir, files[0]);
  const targetFile = path.join(targetDir, targetName);
  
  fs.copyFileSync(sourceFile, targetFile);
  const size = fs.statSync(targetFile).size;
  console.log(`  ✓ ${targetName} (${size} bytes)`);
});

console.log(`\nLatest artifacts blessed in ${targetDir}`);
console.log('Your demo can now load stable URLs without timestamps.');
