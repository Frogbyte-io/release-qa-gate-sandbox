const { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

function readBest(directory) {
  try {
    const value = JSON.parse(readFileSync(join(directory, 'score.json'), 'utf8'));
    return Number.isSafeInteger(value.best) && value.best >= 0 ? value.best : 0;
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return 0;
    throw error;
  }
}

function saveBest(directory, score) {
  if (!Number.isSafeInteger(score) || score < 0) throw new TypeError('score must be a nonnegative safe integer');
  const best = Math.max(readBest(directory), score);
  mkdirSync(directory, { recursive: true });
  const temporary = join(directory, `score-${process.pid}.tmp`);
  try {
    writeFileSync(temporary, JSON.stringify({ best }), { mode: 0o600 });
    renameSync(temporary, join(directory, 'score.json'));
  } finally {
    rmSync(temporary, { force: true });
  }
  return best;
}

module.exports = { readBest, saveBest };
