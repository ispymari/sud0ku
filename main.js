// Sudoku Game Logic
let gameState = {
    currentDifficulty: null,
    board: null,
    solution: null,
    originalBoard: null,
    selectedCell: null,
    mistakes: 0,
    score: 0,
    timerInterval: null,
    timerSeconds: 0,
    timerStarted: false,
    selectedNumber: null,
    tooltipsShown: {},
    errorCells: new Set(),
    gifTimeout: null,
    notesMode: false,
    cellNotes: new Map(),
    hintsUsed: 0,
    maxHints: 3
};

// Difficulty levels with number of clues
const difficulties = {
    easy: 40,
    medium: 30,
    hard: 20,
    expert: 15,
    master: 12,      // Master: more clues than extreme
    extreme: 8       // Extreme: very few clues
};

// Tool button tooltips
const toolTooltips = {
    'retry-btn': 'Retry: Start the current puzzle over',
    'erase-btn': 'Erase: Clear the selected cell',
    'note-btn': 'Note: Add notes to cells',
    'hint-btn': 'Hint: Get a hint for the puzzle'
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    const splashScreen = document.getElementById('splash-screen');
    const mainContent = document.getElementById('main-content');

    // Hide splash screen after 3 seconds
    setTimeout(function() {
        splashScreen.classList.add('fade-out');

        setTimeout(function() {
            mainContent.classList.remove('hidden');
            initializeGame();
        }, 500);
    }, 3000);
});

function initializeGame() {
    // Set up difficulty buttons
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            setDifficulty(this.dataset.difficulty);
        });
    });

    // Set up number input buttons
    document.querySelectorAll('.number-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (gameState.selectedCell && !this.disabled) {
                enterNumber(gameState.selectedCell, this.dataset.number);
            }
        });
    });

    // Set up tool buttons with tooltips
    setupToolButtons();

    // Set up keyboard input for mobile/desktop
    setupKeyboardInput();

    // Set up new game button
    document.getElementById('new-game-btn').addEventListener('click', function() {
        // Always start new game, default to easy if not set
        startNewGame(gameState.currentDifficulty || 'easy');
    });

    // Start with easy difficulty by default
    setDifficulty('easy');
}

function setupToolButtons() {
    document.getElementById('retry-btn').addEventListener('click', function() {
        showToolTooltip('retry-btn');
        resetProgress();
    });

    document.getElementById('erase-btn').addEventListener('click', function() {
        showToolTooltip('erase-btn');
        if (gameState.selectedCell) {
            eraseCell(gameState.selectedCell);
        }
    });

    document.getElementById('note-btn').addEventListener('click', function() {
        showToolTooltip('note-btn');
        toggleNoteMode();
    });

    document.getElementById('hint-btn').addEventListener('click', function() {
        showToolTooltip('hint-btn');
        giveHint();
    });
}

function setupKeyboardInput() {
    const keypadInput = document.getElementById('mobile-keypad-input');
    
    // Handle numeric keyboard input
    keypadInput.addEventListener('input', function(e) {
        const value = this.value;
        if (value && gameState.selectedCell && !isNaN(value)) {
            const number = parseInt(value);
            if (number >= 1 && number <= 9) {
                enterNumber(gameState.selectedCell, number.toString());
                this.value = '';
            }
        }
    });
    
    // Handle physical keyboard input
    document.addEventListener('keydown', function(e) {
        if (!gameState.selectedCell) return;
        
        const key = e.key;
        
        if (key >= '1' && key <= '9') {
            e.preventDefault();
            enterNumber(gameState.selectedCell, key);
        } else if (key === 'Backspace' || key === 'Delete') {
            e.preventDefault();
            eraseCell(gameState.selectedCell);
        }
    });
}

function focusMobileKeypad() {
    const keypadInput = document.getElementById('mobile-keypad-input');
    if (keypadInput) {
        keypadInput.focus();
    }
}

function showToolTooltip(btnId) {
    if (!gameState.tooltipsShown[btnId]) {
        const modal = document.getElementById('tooltip-modal');
        const message = document.getElementById('tooltip-message');
        const okBtn = document.getElementById('tooltip-ok-btn');

        message.textContent = toolTooltips[btnId];
        modal.classList.remove('hidden');

        okBtn.onclick = function() {
            modal.classList.add('hidden');
            gameState.tooltipsShown[btnId] = true;
            // Save to localStorage so it doesn't show again
            localStorage.setItem('tooltipsShown', JSON.stringify(gameState.tooltipsShown));
        };
    }
}

function setDifficulty(difficulty) {
    gameState.currentDifficulty = difficulty;

    // Update active button
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-difficulty="${difficulty}"]`).classList.add('active');

    // Start new game with this difficulty
    startNewGame(difficulty);
}

function startNewGame(difficulty) {
    // Reset game state
    gameState.mistakes = 0;
    gameState.score = 0;
    gameState.timerSeconds = 0;
    gameState.timerStarted = false;
    gameState.selectedCell = null;
    gameState.selectedNumber = null;
    gameState.errorCells = new Set();
    gameState.notesMode = false;
    gameState.cellNotes = new Map();
    gameState.hintsUsed = 0;

    // Stop existing timer
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }

    // Clear any pending GIF timeout
    if (gameState.gifTimeout) {
        clearTimeout(gameState.gifTimeout);
    }

    // Reset to idle GIF
    const gifElement = document.getElementById('funny-gif');
    if (gifElement) {
        gifElement.src = 'images/giphy.gif';
    }

    // Generate new puzzle
    generatePuzzle(difficulty);

    // Update UI
    updateScoreDisplay();
    updateTimerDisplay();
    updateHintBadge();
    renderSudokuGrid();

    // Load tooltips from localStorage
    const saved = localStorage.getItem('tooltipsShown');
    if (saved) {
        gameState.tooltipsShown = JSON.parse(saved);
    }
}

function generatePuzzle(difficulty) {
    // Generate a valid sudoku solution
    gameState.solution = generateValidSudoku();

    // Copy solution and remove numbers based on difficulty
    gameState.board = gameState.solution.map(row => [...row]);
    
    const clueCount = difficulties[difficulty];
    let removed = 0;

    while (removed < 81 - clueCount) {
        const row = Math.floor(Math.random() * 9);
        const col = Math.floor(Math.random() * 9);

        if (gameState.board[row][col] !== 0) {
            gameState.board[row][col] = 0;
            removed++;
        }
    }
    
    // Save the original puzzle (with only the clues)
    gameState.originalBoard = gameState.board.map(row => [...row]);
}

function generateValidSudoku() {
    const board = Array(9).fill(null).map(() => Array(9).fill(0));

    function isValid(row, col, num) {
        // Check row
        for (let i = 0; i < 9; i++) {
            if (board[row][i] === num) return false;
        }

        // Check column
        for (let i = 0; i < 9; i++) {
            if (board[i][col] === num) return false;
        }

        // Check 3x3 box
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let i = boxRow; i < boxRow + 3; i++) {
            for (let j = boxCol; j < boxCol + 3; j++) {
                if (board[i][j] === num) return false;
            }
        }

        return true;
    }

    function solve() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === 0) {
                    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    for (let i = nums.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [nums[i], nums[j]] = [nums[j], nums[i]];
                    }

                    for (let num of nums) {
                        if (isValid(row, col, num)) {
                            board[row][col] = num;
                            if (solve()) return true;
                            board[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    solve();
    return board;
}

function renderSudokuGrid() {
    const grid = document.getElementById('sudoku-grid');
    grid.innerHTML = '';

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div');
            cell.className = 'sudoku-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            // Check if this cell has an error
            const cellKey = `${row},${col}`;
            if (gameState.errorCells.has(cellKey)) {
                cell.classList.add('error');
            }

            // Check if this is a given cell
            if (gameState.solution[row][col] === gameState.board[row][col] && gameState.board[row][col] !== 0) {
                cell.classList.add('given');
                cell.textContent = gameState.board[row][col];
            } else if (gameState.board[row][col] !== 0) {
                cell.textContent = gameState.board[row][col];
            } else {
                // Show notes if any exist for this cell
                const notes = gameState.cellNotes.get(cellKey);
                if (notes && notes.length > 0) {
                    const notesDiv = document.createElement('div');
                    notesDiv.className = 'cell-notes';
                    notesDiv.textContent = notes.join('');
                    cell.appendChild(notesDiv);
                }
            }

            cell.addEventListener('click', function() {
                selectCell(row, col);
            });

            grid.appendChild(cell);
        }
    }
    updateNumberButtonsState();
}

function selectCell(row, col) {
    // Remove previous selection and number highlights
    if (gameState.selectedCell) {
        const prevCell = document.querySelector(`[data-row="${gameState.selectedCell.row}"][data-col="${gameState.selectedCell.col}"]`);
        if (prevCell) {
            prevCell.classList.remove('selected');
        }
    }
    
    // Remove all previous number highlights
    document.querySelectorAll('.sudoku-cell.number-highlight').forEach(cell => {
        cell.classList.remove('number-highlight');
    });

    // Check if cell is given - don't select but still highlight
    const isGivenCell = gameState.solution[row][col] === gameState.board[row][col] && gameState.board[row][col] !== 0;
    
    if (!isGivenCell) {
        // Select new cell only if it's not a given cell
        gameState.selectedCell = { row, col };
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        
        // Focus mobile keypad for keyboard input
        focusMobileKeypad();
        
        // In note mode, add or remove notes instead of selecting
        if (gameState.notesMode) {
            // Switch back to normal mode after adding note
            return;
        }
        
        cell.classList.add('selected');
    }
    
    // Highlight all cells with the same number (works for both given and user-entered)
    const cellNumber = gameState.board[row][col];
    if (cellNumber !== 0) {
        document.querySelectorAll('.sudoku-cell').forEach(gridCell => {
            const cellRow = parseInt(gridCell.dataset.row);
            const cellCol = parseInt(gridCell.dataset.col);
            if (gameState.board[cellRow][cellCol] === cellNumber) {
                gridCell.classList.add('number-highlight');
            }
        });
    }
}

function enterNumber(cell, number) {
    if (!cell) return;

    // If in note mode, add note to cell
    if (gameState.notesMode) {
        const cellKey = `${cell.row},${cell.col}`;
        let notes = gameState.cellNotes.get(cellKey) || [];
        
        // Add or remove note
        if (notes.includes(parseInt(number))) {
            notes = notes.filter(n => n !== parseInt(number));
        } else {
            notes.push(parseInt(number));
            notes.sort((a, b) => a - b);
        }
        
        if (notes.length > 0) {
            gameState.cellNotes.set(cellKey, notes);
        } else {
            gameState.cellNotes.delete(cellKey);
        }
        
        renderSudokuGrid();
        return;
    }

    // Start timer on first input
    if (!gameState.timerStarted) {
        gameState.timerStarted = true;
        startTimer();
    }

    const row = cell.row;
    const col = cell.col;
    const cellKey = `${row},${col}`;

    // Clear notes when entering a number
    gameState.cellNotes.delete(cellKey);

    // Update board
    gameState.board[row][col] = parseInt(number);

    // Check if correct
    if (parseInt(number) !== gameState.solution[row][col]) {
        gameState.mistakes++;
        // Track error cell
        gameState.errorCells.add(cellKey);
        // Show wrong answer GIF
        displayGif('images/huh.gif', 5000);
        if (gameState.mistakes > 3) {
            // Game over, start new game
            setTimeout(() => {
                alert('Game Over! Too many mistakes. Starting a new game...');
                startNewGame(gameState.currentDifficulty);
            }, 100);
            return;
        }
    } else {
        gameState.score += 10;
        // Remove error status if corrected
        gameState.errorCells.delete(cellKey);
        // Show correct answer GIF
        displayGif('images/happy.gif', 5000);
    }

    updateScoreDisplay();
    renderSudokuGrid();

    // Check for completion
    if (isPuzzleComplete()) {
        showCompletionPopup();
    }
}

// Check if the puzzle is complete
function isPuzzleComplete() {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (gameState.board[row][col] !== gameState.solution[row][col]) {
                return false;
            }
        }
    }
    return true;
}

// Show congratulatory popup
function showCompletionPopup() {
    const modal = document.getElementById('completion-modal');
    const message = document.getElementById('completion-message');
    const okBtn = document.getElementById('completion-ok-btn');
    message.innerHTML = `🎉 Congratulations!<br>Your total score: <b>${gameState.score}</b>`;
    modal.classList.remove('hidden');
    okBtn.onclick = function() {
        modal.classList.add('hidden');
        // Optionally, start a new game or do nothing
    };
}

// Disable number buttons if all 9 are used
function updateNumberButtonsState() {
    const counts = Array(10).fill(0); // 1-9
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const val = gameState.board[row][col];
            if (val >= 1 && val <= 9) counts[val]++;
        }
    }
    document.querySelectorAll('.number-btn').forEach(btn => {
        const num = parseInt(btn.dataset.number);
        btn.disabled = counts[num] >= 9;
        btn.classList.toggle('disabled', btn.disabled);
    });
}

function eraseCell(cell) {
    if (!cell) return;

    const row = cell.row;
    const col = cell.col;

    // Check if it's not a given cell
    if (gameState.solution[row][col] !== gameState.board[row][col]) {
        gameState.board[row][col] = 0;
        renderSudokuGrid();
    }
}

function retryGame() {
    if (gameState.currentDifficulty) {
        startNewGame(gameState.currentDifficulty);
    }
}

function resetProgress() {
    // Reset only the user's progress on current board
    // Restore the original puzzle (only clues, no user answers)
    gameState.board = gameState.originalBoard.map(row => [...row]);
    gameState.mistakes = 0;
    gameState.score = 0;
    gameState.timerSeconds = 0;
    gameState.errorCells = new Set();
    gameState.cellNotes = new Map();
    
    // Clear any pending GIF timeout
    if (gameState.gifTimeout) {
        clearTimeout(gameState.gifTimeout);
    }
    
    // Reset to idle GIF
    const gifElement = document.getElementById('funny-gif');
    if (gifElement) {
        gifElement.src = 'images/giphy.gif';
    }
    
    updateScoreDisplay();
    updateTimerDisplay();
    renderSudokuGrid();
}

function retryGame() {
    if (gameState.currentDifficulty) {
        startNewGame(gameState.currentDifficulty);
    }
}

function displayGif(gifPath, duration) {
    // Clear any pending timeout
    if (gameState.gifTimeout) {
        clearTimeout(gameState.gifTimeout);
    }
    
    // Display the GIF
    const gifElement = document.getElementById('funny-gif');
    if (gifElement) {
        gifElement.src = gifPath;
    }
    
    // Reset to idle GIF after duration
    gameState.gifTimeout = setTimeout(() => {
        if (gifElement) {
            gifElement.src = 'images/giphy.gif';
        }
    }, duration);
}

function toggleNoteMode() {
    gameState.notesMode = !gameState.notesMode;
    
    // Clear selection when entering note mode
    if (gameState.notesMode) {
        if (gameState.selectedCell) {
            const cell = document.querySelector(`[data-row="${gameState.selectedCell.row}"][data-col="${gameState.selectedCell.col}"]`);
            if (cell) {
                cell.classList.remove('selected');
            }
        }
        gameState.selectedCell = null;
    }
}

function giveHint() {
    // Check if hints are available
    if (gameState.hintsUsed >= gameState.maxHints) {
        alert('You have used all 3 hints!');
        return;
    }

    // Find an empty cell that hasn't been filled by user
    let emptyCells = [];
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            // Only consider cells that are empty or have wrong answers
            if (gameState.board[row][col] === 0) {
                emptyCells.push({ row, col });
            }
        }
    }

    if (emptyCells.length === 0) {
        alert('No empty cells left!');
        return;
    }

    // Pick a random empty cell
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const row = randomCell.row;
    const col = randomCell.col;

    // Fill with solution
    gameState.board[row][col] = gameState.solution[row][col];
    gameState.hintsUsed++;
    gameState.score += 5;

    // Update hint badge
    updateHintBadge();

    updateScoreDisplay();
    renderSudokuGrid();
}

function startTimer() {
    gameState.timerInterval = setInterval(function() {
        gameState.timerSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(gameState.timerSeconds / 60);
    const seconds = gameState.timerSeconds % 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer').textContent = timeString;
}

function updateScoreDisplay() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('mistakes').textContent = `${gameState.mistakes}/3`;
}

function updateHintBadge() {
    const badge = document.getElementById('hint-badge');
    if (badge) {
        const hintsRemaining = gameState.maxHints - gameState.hintsUsed;
        badge.textContent = hintsRemaining;
        
        // Hide badge if no hints left
        if (hintsRemaining <= 0) {
            badge.style.display = 'none';
        }
    }
}
