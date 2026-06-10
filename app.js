const boardElement = document.getElementById("board");
const statusText = document.getElementById("statusText");
const turnText = document.getElementById("turnText");
const restartButton = document.getElementById("restartButton");

const SIZE = 8;
const HUMAN = "red";
const COMPUTER = "black";
const COMPUTER_DELAY_MS = 450;

let board = [];
let currentPlayer = HUMAN;
let selected = null;
let legalTargets = [];
let mustContinueCapture = false;
let winner = null;
let computerThinking = false;
let computerTimer = null;

function createPiece(player) {
  return { player, king: false };
}

function cloneBoard(sourceBoard) {
  return sourceBoard.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
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
  mustContinueCapture = false;
  winner = null;
  computerThinking = false;
  computerTimer = null;
  render();
  updateStatus("Your move");
}

function isInside(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function directionsFor(piece) {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }

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

function getMovesForPiece(state, row, col, captureOnly = false) {
  const piece = state[row][col];
  if (!piece) return [];

  const moves = [];

  for (const [rowStep, colStep] of directionsFor(piece)) {
    const adjacentRow = row + rowStep;
    const adjacentCol = col + colStep;
    if (!isInside(adjacentRow, adjacentCol)) continue;

    const adjacentPiece = state[adjacentRow][adjacentCol];

    if (!adjacentPiece && !captureOnly) {
      moves.push({ row: adjacentRow, col: adjacentCol, capture: null });
      continue;
    }

    const landingRow = row + rowStep * 2;
    const landingCol = col + colStep * 2;

    if (
      adjacentPiece &&
      adjacentPiece.player !== piece.player &&
      isInside(landingRow, landingCol) &&
      !state[landingRow][landingCol]
    ) {
      moves.push({
        row: landingRow,
        col: landingCol,
        capture: { row: adjacentRow, col: adjacentCol },
      });
    }
  }

  return captureOnly ? moves.filter((move) => move.capture) : moves;
}

function playerHasCapture(state, player) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = state[row][col];
      if (piece?.player === player && getMovesForPiece(state, row, col, true).length > 0) {
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

      for (const target of getMovesForPiece(state, row, col, captureRequired)) {
        moves.push({ from: { row, col }, target });
      }
    }
  }

  return moves;
}

function getSelectableMoves(row, col) {
  const piece = board[row][col];
  if (!piece || piece.player !== currentPlayer) return [];

  const captureRequired = playerHasCapture(board, currentPlayer);
  return getMovesForPiece(board, row, col, captureRequired);
}

function selectPiece(row, col) {
  if (winner || computerThinking || currentPlayer !== HUMAN) return;

  const moves = getSelectableMoves(row, col);
  if (moves.length === 0) return;

  selected = { row, col };
  legalTargets = moves;
  render();

  if (playerHasCapture(board, currentPlayer)) {
    updateStatus("You must capture");
  } else {
    updateStatus("Choose a highlighted square");
  }
}

function findLegalTarget(row, col) {
  return legalTargets.find((move) => move.row === row && move.col === col);
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

function promoteIfNeeded(piece, row) {
  if (piece.player === HUMAN && row === 0) piece.king = true;
  if (piece.player === COMPUTER && row === SIZE - 1) piece.king = true;
}

function moveSelectedPiece(target) {
  if (!selected || winner || computerThinking || currentPlayer !== HUMAN) return;

  board = applySingleMove(board, selected, target);

  if (target.capture) {
    const followUpCaptures = getMovesForPiece(board, target.row, target.col, true);
    if (followUpCaptures.length > 0) {
      selected = { row: target.row, col: target.col };
      legalTargets = followUpCaptures;
      mustContinueCapture = true;
      render();
      updateStatus("Continue capturing");
      return;
    }
  }

  mustContinueCapture = false;
  selected = null;
  legalTargets = [];
  finishTurn();
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
  } else if (playerHasCapture(board, HUMAN)) {
    updateStatus("Your move: capture required");
  } else {
    updateStatus("Your move");
  }
}

function getWinningPlayer(state, playerToMove) {
  const opponent = playerToMove;
  const otherPlayer = opponent === HUMAN ? COMPUTER : HUMAN;

  let opponentPieces = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (state[row][col]?.player === opponent) opponentPieces += 1;
    }
  }

  if (opponentPieces === 0) return otherPlayer;
  if (getLegalMovesForPlayer(state, opponent).length === 0) return otherPlayer;
  return null;
}

function getCaptureSequences(state, source, player) {
  const captures = getMovesForPiece(state, source.row, source.col, true);
  if (captures.length === 0) return [];

  const sequences = [];

  for (const target of captures) {
    const nextState = applySingleMove(state, source, target);
    const nextSource = { row: target.row, col: target.col };
    const continuations = getCaptureSequences(nextState, nextSource, player);

    if (continuations.length === 0) {
      sequences.push({
        steps: [{ from: source, target }],
        state: nextState,
      });
      continue;
    }

    for (const continuation of continuations) {
      sequences.push({
        steps: [{ from: source, target }, ...continuation.steps],
        state: continuation.state,
      });
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
      options.push(...getCaptureSequences(state, move.from, player));
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

      const value = piece.king ? 175 : 100;
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

function chooseComputerTurn(options) {
  let bestScore = -Infinity;
  let bestOptions = [];

  for (const option of options) {
    const humanReplyOptions = getCompleteTurnOptions(option.state, HUMAN);
    const replyScores = humanReplyOptions.map((reply) => evaluateBoard(reply.state));
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

      if (selected?.row === row && selected?.col === col) {
        square.classList.add("selected");
      }

      if (legalTargets.some((move) => move.row === row && move.col === col)) {
        square.classList.add("legal");
      }

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

  if (winner) {
    turnText.textContent = "Game over";
  } else if (currentPlayer === HUMAN) {
    turnText.textContent = "You";
  } else {
    turnText.textContent = "Computer";
  }
}

function updateStatus(message) {
  statusText.textContent = message;
}

restartButton.addEventListener("click", resetGame);
resetGame();
