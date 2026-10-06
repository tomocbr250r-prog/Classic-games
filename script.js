const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const displayEl = document.querySelector('.display');

const titleScreen = document.getElementById('title-screen');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 16;

const COLORS = {
  EMPTY: '#8bac0f',
  BLOCK: '#0f380f',
  BORDER: '#306230'
};

const SHAPES = [
  [[1, 1, 1, 1]],        // I
  [[1, 1], [1, 1]],      // O
  [[0, 1, 0], [1, 1, 1]],// T
  [[0, 1, 1], [1, 1, 0]],// S
  [[1, 1, 0], [0, 1, 1]],// Z
  [[1, 0, 0], [1, 1, 1]],// J
  [[0, 0, 1], [1, 1, 1]] // L
];

const STATES = {
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER'
};
let gameState = STATES.TITLE;

// --- Web Audio API ---
let audioCtx = null;
let bgmIntervalId = null;
let bgmStep = 0;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

const BGM_MELODY = [
  659.25, 493.88, 523.25, 587.33, 523.25, 493.88, 440.00, 440.00,
  523.25, 659.25, 587.33, 523.25, 493.88, 523.25, 587.33, 659.25,
  523.25, 440.00, 440.00, 0,      587.33, 698.46, 880.00, 783.99,
  698.46, 659.25, 523.25, 659.25, 587.33, 523.25, 493.88, 493.88
];

function startBGM() {
  stopBGM();
  bgmStep = 0;
  
  bgmIntervalId = setInterval(() => {
    if (gameState !== STATES.PLAYING || !audioCtx) return;
    
    const freq = BGM_MELODY[bgmStep];
    if (freq > 0) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.015, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    }
    
    bgmStep = (bgmStep + 1) % BGM_MELODY.length;
  }, 150);
}

function stopBGM() {
  if (bgmIntervalId) {
    clearInterval(bgmIntervalId);
    bgmIntervalId = null;
  }
}

function playSound(type) {
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'start') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.1);
    osc.frequency.setValueAtTime(659.25, now + 0.2);
    osc.frequency.setValueAtTime(880, now + 0.3);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);

  } else if (type === 'levelup') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.08);
    osc.frequency.setValueAtTime(783.99, now + 0.16);
    osc.frequency.setValueAtTime(1046.50, now + 0.24);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);

  } else if (type === 'move') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.start(now);
    osc.stop(now + 0.04);

  } else if (type === 'rotate') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);

  } else if (type === 'drop') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);

  } else if (type === 'clear') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.00, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);

  } else if (type === 'gameover') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}

// --- ゲームモデル ---
let grid = createGrid();
let score = 0;
let lines = 0;
let level = 1;

let currentPiece = null;
let nextPiece = null;

let dropCounter = 0;
let dropInterval = 800;
let lastTime = 0;

function createGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function drawBlock(context, x, y, size = BLOCK_SIZE) {
  const px = x * size;
  const py = y * size;

  context.fillStyle = COLORS.BLOCK;
  context.fillRect(px, py, size, size);

  context.fillStyle = COLORS.EMPTY;
  context.fillRect(px + 2, py + 2, size - 4, size - 4);

  context.fillStyle = COLORS.BLOCK;
  context.fillRect(px + 4, py + 4, size - 8, size - 8);
}

class Piece {
  constructor(shape) {
    this.shape = shape;
    this.x = Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2);
    this.y = 0;
  }

  rotate() {
    return this.shape[0].map((_, i) =>
      this.shape.map(row => row[i]).reverse()
    );
  }
}

function getRandomPiece() {
  const idx = Math.floor(Math.random() * SHAPES.length);
  return new Piece(SHAPES[idx]);
}

function collide(grid, piece, offset = { x: 0, y: 0 }, shape = piece.shape) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const newX = piece.x + c + offset.x;
        const newY = piece.y + r + offset.y;

        if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
        if (newY >= 0 && grid[newY][newX]) return true;
      }
    }
  }
  return false;
}

function merge(grid, piece) {
  piece.shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value) {
        grid[piece.y + r][piece.x + c] = 1;
      }
    });
  });
}

function addScore(points) {
  score += points;

  // 500点ごとにレベル計算 (最大100レベル)
  const newLevel = Math.min(100, Math.floor(score / 500) + 1);

  if (newLevel > level) {
    level = newLevel;
    playSound('levelup');
  }

  // 100段階の速度計算 (Lv1: 800ms ～ Lv100: 70ms)
  dropInterval = Math.max(70, 800 - (level - 1) * 7.37);

  updateUI();
}

function clearLines() {
  let linesCleared = 0;

  for (let r = ROWS - 1; r >= 0; r--) {
    if (grid[r].every(val => val === 1)) {
      grid.splice(r, 1);
      grid.unshift(Array(COLS).fill(0));
      linesCleared++;
      r++;
    }
  }

  if (linesCleared > 0) {
    playSound('clear');

    const points = [0, 100, 300, 500, 800];
    lines += linesCleared;
    addScore(points[linesCleared]);
  }
}

function updateUI() {
  document.getElementById('score').innerText = score;
  document.getElementById('lines').innerText = lines;
  document.getElementById('level').innerText = level;
}

function playerDrop() {
  if (!collide(grid, currentPiece, { x: 0, y: 1 })) {
    currentPiece.y++;
  } else {
    merge(grid, currentPiece);
    clearLines();

    currentPiece = nextPiece;
    nextPiece = getRandomPiece();
    drawNext();

    if (collide(grid, currentPiece)) {
      gameState = STATES.GAMEOVER;
      stopBGM();
      playSound('gameover');
    }
  }
  dropCounter = 0;
}

function hardDrop() {
  let droppedDist = 0;
  while (!collide(grid, currentPiece, { x: 0, y: 1 })) {
    currentPiece.y++;
    droppedDist++;
  }
  playSound('drop');
  addScore(droppedDist * 2);
  playerDrop();
}

function playerMove(dir) {
  if (!collide(grid, currentPiece, { x: dir, y: 0 })) {
    currentPiece.x += dir;
    playSound('move');
  }
}

function playerRotate() {
  const rotated = currentPiece.rotate();
  if (!collide(grid, currentPiece, { x: 0, y: 0 }, rotated)) {
    currentPiece.shape = rotated;
    playSound('rotate');
  }
}

function drawGrid() {
  ctx.fillStyle = COLORS.EMPTY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  grid.forEach((row, r) => {
    row.forEach((val, c) => {
      if (val) drawBlock(ctx, c, r);
    });
  });

  if (currentPiece) {
    currentPiece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) drawBlock(ctx, currentPiece.x + c, currentPiece.y + r);
      });
    });
  }
}

function drawNext() {
  nextCtx.fillStyle = COLORS.EMPTY;
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (nextPiece) {
    const offsetX = Math.floor((4 - nextPiece.shape[0].length) / 2);
    const offsetY = Math.floor((4 - nextPiece.shape.length) / 2);

    nextPiece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) drawBlock(nextCtx, c + offsetX, r + offsetY, 14);
      });
    });
  }
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(15, 56, 15, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLORS.EMPTY;
  ctx.font = '10px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 10);

  ctx.font = '8px "Press Start 2P"';
  ctx.fillText('TOUCH TO RESTART', canvas.width / 2, canvas.height / 2 + 20);
}

function startGame() {
  grid = createGrid();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 800;
  updateUI();

  currentPiece = getRandomPiece();
  nextPiece = getRandomPiece();
  drawNext();

  titleScreen.classList.add('hidden');
  gameState = STATES.PLAYING;
  
  playSound('start');
  startBGM();
}

function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  if (gameState === STATES.PLAYING) {
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      playerDrop();
    }
    drawGrid();
  } else if (gameState === STATES.GAMEOVER) {
    drawGameOver();
  }

  requestAnimationFrame(update);
}

// --- スマホ・タッチ＆フリック操作実装 ---
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

displayEl.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = Date.now();

  if (gameState === STATES.TITLE || gameState === STATES.GAMEOVER) {
    startGame();
  }
}, { passive: false });

displayEl.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (gameState !== STATES.PLAYING) return;

  const touch = e.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;
  const duration = Date.now() - touchStartTime;

  const minSwipeDistance = 25;

  if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance && duration < 250) {
    playerRotate();
  } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX > minSwipeDistance) {
      playerMove(1);
    } else if (deltaX < -minSwipeDistance) {
      playerMove(-1);
    }
  } else {
    if (deltaY > minSwipeDistance) {
      playerDrop();
      addScore(1);
    } else if (deltaY < -minSwipeDistance) {
      hardDrop();
    }
  }
}, { passive: false });

function setupTouchButtons() {
  const bindBtn = (id, action) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (gameState === STATES.TITLE || gameState === STATES.GAMEOVER) {
        startGame();
      } else if (gameState === STATES.PLAYING) {
        action();
      }
    }, { passive: false });
  };

  bindBtn('btn-left', () => playerMove(-1));
  bindBtn('btn-right', () => playerMove(1));
  bindBtn('btn-down', () => { playerDrop(); addScore(1); });
  bindBtn('btn-rotate', () => playerRotate());
  bindBtn('btn-drop', () => hardDrop());
}

document.addEventListener('keydown', e => {
  if (gameState === STATES.TITLE) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startGame();
    }
    return;
  }

  if (gameState === STATES.GAMEOVER) {
    if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
      startGame();
    }
    return;
  }

  if (gameState === STATES.PLAYING) {
    switch (e.key) {
      case 'ArrowLeft':
        playerMove(-1);
        break;
      case 'ArrowRight':
        playerMove(1);
        break;
      case 'ArrowDown':
        playerDrop();
        addScore(1);
        break;
      case 'ArrowUp':
      case 'z':
      case 'Z':
        playerRotate();
        break;
      case ' ':
        e.preventDefault();
        hardDrop();
        break;
    }
  }
});

setupTouchButtons();
drawGrid();
drawNext();
update();