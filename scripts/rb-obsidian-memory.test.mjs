#!/usr/bin/env node

import assert from 'assert/strict';
import {
  chunkMarkdown,
  cosineSimilarity,
  globToRegExp,
  keywordSearch,
  sourceRole,
} from './rb-obsidian-memory.mjs';

function testGlobMatcher() {
  const re = globToRegExp('03 Architecture/**/*.md');
  assert.equal(re.test('03 Architecture/Verify Engine.md'), true);
  assert.equal(re.test('03 Architecture/deep/Verify Engine.md'), true);
  assert.equal(re.test('05 Bugs/BUG-001.md'), false);
}

function testChunkIdsInputsAreStableShape() {
  const chunks = chunkMarkdown({
    text: '# Title\n\nIntro\n\n## Claim\n\nExport is trusted only after Verify PASS.',
    sourcePath: 'docs/product/example.md',
    sourceType: 'repo',
    maxChunkChars: 120,
    maxChunksPerSource: 10,
  });
  assert.equal(chunks.length, 2);
  assert.equal(chunks[1].source_path, 'docs/product/example.md');
  assert.deepEqual(chunks[1].heading_path, ['Title', 'Claim']);
  assert.equal(chunks[1].source_type, 'repo');
}

function testKeywordSearchWithoutEmbeddings() {
  const chunks = [
    {
      id: 'a',
      source_path: 'docs/product/RED_BYTE_CURRENT_TRUTH.md',
      source_role: 'current_truth',
      source_type: 'repo',
      title: 'Truth',
      heading_path: ['Export'],
      text: 'Trusted Export requires current Compare PASS and current mapping.',
    },
    {
      id: 'b',
      source_path: '08 Agents + Prompts/Session Log.md',
      source_role: 'memory',
      source_type: 'obsidian',
      title: 'Session Log',
      heading_path: ['Older'],
      text: 'Export ideas and future planning.',
    },
  ];
  const results = keywordSearch(chunks, 'trusted export compare pass', 2);
  assert.equal(results[0].chunk.id, 'a');
  assert.ok(results[0].score > results[1].score);
}

function testSourceRoles() {
  assert.equal(sourceRole('repo', 'AI_STATE.md'), 'current_truth');
  assert.equal(sourceRole('repo', 'docs/contracts/RedByte_Product_Contract.md'), 'target_contract');
  assert.equal(sourceRole('repo', 'docs/ide/04-export.md'), 'surface_spec');
  assert.equal(sourceRole('obsidian', '01 Dashboard/RedByte Engineering Brain.md'), 'memory');
}

function testCosineSimilarity() {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
}

testGlobMatcher();
testChunkIdsInputsAreStableShape();
testKeywordSearchWithoutEmbeddings();
testSourceRoles();
testCosineSimilarity();

process.stdout.write('[rb-memory-test] [ok] focused memory bridge tests passed.\n');
