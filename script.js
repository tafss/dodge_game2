// Variables globales
let playerName = "Piloto";
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let gameOver = false;
let score = 0;
let speedMultiplier = 1.8; // Velocidad rápida desde el inicio
let spawnTimer = 0;

// Cargar récord local
let highScores = JSON.parse(localStorage.getItem("cyberDodgeRecords")) || [
  { name: "ACE", score: 2500 },
  { name: "NEO", score: 1800 },
  { name: "CYBER", score: 1200 }
];

// Jugador
const player = {
  x: canvas.width / 2 - 14,
  y: canvas.height - 60,
  width: 28,
  height: 28,
  speed: 7.5
};

// Teclas WASD
const keys = { w: false, a: false, s: false, d: false };

// Obstáculos
let obstacles = [];

// Eventos de teclado
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
  if (gameOver && k === "r") resetGame();
});

window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

function startGame() {
  const input = document.getElementById("usernameInput").value.trim();
  if (input !== "") playerName = input;
  
  document.getElementById("loginScreen").classList.remove("active");
  document.getElementById("gameScreen").classList.add("active");
  
  updateLeaderboardUI();
  resetGame();
}

function spawnObstacle() {
  const width = Math.random() * 35 + 20;
  const x = Math.random() * (canvas.width - width);
  const speed = (Math.random() * 3 + 4.5) * speedMultiplier;

  obstacles.push({ x, y: -25, width, height: 22, speed });
}

function resetGame() {
  gameOver = false;
  score = 0;
  speedMultiplier = 1.8;
  obstacles = [];
  player.x = canvas.width / 2 - 14;
  player.y = canvas.height - 60;
  requestAnimationFrame(gameLoop);
}

function update() {
  if (gameOver) return;

  // Puntuación y aceleración muy rápida
  score += 2;
  speedMultiplier += 0.0012;

  // Movimiento WASD
  if (keys.w && player.y > 0) player.y -= player.speed;
  if (keys.s && player.y + player.height < canvas.height) player.y += player.speed;
  if (keys.a && player.x > 0) player.x -= player.speed;
  if (keys.d && player.x + player.width < canvas.width) player.x += player.speed;

  // Generar obstáculos a ritmo acelerado
  spawnTimer++;
  if (spawnTimer > Math.max(6, 25 - Math.floor(speedMultiplier * 4))) {
    spawnObstacle();
    spawnTimer = 0;
  }

  // Actualizar obstáculos
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.y += obs.speed;

    // Detección de colisión (AABB)
    if (
      player.x < obs.x + obs.width &&
      player.x + player.width > obs.x &&
      player.y < obs.y + obs.height &&
      player.y + player.height > obs.y
    ) {
      triggerGameOver();
    }

    if (obs.y > canvas.height) {
      obstacles.splice(i, 1);
    }
  }
}

function triggerGameOver() {
  gameOver = true;
  saveHighScore(playerName, score);
}

function saveHighScore(name, score) {
  highScores.push({ name, score });
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, 5); // Guardar TOP 5
  localStorage.setItem("cyberDodgeRecords", JSON.stringify(highScores));
  updateLeaderboardUI();
}

function updateLeaderboardUI() {
  const list = document.getElementById("leaderboard");
  list.innerHTML = "";
  highScores.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "leaderboard-item";
    li.innerHTML = `
      <span><span class="rank">#${index + 1}</span>${item.name}</span>
      <span class="score">${item.score}</span>
    `;
    list.appendChild(li);
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Jugador (Nave Neón)
  ctx.fillStyle = "#00f0ff";
  ctx.shadowColor = "#00f0ff";
  ctx.shadowBlur = 12;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Etiqueta Nombre Jugador
  ctx.fillStyle = "#ffffff";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(playerName, player.x + player.width / 2, player.y - 6);

  // Obstáculos
  ctx.fillStyle = "#ff0055";
  ctx.shadowColor = "#ff0055";
  ctx.shadowBlur = 10;
  for (const obs of obstacles) {
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  }

  ctx.shadowBlur = 0; // Reset sombra

  // Puntuación
  ctx.fillStyle = "#ffe600";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("SCORE: " + score, 15, 30);

  // Game Over
  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ff0055";
    ctx.font = "bold 38px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("¡DESTRUIDO!", canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.fillText("Puntuación: " + score, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText("Presiona 'R' para reiniciar", canvas.width / 2, canvas.height / 2 + 65);
  }
}

function gameLoop() {
  update();
  draw();
  if (!gameOver) {
    requestAnimationFrame(gameLoop);
  }
}
