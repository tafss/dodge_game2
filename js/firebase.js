// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Referencias a colecciones
const playersRef = db.collection("players");
const leaderboardRef = db.collection("leaderboard");

// Escuchar cambios en la tabla de records mundiales
function listenToLeaderboard(callback) {
  leaderboardRef.orderBy("score", "desc").limit(10).onSnapshot((snapshot) => {
    const scores = [];
    snapshot.forEach((doc) => scores.push(doc.data()));
    callback(scores);
  });
}

// Guardar record si entra en el Top 10
async function saveHighScore(name, score) {
  if (score <= 0) return;
  await leaderboardRef.add({
    name: name,
    score: score,
    date: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Actualizar posición propia en tiempo real
function updatePresence(playerId, data) {
  playersRef.doc(playerId).set(data, { merge: true });
}

// Borrar jugador al desconectarse
function removePresence(playerId) {
  playersRef.doc(playerId).delete();
}

// Escuchar a otros jugadores activos
function listenToActivePlayers(callback) {
  playersRef.onSnapshot((snapshot) => {
    const players = {};
    snapshot.forEach((doc) => {
      players[doc.id] = doc.data();
    });
    callback(players);
  });
}
