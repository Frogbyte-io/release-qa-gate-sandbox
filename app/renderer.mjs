import { beginRound, collect, tick, CELL_COUNT, ROUND_SECONDS } from './game.mjs';

const api = window.orbitApi ?? {
  readBest: async () => Number(localStorage.getItem('orbit-best') || 0),
  saveBest: async (score) => {
    const best = Math.max(score, Number(localStorage.getItem('orbit-best') || 0));
    localStorage.setItem('orbit-best', String(best));
    return best;
  },
};

const score = document.getElementById('score');
const best = document.getElementById('best');
const time = document.getElementById('time');
const streak = document.getElementById('streak');
const message = document.getElementById('message');
const start = document.getElementById('start');
const grid = document.getElementById('grid');
const cells = [];
let round;
let timer;

for (let index = 0; index < CELL_COUNT; index += 1) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cell';
  button.setAttribute('aria-label', `Empty cell ${index + 1}`);
  button.addEventListener('click', () => {
    if (!round?.active) return;
    const hit = index === round.target;
    round = collect(round, index);
    message.textContent = hit ? (round.streak % 3 === 0 ? 'Comet combo! Keep going.' : 'Star gathered!') : 'A little stardust slipped away.';
    render();
  });
  grid.append(button);
  cells.push(button);
}

function render() {
  score.textContent = String(round?.score ?? 0);
  time.textContent = `${round?.secondsLeft ?? ROUND_SECONDS}s`;
  streak.textContent = `✦ ${round?.streak ?? 0} streak`;
  cells.forEach((cell, index) => {
    const lit = round?.active && round.target === index;
    cell.classList.toggle('lit', Boolean(lit));
    cell.textContent = lit ? '✦' : '';
    cell.setAttribute('aria-label', lit ? `Collect star in cell ${index + 1}` : `Empty cell ${index + 1}`);
  });
}

async function finish() {
  clearInterval(timer);
  start.disabled = false;
  start.textContent = 'Play again';
  message.textContent = `Nightfall! You gathered ${round.score} starlight.`;
  try { best.textContent = String(await api.saveBest(round.score)); }
  catch { message.textContent += ' Your best score could not be saved.'; }
}

start.addEventListener('click', () => {
  clearInterval(timer);
  round = beginRound();
  start.disabled = true;
  message.textContent = 'The stars are awake. Go!';
  render();
  timer = setInterval(() => {
    round = tick(round);
    render();
    if (!round.active) void finish();
  }, 1000);
});

api.readBest().then((value) => { best.textContent = String(value); }).catch(() => {
  message.textContent = 'Your best score could not be loaded.';
});
render();
