const boardElement = document.getElementById("board");
const statusText = document.getElementById("statusText");
const turnText = document.getElementById("turnText");
const restartButton = document.getElementById("restartButton");
const rulesSelect = document.getElementById("rulesSelect");
const rulesHint = document.getElementById("rulesHint");

const SIZE = 8;
const HUMAN = "red";
const COMPUTER = "black";
const COMPUTER_DELAY_MS = 450;

let board = [];
let currentPlayer = HUMAN;
let selected = null;
let legalTargets = [];
let bestTargets = [];
let mustContinueCapture = false;
let winner = null;
let computerThinking = false;
let computerTimer = null;
let ruleset = "english";

function createPiece(player) {
  return { player, king: false };
}

function cloneBoard(sourceBoard) {
  return sourceBoard.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function isInside(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function diagonalDirections() {
  return [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
}

function forwardDirections(piece) {
  if (piece.king) return diagonalDirections();
  return piece.player === HUMAN
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];
}

function captureDirections(piece) {
  if (piece.king) return diagonalDirections();
  return forwardDirections(piece);
}

function getRulesHint() {
  if (ruleset === "russian") {
    return "Russian mode: regular pieces move and capture forward only. Kings fly diagonally. Captures are mandatory.";
  }
  return "English rules: regular pieces move and capture forward. Kings move one square diagonally. Captures are mandatory.";
}

function resetGame() {
  if (computerTimer) clearTimeout(computerTimer);

  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if ((row + col) % 2 === 1) board[row][col] = createPiece(COMPUTER);
    }
  }

  for (let row = 5; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if ((row + col) % 2 === 1) board[row][col] = createPiece(HUMAN);
    }
  }

  currentPlayer = HUMAN;
  selected = null;
  legalTargets = [];
  bestTargets = [];
  mustContinueCapture = false;
  winner = null;
  computerThinking = false;
  computerTimer = null;
  rulesHint.textContent = getRulesHint();
  render();
  updateStatus("Your move");
}

function getSimpleMovesForPiece(state, row, col) {
  const piece = state[row][col];
  if (!piece) return [];

  if (piece.king && ruleset === "russian") {
    const moves = [];
    for (const [rowStep, colStep] of diagonalDirections()) {
      let nextRow = row + rowStep;
      let nextCol = col + colStep;
      while (isInside(nextRow, nextCol) && !state[nextRow][nextCol]) {
        moves.push({ row: nextRow, col: nextCol, capture: null });
        nextRow += rowStep;
        nextCol += colStep;
      }
    }
    return moves;
  }

  const moves = [];
  for (const [rowStep, colStep] of forwardDirections(piece)) {
    const nextRow = row + rowStep;
    const nextCol = col + colStep;
    if (isInside(nextRow, nextCol) && !state[nextRow][nextCol]) {
      moves.push({ row: nextRow, col: nextCol, capture: null });
    }
  }
  return moves;
}

function getCaptureMovesForPiece(state, row, col) {
  const piece = state[row][col];
  if (!piece) return [];

  if (piece.king && ruleset === "russian") {
    const moves = [];

    for (const [rowStep, colStep] of diagonalDirections()) {
      let nextRow = row + rowStep;
      let nextCol = col + colStep;
      let enemy = null;

      while (isInside(nextRow, nextCol)) {
        const occupant = state[nextRow][nextCol];

        if (!occupant) {
          if (enemy) {
            moves.push({
              row: nextRow,
              col: nextCol,
              capture: enemy,
            });
          }
          nextRow += rowStep;
          nextCol += colStep;
          continue;
        }

        if (occupant.player === piece.player || enemy) break;

        enemy = { row: nextRow, col: nextCol };
        nextRow += rowStep;
        nextCol += colStep;
      }
    }

    return moves;
  }

  const moves = [];
  for (const [rowStep, colStep] of captureDirections(piece)) {
    const enemyRow = row + rowStep;
    const enemyCol = col + colStep;
    const landingRow = row + rowStep * 2;
    const landingCol = col + colStep * 2;

    if (
      isInside(enemyRow, enemyCol) &&
      isInside(landingRow, landingCol) &&
      state[enemyRow][enemyCol] &&
      state[enemyRow][enemyCol].player !== piece.player &&
      !state[landingRow][landingCol]
    ) {
      moves.push({
        row: landingRow,
        col: landingCol,
        capture: { row: enemyRow, col: enemyCol },
      });
    }
  }

  return moves;
}

function getMovesForPiece(state, row, col, captureOnly = false) {
  const captures = getCaptureMovesForPiece(state, row, col);
  if (captureOnly || captures.length > 0) return captures;
  return getSimpleMovesForPiece(state, row, col);
}

function playerHasCapture(state, player) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state[row][col];
      if (piece?.player === player && getCaptureMovesForPiece(state, row, col).length > 0) {
        return true;
      }
    }
  }
  return false;
}

function getLegalMovesForPlayer(state, player) {
  const captureRequired = playerHasCapture(state, player);
  const moves = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state[row][col];
      if (piece?.player !== player) continue;

      const targets = captureRequired
        ? getCaptureMovesForPiece(state, row, col)
        : getSimpleMovesForPiece(state, row, col);

      for (const target of targets) {
        moves.push({ from: { row, col }, target });
      }
    }
  }

  return moves;
}

function getSelectableMoves(row, col) {
  const piece = board[row][col];
  if (!piece || piece.player !== currentPlayer) return [];

  return playerHasCapture(board, currentPlayer)
    ? getCaptureMovesForPiece(board, row, col)
    : getSimpleMovesForPiece(board, row, col);
}

function selectPiece(row, col) {
  if (winner || computerThinking || currentPlayer !== HUMAN) return;

  const moves = getSelectableMoves(row, col);
  if (moves.length === 0) return;

  selected = { row, col };
  legalTargets = moves;
  bestTargets = getBestTargetsForSelection();
  render();
  updateStatus(playerHasCapture(board, currentPlayer) ? "You must capture. Green is the suggested target." : "Choose a highlighted square. Green is the suggested target.");
}

function findLegalTarget(row, col) {
  return legalTargets.find((move) => move.row === row && move.col === col);
}

function isBestTarget(row, col) {
  return bestTargets.some((move) => move.row === row && move.col === col);
}

function promoteIfNeeded(piece, row) {
  if (piece.player === HUMAN && row === 0) piece.king = true;
  if (piece.player === COMPUTER && row === SIZE - 1) piece.king = true;
}

function applySingleMove(state, source, target) {
  const nextState = cloneBoard(state);
  const piece = nextState[source.row][source.col];

  nextState[target.row][target.col] = piece;
  nextState[source.row][source.col] = null;

  if (target.capture) {
    nextState[target.capture.row][target.capture.col] = null;
  }

  promoteIfNeeded(piece, target.row);
  return nextState;
}

function moveSelectedPiece(target) {
  if (!selected || winner || computerThinking || currentPlayer !== HUMAN) return;

  board = applySingleMove(board, selected, target);

  if (target.capture) {
    const followUpCaptures = getCaptureMovesForPiece(board, target.row, target.col);
    if (followUpCaptures.length > 0) {
      selected = { row: target.row, col: target.col };
      legalTargets = followUpCaptures;
      bestTargets = getBestTargetsForSelection();
      mustContinueCapture = true;
      render();
      updateStatus("Continue capturing. Green is the suggested target.");
      return;
    }
  }

  mustContinueCapture = false;
  selected = null;
  legalTargets = [];
  bestTargets = [];
  finishTurn();
}

function getWinningPlayer(state, playerToMove) {
  const otherPlayer = playerToMove === HUMAN ? COMPUTER : HUMAN;
  let pieceCount = 0;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (state[row][col]?.player === playerToMove) pieceCount += 1;
    }
  }

  if (pieceCount === 0) return otherPlayer;
  if (getLegalMovesForPlayer(state, playerToMove).length === 0) return otherPlayer;
  return null;
}

function finishTurn() {
  const nextPlayer = currentPlayer === HUMAN ? COMPUTER : HUMAN;
  const winningPlayer = getWinningPlayer(board, nextPlayer);

  if (winningPlayer) {
    winner = winningPlayer;
    computerThinking = false;
    render();
    updateStatus(winner === HUMAN ? "You win!" : "Computer wins!");
    return;
  }

  currentPlayer = nextPlayer;
  render();

  if (currentPlayer === COMPUTER) {
    scheduleComputerTurn();
  } else {
    updateStatus(playerHasCapture(board, HUMAN) ? "Your move: capture required" : "Your move");
  }
}

function getCaptureSequences(state, source) {
  const captures = getCaptureMovesForPiece(state, source.row, source.col);
  if (captures.length === 0) return [];

  const sequences = [];
  for (const target of captures) {
    const nextState = applySingleMove(state, source, target);
    const nextSource = { row: target.row, col: target.col };
    const continuations = getCaptureSequences(nextState, nextSource);

    if (continuations.length === 0) {
      sequences.push({ steps: [{ from: source, target }], state: nextState });
    } else {
      for (const continuation of continuations) {
        sequences.push({
          steps: [{ from: source, target }, ...continuation.steps],
          state: continuation.state,
        });
      }
    }
  }

  return sequences;
}

function getCompleteTurnOptions(state, player) {
  const immediateMoves = getLegalMovesForPlayer(state, player);
  if (immediateMoves.length === 0) return [];

  if (immediateMoves[0].target.capture) {
    const options = [];
    const visitedSources = new Set();

    for (const move of immediateMoves) {
      const key = `${move.from.row},${move.from.col}`;
      if (visitedSources.has(key)) continue;
      visitedSources.add(key);
      options.push(...getCaptureSequences(state, move.from));
    }

    return options;
  }

  return immediateMoves.map((move) => ({
    steps: [move],
    state: applySingleMove(state, move.from, move.target),
  }));
}

function evaluateBoard(state) {
  let score = 0;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state[row][col];
      if (!piece) continue;

      const value = piece.king ? (ruleset === "russian" ? 220 : 175) : 100;
      const progress = piece.king ? 0 : piece.player === COMPUTER ? row * 4 : (SIZE - 1 - row) * 4;
      const centerBonus = col >= 2 && col <= 5 && row >= 2 && row <= 5 ? 6 : 0;
      const positionalValue = value + progress + centerBonus;
      score += piece.player === COMPUTER ? positionalValue : -positionalValue;
    }
  }

  score += getLegalMovesForPlayer(state, COMPUTER).length * 3;
  score -= getLegalMovesForPlayer(state, HUMAN).length * 3;
  return score;
}

function scoreHumanFinishedTurn(state) {
  const winningPlayer = getWinningPlayer(state, COMPUTER);
  if (winningPlayer === HUMAN) return Infinity;
  if (winningPlayer === COMPUTER) return -Infinity;

  const computerOptions = getCompleteTurnOptions(state, COMPUTER);
  if (computerOptions.length === 0) return Infinity;

  const bestComputerScore = Math.max(...computerOptions.map((option) => evaluateBoard(option.state)));
  return -bestComputerScore;
}

function scoreHumanTarget(target) {
  if (!selected) return -Infinity;

  const afterTarget = applySingleMove(board, selected, target);
  if (!target.capture) return scoreHumanFinishedTurn(afterTarget);

  const followUpCaptures = getCaptureMovesForPiece(afterTarget, target.row, target.col);
  if (followUpCaptures.length === 0) return scoreHumanFinishedTurn(afterTarget);

  const continuations = getCaptureSequences(afterTarget, { row: target.row, col: target.col });
  if (continuations.length === 0) return scoreHumanFinishedTurn(afterTarget);

  return Math.max(...continuations.map((continuation) => scoreHumanFinishedTurn(continuation.state)));
}

function getBestTargetsForSelection() {
  if (!selected || legalTargets.length === 0) return [];

  const scoredTargets = legalTargets.map((target) => ({
    target,
    score: scoreHumanTarget(target),
  }));

  const bestScore = Math.max(...scoredTargets.map((item) => item.score));
  return scoredTargets
    .filter((item) => item.score === bestScore)
    .map((item) => item.target);
}

function chooseComputerTurn(options) {
  let bestScore = -Infinity;
  let bestOptions = [];

  for (const option of options) {
    const humanReplies = getCompleteTurnOptions(option.state, HUMAN);
    const replyScores = humanReplies.map((reply) => evaluateBoard(reply.state));
    const worstReplyScore = replyScores.length > 0 ? Math.min(...replyScores) : evaluateBoard(option.state) + 10000;

    if (worstReplyScore > bestScore) {
      bestScore = worstReplyScore;
      bestOptions = [option];
    } else if (worstReplyScore === bestScore) {
      bestOptions.push(option);
    }
  }

  return bestOptions[Math.floor(Math.random() * bestOptions.length)];
}

function scheduleComputerTurn() {
  computerThinking = true;
  render();
  updateStatus(playerHasCapture(board, COMPUTER) ? "Computer is choosing a capture..." : "Computer is thinking...");

  computerTimer = setTimeout(() => {
    computerTimer = null;
    playComputerTurn();
  }, COMPUTER_DELAY_MS);
}

function playComputerTurn() {
  if (winner || currentPlayer !== COMPUTER) return;

  const options = getCompleteTurnOptions(board, COMPUTER);
  if (options.length === 0) {
    winner = HUMAN;
    computerThinking = false;
    render();
    updateStatus("You win!");
    return;
  }

  const chosen = chooseComputerTurn(options);
  board = chosen.state;
  computerThinking = false;
  selected = null;
  legalTargets = [];
  bestTargets = [];
  mustContinueCapture = false;
  finishTurn();
}

function handleSquareClick(row, col) {
  if (winner || computerThinking || currentPlayer !== HUMAN) return;

  const target = findLegalTarget(row, col);
  if (target) {
    moveSelectedPiece(target);
    return;
  }

  if (mustContinueCapture) return;

  const piece = board[row][col];
  if (piece?.player === HUMAN) {
    selectPiece(row, col);
    return;
  }

  selected = null;
  legalTargets = [];
  bestTargets = [];
  render();
}

function render() {
  boardElement.innerHTML = "";
  boardElement.classList.toggle("thinking", computerThinking);

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}`);
      square.disabled = Boolean(winner || computerThinking || currentPlayer !== HUMAN);
      square.addEventListener("click", () => handleSquareClick(row, col));

      if (selected?.row === row && selected?.col === col) square.classList.add("selected");
      if (legalTargets.some((move) => move.row === row && move.col === col)) square.classList.add("legal");
      if (isBestTarget(row, col)) square.classList.add("best");

      const piece = board[row][col];
      if (piece) {
        const pieceElement = document.createElement("span");
        pieceElement.className = `piece ${piece.player}${piece.king ? " king" : ""}`;
        pieceElement.setAttribute("aria-label", `${piece.king ? "King " : ""}${piece.player} piece`);
        square.appendChild(pieceElement);
      }

      boardElement.appendChild(square);
    }
  }

  turnText.textContent = winner ? "Game over" : currentPlayer === HUMAN ? "You" : "Computer";
}

function updateStatus(message) {
  statusText.textContent = message;
}

restartButton.addEventListener("click", resetGame);
rulesSelect.addEventListener("change", (event) => {
  ruleset = event.target.value;
  resetGame();
});

resetGame();
