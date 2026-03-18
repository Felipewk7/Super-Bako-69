const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
const timeEl = document.getElementById('time');

// Configs
const TILE_SIZE = 16;
const GRAVITY = 0.25;
const FRICTION = 0.8;
const MAX_FALL_SPEED = 6;

let gameState = 'menu'; // 'menu', 'playing', 'gameOver'
let player = null;
let level = {
    blocks: [],
    enemies: []
};
let cameraX = 0;
let gameData = {
    score: 0,
    coins: 0,
    time: 400
};

// Input handling
const keys = {
    left: false,
    right: false,
    up: false,
    down: false
};

window.addEventListener('keydown', e => {
    if (gameState !== 'playing') return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keys.up = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
});

window.addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
});

// Assets
const assets = {};
function loadImage(id, src) {
    const img = new Image();
    img.src = src;
    assets[id] = img;
}

loadImage('player', './assets/player.png');
loadImage('enemy', './assets/enemy.png');
loadImage('block', './assets/block.png');
loadImage('coin', './assets/coin.png');
loadImage('pipe', './assets/pipe.png');

function drawSprite(id, x, y, width, height, fallbackColor) {
    const img = assets[id];
    if (img && img.complete && img.naturalWidth !== 0) {
        ctx.drawImage(img, Math.floor(x), Math.floor(y), width, height);
    } else {
        ctx.fillStyle = fallbackColor;
        ctx.fillRect(Math.floor(x), Math.floor(y), width, height);
    }
}

function testAABB(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 14; // Slightly smaller for better feel
        this.height = 16;
        this.vx = 0;
        this.vy = 0;
        this.speed = 2;
        this.jumpPower = 4.5;
        this.isGrounded = false;
        this.jumpTime = 0;
        this.state = 'idle'; // idle, walk, jump, die
    }

    update() {
        if (this.state === 'die') {
            this.vy += GRAVITY;
            this.y += this.vy;
            return;
        }

        if (keys.left) {
            this.vx -= 0.3;
            this.state = 'walk';
        } else if (keys.right) {
            this.vx += 0.3;
            this.state = 'walk';
        } else {
            this.vx *= FRICTION;
            if (Math.abs(this.vx) < 0.1) this.vx = 0;
            this.state = 'idle';
        }

        if (this.vx > this.speed) this.vx = this.speed;
        if (this.vx < -this.speed) this.vx = -this.speed;

        if (keys.up) {
            if (this.isGrounded) {
                this.vy = -this.jumpPower;
                this.isGrounded = false;
                this.jumpTime = 12;
            } else if (this.jumpTime > 0) {
                this.vy -= 0.18;
                this.jumpTime--;
            }
        } else {
            this.jumpTime = 0;
        }

        this.vy += GRAVITY;
        if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

        this.x += this.vx;
        this.handleCollisions(true);

        this.y += this.vy;
        this.isGrounded = false;
        this.handleCollisions(false);

        if (this.y > canvas.height + 64) this.die();
    }

    handleCollisions(isHoriz) {
        for (let b of level.blocks) {
            if (testAABB(this, b)) {
                if (isHoriz) {
                    if (this.vx > 0) this.x = b.x - this.width;
                    else if (this.vx < 0) this.x = b.x + b.width;
                    this.vx = 0;
                } else {
                    if (this.vy > 0) {
                        this.y = b.y - this.height;
                        this.vy = 0;
                        this.isGrounded = true;
                    } else if (this.vy < 0) {
                        this.y = b.y + b.height;
                        this.vy = 0;
                        this.jumpTime = 0;
                        b.hit();
                    }
                }
            }
        }
    }

    die() {
        if (this.state === 'die') return;
        this.state = 'die';
        this.vy = -5;
        this.vx = 0;
        setTimeout(setGameOver, 1500);
    }

    draw() {
        drawSprite('player', this.x, this.y, this.width, this.height, '#f00');
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 16;
        this.vx = -0.5;
        this.vy = 0;
        this.isDead = false;
    }

    update() {
        if (this.isDead) return;
        this.vy += GRAVITY;
        this.x += this.vx;
        
        let hitWall = false;
        for (let b of level.blocks) {
            if (testAABB(this, b)) {
                if (this.vx > 0) this.x = b.x - this.width;
                else this.x = b.x + b.width;
                hitWall = true;
                break;
            }
        }
        if (hitWall) this.vx *= -1;

        this.y += this.vy;
        for (let b of level.blocks) {
            if (testAABB(this, b)) {
                if (this.vy > 0) {
                    this.y = b.y - this.height;
                    this.vy = 0;
                }
            }
        }
    }

    draw() {
        if (!this.isDead) {
            drawSprite('enemy', this.x, this.y, 16, 16, '#80f');
        }
    }
}

class Block {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = TILE_SIZE;
        this.height = TILE_SIZE;
        this.type = type;
        if (type === 'pipe') {
            this.width = 32;
            this.height = 32;
        }
        this.used = false;
    }

    hit() {
        if (this.type === 'question' && !this.used) {
            this.used = true;
            gameData.coins++;
            coinsEl.innerText = `x${gameData.coins.toString().padStart(2, '0')}`;
            gameData.score += 100;
        } else if (this.type === 'hidden' && !this.used) {
            this.used = true;
            this.type = 'solid';
            gameData.score += 500;
        }
    }

    draw() {
        if (this.type === 'hidden' && !this.used) return;
        let c = '#8B4513';
        if (this.type === 'question') c = this.used ? '#555' : '#FFD700';
        if (this.type === 'pipe') c = '#00FF00';
        let spr = this.type === 'pipe' ? 'pipe' : 'block';
        drawSprite(spr, this.x, this.y, this.width, this.height, c);
    }
}

function resetLevel() {
    // Clean arrays
    level.blocks = [];
    level.enemies = [];
    cameraX = 0;
    
    // Build floor - make it 2 tiles thick
    for (let i = -5; i < 200; i++) {
        level.blocks.push(new Block(i * TILE_SIZE, 192, 'solid'));
        level.blocks.push(new Block(i * TILE_SIZE, 208, 'solid'));
    }

    // Some blocks to jump on
    level.blocks.push(new Block(10 * TILE_SIZE, 128, 'question'));
    level.blocks.push(new Block(11 * TILE_SIZE, 128, 'solid'));
    level.blocks.push(new Block(12 * TILE_SIZE, 128, 'question'));
    
    // Pipe
    level.blocks.push(new Block(40 * TILE_SIZE, 160, 'pipe'));

    // Enemy
    level.enemies.push(new Enemy(28 * TILE_SIZE, 160));
    
    // Setup player - start on floor
    player = new Player(64, 176);
}

function startGame() {
    gameState = 'playing';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    gameData.score = 0;
    gameData.coins = 0;
    gameData.time = 400;
    
    scoreEl.innerText = '000000';
    coinsEl.innerText = 'x00';
    timeEl.innerText = '400';
    
    resetLevel();
}

function setGameOver() {
    gameState = 'gameOver';
    gameOverScreen.classList.add('active');
}

function update() {
    if (gameState !== 'playing') return;

    if (player) player.update();
    level.enemies.forEach(e => {
        e.update();
        if (!e.isDead && player && testAABB(player, e) && player.state !== 'die') {
            if (player.vy > 0 && player.y + player.height < e.y + 10) {
                e.isDead = true;
                player.vy = -3;
                gameData.score += 200;
            } else {
                player.die();
            }
        }
    });

    if (player) {
        cameraX = player.x - 128 + 7;
        if (cameraX < 0) cameraX = 0;
    }

    scoreEl.innerText = gameData.score.toString().padStart(6, '0');
    
    if (Math.random() < 0.005) {
        gameData.time--;
        timeEl.innerText = gameData.time;
        if (gameData.time <= 0 && player) player.die();
    }
}

function draw() {
    // Clear with Sky Blue
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'menu') return;

    ctx.save();
    ctx.translate(-Math.floor(cameraX), 0);

    level.blocks.forEach(b => b.draw());
    level.enemies.forEach(e => e.draw());
    if (player) player.draw();

    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Start loop
loop();

