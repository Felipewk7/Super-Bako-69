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
const finalScoreEl = document.getElementById('final-score');

// Configs
const TILE_SIZE = 16;
const GRAVITY = 0.25;
const FRICTION = 0.8;
const MAX_FALL_SPEED = 6;

let gameState = 'menu'; // 'menu', 'playing', 'gameOver'

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

// A simple AABB collision check
function testAABB(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// Asset Loader
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

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 16;
        this.vx = 0;
        this.vy = 0;
        this.speed = 1.5;
        this.jumpPower = 4;
        this.isGrounded = false;
        this.jumpTime = 0;
        this.state = 'idle'; // idle, walk, jump, die
        this.color = '#ff0000'; // Fallback
    }

    update() {
        if (this.state === 'die') {
            this.vy += GRAVITY;
            this.y += this.vy;
            return;
        }

        // Horizontal movement with inertia
        if (keys.left) {
            this.vx -= 0.2;
            this.state = 'walk';
        } else if (keys.right) {
            this.vx += 0.2;
            this.state = 'walk';
        } else {
            this.vx *= FRICTION; // Friction
            if (Math.abs(this.vx) < 0.1) this.vx = 0;
            this.state = 'idle';
        }

        // Limit speed
        if (this.vx > this.speed) this.vx = this.speed;
        if (this.vx < -this.speed) this.vx = -this.speed;

        // Variable Jump
        if (keys.up) {
            if (this.isGrounded) {
                this.vy = -this.jumpPower;
                this.isGrounded = false;
                this.jumpTime = 10;
            } else if (this.jumpTime > 0) {
                this.vy -= 0.15; // Hold to jump higher
                this.jumpTime--;
            }
        } else {
            this.jumpTime = 0;
        }

        if (!this.isGrounded) {
            this.state = 'jump';
        }

        this.vy += GRAVITY;
        if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

        // Move X and test collisions
        this.x += this.vx;
        this.handleCollisions(true);

        // Move Y and test collisions
        this.y += this.vy;
        this.isGrounded = false;
        this.handleCollisions(false);
        
        // Death by falling
        if (this.y > canvas.height + 50) {
            this.die();
        }
    }

    handleCollisions(isHoriz) {
        for (let b of level.blocks) {
            if (testAABB(this, b)) {
                if (isHoriz) {
                    if (this.vx > 0) {
                        this.x = b.x - this.width;
                        this.vx = 0;
                    } else if (this.vx < 0) {
                        this.x = b.x + b.width;
                        this.vx = 0;
                    }
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
        this.vy = -4; // Bounce up
        this.vx = 0;
        
        setTimeout(() => {
            setGameOver();
        }, 1500);
    }

    draw() {
        drawSprite('player', this.x, this.y, this.width, this.height, this.color);
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
        this.color = '#8A2BE2'; // Fallback
    }

    update() {
        if (this.isDead) return;

        this.vy += GRAVITY;
        
        // Move X
        this.x += this.vx;
        let hitWall = false;
        for (let b of level.blocks) {
            if (testAABB(this, b)) {
                if (this.vx > 0) this.x = b.x - this.width;
                else if (this.vx < 0) this.x = b.x + b.width;
                hitWall = true;
                break;
            }
        }

        if (hitWall) this.vx *= -1; // Reverse direction

        // Move Y
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
            drawSprite('enemy', this.x, this.y, this.width, this.height, this.color);
        }
    }
}

class Block {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = TILE_SIZE;
        this.height = TILE_SIZE;
        this.type = type; // 'solid', 'question', 'hidden', 'pipe'
        
        if (type === 'pipe') {
            this.width = TILE_SIZE * 2;
            this.height = TILE_SIZE * 2;
        }

        this.used = false;
    }

    hit() {
        if (this.type === 'question' && !this.used) {
            this.used = true;
            game.coins++;
            coinsEl.innerText = `x${game.coins.toString().padStart(2, '0')}`;
            game.score += 100;
        } else if (this.type === 'hidden' && !this.used) {
            this.used = true;
            this.type = 'solid'; 
            game.score += 500;
        }
    }

    draw() {
        if (this.type === 'hidden' && !this.used) return; 

        let c = '#8B4513';
        if (this.type === 'question') c = this.used ? '#555' : '#FFD700';
        if (this.type === 'pipe') c = '#00FF00';

        let spr = 'block';
        if (this.type === 'pipe') spr = 'pipe';

        drawSprite(spr, this.x, this.y, this.width, this.height, c);
    }
}

const game = {
    score: 0,
    coins: 0,
    time: 400
};

let player;
let level = {
    blocks: [],
    enemies: []
};

let cameraX = 0;

function resetLevel() {
    player = new Player(50, 50);
    level.blocks = [];
    level.enemies = [];
    cameraX = 0;
    
    // Continuous Solid Floor
    for (let i = 0; i < 150; i++) {
        level.blocks.push(new Block(i * TILE_SIZE, 208, 'solid'));
        level.blocks.push(new Block(i * TILE_SIZE, 224, 'solid'));
    }

    // Question blocks
    level.blocks.push(new Block(10 * TILE_SIZE, 144, 'question'));
    level.blocks.push(new Block(25 * TILE_SIZE, 144, 'question'));
    
    // Hidden block
    level.blocks.push(new Block(15 * TILE_SIZE, 144, 'hidden'));

    // Pipe
    level.blocks.push(new Block(40 * TILE_SIZE, 208 - TILE_SIZE*2, 'pipe'));

    // Walls
    for(let i=0; i<15; i++) level.blocks.push(new Block(-16, i*16, 'solid'));

    // Enemy placements
    level.enemies.push(new Enemy(26 * TILE_SIZE, 192));
    level.enemies.push(new Enemy(38 * TILE_SIZE, 192));
}

function startGame() {
    gameState = 'playing';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    game.score = 0;
    game.coins = 0;
    game.time = 400;
    scoreEl.innerText = '000000';
    coinsEl.innerText = 'x00';
    timeEl.innerText = '400';
    resetLevel();
}

function setGameOver() {
    gameState = 'gameOver';
    finalScoreEl.innerText = game.score;
    gameOverScreen.classList.add('active');
}

function update() {
    if (gameState !== 'playing') return;

    // Update entities
    player.update();
    
    level.enemies.forEach(e => {
        e.update();
        if (!e.isDead && testAABB(player, e) && player.state !== 'die') {
            if (player.vy > 0 && player.y + player.height < e.y + e.height / 2 + 5) {
                e.isDead = true;
                player.vy = -3; 
                game.score += 200;
            } else {
                player.die();
            }
        }
    });

    // Camera follow
    cameraX = player.x - (canvas.width / 2) + (player.width / 2);
    if (cameraX < 0) cameraX = 0; 

    // Update UI
    scoreEl.innerText = game.score.toString().padStart(6, '0');
    
    // Simple time countdown (simplified)
    if (Math.random() < 0.01) {
        game.time--;
        timeEl.innerText = game.time;
        if (game.time <= 0) player.die();
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-Math.floor(cameraX), 0);

    // Draw blocks
    level.blocks.forEach(b => b.draw());
    
    // Draw enemies
    level.enemies.forEach(e => e.draw());

    // Draw player
    player.draw();

    ctx.restore();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Init loop
loop();

