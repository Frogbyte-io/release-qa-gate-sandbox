// `linux/persistence`: the best score survives an app restart. A round is played in the packaged app (collecting a known
// number of stars), the round runs out and the app saves the score; the score is confirmed on disk independently, the app
// is restarted and must show the same best score again. Elements are found by id and by the `lit` class on a cell, which
// is how the game marks the star to collect. Waiting uses the runner's `ctx.waitFor`, so a value that never appears is an
// assertion failure (the candidate misbehaved), not an infrastructure error; checks on disk use node:assert. A screenshot
// is kept as evidence at each step, and a failure also keeps the page's DOM and console.
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { scoreFile, session, tool } from './app.mjs';

// Five stars score 1 + 1 + 2 + 1 + 1: every third star in a row is worth two (app/game.mjs).
const STARS = 5;
const EXPECTED_BEST = 6;

/** An element's text, or undefined if it cannot be read yet (e.g. the page is still loading after a restart). */
async function text(selector) {
  return (await session().browser.$(selector)).getText().catch(() => undefined);
}

const shows = (ctx, selector, expected, description) =>
  ctx.waitFor(async () => (await text(selector)) === expected, { timeoutMs: 20_000, intervalMs: 200, description });

/** Saves a screenshot of the app as the attempt's evidence and returns its SHA-256. */
const capture = async (ctx, name) => session().screenshot(await ctx.evidence(name));

async function persistence(ctx) {
  const file = scoreFile(ctx);
  const browser = () => session().browser;

  await shows(ctx, '#best', '0', 'the best score to start at 0');
  const initial = await capture(ctx, '1-initial.png');

  await (await browser().$('#start')).click();
  for (let star = 1; star <= STARS; star += 1) {
    // The star is lit again as soon as the previous one is collected; the round's timer never moves it.
    await ctx.waitFor(async () => (await browser().$('#grid .cell.lit')).isExisting(), { timeoutMs: 10_000, intervalMs: 100, description: `star ${star} to be lit` });
    await (await browser().$('#grid .cell.lit')).click();
  }
  await shows(ctx, '#score', String(EXPECTED_BEST), `the round's score to be ${EXPECTED_BEST}`);
  await capture(ctx, '2-playing.png');

  // The round lasts 30 seconds; the best score is saved when it ends and the button offers another round.
  await ctx.waitFor(async () => (await text('#start')) === 'Play again', { timeoutMs: 60_000, intervalMs: 500, description: 'the round to end' });
  await shows(ctx, '#best', String(EXPECTED_BEST), 'the best score to be shown after the round');
  const finished = await capture(ctx, '3-finished.png');
  // Checked as an assertion first: a round that saved nothing is the candidate failing, not a read error.
  assert.ok(existsSync(file), `the end of a round writes ${file}`);
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { best: EXPECTED_BEST }, `the best score on disk in ${file}`);

  await session().restart(ctx);
  await shows(ctx, '#best', String(EXPECTED_BEST), 'the best score to be shown after a restart');
  const restarted = await capture(ctx, '4-restarted.png');
  assert.equal(await text('#score'), '0', 'a restart starts a fresh round, not the old score');

  // Taken with the best score at 0 and at its saved value, so the first must differ from the other two; a match is a stale screenshot.
  const { assertScreenshotsDiffer } = await tool('packages/qa/src/drivers/screenshots.ts');
  assertScreenshotsDiffer({ '1-initial.png': initial }, { '3-finished.png': finished, '4-restarted.png': restarted });
}

export const scenarios = [
  {
    id: 'persistence',
    async steps(ctx) {
      try {
        await persistence(ctx);
      } catch (error) {
        // What was on screen and in the console when it went wrong; best effort, since the session may be the problem.
        await session().captureFailureEvidence(ctx, 'failure').catch(() => undefined);
        throw error;
      }
    },
  },
];
