// Demo Data Loader for Bowls Performance Tracker
// Embedded demo data based on real tournament data from Central Hub

const DEMO_DATA_MARKER = '__demo_data';

// ===== REAL DATA CONSTANTS =====

const _DEMO_SHOT_TYPES = [
  { name: 'Draw shot',       weight: 30 },
  { name: 'Past',            weight: 27 },
  { name: 'Short',           weight: 20 },
  { name: 'JackHigh',        weight: 11 },
  { name: 'Weight shot',     weight: 7 },
  { name: 'Draw Positional', weight: 2 },
  { name: 'Draw to Respot',  weight: 1 },
  { name: 'Blocker',         weight: 1 },
  { name: 'Bowl off Rink',   weight: 0.5 },
  { name: 'Draw to Ditch',   weight: 0.3 },
  { name: 'Other',           weight: 0.1 },
  { name: 'No Bowl thrown',  weight: 0.1 }
];

const _DEMO_RESULT_CATEGORIES = [
  { name: '< 0.5 ft',              weight: 15, scoreLo: 4, scoreHi: 4, distLo: 0.05, distHi: 0.49 },
  { name: '0.5 ft - 1 ft',         weight: 18, scoreLo: 3, scoreHi: 4, distLo: 0.50, distHi: 0.99 },
  { name: '1 ft - 2 ft',           weight: 16, scoreLo: 2, scoreHi: 3, distLo: 1.00, distHi: 1.99 },
  { name: '2 ft - 3 ft',           weight: 12, scoreLo: 1, scoreHi: 2, distLo: 2.00, distHi: 2.99 },
  { name: '> 3 ft',                weight: 10, scoreLo: 0, scoreHi: 1, distLo: 3.00, distHi: 5.00 },
  { name: 'Very well played',      weight: 8,  scoreLo: 4, scoreHi: 4, distLo: 0.05, distHi: 0.40 },
  { name: 'Good Effort',           weight: 6,  scoreLo: 3, scoreHi: 3, distLo: 0.30, distHi: 1.20 },
  { name: 'Average attempt',       weight: 5,  scoreLo: 2, scoreHi: 2, distLo: 1.00, distHi: 2.50 },
  { name: 'Below average',         weight: 4,  scoreLo: 1, scoreHi: 1, distLo: 2.00, distHi: 3.50 },
  { name: 'Score 3',               weight: 3,  scoreLo: 3, scoreHi: 3, distLo: 0.30, distHi: 1.00 },
  { name: 'Score 0',               weight: 2,  scoreLo: 0, scoreHi: 0, distLo: 3.00, distHi: 6.00 },
  { name: 'Completely Ineffective', weight: 1,  scoreLo: 0, scoreHi: 0, distLo: 4.00, distHi: 8.00 },
  { name: 'Bowl off Rink',         weight: 0.5, scoreLo: 0, scoreHi: 0, distLo: 10.0, distHi: 15.0 }
];

const _DEMO_JACK_LENGTHS = ['Short', 'Medium', 'Long', 'T'];

// ===== SEEDED RANDOM =====

let _seed = 42;
function _rand() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed & 0x7fffffff) / 2147483647;
}

function _pick(arr) { return arr[Math.floor(_rand() * arr.length)]; }

function _pickWeighted(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = _rand() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function _demoId() {
  return 'demo_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ===== GAME CONFIGS (based on real tournament data) =====

function _buildDemoGames() {
  const games = [];
  const allBowls = [];
  _seed = 42;

  const configs = [
    // World Cup events
    { format: 'Womens Singles', opponent: 'Canda',       date: '2025-04-11', ends: 7, bowlsPer: 4, players: ['Caroline Taylor'],                   playersPerTeam: 1, tournament: 'World Cup Day 1' },
    { format: 'Womens Singles', opponent: 'India',        date: '2025-04-11', ends: 7, bowlsPer: 4, players: ['Amy Williams'],                      playersPerTeam: 1, tournament: 'World Cup Day 2' },
    { format: 'Mens Singles',   opponent: 'Canda',        date: '2025-06-11', ends: 7, bowlsPer: 4, players: ['Ross Owen'],                         playersPerTeam: 1, tournament: 'World Cup Day 3' },
    { format: 'Womens Pairs',   opponent: 'India',        date: '2025-06-12', ends: 7, bowlsPer: 4, players: ['Amy Williams', 'Caroline Taylor'],   playersPerTeam: 2, tournament: 'World Cup Day 4' },
    { format: 'Mens Pairs',     opponent: 'England',      date: '2025-04-12', ends: 7, bowlsPer: 4, players: ['Ross Owen', 'Daniel Davies Jnr'],    playersPerTeam: 2, tournament: 'World Cup Day 2' },
    // Hong Kong events
    { format: 'Mens Pairs',     opponent: 'Malaysia',     date: '2025-07-15', ends: 9, bowlsPer: 4, players: ['Carl Wood', 'Dan Salmon'],           playersPerTeam: 2, tournament: 'HK Day 1' },
    { format: 'Womens Pairs',   opponent: 'USA',          date: '2025-07-16', ends: 9, bowlsPer: 4, players: ['Sara Nicholls', 'Ysie White'],       playersPerTeam: 2, tournament: 'HK Day 2' },
    { format: 'Womens Pairs',   opponent: 'England',      date: '2025-07-18', ends: 9, bowlsPer: 4, players: ['Sara Nicholls', 'Ysie White'],       playersPerTeam: 2, tournament: 'HK Day 3' },
    { format: 'Mens Singles',   opponent: 'South Africa',  date: '2025-07-19', ends: 7, bowlsPer: 4, players: ['Carl Wood'],                        playersPerTeam: 1, tournament: 'HK Men Singles' },
    { format: 'Mens Singles',   opponent: 'Hong Kong',    date: '2025-07-19', ends: 7, bowlsPer: 4, players: ['Dan Salmon'],                       playersPerTeam: 1, tournament: 'HK Men Singles' },
    { format: 'Womens Singles', opponent: 'Hong Kong',    date: '2025-07-20', ends: 7, bowlsPer: 4, players: ['Sara Nicholls'],                    playersPerTeam: 1, tournament: 'HK Women Singles' },
    { format: 'Womens Singles', opponent: 'Hong Kong',    date: '2025-07-20', ends: 7, bowlsPer: 4, players: ['Ysie White'],                       playersPerTeam: 1, tournament: 'HK Women Singles' },
    { format: 'Mens Pairs',     opponent: 'England',      date: '2025-07-22', ends: 9, bowlsPer: 4, players: ['Carl Wood', 'Dan Salmon'],           playersPerTeam: 2, tournament: 'HK Day 5' },
    // Test match
    { format: 'Womens Singles', opponent: 'Australia',    date: '2025-10-10', ends: 7, bowlsPer: 4, players: ['Amy Williams'],                      playersPerTeam: 1, tournament: 'TestDay1' },
  ];

  for (let gi = 0; gi < configs.length; gi++) {
    const cfg = configs[gi];
    const gameId = _demoId();
    const isPairs = cfg.format.includes('Pairs');

    const oppPlayers = cfg.playersPerTeam === 1
      ? [cfg.opponent]
      : [cfg.opponent + ' Lead', cfg.opponent + ' Skip'];

    const game = {
      id: gameId,
      gameId: gameId,
      tournamentName: cfg.tournament,
      format: isPairs ? 'pairs4' : 'singles',
      gameType: 'game',
      matchStructure: 'traditional',
      totalEnds: cfg.ends,
      endCount: cfg.ends,
      currentEnd: cfg.ends,
      completed: true,
      date: cfg.date + 'T10:00:00.000Z',
      yourPlayers: cfg.players,
      players: cfg.players,
      opponentPlayers: oppPlayers,
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
      const jackLen = _pick(_DEMO_JACK_LENGTHS);

      // Your team bowls
      for (let pi = 0; pi < cfg.players.length; pi++) {
        for (let bn = 1; bn <= cfg.bowlsPer; bn++) {
          const hand = _rand() > 0.4 ? 'Forehand' : 'Backhand';
          const shotType = _pickWeighted(_DEMO_SHOT_TYPES).name;
          const result = _pickWeighted(_DEMO_RESULT_CATEGORIES);
          const score = result.scoreLo === result.scoreHi
            ? result.scoreLo
            : (_rand() > 0.5 ? result.scoreHi : result.scoreLo);
          const dist = +(result.distLo + _rand() * (result.distHi - result.distLo)).toFixed(2);

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
            position: isPairs ? (pi === 0 ? 'Lead' : 'Skip') : 'Player',
            x: 200 + Math.floor(_rand() * 100),
            y: 200 + Math.floor(_rand() * 100),
            scoreValue: score,
            score: score,
            resultCategory: result.name,
            direction: result.name,
            distanceCategory: dist < 1 ? 'close' : (dist < 2 ? 'medium' : 'far'),
            distanceInFeet: dist,
            distance: dist,
            scoreCategory: shotType,
            scoreDetail: result.name,
            matLength: jackLen,
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
        const oppName = oppPlayers[pi];
        for (let bn = 1; bn <= cfg.bowlsPer; bn++) {
          const hand = _rand() > 0.5 ? 'Forehand' : 'Backhand';
          const result = _pickWeighted(_DEMO_RESULT_CATEGORIES);
          const score = result.scoreLo === result.scoreHi
            ? result.scoreLo
            : (_rand() > 0.5 ? result.scoreHi : result.scoreLo);
          const dist = +(result.distLo + _rand() * (result.distHi - result.distLo)).toFixed(2);

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
            position: isPairs ? (pi === 0 ? 'Lead' : 'Skip') : 'Player',
            x: 200 + Math.floor(_rand() * 100),
            y: 200 + Math.floor(_rand() * 100),
            scoreValue: score,
            score: score,
            resultCategory: result.name,
            direction: result.name,
            distanceInFeet: dist,
            distance: dist,
            matLength: jackLen,
            jackLength: jackLen,
            shotType: _pickWeighted(_DEMO_SHOT_TYPES).name,
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
