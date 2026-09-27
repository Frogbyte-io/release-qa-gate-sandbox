const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, readFileSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { readBest, saveBest } = require('../app/score.cjs');

test('best score persists and never decreases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orbit-score-'));
  try {
    assert.equal(readBest(dir), 0);
    assert.equal(saveBest(dir, 8), 8);
    assert.equal(saveBest(dir, 3), 8);
    assert.equal(readBest(dir), 8);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'score.json'), 'utf8')), { best: 8 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('corrupt score file fails closed and invalid scores are rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orbit-score-'));
  try {
    writeFileSync(join(dir, 'score.json'), '{broken');
    assert.equal(readBest(dir), 0);
    writeFileSync(join(dir, 'score.json'), 'null');
    assert.equal(readBest(dir), 0);
    assert.throws(() => saveBest(dir, -1));
    assert.throws(() => saveBest(dir, 1.5));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
