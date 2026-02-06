// Analytics Module for Bowls Performance Tracker
// Player Performance Dashboard, Team Comparison, Game History

let analyticsCache = {};

function invalidateAnalyticsCache() {
  analyticsCache = {};
}

// ===== DATA AGGREGATION =====

async function getPlayerStats(playerName, filterGameId) {
  const cacheKey = 'player_' + playerName + (filterGameId ? '_game_' + filterGameId : '');
  if (analyticsCache[cacheKey]) return analyticsCache[cacheKey];

  let allBowls = await getAllBowls();
  const allGames = await getAllGames();

  // Filter by game if specified
  if (filterGameId) {
    allBowls = allBowls.filter(b => b.gameId === filterGameId);
  }

  const playerBowls = allBowls.filter(b => b.playerId === playerName && b.team === 'yours');

  if (playerBowls.length === 0) return null;

  // Games played
  const gameIds = [...new Set(playerBowls.map(b => b.gameId))];
  const gamesPlayed = gameIds.length;

  // Positions played
  const positions = [...new Set(playerBowls.map(b => b.position))];

  // Average score
  const scoredBowls = playerBowls.filter(b => b.score !== undefined && b.score !== null);
  const avgScore = scoredBowls.length > 0
    ? scoredBowls.reduce((sum, b) => sum + (b.scoreValue || b.score || 0), 0) / scoredBowls.length
    : 0;

  // Score distribution
  const scoreDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  scoredBowls.forEach(b => {
    const s = b.scoreValue !== undefined ? b.scoreValue : (b.score || 0);
    scoreDistribution[s] = (scoreDistribution[s] || 0) + 1;
  });

  // Success rate by distance zone
  const distanceZones = {
    'Close (<20cm)': { total: 0, good: 0 },
    'Medium (20-50cm)': { total: 0, good: 0 },
    'Far (>50cm)': { total: 0, good: 0 }
  };
  playerBowls.forEach(b => {
    const dist = b.distance || b.distanceInFeet || 0;
    // Convert feet to cm roughly (1ft ~ 30cm)
    const distCm = dist * 30;
    let zone;
    if (distCm < 20) zone = 'Close (<20cm)';
    else if (distCm < 50) zone = 'Medium (20-50cm)';
    else zone = 'Far (>50cm)';

    distanceZones[zone].total++;
    const score = b.scoreValue !== undefined ? b.scoreValue : (b.score || 0);
    if (score >= 3) distanceZones[zone].good++;
  });

  const distanceSuccessRates = {};
  for (const [zone, data] of Object.entries(distanceZones)) {
    distanceSuccessRates[zone] = data.total > 0 ? (data.good / data.total * 100) : 0;
  }

  // Bowl distribution (short/medium/long distance)
  const bowlDistribution = { short: 0, medium: 0, long: 0 };
  playerBowls.forEach(b => {
    const dist = b.distance || b.distanceInFeet || 0;
    if (dist < 0.67) bowlDistribution.short++;
    else if (dist < 1.67) bowlDistribution.medium++;
    else bowlDistribution.long++;
  });

  // Hand distribution (backhand vs forehand)
  const handDistribution = { forehand: 0, backhand: 0 };
  playerBowls.forEach(b => {
    const hand = b.hand || 'forehand';
    if (hand === 'backhand') handDistribution.backhand++;
    else handDistribution.forehand++;
  });

  // Per-game performance (trend data)
  const gamePerformance = [];
  for (const gid of gameIds) {
    const gameBowls = playerBowls.filter(b => b.gameId === gid);
    const game = allGames.find(g => g.id === gid);
    const gameScored = gameBowls.filter(b => b.score !== undefined);
    const gameAvg = gameScored.length > 0
      ? gameScored.reduce((s, b) => s + (b.scoreValue || b.score || 0), 0) / gameScored.length
      : 0;

    gamePerformance.push({
      gameId: gid,
      gameName: game ? `Game ${game.gameNumber || gameIds.indexOf(gid) + 1}` : gid,
      date: game ? game.date : '',
      avgScore: gameAvg,
      bowlCount: gameBowls.length,
      format: game ? game.format : ''
    });
  }
  gamePerformance.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Best and worst ends
  const endScores = {};
  playerBowls.forEach(b => {
    const key = b.gameId + '_' + b.endNumber;
    if (!endScores[key]) endScores[key] = { total: 0, count: 0, end: b.endNumber, gameId: b.gameId };
    endScores[key].total += (b.scoreValue || b.score || 0);
    endScores[key].count++;
  });
  const endAvgs = Object.values(endScores).map(e => ({
    ...e,
    avg: e.count > 0 ? e.total / e.count : 0
  }));
  endAvgs.sort((a, b) => b.avg - a.avg);
  const bestEnd = endAvgs[0] || null;
  const worstEnd = endAvgs[endAvgs.length - 1] || null;

  // Consistency (standard deviation of scores)
  const scores = scoredBowls.map(b => b.scoreValue || b.score || 0);
  const mean = avgScore;
  const variance = scores.length > 0
    ? scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length
    : 0;
  const consistency = Math.sqrt(variance);

  // Clutch performance (final 3 ends of each game)
  const clutchBowls = playerBowls.filter(b => {
    const game = allGames.find(g => g.id === b.gameId);
    if (!game) return false;
    const totalEnds = game.endCount || game.totalEnds || 21;
    return b.endNumber > totalEnds - 3;
  });
  const clutchScored = clutchBowls.filter(b => b.score !== undefined);
  const clutchAvg = clutchScored.length > 0
    ? clutchScored.reduce((s, b) => s + (b.scoreValue || b.score || 0), 0) / clutchScored.length
    : 0;

  // Direction analysis
  const directionBreakdown = { Short: 0, 'Jack High': 0, Past: 0 };
  playerBowls.forEach(b => {
    const dir = b.resultCategory || b.direction || '';
    if (directionBreakdown[dir] !== undefined) directionBreakdown[dir]++;
  });

  const stats = {
    playerName,
    totalBowls: playerBowls.length,
    gamesPlayed,
    positions,
    avgScore: Math.round(avgScore * 100) / 100,
    scoreDistribution,
    distanceSuccessRates,
    bowlDistribution,
    handDistribution,
    gamePerformance,
    bestEnd,
    worstEnd,
    consistency: Math.round(consistency * 100) / 100,
    clutchAvg: Math.round(clutchAvg * 100) / 100,
    directionBreakdown
  };

  analyticsCache[cacheKey] = stats;
  return stats;
}

async function getAllPlayerNames() {
  const allBowls = await getAllBowls();
  const names = [...new Set(allBowls.filter(b => b.team === 'yours').map(b => b.playerId))];
  return names.filter(n => n && n !== 'opponent');
}

async function getGameSummaries() {
  const allGames = await getAllGames();
  const allBowls = await getAllBowls();

  return allGames.map(game => {
    const gameBowls = allBowls.filter(b => b.gameId === game.id);
    const yourBowls = gameBowls.filter(b => b.team === 'yours');
    const scoredBowls = yourBowls.filter(b => b.score !== undefined);
    const avgScore = scoredBowls.length > 0
      ? scoredBowls.reduce((s, b) => s + (b.scoreValue || b.score || 0), 0) / scoredBowls.length
      : 0;

    // Top performer
    const playerScores = {};
    yourBowls.forEach(b => {
      if (!playerScores[b.playerId]) playerScores[b.playerId] = { total: 0, count: 0 };
      playerScores[b.playerId].total += (b.scoreValue || b.score || 0);
      playerScores[b.playerId].count++;
    });

    let topPerformer = '';
    let topAvg = 0;
    for (const [name, data] of Object.entries(playerScores)) {
      const avg = data.count > 0 ? data.total / data.count : 0;
      if (avg > topAvg) { topAvg = avg; topPerformer = name; }
    }

    return {
      id: game.id,
      tournamentId: game.tournamentId,
      tournamentName: game.tournamentName || '',
      gameNumber: game.gameNumber || 0,
      format: game.format,
      gameType: game.gameType || 'game',
      date: game.date,
      players: game.players || game.yourPlayers || [],
      opponentName: (game.opponentPlayers || [])[0] || '',
      totalEnds: game.endCount || game.totalEnds || 21,
      currentEnd: game.currentEnd || game.totalEnds || 21,
      totalBowls: gameBowls.length,
      avgScore: Math.round(avgScore * 100) / 100,
      topPerformer,
      topAvg: Math.round(topAvg * 100) / 100,
      completed: game.completed || false,
      notes: game.notes || game.gameNotes || ''
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ===== RENDERING =====

async function renderAnalytics(view) {
  const container = document.getElementById('analyticsContent');
  if (!container) return;

  container.innerHTML = '<div class="analytics-loading">Loading analytics...</div>';

  try {
    switch (view) {
      case 'player':
        await renderPlayerDashboard(container);
        break;
      case 'compare':
        await renderTeamComparison(container);
        break;
      case 'history':
        await renderGameHistory(container);
        break;
      default:
        await renderPlayerDashboard(container);
    }
  } catch (err) {
    console.error('[Analytics] Render error:', err);
    container.innerHTML = '<div class="analytics-empty">Error loading analytics. Please try again.</div>';
  }
}

async function renderPlayerDashboard(container) {
  const players = await getAllPlayerNames();
  if (players.length === 0) {
    container.innerHTML = `
      <div class="analytics-empty">
        <p>No player data available yet.</p>
        <p>Start tracking games or load demo data to see analytics.</p>
      </div>`;
    return;
  }

  // Get all games for game filter
  const allGames = await getAllGames();

  const currentPlayer = players[0];
  const stats = await getPlayerStats(currentPlayer);

  container.innerHTML = `
    <div class="player-selector-bar">
      <label for="analyticsPlayerSelect">Player:</label>
      <select id="analyticsPlayerSelect" onchange="applyPlayerFilters()">
        ${players.map(p => `<option value="${p}" ${p === currentPlayer ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
      <label for="analyticsGameFilter" style="margin-left: 10px;">Game:</label>
      <select id="analyticsGameFilter" onchange="applyPlayerFilters()">
        <option value="all">All Games</option>
        ${allGames.map(g => {
          const players = (g.players || g.yourPlayers || []).join(', ');
          const opp = (g.opponentPlayers || [])[0] || '';
          const label = `${players} vs ${opp}`;
          return `<option value="${g.id}">${label}</option>`;
        }).join('')}
      </select>
    </div>
    <div id="activeFilters" class="active-filters" style="display:none;"></div>
    <div id="playerDashboardContent">
      ${renderPlayerStatsHTML(stats)}
    </div>
  `;

  // Render charts after DOM is ready
  setTimeout(() => renderPlayerCharts(stats), 100);
}

function renderPlayerStatsHTML(stats) {
  if (!stats) return '<div class="analytics-empty">No data for this player.</div>';

  const positionText = stats.positions.join(', ');
  const formIndicator = stats.gamePerformance.length >= 2
    ? (() => {
      const recent = stats.gamePerformance[stats.gamePerformance.length - 1]?.avgScore || 0;
      const diff = recent - stats.avgScore;
      if (diff > 0.3) return '<span class="form-up">&#9650; Rising</span>';
      if (diff < -0.3) return '<span class="form-down">&#9660; Declining</span>';
      return '<span class="form-steady">&#9654; Steady</span>';
    })()
    : '<span class="form-steady">--</span>';

  return `
    <div class="stats-summary-cards">
      <div class="stat-card">
        <div class="stat-value">${stats.totalBowls}</div>
        <div class="stat-label">Total Bowls</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgScore.toFixed(2)}</div>
        <div class="stat-label">Avg Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.gamesPlayed}</div>
        <div class="stat-label">Games Played</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.consistency.toFixed(2)}</div>
        <div class="stat-label">Consistency
          <span class="tooltip-trigger" tabindex="0">?
            <span class="tooltip-content">Standard deviation of scores. Lower = more consistent. 0 means every bowl scored the same.</span>
          </span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.clutchAvg.toFixed(2)}</div>
        <div class="stat-label">Clutch
          <span class="tooltip-trigger" tabindex="0">?
            <span class="tooltip-content">Average score in the final 3 ends of each game - measures performance under pressure in close, deciding moments.</span>
          </span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${formIndicator}</div>
        <div class="stat-label">Form
          <span class="tooltip-trigger" tabindex="0">?
            <span class="tooltip-content">Recent performance trend. Compares the most recent game average to the overall average. Rising = improving, Declining = dropping off.</span>
          </span>
        </div>
      </div>
    </div>
    <div class="stat-detail">Position(s): ${positionText}</div>
    <div class="charts-grid">
      <div class="chart-container">
        <h4>Score Trend Across Games</h4>
        <canvas id="scoreTrendChart"></canvas>
      </div>
      <div class="chart-container">
        <h4>Success Rate by Distance</h4>
        <canvas id="distanceSuccessChart"></canvas>
      </div>
      <div class="chart-container">
        <h4>Hand Preference (Backhand vs Forehand)</h4>
        <canvas id="handDistributionChart"></canvas>
      </div>
      <div class="chart-container">
        <h4>Bowl Distance Distribution</h4>
        <canvas id="bowlDistributionChart"></canvas>
      </div>
      <div class="chart-container">
        <h4>Score Distribution</h4>
        <canvas id="scoreDistChart"></canvas>
      </div>
    </div>
  `;
}

function renderPlayerCharts(stats) {
  if (!stats || typeof Chart === 'undefined') return;

  // Score Trend Line Chart
  const trendCtx = document.getElementById('scoreTrendChart');
  if (trendCtx) {
    new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: stats.gamePerformance.map(g => g.gameName),
        datasets: [{
          label: 'Avg Score',
          data: stats.gamePerformance.map(g => g.avgScore.toFixed(2)),
          borderColor: '#2a5298',
          backgroundColor: 'rgba(42, 82, 152, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: '#2a5298'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 4, title: { display: true, text: 'Score' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // Distance Success Rate Bar Chart
  const distCtx = document.getElementById('distanceSuccessChart');
  if (distCtx) {
    const zones = Object.keys(stats.distanceSuccessRates);
    new Chart(distCtx, {
      type: 'bar',
      data: {
        labels: zones,
        datasets: [{
          label: 'Success Rate (%)',
          data: zones.map(z => stats.distanceSuccessRates[z].toFixed(1)),
          backgroundColor: ['#4CAF50', '#FF9800', '#f44336'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100, title: { display: true, text: '%' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // Hand Distribution Chart (Backhand vs Forehand)
  const handCtx = document.getElementById('handDistributionChart');
  if (handCtx) {
    const total = stats.handDistribution.forehand + stats.handDistribution.backhand;
    const fhPct = total > 0 ? ((stats.handDistribution.forehand / total) * 100).toFixed(1) : 0;
    const bhPct = total > 0 ? ((stats.handDistribution.backhand / total) * 100).toFixed(1) : 0;

    new Chart(handCtx, {
      type: 'doughnut',
      data: {
        labels: [`Forehand (${fhPct}%)`, `Backhand (${bhPct}%)`],
        datasets: [{
          data: [stats.handDistribution.forehand, stats.handDistribution.backhand],
          backgroundColor: ['#2a5298', '#f44336']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  // Bowl Distance Distribution Pie Chart
  const distPieCtx = document.getElementById('bowlDistributionChart');
  if (distPieCtx) {
    new Chart(distPieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Short', 'Medium', 'Long'],
        datasets: [{
          data: [stats.bowlDistribution.short, stats.bowlDistribution.medium, stats.bowlDistribution.long],
          backgroundColor: ['#4CAF50', '#FF9800', '#f44336']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  // Score Distribution Bar Chart
  const scoreDistCtx = document.getElementById('scoreDistChart');
  if (scoreDistCtx) {
    new Chart(scoreDistCtx, {
      type: 'bar',
      data: {
        labels: ['0', '1', '2', '3', '4'],
        datasets: [{
          label: 'Count',
          data: [stats.scoreDistribution[0], stats.scoreDistribution[1], stats.scoreDistribution[2], stats.scoreDistribution[3], stats.scoreDistribution[4]],
          backgroundColor: ['#f44336', '#FF9800', '#FFC107', '#8BC34A', '#4CAF50'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Bowls' } } },
        plugins: { legend: { display: false } }
      }
    });
  }
}

async function applyPlayerFilters() {
  const playerSelect = document.getElementById('analyticsPlayerSelect');
  const gameFilter = document.getElementById('analyticsGameFilter');
  if (!playerSelect) return;

  const playerName = playerSelect.value;
  const gameId = gameFilter ? gameFilter.value : 'all';
  const filterGameId = gameId !== 'all' ? gameId : undefined;

  const stats = await getPlayerStats(playerName, filterGameId);
  const content = document.getElementById('playerDashboardContent');
  if (content) {
    // Destroy existing charts
    Object.values(Chart.instances || {}).forEach(instance => instance.destroy());
    content.innerHTML = renderPlayerStatsHTML(stats);
    setTimeout(() => renderPlayerCharts(stats), 100);
  }

  // Show active filters
  const activeFiltersEl = document.getElementById('activeFilters');
  if (activeFiltersEl) {
    if (filterGameId) {
      const gameOption = gameFilter.options[gameFilter.selectedIndex];
      activeFiltersEl.style.display = 'block';
      activeFiltersEl.innerHTML = `Showing: <strong>${playerName}</strong> in <strong>${gameOption.text}</strong>`;
    } else {
      activeFiltersEl.style.display = 'none';
    }
  }
}

async function switchPlayerDashboard(playerName) {
  // Legacy - now uses applyPlayerFilters
  const select = document.getElementById('analyticsPlayerSelect');
  if (select) select.value = playerName;
  await applyPlayerFilters();
}

// ===== TEAM COMPARISON =====

async function renderTeamComparison(container) {
  const players = await getAllPlayerNames();
  if (players.length < 2) {
    container.innerHTML = `
      <div class="analytics-empty">
        <p>Need at least 2 players for comparison.</p>
        <p>Load demo data or track more games.</p>
      </div>`;
    return;
  }

  // Get stats for all players
  const allStats = [];
  for (const p of players) {
    const s = await getPlayerStats(p);
    if (s) allStats.push(s);
  }

  // Sort by avg score desc
  allStats.sort((a, b) => b.avgScore - a.avgScore);

  const selectionThreshold = 2.5;

  container.innerHTML = `
    <div class="comparison-filters">
      <div class="filter-group">
        <label>Filter by Position:</label>
        <select id="comparePositionFilter" onchange="filterComparison()">
          <option value="all">All Positions</option>
          <option value="Lead">Lead</option>
          <option value="Second">Second</option>
          <option value="Third">Third</option>
          <option value="Skip">Skip</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Sort by:</label>
        <select id="compareSortBy" onchange="filterComparison()">
          <option value="avgScore">Avg Score</option>
          <option value="consistency">Consistency</option>
          <option value="clutchAvg">Clutch Performance</option>
          <option value="totalBowls">Experience</option>
        </select>
      </div>
    </div>
    <div id="comparisonTableContainer">
      ${renderComparisonTable(allStats, selectionThreshold)}
    </div>
    <div class="chart-container" style="margin-top: 20px;">
      <h4>Multi-Metric Comparison</h4>
      <canvas id="radarCompareChart"></canvas>
    </div>
    <div class="chart-container" style="margin-top: 20px;">
      <h4>Head-to-Head: Average Scores</h4>
      <canvas id="headToHeadChart"></canvas>
    </div>
  `;

  setTimeout(() => renderComparisonCharts(allStats), 100);
}

function renderComparisonTable(stats, threshold) {
  if (!stats.length) return '';

  return `
    <div class="comparison-table-wrapper">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Position(s)</th>
            <th>Games</th>
            <th>Bowls</th>
            <th>Avg Score</th>
            <th>Consistency
              <span class="tooltip-trigger tooltip-header" tabindex="0">?
                <span class="tooltip-content">Standard deviation of scores. Lower value = more consistent player.</span>
              </span>
            </th>
            <th>Clutch
              <span class="tooltip-trigger tooltip-header" tabindex="0">?
                <span class="tooltip-content">Average score in the final 3 ends of each game.</span>
              </span>
            </th>
            <th>Status
              <span class="tooltip-trigger tooltip-header" tabindex="0">?
                <span class="tooltip-content">Selection recommendation based on average score (2.5+ threshold) and recent form trend (rising/steady/declining).</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          ${stats.map(s => {
            const isRecommended = s.avgScore >= threshold;
            const recentPerf = s.gamePerformance.length >= 2
              ? s.gamePerformance[s.gamePerformance.length - 1]?.avgScore || 0
              : s.avgScore;
            const formDiff = recentPerf - s.avgScore;
            let formIcon = '&#9654;';
            if (formDiff > 0.3) formIcon = '&#9650;';
            else if (formDiff < -0.3) formIcon = '&#9660;';

            return `<tr class="${isRecommended ? 'recommended-row' : ''}">
              <td><strong>${s.playerName}</strong></td>
              <td>${s.positions.join(', ')}</td>
              <td>${s.gamesPlayed}</td>
              <td>${s.totalBowls}</td>
              <td><strong>${s.avgScore.toFixed(2)}</strong></td>
              <td>${s.consistency.toFixed(2)}</td>
              <td>${s.clutchAvg.toFixed(2)}</td>
              <td>${isRecommended ? '<span class="badge-recommended">Recommended</span>' : ''} ${formIcon}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderComparisonCharts(allStats) {
  if (!allStats.length || typeof Chart === 'undefined') return;

  // Take top 4 for radar chart
  const topPlayers = allStats.slice(0, 4);

  // Radar chart
  const radarCtx = document.getElementById('radarCompareChart');
  if (radarCtx) {
    const colors = ['#2a5298', '#4CAF50', '#FF9800', '#f44336'];
    const maxBowls = Math.max(...topPlayers.map(s => s.totalBowls));

    new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: ['Avg Score', 'Consistency', 'Clutch', 'Experience', 'Games'],
        datasets: topPlayers.map((s, i) => ({
          label: s.playerName,
          data: [
            s.avgScore,
            4 - s.consistency, // Invert so lower variance = better
            s.clutchAvg,
            maxBowls > 0 ? (s.totalBowls / maxBowls * 4) : 0,
            s.gamesPlayed
          ],
          borderColor: colors[i],
          backgroundColor: colors[i] + '20',
          pointBackgroundColor: colors[i]
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { r: { beginAtZero: true, max: 4 } },
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  // Head-to-head bar chart
  const h2hCtx = document.getElementById('headToHeadChart');
  if (h2hCtx) {
    const colors = ['#2a5298', '#4CAF50', '#FF9800', '#f44336', '#9C27B0', '#00BCD4'];
    new Chart(h2hCtx, {
      type: 'bar',
      data: {
        labels: allStats.map(s => s.playerName),
        datasets: [{
          label: 'Average Score',
          data: allStats.map(s => s.avgScore.toFixed(2)),
          backgroundColor: allStats.map((_, i) => colors[i % colors.length]),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 4 } },
        plugins: { legend: { display: false } }
      }
    });
  }
}

async function filterComparison() {
  const position = document.getElementById('comparePositionFilter').value;
  const sortBy = document.getElementById('compareSortBy').value;

  const players = await getAllPlayerNames();
  let allStats = [];
  for (const p of players) {
    const s = await getPlayerStats(p);
    if (s) {
      if (position === 'all' || s.positions.includes(position)) {
        allStats.push(s);
      }
    }
  }

  // Sort
  switch (sortBy) {
    case 'avgScore': allStats.sort((a, b) => b.avgScore - a.avgScore); break;
    case 'consistency': allStats.sort((a, b) => a.consistency - b.consistency); break;
    case 'clutchAvg': allStats.sort((a, b) => b.clutchAvg - a.clutchAvg); break;
    case 'totalBowls': allStats.sort((a, b) => b.totalBowls - a.totalBowls); break;
  }

  const tableContainer = document.getElementById('comparisonTableContainer');
  if (tableContainer) {
    tableContainer.innerHTML = renderComparisonTable(allStats, 2.5);
  }

  // Re-render charts
  const radarCanvas = document.getElementById('radarCompareChart');
  const h2hCanvas = document.getElementById('headToHeadChart');
  if (radarCanvas) {
    const existingRadar = Chart.getChart(radarCanvas);
    if (existingRadar) existingRadar.destroy();
  }
  if (h2hCanvas) {
    const existingH2H = Chart.getChart(h2hCanvas);
    if (existingH2H) existingH2H.destroy();
  }
  setTimeout(() => renderComparisonCharts(allStats), 50);
}

// ===== GAME HISTORY =====

async function renderGameHistory(container) {
  const summaries = await getGameSummaries();

  if (summaries.length === 0) {
    container.innerHTML = `
      <div class="analytics-empty">
        <p>No games recorded yet.</p>
        <p>Start tracking games or load demo data.</p>
      </div>`;
    return;
  }

  // Unique formats and tournaments for filters
  const formats = [...new Set(summaries.map(s => s.format))];
  const tournaments = [...new Set(summaries.map(s => s.tournamentName).filter(Boolean))];

  container.innerHTML = `
    <div class="history-filters">
      <div class="filter-group">
        <label>Format:</label>
        <select id="historyFormatFilter" onchange="filterGameHistory()">
          <option value="all">All Formats</option>
          ${formats.map(f => `<option value="${f}">${formatName(f)}</option>`).join('')}
        </select>
      </div>
      ${tournaments.length > 0 ? `
      <div class="filter-group">
        <label>Tournament:</label>
        <select id="historyTournamentFilter" onchange="filterGameHistory()">
          <option value="all">All Tournaments</option>
          ${tournaments.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>` : ''}
    </div>
    <div id="gameHistoryList">
      ${renderGameCards(summaries)}
    </div>
  `;
}

function renderGameCards(summaries) {
  if (summaries.length === 0) return '<div class="analytics-empty">No matching games found.</div>';

  return summaries.map(s => `
    <div class="game-history-card" onclick="showGameDrillDown('${s.id}')">
      <div class="ghc-header">
        <div class="ghc-format">${formatName(s.format)}${s.gameType === 'trial' ? ' <span class="badge-trial">Trial</span>' : ''}</div>
        <div class="ghc-date">${formatDate(s.date)}</div>
      </div>
      <div class="ghc-teams">
        <strong>${s.players.join(', ')}</strong> vs <strong>${s.opponentName}</strong>
      </div>
      ${s.tournamentName ? `<div class="ghc-tournament">${s.tournamentName}</div>` : ''}
      <div class="ghc-stats">
        <div class="ghc-stat">
          <span class="ghc-stat-value">${s.totalEnds}</span>
          <span class="ghc-stat-label">Ends</span>
        </div>
        <div class="ghc-stat">
          <span class="ghc-stat-value">${s.totalBowls}</span>
          <span class="ghc-stat-label">Bowls</span>
        </div>
        <div class="ghc-stat">
          <span class="ghc-stat-value">${s.avgScore.toFixed(1)}</span>
          <span class="ghc-stat-label">Avg Score</span>
        </div>
        <div class="ghc-stat">
          <span class="ghc-stat-value">${s.topPerformer || '-'}</span>
          <span class="ghc-stat-label">Top Player</span>
        </div>
      </div>
      ${s.completed ? '<div class="ghc-badge completed">Completed</div>' : '<div class="ghc-badge in-progress">In Progress</div>'}
    </div>
  `).join('');
}

async function filterGameHistory() {
  const formatFilter = document.getElementById('historyFormatFilter')?.value || 'all';
  const tournamentFilter = document.getElementById('historyTournamentFilter')?.value || 'all';

  let summaries = await getGameSummaries();

  if (formatFilter !== 'all') {
    summaries = summaries.filter(s => s.format === formatFilter);
  }
  if (tournamentFilter !== 'all') {
    summaries = summaries.filter(s => s.tournamentName === tournamentFilter);
  }

  const listContainer = document.getElementById('gameHistoryList');
  if (listContainer) {
    listContainer.innerHTML = renderGameCards(summaries);
  }
}

async function showGameDrillDown(gameId) {
  const game = await getGame(gameId);
  const bowls = await getBowlsByGame(gameId);
  if (!game) return;

  const container = document.getElementById('analyticsContent');
  const yourBowls = bowls.filter(b => b.team === 'yours');
  const totalEnds = game.endCount || game.totalEnds || 21;

  // Player performance in this game
  const playerBreakdown = {};
  yourBowls.forEach(b => {
    const name = b.playerId || b.playerName || b.player;
    if (!playerBreakdown[name]) playerBreakdown[name] = { total: 0, count: 0, bowls: [] };
    playerBreakdown[name].total += (b.scoreValue || b.score || 0);
    playerBreakdown[name].count++;
    playerBreakdown[name].bowls.push(b);
  });

  // End-by-end data
  const endData = [];
  for (let e = 1; e <= totalEnds; e++) {
    const endBowls = yourBowls.filter(b => (b.endNumber || b.end) === e);
    const endScore = endBowls.reduce((s, b) => s + (b.scoreValue || b.score || 0), 0);
    const endCount = endBowls.length;
    endData.push({
      end: e,
      totalScore: endScore,
      avgScore: endCount > 0 ? endScore / endCount : 0,
      bowlCount: endCount,
      notes: game.endNotes?.[e] || ''
    });
  }

  const players = game.players || game.yourPlayers || [];
  const opponentName = (game.opponentPlayers || [])[0] || 'Opponent';
  const playerNames = Object.keys(playerBreakdown);

  container.innerHTML = `
    <div class="drill-down">
      <button class="btn-back" onclick="renderAnalytics('history')">&#8592; Back to History</button>
      <div class="dd-header">
        <h3>${players.join(', ')} vs ${opponentName}</h3>
        <div class="dd-meta">
          <span>${formatName(game.format)}</span>
          <span>${formatDate(game.date)}</span>
          ${game.tournamentName ? `<span>${game.tournamentName}</span>` : ''}
        </div>
      </div>
      ${game.notes || game.gameNotes ? `<div class="dd-notes">${game.notes || game.gameNotes}</div>` : ''}

      <div class="dd-filter-bar">
        <label for="ddPlayerFilter">Filter by Player:</label>
        <select id="ddPlayerFilter" onchange="filterDrillDownByPlayer('${gameId}')">
          <option value="all">All Players</option>
          ${playerNames.map(p => `<option value="${p}">${p}</option>`).join('')}
        </select>
      </div>

      <h4>Player Performance</h4>
      <div class="dd-player-grid" id="ddPlayerGrid">
        ${Object.entries(playerBreakdown).map(([name, data]) => `
          <div class="dd-player-card">
            <div class="dd-player-name">${name}</div>
            <div class="dd-player-stats">
              <div>${data.count} bowls</div>
              <div>Avg: ${(data.total / data.count).toFixed(2)}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <h4>End-by-End Progression</h4>
      <div class="chart-container">
        <canvas id="endProgressionChart"></canvas>
      </div>

      <div class="dd-end-list" id="ddEndList">
        ${endData.map(e => `
          <div class="dd-end-item ${e.bowlCount === 0 ? 'empty' : ''}">
            <div class="dd-end-num">End ${e.end}</div>
            <div class="dd-end-stats">
              <span>${e.bowlCount} bowls</span>
              <span>Total: ${e.totalScore}</span>
              <span>Avg: ${e.avgScore.toFixed(1)}</span>
            </div>
            ${e.notes ? `<div class="dd-end-notes">${e.notes}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  setTimeout(() => renderEndProgressionChart(endData), 100);
}

function renderEndProgressionChart(endData) {
  const ctx = document.getElementById('endProgressionChart');
  if (ctx && typeof Chart !== 'undefined') {
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: endData.map(e => `End ${e.end}`),
        datasets: [{
          label: 'Avg Score per End',
          data: endData.map(e => e.avgScore.toFixed(2)),
          borderColor: '#2a5298',
          backgroundColor: 'rgba(42, 82, 152, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#2a5298'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 4, title: { display: true, text: 'Score' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
}

async function filterDrillDownByPlayer(gameId) {
  const selectedPlayer = document.getElementById('ddPlayerFilter').value;
  const bowls = await getBowlsByGame(gameId);
  const game = await getGame(gameId);
  if (!game) return;

  let yourBowls = bowls.filter(b => b.team === 'yours');
  if (selectedPlayer !== 'all') {
    yourBowls = yourBowls.filter(b => (b.playerId || b.playerName || b.player) === selectedPlayer);
  }

  const totalEnds = game.endCount || game.totalEnds || 21;

  // Rebuild player cards
  const playerBreakdown = {};
  yourBowls.forEach(b => {
    const name = b.playerId || b.playerName || b.player;
    if (!playerBreakdown[name]) playerBreakdown[name] = { total: 0, count: 0, bowls: [] };
    playerBreakdown[name].total += (b.scoreValue || b.score || 0);
    playerBreakdown[name].count++;
    playerBreakdown[name].bowls.push(b);
  });

  const playerGrid = document.getElementById('ddPlayerGrid');
  if (playerGrid) {
    playerGrid.innerHTML = Object.entries(playerBreakdown).map(([name, data]) => {
      // Show hand breakdown for individual player
      const fhCount = data.bowls.filter(b => b.hand === 'forehand').length;
      const bhCount = data.bowls.filter(b => b.hand === 'backhand').length;
      return `
        <div class="dd-player-card">
          <div class="dd-player-name">${name}</div>
          <div class="dd-player-stats">
            <div>${data.count} bowls</div>
            <div>Avg: ${(data.total / data.count).toFixed(2)}</div>
            <div>FH: ${fhCount} | BH: ${bhCount}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Rebuild end-by-end data
  const endData = [];
  for (let e = 1; e <= totalEnds; e++) {
    const endBowls = yourBowls.filter(b => (b.endNumber || b.end) === e);
    const endScore = endBowls.reduce((s, b) => s + (b.scoreValue || b.score || 0), 0);
    const endCount = endBowls.length;
    endData.push({
      end: e,
      totalScore: endScore,
      avgScore: endCount > 0 ? endScore / endCount : 0,
      bowlCount: endCount,
      notes: game.endNotes?.[e] || ''
    });
  }

  const endList = document.getElementById('ddEndList');
  if (endList) {
    endList.innerHTML = endData.map(e => `
      <div class="dd-end-item ${e.bowlCount === 0 ? 'empty' : ''}">
        <div class="dd-end-num">End ${e.end}</div>
        <div class="dd-end-stats">
          <span>${e.bowlCount} bowls</span>
          <span>Total: ${e.totalScore}</span>
          <span>Avg: ${e.avgScore.toFixed(1)}</span>
        </div>
        ${e.notes ? `<div class="dd-end-notes">${e.notes}</div>` : ''}
      </div>
    `).join('');
  }

  // Re-render chart
  const chartCanvas = document.getElementById('endProgressionChart');
  if (chartCanvas) {
    const existing = Chart.getChart(chartCanvas);
    if (existing) existing.destroy();
  }
  setTimeout(() => renderEndProgressionChart(endData), 50);
}

// ===== UTILITY FUNCTIONS =====

function formatName(format) {
  const names = {
    'singles': 'Singles',
    'pairs4': 'Pairs (4 bowls)',
    'pairs3': 'Pairs (3 bowls)',
    'triples3': 'Triples (3 bowls)',
    'triples2': 'Triples (2 bowls)',
    'fours': 'Fours'
  };
  return names[format] || format;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
