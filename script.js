const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24;

const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const startButton = document.getElementById("startButton");
const resumeButton = document.getElementById("resumeButton");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");

const COLORS = {
  I: "#00f5d4",
  J: "#4361ee",
  L: "#f9c74f",
  O: "#ffd166",
  S: "#90be6d",
  T: "#9d4edd",
  Z: "#f94144",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const lineClearScores = [0, 100, 300, 500, 800];

function createMatrix(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(null));
}

function rotate(matrix, dir) {
  const size = matrix.length;
  const rotated = matrix.map((row, y) => row.map((_, x) => matrix[size - x - 1][y]));
  if (dir > 0) {
    return rotated;
  }
  // Counter-clockwise rotation
  return rotated.map((row, y) => row.map((_, x) => rotated[size - x - 1][y]));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

class Bag {
  constructor() {
    this.pieces = [];
  }

  next() {
    if (this.pieces.length === 0) {
      this.pieces = Object.keys(SHAPES);
      for (let i = this.pieces.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.pieces[i], this.pieces[j]] = [this.pieces[j], this.pieces[i]];
      }
    }
    return this.pieces.pop();
  }
}

class Piece {
  constructor(type) {
    this.type = type;
    this.matrix = cloneMatrix(SHAPES[type]);
    this.pos = { x: Math.floor(COLS / 2) - Math.ceil(this.matrix[0].length / 2), y: -1 };
  }

  rotate(dir) {
    const nextMatrix = rotate(this.matrix, dir);
    this.matrix = nextMatrix;
  }
}

class Game {
  constructor() {
    this.board = createMatrix(COLS, ROWS);
    this.bag = new Bag();
    this.active = null;
    this.next = null;
    this.dropCounter = 0;
    this.dropInterval = 1000;
    this.lastTime = 0;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.running = false;
    this.paused = false;
    this.animationFrame = null;
  }

  start() {
    this.board = createMatrix(COLS, ROWS);
    this.bag = new Bag();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 1000;
    this.dropCounter = 0;
    this.lastTime = 0;
    this.running = true;
    this.paused = false;
    this.setOverlay(false);
    this.spawnPiece();
    this.updateDisplay();
    this.loop();
  }

  loop(time = 0) {
    if (!this.running) {
      return;
    }
    if (this.paused) {
      this.lastTime = time;
      this.animationFrame = requestAnimationFrame((t) => this.loop(t));
      return;
    }
    const delta = time - this.lastTime;
    this.lastTime = time;
    this.dropCounter += delta;
    if (this.dropCounter > this.dropInterval) {
      this.softDrop();
    }
    this.draw();
    this.animationFrame = requestAnimationFrame((t) => this.loop(t));
  }

  spawnPiece() {
    const type = this.next ?? this.bag.next();
    this.active = new Piece(type);
    this.next = this.bag.next();
    if (this.collides(this.active.matrix, this.active.pos)) {
      this.gameOver();
    }
    this.drawNext();
  }

  merge() {
    this.active.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          const posY = this.active.pos.y + y;
          if (posY >= 0) {
            this.board[posY][this.active.pos.x + x] = this.active.type;
          }
        }
      });
    });
  }

  collides(matrix, pos) {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) continue;
        const boardX = pos.x + x;
        const boardY = pos.y + y;
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
          return true;
        }
        if (boardY >= 0 && this.board[boardY][boardX]) {
          return true;
        }
      }
    }
    return false;
  }

  move(dir) {
    if (!this.active) return;
    const newPos = { x: this.active.pos.x + dir, y: this.active.pos.y };
    if (!this.collides(this.active.matrix, newPos)) {
      this.active.pos = newPos;
    }
  }

  rotate(dir) {
    if (!this.active) return;
    const oldMatrix = cloneMatrix(this.active.matrix);
    this.active.rotate(dir);
    const offsets = [0, -1, 1, -2, 2];
    for (const offset of offsets) {
      const newPos = { x: this.active.pos.x + offset, y: this.active.pos.y };
      if (!this.collides(this.active.matrix, newPos)) {
        this.active.pos = newPos;
        return;
      }
    }
    this.active.matrix = oldMatrix;
  }

  softDrop() {
    if (!this.active) return;
    const newPos = { x: this.active.pos.x, y: this.active.pos.y + 1 };
    if (!this.collides(this.active.matrix, newPos)) {
      this.active.pos = newPos;
    } else {
      this.lockPiece();
    }
    this.dropCounter = 0;
  }

  hardDrop() {
    if (!this.active) return;
    while (!this.collides(this.active.matrix, { x: this.active.pos.x, y: this.active.pos.y + 1 })) {
      this.active.pos.y += 1;
    }
    this.lockPiece();
    this.dropCounter = 0;
  }

  lockPiece() {
    this.merge();
    const cleared = this.clearLines();
    if (cleared > 0) {
      this.score += lineClearScores[cleared] * this.level;
      this.lines += cleared;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 80);
      this.updateDisplay();
    }
    this.spawnPiece();
  }

  clearLines() {
    let cleared = 0;
    outer: for (let y = ROWS - 1; y >= 0; y -= 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!this.board[y][x]) {
          continue outer;
        }
      }
      const row = this.board.splice(y, 1)[0].fill(null);
      this.board.unshift(row);
      cleared += 1;
      y += 1;
    }
    return cleared;
  }

  drawCell(x, y, type, ctx, size) {
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(x * size, y * size, size, size);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x * size, y * size, size, size);
  }

  draw() {
    boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    this.board.forEach((row, y) => {
      row.forEach((type, x) => {
        if (type) {
          this.drawCell(x, y, type, boardCtx, BLOCK_SIZE);
        }
      });
    });
    if (this.active) {
      this.active.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const drawY = this.active.pos.y + y;
            if (drawY >= 0) {
              this.drawCell(this.active.pos.x + x, drawY, this.active.type, boardCtx, BLOCK_SIZE);
            }
          }
        });
      });
    }
  }

  drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!this.next) return;
    const matrix = SHAPES[this.next];
    const size = BLOCK_SIZE * 0.75;
    const offsetX = Math.floor((nextCanvas.width / size - matrix[0].length) / 2);
    const offsetY = Math.floor((nextCanvas.height / size - matrix.length) / 2);
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          this.drawCell(x + offsetX, y + offsetY, this.next, nextCtx, size);
        }
      });
    });
  }

  updateDisplay() {
    scoreEl.textContent = this.score;
    linesEl.textContent = this.lines;
    levelEl.textContent = this.level;
  }

  togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
    this.setOverlay(this.paused, this.paused ? "Paused" : "");
  }

  gameOver() {
    this.running = false;
    this.active = null;
    cancelAnimationFrame(this.animationFrame);
    this.draw();
    this.setOverlay(true, "Game Over");
    resumeButton.textContent = "Restart";
  }

  setOverlay(visible, message = "") {
    overlay.hidden = !visible;
    overlay.style.display = visible ? "flex" : "none";
    overlayText.textContent = message;
  }
}

const game = new Game();

document.addEventListener("keydown", (event) => {
  if (!game.running) return;
  switch (event.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      game.move(-1);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      game.move(1);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      event.preventDefault();
      game.softDrop();
      break;
    case "ArrowUp":
    case "w":
    case "W":
      event.preventDefault();
      game.rotate(1);
      break;
    case "q":
    case "Q":
      game.rotate(-1);
      break;
    case " ":
      event.preventDefault();
      game.hardDrop();
      break;
    case "Escape":
    case "p":
    case "P":
      game.togglePause();
      break;
    default:
      break;
  }
});

startButton.addEventListener("click", () => {
  startButton.textContent = "Restart";
  resumeButton.textContent = "Resume";
  game.start();
});

resumeButton.addEventListener("click", () => {
  if (!game.running) {
    startButton.click();
    return;
  }
  if (game.paused) {
    game.togglePause();
  }
});

overlay.addEventListener("click", (event) => {
  if (event.target === overlay && game.paused) {
    game.togglePause();
  }
});

window.addEventListener("blur", () => {
  if (game.running && !game.paused) {
    game.togglePause();
  }
});
