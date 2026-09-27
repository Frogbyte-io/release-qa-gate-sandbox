import test from 'node:test';
import assert from 'node:assert/strict';
import { beginRound, collect, tick } from '../app/game.mjs';

test('collecting the lit star scores and moves it to another cell', () => {
  const round = beginRound(() => 0);
  assert.equal(round.target, 0);
  const next = collect(round, 0, () => 0);
  assert.equal(next.score, 1);
  assert.equal(next.streak, 1);
  assert.notEqual(next.target, 0);
  assert.equal(round.score, 0);
});

test('misses break a streak without scoring', () => {
  const round = collect(beginRound(() => 0), 0, () => 0);
  const missed = collect(round, 0, () => 0);
  assert.equal(missed.score, 1);
  assert.equal(missed.streak, 0);
});

test('a round ends at zero and cannot score afterward', () => {
  let round = beginRound(() => 0);
  for (let second = 0; second < 30; second += 1) round = tick(round);
  assert.equal(round.secondsLeft, 0);
  assert.equal(round.active, false);
  assert.deepEqual(collect(round, round.target, () => 0), round);
  assert.deepEqual(tick(round), round);
});

test('a three-star streak earns a bonus', () => {
  let round = beginRound(() => 0);
  for (let star = 0; star < 4; star += 1) round = collect(round, round.target, () => 0);
  assert.equal(round.score, 5);
});
