const socket = io();

// DOM elements
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverModal = document.getElementById('game-over-modal');
const btnPlayAI = document.getElementById('btn-play-ai');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const joinForm = document.getElementById('join-form');
const roomInput = document.getElementById('room-input');
const btnJoinSubmit = document.getElementById('btn-join-submit');
const roomInfo = document.getElementById('room-info');
const roomIdDisplay = document.getElementById('room-id-display');
const gameRoomId = document.getElementById('game-room-id');
const board = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const btnUndo = document.getElementById('btn-undo');
const btnCopyRoom = document.getElementById('btn-copy-room');
const btnLeave = document.getElementById('btn-leave');

const btnBackToMenu = document.getElementById('btn-back-to-menu');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverMessage = document.getElementById('game-over-message');

// Game state
let myColor = null;
let currentTurn = 'white';
let selectedCell = null;
let validMoves = [];
let gameStarted = false;
let gameOver = false;
let roomId = null;
let mustContinueCapture = null;
let isAIGame = false;

// Socket event handlers
socket.on('roomCreated', (data) => {
    roomId = data.roomId;
    myColor = data.color;
    isAIGame = data.isAI || false;
    gameRoomId.textContent = data.roomId;
    
    if (data.isAI) {
        // AI game starts immediately, no waiting
        showToast('Игра с компьютером началась!', 'success');
    } else {
        roomIdDisplay.textContent = data.roomId;
        roomInfo.classList.remove('hidden');
        joinForm.classList.add('hidden');
        showToast(`Комната создана! ID: ${data.roomId}`, 'success');
    }
});


socket.on('yourColor', (color) => {
    myColor = color;
});

socket.on('gameState', (data) => {
    gameStarted = data.gameStarted;
    gameOver = data.gameOver;
    currentTurn = data.currentTurn;
    mustContinueCapture = data.mustContinueCapture || null;

    if (gameStarted) {
        menuScreen.classList.remove('active');
        menuScreen.classList.add('hidden');
        gameScreen.classList.add('active');
        gameScreen.classList.remove('hidden');
    }

    if (data.players) {
        updatePlayerInfo(data.players, data.currentTurn);
    }

    renderBoard(data.board, data.lastMove);

    if (gameOver) {
        showGameOver(data);
    }
});

socket.on('validMoves', (moves) => {
    validMoves = moves;
    highlightValidMoves(moves);
});

socket.on('error', (message) => {
    showToast(message, 'error');
});

socket.on('undoSuccess', () => {
    showToast('Ход отменён!', 'success');
});


// UI Event handlers
btnPlayAI.addEventListener('click', () => {
    socket.emit('playWithAI');
});

btnCreateRoom.addEventListener('click', () => {
    socket.emit('createRoom');
});


btnJoinRoom.addEventListener('click', () => {
    joinForm.classList.toggle('hidden');
    roomInfo.classList.add('hidden');
});

btnJoinSubmit.addEventListener('click', () => {
    const code = roomInput.value.trim().toUpperCase();
    if (code.length === 6) {
        socket.emit('joinRoom', code);
    } else {
        showToast('Введите корректный ID комнаты (6 символов)', 'error');
    }
});

roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnJoinSubmit.click();
});

roomIdDisplay.addEventListener('click', () => {
    navigator.clipboard.writeText(roomIdDisplay.textContent).then(() => {
        showToast('ID комнаты скопирован!', 'success');
    });
});

btnCopyRoom.addEventListener('click', () => {
    navigator.clipboard.writeText(gameRoomId.textContent).then(() => {
        showToast('ID комнаты скопирован!', 'success');
    });
});

btnUndo.addEventListener('click', () => {
    if (!gameOver && gameStarted) {
        socket.emit('undoMove');
    }
});

btnLeave.addEventListener('click', () => {
    location.reload();
});


btnBackToMenu.addEventListener('click', () => {
    location.reload();
});

// Board rendering
function renderBoard(boardData, lastMove) {
    board.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const cell = document.createElement('div');
            cell.className = `cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            cell.dataset.row = row;
            cell.dataset.col = col;

            // Highlight last move
            if (lastMove) {
                if ((lastMove.from.row === row && lastMove.from.col === col) ||
                    (lastMove.to.row === row && lastMove.to.col === col)) {
                    cell.classList.add('last-move');
                }
            }

            // Highlight selected
            if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
                cell.classList.add('selected');
            }

            const piece = boardData[row][col];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = `piece ${piece.color}${piece.type === 'king' ? ' king' : ''}`;

                // Make clickable if it's my piece and my turn
                if (!gameOver && gameStarted && piece.color === myColor && currentTurn === myColor) {
                    if (!mustContinueCapture || (mustContinueCapture.row === row && mustContinueCapture.col === col)) {
                        pieceEl.classList.add('clickable');
                        pieceEl.addEventListener('click', (e) => {
                            e.stopPropagation();
                            selectPiece(row, col);
                        });
                    }
                }

                cell.appendChild(pieceEl);
            } else {
                // Empty cell click for moving
                if (!gameOver && gameStarted && selectedCell) {
                    cell.addEventListener('click', () => {
                        handleCellClick(row, col);
                    });
                }
            }

            board.appendChild(cell);
        }
    }
}

function selectPiece(row, col) {
    selectedCell = { row, col };
    socket.emit('getValidMoves', { row, col });
    renderBoardFromState();
}

function handleCellClick(row, col) {
    if (!selectedCell) return;

    const move = validMoves.find(m => m.to.row === row && m.to.col === col);
    if (move) {
        socket.emit('makeMove', move);
        selectedCell = null;
        validMoves = [];
    } else {
        selectedCell = null;
        validMoves = [];
        renderBoardFromState();
    }
}

function highlightValidMoves(moves) {
    const cells = board.querySelectorAll('.cell.dark');
    cells.forEach(cell => {
        cell.classList.remove('valid-move', 'valid-capture');
    });

    moves.forEach(move => {
        const cell = board.querySelector(`.cell[data-row="${move.to.row}"][data-col="${move.to.col}"]`);
        if (cell) {
            cell.classList.add('valid-move');
            if (move.captured) {
                cell.classList.add('valid-capture');
            }
            cell.addEventListener('click', () => {
                handleCellClick(move.to.row, move.to.col);
            }, { once: true });
        }
    });
}

function renderBoardFromState() {
    // We need to re-render with current state
    // This is called after selecting a piece
    // The board will be re-rendered when we get gameState from server
    // For now, just update the visual selection
    document.querySelectorAll('.cell.selected').forEach(c => c.classList.remove('selected'));
    if (selectedCell) {
        const cell = board.querySelector(`.cell[data-row="${selectedCell.row}"][data-col="${selectedCell.col}"]`);
        if (cell) cell.classList.add('selected');
    }
}

function updatePlayerInfo(players, turn) {
    const whitePlayer = document.querySelector('.white-player');
    const blackPlayer = document.querySelector('.black-player');
    whitePlayer.classList.remove('active-turn');
    blackPlayer.classList.remove('active-turn');

    if (turn === 'white') {
        whitePlayer.classList.add('active-turn');
        turnIndicator.textContent = 'Ход: Белых';
    } else {
        blackPlayer.classList.add('active-turn');
        turnIndicator.textContent = 'Ход: Чёрных';
    }
}

function showGameOver(data) {
    gameOverModal.classList.remove('hidden');
    if (data.disconnected) {
        gameOverTitle.textContent = 'Соперник отключился';
        gameOverMessage.textContent = 'Вы победили!';
    } else if (data.winner === myColor) {
        gameOverTitle.textContent = '🎉 Победа!';
        gameOverMessage.textContent = 'Поздравляем! Вы выиграли!';
    } else if (data.winner) {
        gameOverTitle.textContent = '😔 Поражение';
        gameOverMessage.textContent = 'Вы проиграли. Попробуйте ещё раз!';
    } else {
        gameOverTitle.textContent = 'Игра окончена';
        gameOverMessage.textContent = 'Ничья';
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
