// IndexedDB Data Layer for Bowls Performance Tracker
// Database: BowlsTrackerDB v1

const DB_NAME = 'BowlsTrackerDB';
const DB_VERSION = 1;

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('[DB] Upgrading database schema...');

      // Tournaments store
      if (!db.objectStoreNames.contains('tournaments')) {
        const tournamentStore = db.createObjectStore('tournaments', { keyPath: 'id' });
        tournamentStore.createIndex('name', 'name', { unique: false });
        tournamentStore.createIndex('date', 'date', { unique: false });
      }

      // Games store
      if (!db.objectStoreNames.contains('games')) {
        const gameStore = db.createObjectStore('games', { keyPath: 'id' });
        gameStore.createIndex('tournamentId', 'tournamentId', { unique: false });
        gameStore.createIndex('date', 'date', { unique: false });
        gameStore.createIndex('completed', 'completed', { unique: false });
      }

      // Bowls store
      if (!db.objectStoreNames.contains('bowls')) {
        const bowlStore = db.createObjectStore('bowls', { keyPath: 'id' });
        bowlStore.createIndex('gameId', 'gameId', { unique: false });
        bowlStore.createIndex('playerId', 'playerId', { unique: false });
        bowlStore.createIndex('gameId_playerId', ['gameId', 'playerId'], { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'settingName' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log('[DB] Database opened successfully');
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[DB] Error opening database:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Generic transaction helper
async function withTransaction(storeNames, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const result = callback(tx);

    tx.oncomplete = () => resolve(result);
    tx.onerror = (event) => {
      console.error('[DB] Transaction error:', event.target.error);
      reject(event.target.error);
    };
    tx.onabort = (event) => {
      console.error('[DB] Transaction aborted:', event.target.error);
      reject(event.target.error);
    };
  });
}

// ===== TOURNAMENT OPERATIONS =====

async function saveTournament(tournament) {
  if (!tournament.id) tournament.id = generateId();
  if (!tournament.date) tournament.date = new Date().toISOString();

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tournaments', 'readwrite');
    tx.objectStore('tournaments').put(tournament);
    tx.oncomplete = () => resolve(tournament);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getTournament(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tournaments', 'readonly');
    const request = tx.objectStore('tournaments').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getAllTournaments() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tournaments', 'readonly');
    const request = tx.objectStore('tournaments').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function deleteTournament(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tournaments', 'readwrite');
    tx.objectStore('tournaments').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ===== GAME OPERATIONS =====

async function saveGame(game) {
  if (!game.id) game.id = generateId();
  if (!game.date) game.date = new Date().toISOString();

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('games', 'readwrite');
    tx.objectStore('games').put(game);
    tx.oncomplete = () => resolve(game);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getGame(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('games', 'readonly');
    const request = tx.objectStore('games').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getAllGames() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('games', 'readonly');
    const request = tx.objectStore('games').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getGamesByTournament(tournamentId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('games', 'readonly');
    const index = tx.objectStore('games').index('tournamentId');
    const request = index.getAll(tournamentId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getOpenGames() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('games', 'readonly');
    const index = tx.objectStore('games').index('completed');
    const request = index.getAll(false);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function deleteGame(id) {
  const db = await openDB();
  // Delete game and its bowls
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['games', 'bowls'], 'readwrite');

    tx.objectStore('games').delete(id);

    // Delete associated bowls
    const bowlIndex = tx.objectStore('bowls').index('gameId');
    const bowlRequest = bowlIndex.openCursor(id);
    bowlRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ===== BOWL OPERATIONS =====

async function saveBowl(bowl) {
  if (!bowl.id) bowl.id = generateId();
  if (!bowl.timestamp) bowl.timestamp = new Date().toISOString();

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bowls', 'readwrite');
    tx.objectStore('bowls').put(bowl);
    tx.oncomplete = () => resolve(bowl);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function saveBowlsBatch(bowls) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bowls', 'readwrite');
    const store = tx.objectStore('bowls');
    bowls.forEach(bowl => {
      if (!bowl.id) bowl.id = generateId();
      if (!bowl.timestamp) bowl.timestamp = new Date().toISOString();
      store.put(bowl);
    });
    tx.oncomplete = () => resolve(bowls);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getBowl(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bowls', 'readonly');
    const request = tx.objectStore('bowls').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getBowlsByGame(gameId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bowls', 'readonly');
    const index = tx.objectStore('bowls').index('gameId');
    const request = index.getAll(gameId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getBowlsByPlayer(playerId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bowls', 'readonly');
    const index = tx.objectStore('bowls').index('playerId');
    const request = index.getAll(playerId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getAllBowls() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bowls', 'readonly');
    const request = tx.objectStore('bowls').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function deleteBowl(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bowls', 'readwrite');
    tx.objectStore('bowls').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function deleteBowlsByGame(gameId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bowls', 'readwrite');
    const index = tx.objectStore('bowls').index('gameId');
    const request = index.openCursor(gameId);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ===== SETTINGS OPERATIONS =====

async function saveSetting(name, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ settingName: name, value: value });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getSetting(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const request = tx.objectStore('settings').get(name);
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = (e) => reject(e.target.error);
  });
}

// ===== DATA MIGRATION (localStorage -> IndexedDB) =====

async function migrateFromLocalStorage() {
  try {
    const migrated = await getSetting('migrationCompleted');
    if (migrated) return false;

    // Check for any localStorage data
    const keys = Object.keys(localStorage);
    if (keys.length === 0) {
      await saveSetting('migrationCompleted', true);
      return false;
    }

    console.log('[DB] Migrating localStorage data...');

    // Try to find bowls-related data in localStorage
    for (const key of keys) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && Array.isArray(data) && data.length > 0 && data[0].gameId !== undefined) {
          // This looks like game data - migrate it
          for (const game of data) {
            const gameRecord = {
              id: game.gameId?.toString() || generateId(),
              tournamentId: null,
              tournamentName: game.tournamentName || '',
              gameNumber: 1,
              format: game.format || 'singles',
              endCount: game.totalEnds || 21,
              players: game.yourPlayers || [],
              opponentPlayers: game.opponentPlayers || [],
              date: new Date().toISOString(),
              notes: game.gameNotes || '',
              endNotes: game.endNotes || {},
              completed: false,
              // Preserve legacy fields for app.js compatibility
              bowlsPerPlayer: game.bowlsPerPlayer || 4,
              playersPerTeam: game.playersPerTeam || 1,
              currentEnd: game.currentEnd || 1,
              currentPlayerIndex: game.currentPlayerIndex || 0,
              currentTeam: game.currentTeam || 'yours',
              currentHand: game.currentHand || 'forehand',
              matLength: game.matLength || 'short',
              jackLength: game.jackLength || 'short',
              jackPosition: game.jackPosition || { x: 250, y: 250 }
            };
            await saveGame(gameRecord);

            // Migrate bowls for this game
            if (game.bowls && game.bowls.length > 0) {
              const bowlRecords = game.bowls.map((bowl, idx) => ({
                id: generateId(),
                gameId: gameRecord.id,
                playerId: bowl.player || 'unknown',
                playerName: bowl.player || 'Unknown',
                position: getPositionFromIndex(game.format, bowl.playerIndex),
                endNumber: bowl.end || 1,
                bowlNumber: idx + 1,
                distance: bowl.distanceInFeet || 0,
                direction: bowl.resultCategory || '',
                angle: 0,
                score: bowl.scoreValue || 0,
                timestamp: new Date().toISOString(),
                notes: bowl.notes || '',
                // Preserve extra fields
                x: bowl.x,
                y: bowl.y,
                team: bowl.team,
                hand: bowl.hand,
                matLength: bowl.matLength,
                jackLength: bowl.jackLength,
                resultCategory: bowl.resultCategory,
                distanceCategory: bowl.distanceCategory,
                scoreCategory: bowl.scoreCategory,
                scoreDetail: bowl.scoreDetail
              }));
              await saveBowlsBatch(bowlRecords);
            }
          }
        }
      } catch (e) {
        // Not JSON or not game data, skip
      }
    }

    await saveSetting('migrationCompleted', true);
    console.log('[DB] Migration complete');
    return true;
  } catch (err) {
    console.error('[DB] Migration error:', err);
    return false;
  }
}

// ===== CLEAR ALL DATA =====

async function clearAllData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['tournaments', 'games', 'bowls', 'settings'], 'readwrite');
    tx.objectStore('tournaments').clear();
    tx.objectStore('games').clear();
    tx.objectStore('bowls').clear();
    tx.objectStore('settings').clear();
    tx.oncomplete = () => {
      console.log('[DB] All data cleared');
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ===== UTILITY =====

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getPositionFromIndex(format, index) {
  const positionsByFormat = {
    'singles': ['Player'],
    'pairs4': ['Lead', 'Skip'],
    'pairs3': ['Lead', 'Skip'],
    'triples3': ['Lead', 'Second', 'Skip'],
    'triples2': ['Lead', 'Second', 'Skip'],
    'fours': ['Lead', 'Second', 'Third', 'Skip']
  };
  const positions = positionsByFormat[format] || ['Player'];
  return positions[index] || 'Player';
}
