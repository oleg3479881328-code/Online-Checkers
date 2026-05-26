const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Game state
const rooms = {};
const waitingPlayers = [];

// Checkers game logic
function createInitialBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
                if (row < 3) {
                    board[row][col] = { type: 'man', color: 'black' };
                } else if (row > 4) {
                    board[row][col] = { type: 'man', color: 'white' };
                }
            }
        }
    }
    return board;
}

function cloneBoard(board) {
    return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

function getValidMoves(board, row, col) {
    const piece = board[row][col];
    if (!piece) return [];

    const moves = [];
    const captures = [];
    const directions = piece.type === 'king' ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                       piece.color === 'white' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];

    for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (!board[nr][nc]) {
                moves.push({ from: { row, col }, to: { row: nr, col: nc }, captured: null });
            } else if (board[nr][nc].color !== piece.color) {
                const jr = nr + dr;
                const jc = nc + dc;
                if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !board[jr][jc]) {
                    captures.push({ from: { row, col }, to: { row: jr, col: jc }, captured: { row: nr, col: nc } });
                }
            }
        }
    }

    // If captures exist, only return captures (must capture)
    if (captures.length > 0) return captures;
    return moves;
}

function getAllValidMoves(board, color) {
    const allMoves = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] && board[row][col].color === color) {
                const moves = getValidMoves(board, row, col);
                allMoves.push(...moves);
            }
        }
    }
    return allMoves;
}

function hasAnyCapture(board, color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] && board[row][col].color === color) {
                const moves = getValidMoves(board, row, col);
                if (moves.some(m => m.captured)) return true;
            }
        }
    }
    return false;
}

function applyMove(board, move) {
    const newBoard = cloneBoard(board);
    const piece = newBoard[move.from.row][move.from.col];
    newBoard[move.to.row][move.to.col] = piece;
    newBoard[move.from.row][move.from.col] = null;

    if (move.captured) {
        newBoard[move.captured.row][move.captured.col] = null;
    }

    // King promotion
    if (piece.type === 'man') {
        if (piece.color === 'white' && move.to.row === 0) {
            newBoard[move.to.row][move.to.col] = { type: 'king', color: 'white' };
        } else if (piece.color === 'black' && move.to.row === 7) {
            newBoard[move.to.row][move.to.col] = { type: 'king', color: 'black' };
        }
    }

    return newBoard;
}

function checkWinner(board) {
    let whiteCount = 0;
    let blackCount = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col]) {
                if (board[row][col].color === 'white') whiteCount++;
                else blackCount++;
            }
        }
    }
    if (whiteCount === 0) return 'black';
    if (blackCount === 0) return 'white';
    return null;
}

function createRoom() {
    const roomId = uuidv4().substring(0, 6);
    rooms[roomId] = {
        id: roomId,
        players: [],
        board: createInitialBoard(),
        currentTurn: 'white',
        gameStarted: false,
        gameOver: false,
        winner: null,
        lastMove: null
    };
    return roomId;
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('createRoom', () => {
        const roomId = createRoom();
        socket.join(roomId);
        rooms[roomId].players.push({ id: socket.id, color: 'white' });
        socket.emit('roomCreated', { roomId, color: 'white' });
        socket.emit('gameState', {
            board: rooms[roomId].board,
            currentTurn: rooms[roomId].currentTurn,
            color: 'white',
            gameStarted: false,
            gameOver: false,
            winner: null,
            players: rooms[roomId].players.map(p => p.color)
        });
        console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    socket.on('joinRoom', (roomId) => {
        const room = rooms[roomId];
        if (!room) {
            socket.emit('error', 'Комната не найдена');
            return;
        }
        if (room.players.length >= 2) {
            socket.emit('error', 'Комната уже заполнена');
            return;
        }
        if (room.gameStarted) {
            socket.emit('error', 'Игра уже началась');
            return;
        }

        socket.join(roomId);
        room.players.push({ id: socket.id, color: 'black' });
        room.gameStarted = true;
        room.currentTurn = 'white';

        // Notify both players
        io.to(roomId).emit('gameState', {
            board: room.board,
            currentTurn: room.currentTurn,
            gameStarted: true,
            gameOver: false,
            winner: null,
            players: room.players.map(p => p.color)
        });

        // Send color to the joining player
        socket.emit('yourColor', 'black');
        // The first player already knows they're white

        console.log(`Player ${socket.id} joined room ${roomId}`);
    });

    socket.on('getValidMoves', ({ row, col }) => {
        // Find which room this socket is in
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const player = room.players.find(p => p.id === socket.id);
            if (player && room.gameStarted && !room.gameOver) {
                const piece = room.board[row][col];
                if (piece && piece.color === player.color && room.currentTurn === player.color) {
                    const moves = getValidMoves(room.board, row, col);
                    socket.emit('validMoves', moves);
                }
                break;
            }
        }
    });

    socket.on('makeMove', (move) => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const player = room.players.find(p => p.id === socket.id);
            if (player && room.gameStarted && !room.gameOver) {
                if (room.currentTurn !== player.color) {
                    socket.emit('error', 'Сейчас не ваш ход');
                    return;
                }

                const piece = room.board[move.from.row][move.from.col];
                if (!piece || piece.color !== player.color) {
                    socket.emit('error', 'Это не ваша шашка');
                    return;
                }

                const validMoves = getValidMoves(room.board, move.from.row, move.from.col);
                const isValid = validMoves.some(m =>
                    m.to.row === move.to.row && m.to.col === move.to.col &&
                    (m.captured?.row === move.captured?.row && m.captured?.col === move.captured?.col ||
                     (!m.captured && !move.captured))
                );

                if (!isValid) {
                    socket.emit('error', 'Недопустимый ход');
                    return;
                }

                // Check if must capture
                const mustCapture = hasAnyCapture(room.board, player.color);
                if (mustCapture && !move.captured) {
                    socket.emit('error', 'Вы обязаны бить!');
                    return;
                }

                room.board = applyMove(room.board, move);
                room.lastMove = move;

                // Check for winner
                const winner = checkWinner(room.board);
                if (winner) {
                    room.gameOver = true;
                    room.winner = winner;
                    io.to(roomId).emit('gameState', {
                        board: room.board,
                        currentTurn: room.currentTurn,
                        gameStarted: true,
                        gameOver: true,
                        winner: winner,
                        players: room.players.map(p => p.color),
                        lastMove: move
                    });
                    return;
                }

                // Check for additional capture (chain)
                if (move.captured) {
                    const additionalCaptures = getValidMoves(room.board, move.to.row, move.to.col);
                    const hasMoreCaptures = additionalCaptures.some(m => m.captured);
                    if (hasMoreCaptures) {
                        // Same player continues
                        io.to(roomId).emit('gameState', {
                            board: room.board,
                            currentTurn: player.color,
                            gameStarted: true,
                            gameOver: false,
                            winner: null,
                            players: room.players.map(p => p.color),
                            lastMove: move,
                            mustContinueCapture: { row: move.to.row, col: move.to.col }
                        });
                        return;
                    }
                }

                // Switch turn
                room.currentTurn = room.currentTurn === 'white' ? 'black' : 'white';

                // Check if next player has any moves
                const nextMoves = getAllValidMoves(room.board, room.currentTurn);
                if (nextMoves.length === 0) {
                    room.gameOver = true;
                    room.winner = room.currentTurn === 'white' ? 'black' : 'white';
                }

                io.to(roomId).emit('gameState', {
                    board: room.board,
                    currentTurn: room.currentTurn,
                    gameStarted: true,
                    gameOver: room.gameOver,
                    winner: room.winner,
                    players: room.players.map(p => p.color),
                    lastMove: move
                });
                break;
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.gameStarted && !room.gameOver) {
                    room.gameOver = true;
                    room.winner = room.players.length > 0 ? room.players[0].color : null;
                    io.to(roomId).emit('gameState', {
                        board: room.board,
                        currentTurn: room.currentTurn,
                        gameStarted: true,
                        gameOver: true,
                        winner: room.winner,
                        players: room.players.map(p => p.color),
                        lastMove: null,
                        disconnected: true
                    });
                }
                if (room.players.length === 0) {
                    delete rooms[roomId];
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
