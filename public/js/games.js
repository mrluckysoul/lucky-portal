const stage = () => document.getElementById('gameBody');
let cleanup = null;

/* ---------------- Tic Tac Toe ---------------- */
const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function ticTacToe() {
  let board = Array(9).fill('');
  let over = false;
  let wins = 0;
  stage().innerHTML = `
    <p class="muted" id="ttStatus">You are ❌ — your move.</p>
    <div class="board" id="ttBoard"></div>
    <div class="stat-row"><span>Wins this session: <b id="ttWins">0</b></span></div>`;

  const boardEl = document.getElementById('ttBoard');
  const status = document.getElementById('ttStatus');

  function winner(b) {
    for (const line of WIN_LINES) {
      const [a, c, d] = line;
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a], line };
    }
    return b.every(Boolean) ? { player: 'draw', line: [] } : null;
  }

  function best(b, player) {
    const result = winner(b);
    if (result) return { score: result.player === 'O' ? 1 : result.player === 'X' ? -1 : 0 };
    let bestMove = null;
    for (let i = 0; i < 9; i += 1) {
      if (b[i]) continue;
      b[i] = player;
      const { score } = best(b, player === 'O' ? 'X' : 'O');
      b[i] = '';
      if (!bestMove || (player === 'O' ? score > bestMove.score : score < bestMove.score)) bestMove = { score, index: i };
    }
    return bestMove;
  }

  function render(highlight = []) {
    boardEl.innerHTML = board
      .map((v, i) => `<button class="cell ${highlight.includes(i) ? 'win' : ''}" data-i="${i}">${v}</button>`)
      .join('');
  }

  function finish(result) {
    over = true;
    render(result.line);
    if (result.player === 'X') {
      wins += 1;
      document.getElementById('ttWins').textContent = wins;
      status.textContent = 'You win! 🎉 Press restart for another round.';
      saveScore('Tic Tac Toe', wins * 10);
    } else if (result.player === 'O') {
      status.textContent = 'Computer wins this one. Try again!';
    } else {
      status.textContent = "It's a draw.";
    }
  }

  boardEl.addEventListener('click', (event) => {
    const cell = event.target.closest('.cell');
    if (!cell || over) return;
    const index = Number(cell.dataset.i);
    if (board[index]) return;
    board[index] = 'X';
    render();
    let result = winner(board);
    if (result) return finish(result);
    // small chance of a random move so the AI is beatable
    const empty = board.map((v, i) => (v ? null : i)).filter((i) => i !== null);
    const move = Math.random() < 0.25 ? empty[Math.floor(Math.random() * empty.length)] : best([...board], 'O').index;
    board[move] = 'O';
    render();
    result = winner(board);
    if (result) finish(result);
    else status.textContent = 'Your move.';
  });

  render();
}

/* ---------------- Guess the number ---------------- */
function guessNumber() {
  let secret = Math.floor(Math.random() * 100) + 1;
  let tries = 0;
  stage().innerHTML = `
    <p class="muted">I picked a number between 1 and 100. You have 10 guesses.</p>
    <div class="field" style="max-width:260px"><input id="gnInput" type="number" min="1" max="100" placeholder="Your guess" /></div>
    <button class="btn small" id="gnBtn" type="button">Guess</button>
    <div class="stat-row" style="margin-top:14px"><span>Guesses used: <b id="gnTries">0</b>/10</span></div>
    <p id="gnHint" style="font-size:18px"></p>
    <ul class="list" id="gnLog"></ul>`;

  const hint = document.getElementById('gnHint');
  const log = document.getElementById('gnLog');

  function submit() {
    const value = Number(document.getElementById('gnInput').value);
    if (!value || value < 1 || value > 100) { hint.textContent = 'Enter a number between 1 and 100.'; return; }
    tries += 1;
    document.getElementById('gnTries').textContent = tries;
    document.getElementById('gnInput').value = '';
    if (value === secret) {
      const score = Math.max(10, 110 - tries * 10);
      hint.textContent = `🎉 Correct! You found ${secret} in ${tries} ${tries === 1 ? 'guess' : 'guesses'}. Score ${score}.`;
      saveScore('Guess the number', score);
      document.getElementById('gnBtn').disabled = true;
      return;
    }
    const near = Math.abs(value - secret) <= 5 ? ' (very close!)' : '';
    hint.textContent = value < secret ? `📈 Too low${near}` : `📉 Too high${near}`;
    log.insertAdjacentHTML('afterbegin', `<li>${value} — ${value < secret ? 'too low' : 'too high'}</li>`);
    if (tries >= 10) {
      hint.textContent = `Out of guesses! The number was ${secret}.`;
      document.getElementById('gnBtn').disabled = true;
    }
  }

  document.getElementById('gnBtn').addEventListener('click', submit);
  document.getElementById('gnInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

/* ---------------- Memory match ---------------- */
function memoryMatch() {
  const emojis = ['🍀', '🎮', '🚀', '🎧', '🍕', '🐳', '🌈', '⚽'];
  const deck = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
  let first = null;
  let lock = false;
  let moves = 0;
  let matched = 0;
  let startedAt = Date.now();

  stage().innerHTML = `
    <div class="stat-row"><span>Moves: <b id="mmMoves">0</b></span><span>Pairs: <b id="mmPairs">0</b>/8</span><span>Time: <b id="mmTime">0</b>s</span></div>
    <div class="memory-grid" id="mmGrid"></div>`;

  const grid = document.getElementById('mmGrid');
  grid.innerHTML = deck.map((e, i) => `<div class="memory-card" data-i="${i}">${e}</div>`).join('');
  const timer = setInterval(() => {
    document.getElementById('mmTime').textContent = Math.floor((Date.now() - startedAt) / 1000);
  }, 1000);
  cleanup = () => clearInterval(timer);

  grid.addEventListener('click', (event) => {
    const card = event.target.closest('.memory-card');
    if (!card || lock || card.classList.contains('flipped') || card.classList.contains('matched')) return;
    card.classList.add('flipped');
    if (!first) { first = card; return; }
    moves += 1;
    document.getElementById('mmMoves').textContent = moves;
    if (deck[first.dataset.i] === deck[card.dataset.i]) {
      first.classList.add('matched');
      card.classList.add('matched');
      first = null;
      matched += 1;
      document.getElementById('mmPairs').textContent = matched;
      if (matched === 8) {
        clearInterval(timer);
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        const score = Math.max(20, 300 - moves * 5 - seconds);
        toast(`All pairs found in ${moves} moves! Score ${score}`);
        saveScore('Memory match', score);
      }
      return;
    }
    lock = true;
    const second = card;
    setTimeout(() => {
      first.classList.remove('flipped');
      second.classList.remove('flipped');
      first = null;
      lock = false;
    }, 700);
  });
}

/* ---------------- Rock paper scissors ---------------- */
function rockPaperScissors() {
  const moves = { '✊': 'Rock', '✋': 'Paper', '✌️': 'Scissors' };
  const beats = { '✊': '✌️', '✋': '✊', '✌️': '✋' };
  let you = 0;
  let cpu = 0;

  stage().innerHTML = `
    <p class="muted">First to 5 wins the match.</p>
    <div class="stat-row"><span>You: <b id="rpsYou">0</b></span><span>Computer: <b id="rpsCpu">0</b></span></div>
    <div class="rps-options">${Object.keys(moves).map((m) => `<button data-move="${m}">${m}</button>`).join('')}</div>
    <p id="rpsResult" style="font-size:18px;text-align:center"></p>`;

  const result = document.getElementById('rpsResult');
  stage().querySelector('.rps-options').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || you >= 5 || cpu >= 5) return;
    const mine = button.dataset.move;
    const theirs = Object.keys(moves)[Math.floor(Math.random() * 3)];
    let line = `You ${mine} vs ${theirs} computer — `;
    if (mine === theirs) line += "it's a tie.";
    else if (beats[mine] === theirs) { you += 1; line += 'you win the point! 🎉'; }
    else { cpu += 1; line += 'computer takes the point.'; }
    document.getElementById('rpsYou').textContent = you;
    document.getElementById('rpsCpu').textContent = cpu;
    if (you === 5) { line = 'Match over — you win 🏆'; saveScore('Rock paper scissors', 50 + (5 - cpu) * 10); }
    if (cpu === 5) line = 'Match over — computer wins. Restart to try again.';
    result.textContent = line;
  });
}

/* ---------------- Whack a mole ---------------- */
function whackAMole() {
  let score = 0;
  let left = 30;
  let active = -1;

  stage().innerHTML = `
    <p class="muted">Tap the mole before it disappears. 30 seconds on the clock.</p>
    <div class="stat-row"><span>Score: <b id="wmScore">0</b></span><span>Time left: <b id="wmTime">30</b>s</span></div>
    <div class="mole-grid" id="wmGrid">${Array.from({ length: 9 }, (_, i) => `<div class="mole-hole" data-i="${i}"></div>`).join('')}</div>`;

  const holes = [...document.querySelectorAll('.mole-hole')];
  const pop = setInterval(() => {
    holes.forEach((h) => { h.classList.remove('up'); h.textContent = ''; });
    active = Math.floor(Math.random() * 9);
    holes[active].classList.add('up');
    holes[active].textContent = '🐹';
  }, 800);
  const clock = setInterval(() => {
    left -= 1;
    document.getElementById('wmTime').textContent = left;
    if (left <= 0) {
      clearInterval(pop); clearInterval(clock);
      holes.forEach((h) => { h.classList.remove('up'); h.textContent = ''; });
      toast(`Time up! You scored ${score}`);
      saveScore('Whack a mole', score);
    }
  }, 1000);
  cleanup = () => { clearInterval(pop); clearInterval(clock); };

  document.getElementById('wmGrid').addEventListener('click', (event) => {
    const hole = event.target.closest('.mole-hole');
    if (!hole || left <= 0 || Number(hole.dataset.i) !== active) return;
    score += 1;
    document.getElementById('wmScore').textContent = score;
    hole.classList.remove('up');
    hole.textContent = '';
    active = -1;
  });
}

/* ---------------- Typing speed ---------------- */
const SENTENCES = [
  'Learning to build web apps is more fun when you ship something you can show your friends.',
  'A glass card with a soft blur and a bright gradient makes any page look modern.',
  'Practice a little every day and the difficult things slowly become easy.'
];

function typingSpeed() {
  const text = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
  let startedAt = null;
  let done = false;

  stage().innerHTML = `
    <p class="muted">Type the sentence below as fast and as accurately as you can.</p>
    <div class="typing-target" id="tsTarget"></div>
    <div class="field"><textarea id="tsInput" placeholder="Start typing here..."></textarea></div>
    <div class="stat-row"><span>WPM: <b id="tsWpm">0</b></span><span>Accuracy: <b id="tsAcc">100</b>%</span></div>`;

  const target = document.getElementById('tsTarget');
  const input = document.getElementById('tsInput');

  function paint(typed) {
    target.innerHTML = text
      .split('')
      .map((char, i) => {
        if (i >= typed.length) return i === typed.length ? `<span class="current">${char}</span>` : `<span>${char}</span>`;
        return `<span class="${typed[i] === char ? 'correct' : 'wrong'}">${char}</span>`;
      })
      .join('');
  }

  input.addEventListener('input', () => {
    if (done) return;
    if (!startedAt) startedAt = Date.now();
    const typed = input.value;
    paint(typed);
    const minutes = (Date.now() - startedAt) / 60000;
    const correct = typed.split('').filter((c, i) => c === text[i]).length;
    const wpm = minutes > 0 ? Math.round((typed.length / 5) / minutes) : 0;
    const accuracy = typed.length ? Math.round((correct / typed.length) * 100) : 100;
    document.getElementById('tsWpm').textContent = wpm;
    document.getElementById('tsAcc').textContent = accuracy;
    if (typed === text) {
      done = true;
      const score = Math.max(10, Math.round(wpm * (accuracy / 100)));
      toast(`Finished at ${wpm} WPM with ${accuracy}% accuracy!`);
      saveScore('Typing speed', score);
    }
  });

  paint('');
  input.focus();
}

const GAMES = {
  tictactoe: { title: 'Tic Tac Toe ❌⭕', start: ticTacToe },
  guess: { title: 'Guess the number 🔢', start: guessNumber },
  memory: { title: 'Memory match 🧠', start: memoryMatch },
  rps: { title: 'Rock paper scissors ✊✋✌️', start: rockPaperScissors },
  mole: { title: 'Whack a mole 🐹', start: whackAMole },
  typing: { title: 'Typing speed ⌨️', start: typingSpeed }
};

let currentGame = null;

function openGame(key) {
  if (cleanup) { cleanup(); cleanup = null; }
  currentGame = key;
  document.getElementById('gameStage').classList.remove('hidden');
  document.getElementById('gameTitle').textContent = GAMES[key].title;
  GAMES[key].start();
  document.getElementById('gameStage').scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', async () => {
  initNav('games');
  await requireSession();
  document.getElementById('gameMenu').addEventListener('click', (event) => {
    const tile = event.target.closest('.game-tile');
    if (tile) openGame(tile.dataset.game);
  });
  document.getElementById('restartBtn').addEventListener('click', () => currentGame && openGame(currentGame));
  document.getElementById('exitBtn').addEventListener('click', () => {
    if (cleanup) { cleanup(); cleanup = null; }
    document.getElementById('gameStage').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
