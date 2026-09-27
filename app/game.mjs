export const CELL_COUNT = 25;
export const ROUND_SECONDS = 30;

const cell = (random, count) => Math.min(count - 1, Math.max(0, Math.floor(random() * count)));

export function beginRound(random = Math.random) {
  return { active: true, secondsLeft: ROUND_SECONDS, score: 0, streak: 0, target: cell(random, CELL_COUNT) };
}

export function collect(round, index, random = Math.random) {
  if (!round.active) return round;
  if (index !== round.target) return { ...round, streak: 0 };
  const other = cell(random, CELL_COUNT - 1);
  return {
    ...round,
    score: round.score + ((round.streak + 1) % 3 === 0 ? 2 : 1),
    streak: round.streak + 1,
    target: other >= round.target ? other + 1 : other,
  };
}

export function tick(round) {
  if (!round.active) return round;
  const secondsLeft = round.secondsLeft - 1;
  return { ...round, secondsLeft, active: secondsLeft > 0 };
}
