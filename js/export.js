// CSV Export Module for Bowls Performance Tracker

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(headers, rows) {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(row => row.map(escapeCSV).join(','));
  return [headerLine, ...dataLines].join('\n');
}

function getDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

// Export all player statistics
async function exportAllPlayerStats() {
  const players = await getAllPlayerNames();
  if (players.length === 0) {
    alert('No player data to export.');
    return;
  }

  const headers = [
    'Player Name', 'Position(s)', 'Games Played', 'Total Bowls',
    'Avg Score', 'Consistency (SD)', 'Clutch Avg',
    'Close Success Rate (%)', 'Medium Success Rate (%)', 'Far Success Rate (%)',
    'Short Bowls', 'Medium Bowls', 'Long Bowls'
  ];

  const rows = [];
  for (const name of players) {
    const stats = await getPlayerStats(name);
    if (!stats) continue;
    rows.push([
      stats.playerName,
      stats.positions.join('; '),
      stats.gamesPlayed,
      stats.totalBowls,
      stats.avgScore.toFixed(2),
      stats.consistency.toFixed(2),
      stats.clutchAvg.toFixed(2),
      (stats.distanceSuccessRates['Close (<20cm)'] || 0).toFixed(1),
      (stats.distanceSuccessRates['Medium (20-50cm)'] || 0).toFixed(1),
      (stats.distanceSuccessRates['Far (>50cm)'] || 0).toFixed(1),
      stats.bowlDistribution.short,
      stats.bowlDistribution.medium,
      stats.bowlDistribution.long
    ]);
  }

  const csv = toCSV(headers, rows);
  downloadCSV(csv, `BowlsTracker_AllPlayers_${getDateStamp()}.csv`);
}

// Export single player history
async function exportPlayerHistory(playerName) {
  const bowls = await getAllBowls();
  const playerBowls = bowls.filter(b => b.playerId === playerName && b.team === 'yours');

  if (playerBowls.length === 0) {
    alert('No data for this player.');
    return;
  }

  const allGames = await getAllGames();

  const headers = [
    'Game', 'Date', 'Format', 'End', 'Bowl Number',
    'Position', 'Hand', 'Distance (ft)', 'Direction',
    'Score', 'Score Category', 'Score Detail',
    'Mat Length', 'Jack Length', 'Notes'
  ];

  const rows = playerBowls.map(b => {
    const game = allGames.find(g => g.id === b.gameId);
    return [
      game ? `Game ${game.gameNumber || ''}` : b.gameId,
      game ? formatDate(game.date) : '',
      game ? formatName(game.format) : '',
      b.endNumber || b.end || '',
      b.bowlNumber || '',
      b.position || '',
      b.hand || '',
      (b.distanceInFeet || b.distance || 0).toFixed(2),
      b.resultCategory || b.direction || '',
      b.scoreValue || b.score || 0,
      b.scoreCategory || '',
      b.scoreDetail || '',
      b.matLength || '',
      b.jackLength || '',
      b.notes || ''
    ];
  });

  const csv = toCSV(headers, rows);
  const safeName = playerName.replace(/[^a-zA-Z0-9]/g, '_');
  downloadCSV(csv, `BowlsTracker_${safeName}_${getDateStamp()}.csv`);
}

// Export game data
async function exportGameData(gameId) {
  const game = await getGame(gameId);
  const bowls = await getBowlsByGame(gameId);

  if (!game) {
    alert('Game not found.');
    return;
  }

  const headers = [
    'End', 'Player', 'Team', 'Bowl Number', 'Position',
    'Hand', 'Distance (ft)', 'Direction', 'Distance Category',
    'Score', 'Score Category', 'Score Detail',
    'Mat Length', 'Jack Length', 'Timestamp', 'Notes'
  ];

  const rows = bowls
    .sort((a, b) => {
      const endA = a.endNumber || a.end || 0;
      const endB = b.endNumber || b.end || 0;
      if (endA !== endB) return endA - endB;
      return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
    })
    .map(b => [
      b.endNumber || b.end || '',
      b.playerName || b.player || b.playerId || '',
      b.team || '',
      b.bowlNumber || '',
      b.position || '',
      b.hand || '',
      (b.distanceInFeet || b.distance || 0).toFixed(2),
      b.resultCategory || b.direction || '',
      b.distanceCategory || '',
      b.scoreValue || b.score || 0,
      b.scoreCategory || '',
      b.scoreDetail || '',
      b.matLength || '',
      b.jackLength || '',
      b.timestamp || '',
      b.notes || ''
    ]);

  const csv = toCSV(headers, rows);
  const players = (game.players || game.yourPlayers || []).join('-').replace(/[^a-zA-Z0-9-]/g, '_');
  downloadCSV(csv, `BowlsTracker_Game_${players}_${getDateStamp()}.csv`);
}

// Export tournament summary
async function exportTournamentSummary() {
  const tournaments = await getAllTournaments();
  const allGames = await getAllGames();
  const allBowls = await getAllBowls();

  if (tournaments.length === 0 && allGames.length === 0) {
    alert('No data to export.');
    return;
  }

  const headers = [
    'Tournament', 'Game Number', 'Date', 'Format',
    'Players', 'Opponent', 'Total Ends', 'Total Bowls',
    'Team Avg Score', 'Top Performer', 'Top Performer Avg',
    'Status', 'Notes'
  ];

  const rows = allGames.map(game => {
    const gameBowls = allBowls.filter(b => b.gameId === game.id);
    const yourBowls = gameBowls.filter(b => b.team === 'yours');
    const scoredBowls = yourBowls.filter(b => b.score !== undefined || b.scoreValue !== undefined);
    const avgScore = scoredBowls.length > 0
      ? scoredBowls.reduce((s, b) => s + (b.scoreValue || b.score || 0), 0) / scoredBowls.length
      : 0;

    const playerScores = {};
    yourBowls.forEach(b => {
      const name = b.playerId || b.playerName;
      if (!playerScores[name]) playerScores[name] = { total: 0, count: 0 };
      playerScores[name].total += (b.scoreValue || b.score || 0);
      playerScores[name].count++;
    });

    let topPerformer = '';
    let topAvg = 0;
    for (const [name, data] of Object.entries(playerScores)) {
      const avg = data.count > 0 ? data.total / data.count : 0;
      if (avg > topAvg) { topAvg = avg; topPerformer = name; }
    }

    return [
      game.tournamentName || '',
      game.gameNumber || '',
      formatDate(game.date),
      formatName(game.format),
      (game.players || game.yourPlayers || []).join('; '),
      (game.opponentPlayers || [])[0] || '',
      game.endCount || game.totalEnds || '',
      gameBowls.length,
      avgScore.toFixed(2),
      topPerformer,
      topAvg.toFixed(2),
      game.completed ? 'Completed' : 'In Progress',
      (game.notes || game.gameNotes || '').replace(/\n/g, ' ')
    ];
  });

  const csv = toCSV(headers, rows);
  downloadCSV(csv, `BowlsTracker_Summary_${getDateStamp()}.csv`);
}
