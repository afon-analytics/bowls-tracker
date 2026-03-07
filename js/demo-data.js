// Demo Data Loader for Bowls Performance Tracker
// Embedded demo data — no Supabase dependency

const DEMO_DATA_MARKER = '__demo_data';

// ===== EMBEDDED DEMO DATA =====

const DEMO_PLAYERS = ['Sarah Mitchell', 'James Cooper', 'Caroline Taylor', 'Ryan Edwards'];
const DEMO_OPPONENTS = ['Hong Kong', 'Malaysia', 'Scotland', 'Wales', 'Canada', 'Australia'];
const SHOT_TYPES = ['Draw shot', 'Weight shot', 'Short', 'Past', 'Blocker', 'Trail', 'Drive', 'Wick', 'Promote', 'Rest'];
const RESULTS = ['< 0.5 ft', '0.5-1 ft', '1-2 ft', '2-3 ft', '> 3 ft', 'Very well played', 'Well played', 'Unlucky'];
const JACK_LENGTHS = ['Short', 'Medium', 'Long', 'T'];
const MAT_LENGTHS = ['Short', 'Medium', 'Long'];

function _demoId() {
  return 'demo_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Seeded-ish random for reproducibility within a session
let _seed = 42;
function _rand() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed & 0x7fffffff) / 2147483647;
}

function _pick(arr) { return arr[Math.floor(_rand() * arr.length)]; }

function _scoreFromResult(result) {
  if (result === '< 0.5 ft' || result === 'Very well played') return 4;
  if (result === '0.5-1 ft' || result === 'Well played') return 3;
  if (result === '1-2 ft') return 2;
  if (result === '2-3 ft' || result === 'Unlucky') return 1;
  return 0;
}

function _distanceFromResult(result) {
  if (result === '< 0.5 ft' || result === 'Very well played') return +(0.1 + _rand() * 0.4).toFixed(2);
  if (result === '0.5-1 ft' || result === 'Well played') return +(0.5 + _rand() * 0.5).toFixed(2);
  if (result === '1-2 ft') return +(1.0 + _rand() * 1.0).toFixed(2);
  if (result === '2-3 ft' || result === 'Unlucky') return +(2.0 + _rand() * 1.0).toFixed(2);
  return +(3.0 + _rand() * 2.0).toFixed(2);
}

function _buildDemoGames() {
  const games = [];
  const allBowls = [];
  _seed = 42; // reset for consistent data

  const configs = [
    { format: 'singles', opponent: 'Hong Kong',  date: '2025-04-11', ends: 7, bowlsPer: 4, players: ['Sarah Mitchell'],   playersPerTeam: 1, tournament: 'Asia Pacific Championships' },
    { format: 'singles', opponent: 'Malaysia',   date: '2025-05-03', ends: 6, bowlsPer: 4, players: ['James Cooper'],      playersPerTeam: 1, tournament: 'Asia Pacific Championships' },
    { format: 'singles', opponent: 'Scotland',   date: '2025-06-14', ends: 8, bowlsPer: 4, players: ['Caroline Taylor'],   playersPerTeam: 1, tournament: 'World Singles Qualifier' },
    { format: 'pairs4',  opponent: 'Wales',      date: '2025-07-20', ends: 6, bowlsPer: 4, players: ['Sarah Mitchell', 'James Cooper'],    playersPerTeam: 2, tournament: 'Commonwealth Pairs' },
    { format: 'pairs4',  opponent: 'Canada',     date: '2025-08-09', ends: 7, bowlsPer: 4, players: ['Caroline Taylor', 'Ryan Edwards'],   playersPerTeam: 2, tournament: 'Commonwealth Pairs' },
    { format: 'singles', opponent: 'Australia',  date: '2025-10-10', ends: 9, bowlsPer: 4, players: ['Sarah Mitchell'],   playersPerTeam: 1, tournament: 'Trans-Tasman Test' },
  ];

  for (let gi = 0; gi < configs.length; gi++) {
    const cfg = configs[gi];
    const gameId = _demoId();

    const game = {
      id: gameId,
      gameId: gameId,
      tournamentName: cfg.tournament,
      format: cfg.format,
      gameType: 'game',
      matchStructure: 'traditional',
      totalEnds: cfg.ends,
      endCount: cfg.ends,
      currentEnd: cfg.ends,
      completed: true,
      date: cfg.date + 'T10:00:00.000Z',
      yourPlayers: cfg.players,
      players: cfg.players,
      opponentPlayers: [cfg.opponent + ' Lead', cfg.opponent + ' Skip'].slice(0, cfg.playersPerTeam),
      awayPlayers: [],
      bowlsPerPlayer: cfg.bowlsPer,
      playersPerTeam: cfg.playersPerTeam,
      numberOfSets: null,
      endsPerSet: null,
      tieBreakEnds: null,
      currentSet: 1,
      setScores: [],
      endNotes: {},
      gameNotes: '',
      jackPosition: { x: 250, y: 250 },
      bowls: [],
      currentPlayerIndex: 0,
      currentTeam: 'yours',
      currentHand: 'forehand',
      matLength: 'short',
      jackLength: 'medium',
      gameNumber: gi + 1,
      [DEMO_DATA_MARKER]: true
    };

    games.push(game);

    // Generate bowls for each end
    for (let end = 1; end <= cfg.ends; end++) {
      const jackLen = _pick(JACK_LENGTHS);
      const matLen = _pick(MAT_LENGTHS);

      // Your team bowls
      for (let pi = 0; pi < cfg.players.length; pi++) {
        for (let bn = 1; bn <= cfg.bowlsPer; bn++) {
          const hand = _rand() > 0.4 ? 'Forehand' : 'Backhand';
          const shotType = _pick(SHOT_TYPES);
          const result = _pick(RESULTS);
          const score = _scoreFromResult(result);
          const dist = _distanceFromResult(result);

          allBowls.push({
            id: _demoId(),
            gameId: gameId,
            endNumber: end,
            end: end,
            bowlNumber: bn,
            player: cfg.players[pi],
            playerName: cfg.players[pi],
            playerId: cfg.players[pi],
            team: 'yours',
            hand: hand,
            position: cfg.format === 'singles' ? 'Player' : (pi === 0 ? 'Lead' : 'Skip'),
            x: 200 + Math.floor(_rand() * 100),
            y: 200 + Math.floor(_rand() * 100),
            scoreValue: score,
            score: score,
            resultCategory: result,
            direction: result,
            distanceCategory: dist < 1 ? 'close' : (dist < 2 ? 'medium' : 'far'),
            distanceInFeet: dist,
            distance: dist,
            scoreCategory: shotType,
            scoreDetail: result,
            matLength: matLen,
            jackLength: jackLen,
            shotType: shotType,
            quality: score >= 3 ? 'good' : (score >= 2 ? 'average' : 'poor'),
            isDead: false,
            angle: Math.floor(_rand() * 360),
            notes: '',
            timestamp: new Date(cfg.date + 'T10:00:00.000Z').toISOString(),
            [DEMO_DATA_MARKER]: true
          });
        }
      }

      // Opponent bowls
      for (let pi = 0; pi < cfg.playersPerTeam; pi++) {
        const oppName = cfg.opponent + (pi === 0 ? ' Lead' : ' Skip');
        for (let bn = 1; bn <= cfg.bowlsPer; bn++) {
          const hand = _rand() > 0.5 ? 'Forehand' : 'Backhand';
          const result = _pick(RESULTS);
          const score = _scoreFromResult(result);
          const dist = _distanceFromResult(result);

          allBowls.push({
            id: _demoId(),
            gameId: gameId,
            endNumber: end,
            end: end,
            bowlNumber: bn,
            player: oppName,
            playerName: oppName,
            playerId: oppName,
            team: 'opponent',
            hand: hand,
            position: cfg.playersPerTeam === 1 ? 'Player' : (pi === 0 ? 'Lead' : 'Skip'),
            x: 200 + Math.floor(_rand() * 100),
            y: 200 + Math.floor(_rand() * 100),
            scoreValue: score,
            score: score,
            resultCategory: result,
            direction: result,
            distanceInFeet: dist,
            distance: dist,
            matLength: matLen,
            jackLength: jackLen,
            shotType: _pick(SHOT_TYPES),
            isDead: false,
            angle: Math.floor(_rand() * 360),
            notes: '',
            timestamp: new Date(cfg.date + 'T10:00:00.000Z').toISOString(),
            [DEMO_DATA_MARKER]: true
          });
        }
      }
    }
  }

  return { games, bowls: allBowls };
}

// ===== PUBLIC API =====

async function generateDemoData() {
  console.log('[Demo] Loading embedded demo data...');

  const { games, bowls } = _buildDemoGames();
  const loadedGameIds = [];

  for (const game of games) {
    await saveGame(game);
    loadedGameIds.push(game.id);
  }

  // Save bowls in batches per game
  const bowlsByGame = {};
  for (const b of bowls) {
    if (!bowlsByGame[b.gameId]) bowlsByGame[b.gameId] = [];
    bowlsByGame[b.gameId].push(b);
  }
  for (const gameId of Object.keys(bowlsByGame)) {
    await saveBowlsBatch(bowlsByGame[gameId]);
  }

  await saveSetting('demoGameIds', loadedGameIds);
  await saveSetting('demoDataLoaded', true);

  console.log(`[Demo] Loaded ${games.length} games and ${bowls.length} bowls`);

  return {
    name: 'Demo Data',
    gamesLoaded: games.length,
    deliveriesLoaded: bowls.length
  };
}

async function isDemoDataLoaded() {
  const loaded = await getSetting('demoDataLoaded');
  return loaded === true;
}

async function removeDemoData() {
  const gameIds = await getSetting('demoGameIds');
  if (!gameIds || gameIds.length === 0) {
    // Fallback: try to remove all games marked as demo data
    const allGames = await getAllGames();
    for (const game of allGames) {
      if (game[DEMO_DATA_MARKER]) {
        await deleteGame(game.id);
      }
    }
  } else {
    for (const id of gameIds) {
      await deleteGame(id);
    }
  }

  await saveSetting('demoGameIds', null);
  await saveSetting('demoDataLoaded', false);
  console.log('[Demo] Demo data removed');
}
