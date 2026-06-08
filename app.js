const boardElement = document.getElementById("board");
const statusText = document.getElementById("statusText");
const turnText = document.getElementById("turnText");
const restartButton = document.getElementById("restartButton");

const SIZE = 8;
let board = [];
let currentPlayer = "red";
let selected = null;
let legalTargets = [];
let mustContinueCapture = false;
let winner = null;

function createPiece(player) {
  return { player, king: false };
}

function resetGame() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if ((row + col) % 2 === 1) board[row][col] = createPiece("black");
    }
  }

  for (let row = 5; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if ((row + col) % 2 === 1) board[row][col] = createPiece("red");
    }
  }

  currentPlayer = "red";
  selected = null;
  legalTargets = [];
  mustContinueCapture = false;
  winner = null;
  render();
  updateStatus("Red moves first");
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

  return piece.player === "red"
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];
}

function getMovesForPiece(row, col, captureOnly = false) {
  const piece = board[row][col];
  if (!piece) return [];

  const moves = [];
  for (const [rowStep, colStep] of directionsFor(piece)) {
    const adjacentRow = row + rowStep;
    const adjacentCol = col + colStep;

    if (!isInside(adjacentRow, adjacentCol)) continue;

    const adjacentPiece = board[adjacentRow][adjacentCol];
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
      !board[landingRow][landingCol]
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

function playerHasCapture(player) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = board[row][col];
      if (piece?.player === player && getMovesForPiece(row, col, true).length > 0) {
        return true;
      }
    }
  }
  return false;
}

function getSelectableMoves(row, col) {
  const piece = board[row][col];
  if (!piece || piece.player !== currentPlayer) return [];

  const captureRequired = playerHasCapture(currentPlayer);
  return getMovesForPiece(row, col, captureRequired);
}

function selectPiece(row, col) {
  if (winner) return;

  const moves = getSelectableMoves(row, col);
  if (moves.length === 0) return;

  selected = { row, col };
  legalTargets = moves;
  render();

  if (playerHasCapture(currentPlayer)) {
    updateStatus(`${capitalize(currentPlayer)} must capture`);
  } else {
    updateStatus(`${capitalize(currentPlayer)} selected a piece`);
  }
}

function findLegalTarget(row, col) {
  return legalTargets.find((move) => move.row === row && move.col === col);
}

function moveSelectedPiece(target) {
  if (!selected || winner) return;

  const { row: sourceRow, col: sourceCol } = selected;
  const piece = board[sourceRow][sourceCol];
  board[target.row][target.col] = piece;
  board[sourceRow][sourceCol] = null;

  if (target.capture) {
    board[target.capture.row][target.capture.col] = null;
  }

  promoteIfNeeded(piece, target.row);

  if (target.capture) {
    const followUpCaptures = getMovesForPiece(target.row, target.col, true);
    if (followUpCaptures.length > 0) {
      selected = { row: target.row, col: target.col };
      legalTargets = followUpCaptures;
      mustContinueCapture = true;
      render();
      updateStatus(`${capitalize(currentPlayer)} must continue capturing`);
      return;
    }
  }

  mustContinueCapture = false;
  selected = null;
  legalTargets = [];
  switchPlayer();
}

function promoteIfNeeded(piece, row) {
  if (piece.player === "red" && row === 0) piece.king = true;
  if (piece.player === "black" && row === SIZE - 1) piece.king = true;
}

function switchPlayer() {
  const nextPlayer = currentPlayer === "red" ? "black" : "red";
  const winningPlayer = getWinningPlayer(nextPlayer);

  if (winningPlayer) {
    winner = winningPlayer;
    render();
    updateStatus(`${capitalize(winner)} wins!`);
    return;
  }

  currentPlayer = nextPlayer;
  render();

  if (playerHasCapture(currentPlayer)) {
    updateStatus(`${capitalize(currentPlayer)} must capture`);
  } else {
    updateStatus(`${capitalize(currentPlayer)} to move`);
  }
}

function getWinningPlayer(playerToMove) {
  const opponent = playerToMove;
  const otherPlayer = opponent === "red" ? "black" : "red";

  let opponentPieces = 0;
  let opponentCanMove = false;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = board[row][col];
      if (piece?.player === opponent) {
        opponentPieces += 1;
        if (getMovesForPiece(row, col).length > 0) opponentCanMove = true;
      }
    }
  }

  if (opponentPieces === 0 || !opponentCanMove) return otherPlayer;
  return null;
}

function handleSquareClick(row, col) {
  if (winner) return;

  const target = findLegalTarget(row, col);
  if (target) {
    moveSelectedPiece(target);
    return;
  }

  if (mustContinueCapture) return;

  const piece = board[row][col];
  if (piece?.player === currentPlayer) {
    selectPiece(row, col);
    return;
  }

  selected = null;
  legalTargets = [];
  render();
}

function render() {
  boardElement.innerHTML = "";

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}`);
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

  turnText.textContent = winner ? "Game over" : capitalize(currentPlayer);
}

function updateStatus(message) {
  statusText.textContent = message;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

restartButton.addEventListener("click", resetGame);
resetGame();
