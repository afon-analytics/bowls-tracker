// Demo Data Generator for Bowls Performance Tracker
// Creates realistic sample data for the Summer Club Championship 2025

const DEMO_PLAYERS = {
  leads: [
    { name: 'Sarah Mitchell', level: 'excellent' },
    { name: 'Tom Bradley', level: 'good' }
  ],
  seconds: [
    { name: 'Mike Chen', level: 'good' },
    { name: 'Jenny Williams', level: 'average' }
  ],
  thirds: [
    { name: 'Dave Thompson', level: 'good' },
    { name: 'Rachel Green', level: 'developing' }
  ],
  skips: [
    { name: 'James Wilson', level: 'excellent' },
    { name: 'Karen O\'Brien', level: 'good' }
  ],
  singles: [
    { name: 'Paul Roberts', level: 'good' },
    { name: 'Lisa Chang', level: 'average' }
  ]
};

// Score distributions by player level
const SCORE_DISTRIBUTIONS = {
  excellent: { 4: 0.30, 3: 0.35, 2: 0.20, 1: 0.10, 0: 0.05 },
  good:      { 4: 0.15, 3: 0.30, 2: 0.30, 1: 0.15, 0: 0.10 },
  average:   { 4: 0.08, 3: 0.20, 2: 0.32, 1: 0.25, 0: 0.15 },
  developing:{ 4: 0.05, 3: 0.12, 2: 0.25, 1: 0.30, 0: 0.28 }
};

// Distance distributions (in feet) by score
const DISTANCE_BY_SCORE = {
  4: { min: 0.1, max: 0.5 },
  3: { min: 0.3, max: 1.2 },
  2: { min: 0.8, max: 2.5 },
  1: { min: 2.0, max: 3.5 },
  0: { min: 3.0, max: 5.5 }
};

const RESULT_CATEGORIES = ['Short', 'Jack High', 'Past'];
const HANDS = ['forehand', 'backhand'];
const MAT_LENGTHS = ['short', 'medium', 'long'];
const JACK_LENGTHS = ['short', 'medium', 'long'];

const BOWL_NOTES_POOL = [
  '', '', '', '', '', '', // Most bowls have no notes
  'Great line', 'Narrow', 'Wide', 'Good weight',
  'Too heavy', 'Short of length', 'Perfect draw',
  'Pushed opponent bowl', 'Resting on jack', 'Trail attempt',
  'Promoted own bowl', 'Good cover bowl', 'Unlucky bounce',
  'Changed line mid-delivery', 'Held the head'
];

const END_NOTES_POOL = [
  '', '', '',
  'Good start, controlled the head',
  'Lost count, opponent played well',
  'Key end - turned the game around',
  'Close head, needed measure',
  'Weather affecting the green',
  'Opposition skips weight shot changed everything',
  'Our leads built a great platform',
  'Need to adjust for the green speed',
  'Drawing well to the forehand side',
  'Backhand proving difficult today',
  'Great team effort this end'
];

function weightedRandom(distribution) {
  const rand = Math.random();
  let cumulative = 0;
  for (const [score, prob] of Object.entries(distribution)) {
    cumulative += prob;
    if (rand <= cumulative) return parseInt(score);
  }
  return 2;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getDistanceCategoryFromFeet(feet) {
  if (feet < 0.5) return '< 0.5 ft';
  if (feet < 1) return '0.5 ft - 1 ft';
  if (feet < 2) return '1 ft - 2 ft';
  if (feet < 3) return '2 ft - 3 ft';
  return '> 3 ft';
}

function generateBowlPosition(score, jackPos) {
  const distRange = DISTANCE_BY_SCORE[score];
  const dist = randomBetween(distRange.min, distRange.max);
  const distPx = dist * 100;
  const angle = Math.random() * 2 * Math.PI;
  const x = Math.max(20, Math.min(480, jackPos.x + Math.cos(angle) * distPx));
  const y = Math.max(20, Math.min(480, jackPos.y + Math.sin(angle) * distPx));
  return { x, y, distanceInFeet: dist };
}

function getResultCategory(bowlY, jackY) {
  if (bowlY < jackY - 10) return 'Short';
  if (Math.abs(bowlY - jackY) <= 10) return 'Jack High';
  return 'Past';
}

function isFrontEnd(position) {
  return position === 'Lead' || position === 'Second';
}

function generateScoreDetails(score, position, resultCategory, distanceCategory) {
  if (isFrontEnd(position)) {
    return { scoreCategory: resultCategory, scoreDetail: distanceCategory };
  }
  // Back end scoring
  const shotTypes = ['Draw shot', 'Weight shot', 'Draw Positional', 'Draw to Respot', 'Blocker'];
  const qualities = {
    4: 'Very well played',
    3: 'Good Effort',
    2: 'Average attempt',
    1: 'Below average',
    0: 'Completely Ineffective'
  };
  return {
    scoreCategory: randomChoice(shotTypes),
    scoreDetail: qualities[score] || 'Average attempt'
  };
}

async function generateDemoData() {
  const tournamentId = generateId();
  const tournament = {
    id: tournamentId,
    name: 'Summer Club Championship 2025',
    date: '2025-01-15T09:00:00.000Z',
    location: 'Greenfield Bowling Club',
    notes: 'Annual club championship - four rounds of competition'
  };

  await saveTournament(tournament);

  // Game 1: Fours (21 ends) - balanced performance
  await generateGame({
    tournamentId,
    gameNumber: 1,
    format: 'fours',
    endCount: 21,
    bowlsPerPlayer: 2,
    players: [
      { name: 'Sarah Mitchell', position: 'Lead', level: 'excellent' },
      { name: 'Mike Chen', position: 'Second', level: 'good' },
      { name: 'Dave Thompson', position: 'Third', level: 'good' },
      { name: 'James Wilson', position: 'Skip', level: 'excellent' }
    ],
    opponentName: 'Riverside BC',
    date: '2025-01-15T09:30:00.000Z',
    gameNotes: 'Good start to the championship. Balanced effort from all players. Green was running well in the morning session.',
    scenario: 'balanced'
  });

  // Game 2: Triples (18 ends) - one standout player
  await generateGame({
    tournamentId,
    gameNumber: 2,
    format: 'triples3',
    endCount: 18,
    bowlsPerPlayer: 3,
    players: [
      { name: 'Tom Bradley', position: 'Lead', level: 'good' },
      { name: 'Jenny Williams', position: 'Second', level: 'average' },
      { name: 'James Wilson', position: 'Skip', level: 'excellent' }
    ],
    opponentName: 'Hillside Bowlers',
    date: '2025-01-16T13:00:00.000Z',
    gameNotes: 'James Wilson had an outstanding game. Jenny struggled with the backhand. Green slowed down after rain.',
    scenario: 'standout'
  });

  // Game 3: Pairs (21 ends) - close competition
  await generateGame({
    tournamentId,
    gameNumber: 3,
    format: 'pairs4',
    endCount: 21,
    bowlsPerPlayer: 4,
    players: [
      { name: 'Sarah Mitchell', position: 'Lead', level: 'excellent' },
      { name: 'Karen O\'Brien', position: 'Skip', level: 'good' }
    ],
    opponentName: 'Lakeview Greens',
    date: '2025-01-18T10:00:00.000Z',
    gameNotes: 'Very close game throughout. Sarah\'s consistent leading gave us a platform. Karen made some crucial shots in the final ends.',
    scenario: 'close'
  });

  // Game 4: Singles (15 ends) - varied bowl accuracy
  await generateGame({
    tournamentId,
    gameNumber: 4,
    format: 'singles',
    endCount: 15,
    bowlsPerPlayer: 4,
    players: [
      { name: 'Paul Roberts', position: 'Player', level: 'good' }
    ],
    opponentName: 'D. Martinez',
    date: '2025-01-20T14:00:00.000Z',
    gameNotes: 'Paul had a mixed bag - some brilliant ends followed by poor concentration. Needs to work on consistency.',
    scenario: 'varied'
  });

  await saveSetting('demoDataLoaded', true);
  console.log('[Demo] Demo data generated successfully');
  return tournament;
}

async function generateGame(config) {
  const gameId = generateId();

  const game = {
    id: gameId,
    tournamentId: config.tournamentId,
    tournamentName: 'Summer Club Championship 2025',
    gameNumber: config.gameNumber,
    format: config.format,
    endCount: config.endCount,
    players: config.players.map(p => p.name),
    opponentPlayers: [config.opponentName],
    date: config.date,
    notes: config.gameNotes,
    endNotes: {},
    completed: true,
    bowlsPerPlayer: config.bowlsPerPlayer,
    playersPerTeam: config.players.length,
    currentEnd: config.endCount,
    currentPlayerIndex: 0,
    currentTeam: 'yours',
    currentHand: 'forehand',
    matLength: 'short',
    jackLength: 'medium',
    jackPosition: { x: 250, y: 250 },
    totalEnds: config.endCount
  };

  const allBowls = [];
  let baseTime = new Date(config.date).getTime();

  for (let end = 1; end <= config.endCount; end++) {
    // Randomize jack position for each end
    const jackPos = {
      x: 200 + Math.random() * 100,
      y: 180 + Math.random() * 140
    };

    // Generate bowls for each player in this end
    for (let pi = 0; pi < config.players.length; pi++) {
      const player = config.players[pi];
      let level = player.level;

      // Apply scenario modifiers
      if (config.scenario === 'standout' && player.position === 'Skip') {
        level = 'excellent';
      } else if (config.scenario === 'standout' && player.position === 'Second') {
        level = 'developing';
      } else if (config.scenario === 'close') {
        // Slightly reduce everyone's performance for a close game
        if (level === 'excellent') level = 'good';
      } else if (config.scenario === 'varied') {
        // Alternate between good and poor ends
        level = (end % 3 === 0) ? 'developing' : (end % 3 === 1) ? 'excellent' : 'average';
      }

      const distribution = SCORE_DISTRIBUTIONS[level];

      for (let b = 0; b < config.bowlsPerPlayer; b++) {
        const score = weightedRandom(distribution);
        const pos = generateBowlPosition(score, jackPos);
        const resultCategory = getResultCategory(pos.y, jackPos.y);
        const distanceCategory = getDistanceCategoryFromFeet(pos.distanceInFeet);
        const scoreDetails = generateScoreDetails(score, player.position, resultCategory, distanceCategory);
        const matLength = randomChoice(MAT_LENGTHS);
        const jackLength = randomChoice(JACK_LENGTHS);

        baseTime += 120000 + Math.random() * 60000; // 2-3 minutes apart

        allBowls.push({
          id: generateId(),
          gameId: gameId,
          playerId: player.name,
          playerName: player.name,
          position: player.position,
          endNumber: end,
          bowlNumber: b + 1,
          distance: pos.distanceInFeet,
          direction: resultCategory,
          angle: 0,
          score: score,
          timestamp: new Date(baseTime).toISOString(),
          notes: randomChoice(BOWL_NOTES_POOL),
          x: pos.x,
          y: pos.y,
          team: 'yours',
          hand: randomChoice(HANDS),
          matLength: matLength,
          jackLength: jackLength,
          end: end,
          player: player.name,
          playerIndex: pi,
          resultCategory: resultCategory,
          distanceCategory: distanceCategory,
          distanceInFeet: pos.distanceInFeet,
          scoreCategory: scoreDetails.scoreCategory,
          scoreDetail: scoreDetails.scoreDetail,
          scoreValue: score
        });

        // Generate opponent bowls too (simpler)
        const oppScore = weightedRandom(SCORE_DISTRIBUTIONS['average']);
        const oppPos = generateBowlPosition(oppScore, jackPos);
        baseTime += 120000 + Math.random() * 60000;

        allBowls.push({
          id: generateId(),
          gameId: gameId,
          playerId: 'opponent',
          playerName: config.opponentName,
          position: 'Opponent',
          endNumber: end,
          bowlNumber: b + 1,
          distance: oppPos.distanceInFeet,
          direction: getResultCategory(oppPos.y, jackPos.y),
          angle: 0,
          score: oppScore,
          timestamp: new Date(baseTime).toISOString(),
          notes: '',
          x: oppPos.x,
          y: oppPos.y,
          team: 'opponent',
          hand: randomChoice(HANDS),
          matLength: matLength,
          jackLength: jackLength,
          end: end,
          player: config.opponentName,
          playerIndex: 0,
          resultCategory: getResultCategory(oppPos.y, jackPos.y),
          distanceCategory: getDistanceCategoryFromFeet(oppPos.distanceInFeet),
          distanceInFeet: oppPos.distanceInFeet,
          scoreCategory: '',
          scoreDetail: '',
          scoreValue: oppScore
        });
      }
    }

    // Add end notes for some ends
    if (Math.random() > 0.5) {
      game.endNotes[end] = randomChoice(END_NOTES_POOL);
    }
  }

  await saveGame(game);
  await saveBowlsBatch(allBowls);

  return { game, bowlCount: allBowls.length };
}

async function isDemoDataLoaded() {
  const loaded = await getSetting('demoDataLoaded');
  return loaded === true;
}

async function removeDemoData() {
  // Get tournament
  const tournaments = await getAllTournaments();
  const demoTournament = tournaments.find(t => t.name === 'Summer Club Championship 2025');
  if (!demoTournament) return;

  // Get and delete games
  const games = await getGamesByTournament(demoTournament.id);
  for (const game of games) {
    await deleteGame(game.id);
  }
  await deleteTournament(demoTournament.id);
  await saveSetting('demoDataLoaded', false);
  console.log('[Demo] Demo data removed');
}
