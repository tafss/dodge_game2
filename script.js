import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* Firebase Configuration & Initialization */
const appId = typeof __app_id !== 'undefined' ? __app_id : 'cyberdodge-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "demo", authDomain: "demo.firebaseapp.com", projectId: "demo" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let user = null;
let userId = null;
let username = "Pilot";

async function initAuth() {
  try {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      const cred = await signInWithCustomToken(auth, __initial_auth_token);
      user = cred.user;
    } else {
      const cred = await signInAnonymously(auth);
      user = cred.user;
    }
    userId = user.uid;
  } catch (err) {
    console.error("Auth error:", err);
    userId = 'user_' + Math.random().toString(36).substring(2, 9);
  }
}
await initAuth();

/* Sound Synthesizer */
class SoundFX {
  constructor() { this.ctx = null; this.enabled = true; }
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
  }
  playCollision() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.4);
  }
}
const sound = new SoundFX();

/* Game State & Engine Setup */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const STATE = { LOGIN: 'LOGIN', PLAYING: 'PLAYING', GAMEOVER: 'GAMEOVER' };
let currentState = STATE.LOGIN;

let score = 0;
let startTime = 0;
let elapsedTime = 0;
let speedMultiplier = 1.0;
let baseSpeed = 8.5;
let currentSpawnRate = 220;
let lastSpawnTime = 0;

const keys = { w: false, a: false, s: false, d: false };

const playerColors = ['#00f3ff', '#ff007f', '#ffcc00', '#00ff66', '#a855f7', '#ff6600'];
let myColor = playerColors[Math.floor(Math.random() * playerColors.length)];

const localPlayer = {
  x: CANVAS_WIDTH / 2 - 16,
  y: CANVAS_HEIGHT - 80,
  width: 32,
  height: 32,
  speed: 10,
  alive: true
};

let remotePlayers = {};
let globalLeaderboardData = [];
let obstacles = [];

function setupRealtimePresence() {
  if (!userId) return;

  // Listen to active online players
  const activePlayersCol = collection(db, 'artifacts', appId, 'public', 'data', 'active_players');
  onSnapshot(activePlayersCol, (snapshot) => {
    const now = Date.now();
    remotePlayers = {};
    snapshot.forEach(docSnap => {
      const p = docSnap.data();
      if (docSnap.id !== userId && (now - (p.lastSeen || 0) < 10000)) {
        remotePlayers[docSnap.id] = p;
      }
    });
    updateLivePlayersUI();
  }, err => console.error("Presence snapshot error:", err));

  // Listen to Global High Scores
  const leaderboardCol = collection(db, 'artifacts', appId, 'public', 'data', 'global_leaderboard');
  onSnapshot(leaderboardCol, (snapshot) => {
    const records = [];
    snapshot.forEach(docSnap => {
      records.push(docSnap.data());
    });
    records.sort((a, b) => b.score - a.score);
    globalLeaderboardData = records.slice(0, 10);
    updateLeaderboardUI();
  }, err => console.error("Leaderboard snapshot error:", err));
}
setupRealtimePresence();

function updateMyPresence() {
  if (!userId || currentState !== STATE.PLAYING) return;
  const myDoc = doc(db, 'artifacts', appId, 'public', 'data', 'active_players', userId);
  setDoc(myDoc, {
    name: username,
    x: localPlayer.x,
    y: localPlayer.y,
    score: score,
    alive: localPlayer.alive,
    color: myColor,
    lastSeen: Date.now()
  }).catch(err => console.error("Error updating presence:", err));
}

async function checkAndUpdateHighScore(finalScore) {
  if (!userId || finalScore <= 0) return;

  const isTopRecord = globalLeaderboardData.length < 10 || finalScore > (globalLeaderboardData[globalLeaderboardData.length - 1]?.score || 0);

  if (isTopRecord) {
    document.getElementById('newRecordBadge').classList.remove('hidden');
  } else {
    document.getElementById('newRecordBadge').classList.add('hidden');
  }

  const userRecordDoc = doc(db, 'artifacts', appId, 'public', 'data', 'global_leaderboard', userId);
  await setDoc(userRecordDoc, {
    name: username,
    score: finalScore,
    date: new Date().toLocaleDateString()
  }, { merge: true }).catch(err => console.error("Error saving score:", err));
}

function updateLeaderboardUI() {
  const lb = document.getElementById('globalLeaderboard');
  lb.innerHTML = '';

  if (globalLeaderboardData.length === 0) {
    lb.innerHTML = `<div class="text-xs text-slate-500 text-center py-4">¡Sé el primero en fijar un récord!</div>`;
    return;
  }

  globalLeaderboardData.forEach((rec, idx) => {
    const div = document.createElement('div');
    div.className = `flex items-center justify-between p-2.5 rounded-xl border ${idx === 0 ? 'bg-yellow-500/10 border-yellow-500/40' : 'bg-slate-900/80 border-slate-800'} text-xs`;
    div.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="font-orbitron font-bold ${idx === 0 ? 'text-yellow-400' : 'text-slate-500'} w-4">#${idx + 1}</span>
        <span class="font-bold text-slate-200 font-orbitron">${rec.name}</span>
      </div>
      <span class="font-bold font-orbitron text-cyan-400">${rec.score}</span>
    `;
    lb.appendChild(div);
  });
}

function updateLivePlayersUI() {
  const list = document.getElementById('livePlayersList');
  list.innerHTML = '';

  const players = Object.values(remotePlayers);
  if (players.length === 0) {
    list.innerHTML = `<div class="text-slate-500 text-center py-2">Solo tú en la arena</div>`;
    return;
  }

  players.forEach(p => {
    const div = document.createElement('div');
    div.className = "flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800";
    div.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${p.color}"></span>
        <span class="font-bold font-orbitron text-slate-300">${p.name}</span>
      </div>
      <span class="font-mono text-cyan-400 font-bold">${p.score} pts</span>
    `;
    list.appendChild(div);
  });
}

function spawnObstacle() {
  const width = Math.random() * 35 + 18;
  const height = Math.random() * 25 + 18;
  const x = Math.random() * (CANVAS_WIDTH - width);
  const calcSpeed = (baseSpeed * speedMultiplier) + (Math.random() * 2.5);

  obstacles.push({
    x: x,
    y: -40,
    width: width,
    height: height,
    speed: calcSpeed,
    color: '#ff0055'
  });
}

function handleInput() {
  if (currentState !== STATE.PLAYING || !localPlayer.alive) return;

  const moveX = (keys.d || keys.D ? 1 : 0) - (keys.a || keys.A ? 1 : 0);
  const moveY = (keys.s || keys.S ? 1 : 0) - (keys.w || keys.W ? 1 : 0);

  localPlayer.x += moveX * localPlayer.speed;
  localPlayer.y += moveY * localPlayer.speed;

  localPlayer.x = Math.max(0, Math.min(CANVAS_WIDTH - localPlayer.width, localPlayer.x));
  localPlayer.y = Math.max(0, Math.min(CANVAS_HEIGHT - localPlayer.height, localPlayer.y));
}

function updateGame(timestamp) {
  if (currentState !== STATE.PLAYING) return;

  if (localPlayer.alive) {
    elapsedTime = Math.floor((timestamp - startTime) / 1000);
    score += Math.floor(2.5 * speedMultiplier);
    speedMultiplier += 0.0025; // Accelerate speed rapidly
    currentSpawnRate = Math.max(50, 220 - (speedMultiplier * 35));

    if (timestamp - lastSpawnTime > currentSpawnRate) {
      spawnObstacle();
      lastSpawnTime = timestamp;
    }

    updateMyPresence();
  }

  // Update Obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.y += obs.speed;

    // Collision Check
    if (
      localPlayer.alive &&
      localPlayer.x < obs.x + obs.width &&
      localPlayer.x + localPlayer.width > obs.x &&
      localPlayer.y < obs.y + obs.height &&
      localPlayer.y + localPlayer.height > obs.y
    ) {
      localPlayer.alive = false;
      sound.playCollision();
      triggerGameOver();
    }

    if (obs.y > CANVAS_HEIGHT + 60) {
      obstacles.splice(i, 1);
    }
  }

  document.getElementById('scoreDisplay').innerText = score.toString().padStart(5, '0');
  document.getElementById('speedDisplay').innerText = `${(baseSpeed * speedMultiplier).toFixed(1)} px/f`;
}

function render() {
  ctx.fillStyle = '#05030e';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Cyber Grid Background
  ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_WIDTH; x += 35) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_HEIGHT; y += 35) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
  }

  // Render Remote Players
  Object.values(remotePlayers).forEach(p => {
    if (!p.alive) return;

    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color || '#a855f7';
    ctx.fillStyle = p.color || '#a855f7';
    ctx.globalAlpha = 0.75;

    ctx.beginPath();
    ctx.arc(p.x + 16, p.y + 16, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Player', p.x + 16, p.y - 6);
    ctx.restore();
  });

  // Render Local Player
  if (localPlayer.alive) {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = myColor;
    ctx.fillStyle = myColor;

    ctx.beginPath();
    ctx.moveTo(localPlayer.x + localPlayer.width / 2, localPlayer.y);
    ctx.lineTo(localPlayer.x + localPlayer.width, localPlayer.y + localPlayer.height);
    ctx.lineTo(localPlayer.x + localPlayer.width / 2, localPlayer.y + localPlayer.height - 8);
    ctx.lineTo(localPlayer.x, localPlayer.y + localPlayer.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText(username, localPlayer.x + localPlayer.width / 2, localPlayer.y - 8);
    ctx.restore();
  }

  // Render Obstacles
  for (const obs of obstacles) {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = obs.color;
    ctx.fillStyle = obs.color;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    ctx.restore();
  }
}

function startMatch() {
  currentState = STATE.PLAYING;
  localPlayer.alive = true;
  localPlayer.x = CANVAS_WIDTH / 2 - 16;
  localPlayer.y = CANVAS_HEIGHT - 80;
  score = 0;
  speedMultiplier = 1.0;
  obstacles = [];
  startTime = performance.now();
  lastSpawnTime = performance.now();

  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('gameOverOverlay').classList.add('hidden');
}

async function triggerGameOver() {
  currentState = STATE.GAMEOVER;
  document.getElementById('finalScoreText').innerText = score;
  document.getElementById('finalTimeText').innerText = `${elapsedTime}s`;
  document.getElementById('gameOverOverlay').classList.remove('hidden');

  await checkAndUpdateHighScore(score);
}

function copyShareLink() {
  const url = window.location.href;
  const tempInput = document.createElement('input');
  tempInput.value = url;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);

  const btn = document.getElementById('shareLinkBtn');
  btn.innerHTML = `<i class="fa-solid fa-check"></i> <span>¡Copiado!</span>`;
  setTimeout(() => {
    btn.innerHTML = `<i class="fa-solid fa-share-nodes"></i> <span class="hidden sm:inline">Copiar Enlace</span>`;
  }, 2000);
}

/* Event Handlers */
document.getElementById('startGameBtn').addEventListener('click', () => {
  sound.init();
  const inputName = document.getElementById('usernameInput').value.trim();
  if (!inputName) {
    alert('Ingresa tu apodo para jugar.');
    return;
  }
  username = inputName;
  startMatch();
});

document.getElementById('restartGameBtn').addEventListener('click', startMatch);
document.getElementById('shareLinkBtn').addEventListener('click', copyShareLink);

document.getElementById('soundToggleBtn').addEventListener('click', () => {
  sound.enabled = !sound.enabled;
  document.getElementById('soundIcon').className = sound.enabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  document.getElementById('soundText').innerText = sound.enabled ? 'Audio On' : 'Audio Off';
});

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd'].includes(k)) keys[k] = true;
  if (currentState === STATE.GAMEOVER && k === 'r') startMatch();
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd'].includes(k)) keys[k] = false;
});

function gameLoop(timestamp) {
  handleInput();
  updateGame(timestamp);
  render();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
