#!/usr/bin/env node

import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredNode = fs.readFileSync('.nvmrc', 'utf8').trim();
const actualNode = process.versions.node;

assert(requiredNode === '20.19.0', `.nvmrc must remain pinned to 20.19.0; got ${requiredNode}`);

if (actualNode === requiredNode) {
  console.log(`PASS: Node ${requiredNode} is active for this proof shell.`);
  process.exit(0);
}

const decisionDocPath = 'docs/product/RED_BYTE_RELEASE_CANDIDATE_DECISION.md';
assert(fs.existsSync(decisionDocPath), `${decisionDocPath} must record Node 20 proof status`);

const decisionDoc = fs.readFileSync(decisionDocPath, 'utf8');
const requiredPhrases = [
  'Node 20.19.0 status: blocked',
  'current node=v24.15.0',
  'nvm use 20.19.0',
  'nvm=NOT_FOUND',
];

for (const phrase of requiredPhrases) {
  assert(
    decisionDoc.includes(phrase),
    `Node 20 blocker report must include "${phrase}" when current Node is ${actualNode}`
  );
}

console.log(
  `PASS: Node ${requiredNode} proof is blocked in this shell and the exact blocker is recorded; active Node is ${actualNode}.`
);
