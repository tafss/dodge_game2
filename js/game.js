const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let playerId = "player_" + Math.random().toString(36).substr(2, 9);
let playerName = "";
let gameOver = false;
let score = 0;
let speedMultiplier = 1;
let spawnTimer = 0;

let activePlayers = {};

// Objeto Jugador local
const player = {
  x: canvas.width / 2 - 15,
  y: canvas.height - 50,
  width: 25,
  height: 25,
  speed: 6
};

// Controles WASD
const keys = { w: false, a: false, s: false, d: false };

let obstacles = [];

// Manejo del Login
document.getElementById("btnPlay").addEventListener("click", startGame);
document.getElementById("usernameInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") startGame();
});

function startGame() {
  const input = document.getElementById("usernameInput").value.trim();
  if (!input) return alert("Por favor ingresa un nombre");

  playerName = input;
  document.getElementById("displayName").innerText = playerName;
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("gameScreen").classList.remove("hidden");

  // Escuchar teclado
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
    if (gameOver && k === "r") resetGame();
  });

  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
  });

  // Suscribirse a Firebase
  listenToLeaderboard(renderLeaderboard);
  listenToActivePlayers((players) => {
    activePlayers = players;
  });

  // Limpiar al cerrar pestaña
  window.addEventListener("beforeunload", () => removePresence(playerId));

  gameLoop();
}

function resetGame() {
  gameOver = false;
  score = 0;
  speedMultiplier = 1;
  obstacles = [];
  player.x = canvas.width / 2 - 15;
  player.y = canvas.height - 50;
  gameLoop();
}

function spawnObstacle() {
  const width = Math.random() * 30 + 20;
  const x = Math.random() * (canvas.width - width);
  const speed = (Math.random() * 3 + 4) * speedMultiplier;

  obstacles.push({ x, y: -20, width, height: 20, speed });
}

function update() {
  if (gameOver) return;

  score++;
  speedMultiplier += 0.0008;

  document.getElementById("scoreVal").innerText = score;
  document.getElementById("speedVal").innerText = "x" + speedMultiplier.toFixed(2);

  // Movimiento estricto WASD
  if (keys.w && player.y > 0) player.y -= player.speed;
  if (keys.s && player.y + player.height < canvas.height) player.y += player.speed;
  if (keys.a && player.x > 0) player.x -= player.speed;
  if (keys.d && player.x + player.width < canvas.width) player.x += player.speed;

  // Sincronizar posición propia en Firebase
  updatePresence(playerId, {
    name: playerName,
    x: player.x,
    y: player.y,
    score: score,
    updatedAt: Date.now()
  });

  // Generar obstáculos rápidos
  spawnTimer++;
  if (spawnTimer > Math.max(6, 25 - Math.floor(speedMultiplier * 4))) {
    spawnObstacle();
    spawnTimer = 0;
  }

  // Mover obstáculos y comprobar colisiones
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.y += obs.speed;

    if (
      player.x < obs.x + obs.width &&
      player.x + player.width > obs.x &&
      player.y < obs.y + obs.height &&
      player.y + player.height > obs.y
    ) {
      triggerGameOver();
    }

    if (obs.y > canvas.height) obstacles.splice(i, 1);
  }
}

function triggerGameOver() {
  gameOver = true;
  saveHighScore(playerName, score);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Dibujar a otros jugadores conectados
  for (const id in activePlayers) {
    if (id === playerId) continue;
    const other = activePlayers[id];

    ctx.fillStyle = "rgba(102, 252, 241, 0.4)";
    ctx.fillRect(other.x, other.y, player.width, player.height);

    ctx.fillStyle = "#45a29e";
    ctx.font = "10px sans-serif";
    ctx.fillText(other.name || "Piloto", other.x - 5, other.y - 5);
  }

  // 2. Dibujar jugador local
  ctx.fillStyle = "#66fcf1";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // 3. Dibujar obstáculos
  ctx.fillStyle = "#ff0055";
  for (const obs of obstacles) {
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  }

  // 4. Pantalla de Game Over
  if (gameOver) {
    ctx.fillStyle = "rgba(11, 12, 16, 0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ff0055";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("¡GAME OVER!", canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = "#ffffff";
    ctx.font = "16px sans-serif";
    ctx.fillText("Puntuación final: " + score, canvas.width / 2, canvas.height / 2 + 15);
    ctx.fillText("Presiona 'R' para reiniciar", canvas.width / 2, canvas.height / 2 + 50);
    ctx.textAlign = "left";
  }
}

function renderLeaderboard(scores) {
  const list = document.getElementById("leaderboardList");
  list.innerHTML = "";
  scores.forEach((s) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${s.name}</strong>: ${s.score} pts`;
    list.appendChild(li);
  });
}

function gameLoop() {
  update();
  draw();
  if (!gameOver) {
    requestAnimationFrame(gameLoop);
  }
}
