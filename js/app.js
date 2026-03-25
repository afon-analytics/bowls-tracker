// BowlsTrack - Main Application Logic
// Multi-tier PoC for lawn bowls performance tracking

let allGames = [];
let currentGameId = 0;
let pendingBowl = null;
let canvas, ctx;
let isDraggingJack = false;
let draggingBowl = null;
let dragOffset = { x: 0, y: 0 };
let currentView = 'home';
let deferredInstallPrompt = null;
let selectedGameType = 'game'; // 'game' or 'trial'
let moveJackMode = false;
let jackInDitchMode = false;
let deadBowlMode = false;
let backEndPendingBowl = null;
let selectedShotType = '';
let selectedQuality = '';
let selectedMatchStructure = 'traditional';
let currentTier = 'essential'; // essential, personal, club, elite
let trendChartInstance = null;
let effectivenessChartInstance = null;

// Check if dashboard sent a navigation target
(function() {
    var navTarget = localStorage.getItem('bowlstrack_navigate_to');
    if (navTarget) {
        localStorage.removeItem('bowlstrack_navigate_to');
        setTimeout(function() {
            if (typeof navigateTo === 'function') {
                navigateTo(navTarget);
            }
        }, 100);
    }
})();

let gameState = {
  gameId: 0,
  tournamentName: '',
  format: 'singles',
  gameType: 'game', // 'game' or 'trial'
  matchStructure: 'traditional', // 'traditional' or 'sets'
  numberOfSets: 2,
  endsPerSet: 7,
  tieBreakEnds: 1,
  currentSet: 1,
  setScores: [], // [{yours: shots, opponent: shots}]
  endScores: [], // [{yours: shots, opponent: shots, end: n}]
  yourPlayers: [],
  opponentPlayers: [],
  awayPlayers: [],
  currentEnd: 1,
  totalEnds: 21,
  currentTeam: 'yours',
  currentPlayerIndex: 0,
  currentHand: 'forehand',
  matLength: 'short',
  jackLength: 'short',
  bowlsPerPlayer: 4,
  playersPerTeam: 1,
  bowls: [],
  endNotes: {},
  gameNotes: '',
  jackPosition: null,
  jackOriginalPosition: null,
  jackMoved: false,
  jackInDitch: false
};

// Scoring lookup table
const scoringTable = {
  'Short-< 0.5 ft': 4, 'Short-0.5 ft - 1 ft': 3, 'Short-1 ft - 2 ft': 2,
  'Short-2 ft - 3 ft': 1, 'Short-> 3 ft': 0,
  'Jack High-< 0.5 ft': 4, 'Jack High-0.5 ft - 1 ft': 3, 'Jack High-1 ft - 2 ft': 2,
  'Jack High-2 ft - 3 ft': 1, 'Jack High-> 3 ft': 0,
  'Past-< 0.5 ft': 4, 'Past-0.5 ft - 1 ft': 4, 'Past-1 ft - 2 ft': 3,
  'Past-2 ft - 3 ft': 2, 'Past-> 3 ft': 1,
  'Other-Score 0': 0, 'Other-Score 1': 1, 'Other-Score 2': 2, 'Other-Score 3': 3, 'Other-Score 4': 4,
  'Bowl off Rink-Bowl off Rink': 0,
  'Draw shot-Very well played': 4, 'Draw shot-Good Effort': 3, 'Draw shot-Average attempt': 2,
  'Draw shot-Below average': 1, 'Draw shot-Completely Ineffective': 0,
  'Weight shot-Very well played': 4, 'Weight shot-Good Effort': 3, 'Weight shot-Average attempt': 2,
  'Weight shot-Below average': 1, 'Weight shot-Completely Ineffective': 0,
  'Draw Positional-Very well played': 4, 'Draw Positional-Good Effort': 3, 'Draw Positional-Average attempt': 2,
  'Draw Positional-Below average': 1, 'Draw Positional-Completely Ineffective': 0,
  'Draw to Respot-Very well played': 4, 'Draw to Respot-Good Effort': 3, 'Draw to Respot-Average attempt': 2,
  'Draw to Respot-Below average': 1, 'Draw to Respot-Completely Ineffective': 0,
  'Draw to Ditch-Very well played': 4, 'Draw to Ditch-Good Effort': 3, 'Draw to Ditch-Average attempt': 2,
  'Draw to Ditch-Below average': 1, 'Draw to Ditch-Completely Ineffective': 0,
  'Blocker-Very well played': 4, 'Blocker-Good Effort': 3, 'Blocker-Average attempt': 2,
  'Blocker-Below average': 1, 'Blocker-Completely Ineffective': 0,
  'No Bowl Thrown-': 0
};

// Back-end shot types and quality options
const SHOT_TYPES = ['Draw shot', 'Weight shot', 'Draw Positional', 'Draw to Respot', 'Draw to Ditch', 'Blocker'];
const QUALITY_OPTIONS = [
  { label: 'Very well played', value: 'Very well played', score: 4 },
  { label: 'Good Effort', value: 'Good Effort', score: 3 },
  { label: 'Average attempt', value: 'Average attempt', score: 2 },
  { label: 'Below average', value: 'Below average', score: 1 },
  { label: 'Completely Ineffective', value: 'Completely Ineffective', score: 0 }
];

// ===== APP INITIALIZATION =====

async function initApp() {
  try {
    // Open IndexedDB
    await openDB();
    console.log('[App] Database ready');

    // Initialize Supabase sync layer (overrides db.js functions)
    if (typeof initSupabaseSync === 'function') {
      initSupabaseSync();
    }

    // Migrate localStorage if needed
    await migrateFromLocalStorage();

    // Check for existing Supabase session
    let sessionResult = null;
    if (typeof checkSession === 'function') {
      try {
        sessionResult = await checkSession();
      } catch (err) {
        console.warn('[App] Session check failed:', err.message);
      }
    }

    if (sessionResult) {
      // Authenticated — pull cloud data, then load
      console.log('[App] Resuming session as', sessionResult.role);
      try { await pullDataFromSupabase(); } catch {}
      try { await processQueue(); } catch {}
    }

    // Load open games from IndexedDB
    await reloadGamesFromDB();

    // Check first time user
    const hasVisited = await getSetting('hasVisited');

    // Register service worker
    registerServiceWorker();

    // Setup PWA install prompt
    setupInstallPrompt();

    // Show appropriate screen
    if (sessionResult) {
      // Already authenticated — show the right view
      showAuthenticatedUI(sessionResult.role);
      if (!hasVisited) {
        showOnboarding();
        await saveSetting('hasVisited', true);
      }
    } else {
      // Show login screen (hide other UI)
      document.getElementById('tierBanner').style.display = 'none';
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('loginScreen').classList.add('active');
      if (!hasVisited) {
        // First visit — they might want to try offline first
        await saveSetting('hasVisited', true);
      }
    }

    console.log('[App] Initialization complete');
  } catch (err) {
    console.error('[App] Init error:', err);
  }
}

async function reloadGamesFromDB() {
  const openGames = await getOpenGames();
  allGames = openGames.map(g => ({
    ...g,
    gameId: g.id,
    yourPlayers: g.players || g.yourPlayers || [],
    bowls: []
  }));

  for (let i = 0; i < allGames.length; i++) {
    const bowls = await getBowlsByGame(allGames[i].id);
    allGames[i].bowls = bowls;
  }

  currentGameId = allGames.length;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('[App] Service worker registered:', reg.scope))
      .catch(err => console.error('[App] SW registration failed:', err));
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const banner = document.getElementById('installBanner');
    if (banner) banner.classList.add('visible');
  });
}

async function installPWA() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;
  console.log('[App] Install result:', result.outcome);
  deferredInstallPrompt = null;
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.remove('visible');
}

function dismissInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.remove('visible');
}

// ===== NAVIGATION =====

function navigateTo(view) {
  // Role-based guard: selectors can only access track, games, and home
  if (typeof userRole !== 'undefined' && userRole === 'selector') {
    const selectorAllowed = ['track', 'games', 'home'];
    if (!selectorAllowed.includes(view)) {
      console.warn('[App] Selector role blocked from view:', view);
      view = 'track';
    }
  }

  currentView = view;

  // Hide all screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navItem) navItem.classList.add('active');

  // Show appropriate screen
  switch (view) {
    case 'home':
      document.getElementById('homeScreen').classList.add('active');
      break;
    case 'track':
      document.getElementById('setupScreen').classList.add('active');
      initSetupScreen();
      break;
    case 'games':
      showGamesManager();
      break;
    case 'analytics':
      document.getElementById('analyticsScreen').classList.add('active');
      renderAnalytics('player');
      setAnalyticsTab('player');
      break;
    case 'manager':
      document.getElementById('managerScreen').classList.add('active');
      initManagerView();
      break;
    case 'elite':
      document.getElementById('eliteScreen').classList.add('active');
      initEliteView();
      break;
    case 'tiers':
      document.getElementById('tiersScreen').classList.add('active');
      updateTierButtons();
      break;
  }

  // Show/hide FAB
  const fab = document.getElementById('fabNewGame');
  if (fab) {
    fab.style.display = (view === 'home' || view === 'games') ? 'flex' : 'none';
  }

  // Scroll to top so the new screen is visible
  window.scrollTo(0, 0);
  const container = document.getElementById('mainContainer');
  if (container) container.scrollTop = 0;
}

function setAnalyticsTab(tab) {
  document.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`.analytics-tab[data-tab="${tab}"]`);
  if (activeTab) activeTab.classList.add('active');
  renderAnalytics(tab);
}

// ===== ONBOARDING =====

let onboardingStep = 0;
const onboardingSteps = [
  {
    title: 'Welcome to Bowls Tracker',
    text: 'Track your lawn bowls performance, analyze player statistics, and make better team selection decisions.',
    icon: '&#127923;'
  },
  {
    title: 'Track Games',
    text: 'Record bowls on an interactive green. Tap to place bowls, drag to adjust positions. Automatic scoring for front-end players.',
    icon: '&#127919;'
  },
  {
    title: 'View Analytics',
    text: 'See player performance dashboards, compare team members side-by-side, and track trends over time.',
    icon: '&#128202;'
  },
  {
    title: 'Export & Share',
    text: 'Export your data as CSV files for spreadsheet analysis. Works completely offline with no internet needed.',
    icon: '&#128229;'
  }
];

function showOnboarding() {
  onboardingStep = 0;
  renderOnboardingStep();
  document.getElementById('onboardingOverlay').classList.add('active');
}

function renderOnboardingStep() {
  const step = onboardingSteps[onboardingStep];
  const card = document.getElementById('onboardingCard');
  const isLast = onboardingStep === onboardingSteps.length - 1;

  card.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 15px;">${step.icon}</div>
    <h2>${step.title}</h2>
    <p>${step.text}</p>
    <div class="onboarding-steps">
      ${onboardingSteps.map((_, i) => `<div class="onboarding-dot ${i === onboardingStep ? 'active' : ''}"></div>`).join('')}
    </div>
    <div class="action-buttons">
      ${isLast ? `
        <button onclick="loadDemoDataAndClose()" class="btn-success">Try Demo Data</button>
        <button onclick="closeOnboarding()">Start Fresh</button>
      ` : `
        <button class="btn-secondary" onclick="closeOnboarding()">Skip</button>
        <button onclick="nextOnboardingStep()">Next</button>
      `}
    </div>
  `;
}

function nextOnboardingStep() {
  if (onboardingStep < onboardingSteps.length - 1) {
    onboardingStep++;
    renderOnboardingStep();
  }
}

async function closeOnboarding() {
  document.getElementById('onboardingOverlay').classList.remove('active');
  await saveSetting('hasVisited', true);
}

async function loadDemoDataAndClose() {
  document.getElementById('onboardingOverlay').classList.remove('active');
  await saveSetting('hasVisited', true);

  const statusEl = document.getElementById('homeStatus');
  if (statusEl) statusEl.textContent = 'Loading demo data...';

  try {
    await generateDemoData();
    invalidateAnalyticsCache();
    if (statusEl) statusEl.textContent = 'Demo data loaded!';
    setTimeout(() => {
      if (statusEl) statusEl.textContent = '';
      navigateTo('analytics');
    }, 1000);
  } catch (err) {
    console.error('[App] Demo data error:', err);
    if (statusEl) statusEl.textContent = 'Error: ' + (err.message || 'Failed to load demo data.');
  }
}

async function handleLoadDemoData() {
  const loaded = await isDemoDataLoaded();
  if (loaded) {
    if (!confirm('Demo data is already loaded. Remove it and reload?')) return;
    await removeDemoData();
    invalidateAnalyticsCache();
  }

  const statusEl = document.getElementById('homeStatus');
  if (statusEl) statusEl.textContent = 'Loading demo data...';

  try {
    await generateDemoData();
    invalidateAnalyticsCache();
    if (statusEl) statusEl.textContent = 'Demo data loaded! View Analytics to explore.';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
  } catch (err) {
    console.error('[App] Demo data error:', err);
    if (statusEl) statusEl.textContent = 'Error: ' + (err.message || 'Failed to load demo data.');
  }
}

// ===== GAME TYPE SELECTION =====

function selectGameType(type) {
  selectedGameType = type;
  const buttons = document.querySelectorAll('#gameTypeGroup .radio-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('active', (idx === 0 && type === 'game') || (idx === 1 && type === 'trial'));
  });

  // Update labels
  const yourLabel = document.getElementById('yourTeamLabel');
  const oppLabel = document.getElementById('opponentTeamLabel');
  if (type === 'trial') {
    if (yourLabel) yourLabel.textContent = 'Home Team';
    if (oppLabel) oppLabel.textContent = 'Away Team';
  } else {
    if (yourLabel) yourLabel.textContent = 'Your Team';
    if (oppLabel) oppLabel.textContent = 'Opponent Team';
  }

  // Show/hide away team player inputs
  updateAwayTeamInputs();
}

function updateAwayTeamInputs() {
  const awayDiv = document.getElementById('awayTeamPlayers');
  if (!awayDiv) return;

  if (selectedGameType === 'trial') {
    awayDiv.style.display = 'block';
    const format = document.getElementById('gameFormat').value;
    const positions = getPositionsForFormat(format);
    awayDiv.innerHTML = '';
    positions.forEach((position, idx) => {
      awayDiv.innerHTML += `
        <div class="form-group">
          <label for="awayPlayer${idx}">${position}</label>
          <input type="text" id="awayPlayer${idx}" placeholder="Enter ${position.toLowerCase()} name">
        </div>
      `;
    });
  } else {
    awayDiv.style.display = 'none';
    awayDiv.innerHTML = '';
  }
}

function getPositionsForFormat(format) {
  const positions = {
    'singles': ['Player'],
    'pairs4': ['Lead', 'Skip'],
    'pairs3': ['Lead', 'Skip'],
    'triples3': ['Lead', 'Second', 'Skip'],
    'triples2': ['Lead', 'Second', 'Skip'],
    'fours': ['Lead', 'Second', 'Third', 'Skip']
  };
  return positions[format] || ['Player'];
}

// ===== SETUP SCREEN INIT =====

function initSetupScreen() {
  // Sync match structure UI with current state
  const endsGroup = document.getElementById('endsGroup');
  const setFormatGroup = document.getElementById('setFormatGroup');

  if (selectedMatchStructure === 'sets') {
    if (endsGroup) endsGroup.style.display = 'none';
    if (setFormatGroup) setFormatGroup.style.display = 'block';
    updateSetFormatPreview();
  } else {
    if (setFormatGroup) setFormatGroup.style.display = 'none';
    updateEndsDropdown();
  }

  // Ensure match structure buttons reflect current state
  const buttons = document.querySelectorAll('#matchStructureGroup .radio-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('active', (idx === 0 && selectedMatchStructure === 'traditional') || (idx === 1 && selectedMatchStructure === 'sets'));
  });
}

// ===== MATCH STRUCTURE =====

function selectMatchStructure(structure) {
  selectedMatchStructure = structure;
  const buttons = document.querySelectorAll('#matchStructureGroup .radio-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('active', (idx === 0 && structure === 'traditional') || (idx === 1 && structure === 'sets'));
  });

  const endsGroup = document.getElementById('endsGroup');
  const setFormatGroup = document.getElementById('setFormatGroup');

  if (structure === 'sets') {
    endsGroup.style.display = 'none';
    setFormatGroup.style.display = 'block';
    updateSetFormatPreview();
  } else {
    setFormatGroup.style.display = 'none';
    updateEndsDropdown();
  }
}

function updateSetFormatPreview() {
  const sets = parseInt(document.getElementById('numberOfSets').value);
  const ends = parseInt(document.getElementById('endsPerSet').value);
  const tb = parseInt(document.getElementById('tieBreakEnds').value);
  const total = sets * ends + tb;
  const preview = document.getElementById('setFormatPreview');
  if (preview) {
    preview.textContent = `Format: ${sets} sets \u00D7 ${ends} ends + ${tb} end tie-break (${total} ends max)`;
  }
}

// Attach listeners for set format dropdowns
document.addEventListener('DOMContentLoaded', () => {
  ['numberOfSets', 'endsPerSet', 'tieBreakEnds'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateSetFormatPreview);
  });
});

// ===== GAME SETUP =====

function updateEndsDropdown() {
  const format = document.getElementById('gameFormat').value;
  const endsGroup = document.getElementById('endsGroup');

  if (selectedMatchStructure === 'sets') {
    endsGroup.style.display = 'none';
  } else if (format !== 'singles') {
    endsGroup.style.display = 'block';
  } else {
    endsGroup.style.display = 'none';
  }

  updatePlayerInputs(format);
  updateAwayTeamInputs();
}

function updatePlayerInputs(format) {
  const playerPositions = getPositionsForFormat(format);
  const yourTeamDiv = document.getElementById('yourTeamPlayers');
  const label = selectedGameType === 'trial' ? 'Home Team' : 'Your Team';
  yourTeamDiv.innerHTML = `<h3 id="yourTeamLabel">${label}</h3>`;
  playerPositions.forEach((position, idx) => {
    yourTeamDiv.innerHTML += `
      <div class="form-group">
        <label for="yourPlayer${idx}">${position}</label>
        <input type="text" id="yourPlayer${idx}" placeholder="Enter ${position.toLowerCase()} name">
      </div>
    `;
  });
}

function getPlayerInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

async function startGame() {
  const format = document.getElementById('gameFormat').value;
  const numberOfEnds = document.getElementById('numberOfEnds').value;
  const opponentTeamName = document.getElementById('opponentTeamName').value;
  const tournamentName = document.getElementById('tournamentName').value;

  if (!opponentTeamName) {
    alert('Please enter opponent team name');
    return;
  }

  const formatMap = {
    'singles': { bowls: 4, players: 1, ends: 21 },
    'pairs4': { bowls: 4, players: 2, ends: parseInt(numberOfEnds) },
    'pairs3': { bowls: 3, players: 2, ends: parseInt(numberOfEnds) },
    'triples3': { bowls: 3, players: 3, ends: parseInt(numberOfEnds) },
    'triples2': { bowls: 2, players: 3, ends: parseInt(numberOfEnds) },
    'fours': { bowls: 2, players: 4, ends: parseInt(numberOfEnds) }
  };

  const config = formatMap[format];
  const yourPlayers = [];

  for (let i = 0; i < config.players; i++) {
    const input = document.getElementById(`yourPlayer${i}`);
    if (!input) {
      alert('Player input field not found. Please try reselecting the game format.');
      return;
    }
    if (!input.value || input.value.trim() === '') {
      alert('Please enter all player names for your team');
      return;
    }
    yourPlayers.push(input.value.trim());
  }

  // For trial mode, collect away team players
  let awayPlayers = [];
  if (selectedGameType === 'trial') {
    for (let i = 0; i < config.players; i++) {
      const input = document.getElementById(`awayPlayer${i}`);
      if (!input || !input.value || input.value.trim() === '') {
        alert('Please enter all player names for the away team');
        return;
      }
      awayPlayers.push(input.value.trim());
    }
  }

  const gameId = generateId();

  // Calculate total ends based on match structure
  let totalEnds = config.ends;
  let matchStructure = selectedMatchStructure;
  let numberOfSets = 2;
  let endsPerSet = 7;
  let tieBreakEnds = 1;

  if (matchStructure === 'sets') {
    numberOfSets = parseInt(document.getElementById('numberOfSets').value);
    endsPerSet = parseInt(document.getElementById('endsPerSet').value);
    tieBreakEnds = parseInt(document.getElementById('tieBreakEnds').value);
    totalEnds = numberOfSets * endsPerSet + tieBreakEnds;
  }

  gameState = {
    gameId: gameId,
    id: gameId,
    tournamentName: tournamentName,
    format: format,
    gameType: selectedGameType,
    matchStructure: matchStructure,
    numberOfSets: numberOfSets,
    endsPerSet: endsPerSet,
    tieBreakEnds: tieBreakEnds,
    currentSet: 1,
    setScores: [],
    endScores: [],
    yourPlayers: yourPlayers,
    players: yourPlayers,
    opponentPlayers: [opponentTeamName],
    awayPlayers: awayPlayers,
    bowlsPerPlayer: config.bowls,
    playersPerTeam: config.players,
    totalEnds: totalEnds,
    endCount: totalEnds,
    currentEnd: 1,
    currentPlayerIndex: 0,
    currentTeam: 'yours',
    currentHand: 'forehand',
    matLength: 'short',
    jackLength: 'short',
    bowls: [],
    endNotes: {},
    gameNotes: '',
    jackPosition: { x: 250, y: 250 },
    jackOriginalPosition: null,
    jackMoved: false,
    jackInDitch: false,
    completed: false,
    date: new Date().toISOString()
  };

  // Save to IndexedDB
  await saveGame(gameState);

  allGames.push(gameState);
  currentGameId = allGames.length;

  // Show game screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('gameScreen').classList.add('active');

  // Reset per-team player tracking for new game
  lastPlayerIndexByTeam = { yours: 0, opponent: 0 };
  createPlayerButtons();

  // Update team labels for trial mode
  updateTeamLabels();

  initCanvas();
  updateDisplay();
}

function updateTeamLabels() {
  const teamBtns = document.querySelectorAll('#teamGroup .radio-btn');
  if (gameState.gameType === 'trial') {
    if (teamBtns[0]) teamBtns[0].textContent = 'Home';
    if (teamBtns[1]) teamBtns[1].textContent = 'Away';
  } else {
    if (teamBtns[0]) teamBtns[0].textContent = 'Yours';
    if (teamBtns[1]) teamBtns[1].textContent = 'Opponent';
  }
}

function createPlayerButtons() {
  const positions = getPositionsForFormat(gameState.format);
  const playerButtonsDiv = document.getElementById('playerButtonsInline');
  const playerSelectorDiv = document.getElementById('playerSelectorInline');
  if (!playerButtonsDiv || !playerSelectorDiv) return;

  playerButtonsDiv.innerHTML = '';

  // Determine which players to show based on team
  const isTrialAway = gameState.gameType === 'trial' && gameState.currentTeam === 'opponent';
  const players = isTrialAway ? gameState.awayPlayers : gameState.yourPlayers;
  const count = isTrialAway ? gameState.awayPlayers.length : gameState.playersPerTeam;

  for (let i = 0; i < count; i++) {
    const btn = document.createElement('div');
    btn.className = 'radio-btn' + (i === gameState.currentPlayerIndex ? ' active' : '');
    btn.textContent = positions[i] || `Player ${i + 1}`;
    btn.onclick = () => selectPlayer(i);
    playerButtonsDiv.appendChild(btn);
  }

  // Show/hide player selector based on number of players
  if (count > 1 || gameState.gameType === 'trial') {
    playerSelectorDiv.style.display = 'block';
  } else {
    playerSelectorDiv.style.display = 'none';
  }
}

function selectPlayer(index) {
  gameState.currentPlayerIndex = index;
  // Update per-team tracking
  lastPlayerIndexByTeam[gameState.currentTeam] = index;
  const buttons = document.querySelectorAll('#playerButtonsInline .radio-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('active', idx === index);
  });
  updateDisplay();
}

// ===== CANVAS & DRAWING =====

function initCanvas() {
  canvas = document.getElementById('greenCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = 500;
  canvas.height = 500;

  if (!gameState.jackPosition) {
    gameState.jackPosition = { x: 250, y: 250 };
  }

  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd);

  // Reset jack modes
  moveJackMode = false;
  jackInDitchMode = false;
  updateJackButtonStates();

  // Reset zoom and setup gestures
  canvasZoom = 1;
  canvasPanX = 0;
  canvasPanY = 0;
  if (canvas) canvas.style.transform = '';
  setupZoomGestures();

  drawGreen();
}

function drawGreen() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw ditch area
  const ditchHeight = 30;
  if (gameState.jackLength === 'long' || gameState.jackInDitch) {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, canvas.height - ditchHeight, canvas.width, ditchHeight);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DITCH', canvas.width / 2, canvas.height - 12);
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxRadius = Math.min(canvas.width, canvas.height) / 2 - 10;

  for (let i = 5; i >= 1; i--) {
    const radius = (maxRadius / 5) * i;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#1a3810';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#4a7035';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${i}ft`, centerX, centerY - radius + 15);
  }

  // Draw jack
  if (gameState.jackPosition) {
    drawJack(gameState.jackPosition.x, gameState.jackPosition.y);
  }

  // Draw bowls for current end
  const currentEndBowls = gameState.bowls.filter(b => b.end === gameState.currentEnd);
  currentEndBowls.forEach(bowl => drawBowl(bowl));

  // Draw move jack mode indicator
  if (moveJackMode) {
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TAP TO PLACE JACK', canvas.width / 2, 25);
  }

  // Draw dead bowl mode indicator
  if (deadBowlMode) {
    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(244, 67, 54, 0.85)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TAP A BOWL TO MARK DEAD', canvas.width / 2, 25);
  }
}

function drawJack(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, 2 * Math.PI);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
  ctx.strokeStyle = gameState.jackInDitch ? '#8B4513' : '#FFA500';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Mark if jack has been moved
  if (gameState.jackMoved) {
    ctx.fillStyle = '#FFA500';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', x, y);
  }
}

function drawBowl(bowl) {
  const isYours = bowl.team === 'yours';
  const isTrialMode = gameState.gameType === 'trial';
  const isDead = bowl.isDead;

  ctx.save();

  if (isDead) {
    ctx.globalAlpha = 0.35;
  }

  ctx.beginPath();
  ctx.arc(bowl.x, bowl.y, 18, 0, 2 * Math.PI);

  if (isDead) {
    ctx.fillStyle = '#999';
  } else if (isTrialMode) {
    ctx.fillStyle = isYours ? '#4CAF50' : '#2196F3';
  } else {
    ctx.fillStyle = isYours ? '#4CAF50' : '#f44336';
  }
  ctx.fill();

  // Hand indicator via border color
  const isForehand = bowl.hand === 'forehand';
  if (isDead) {
    ctx.strokeStyle = '#666';
    ctx.setLineDash([4, 3]);
  } else {
    ctx.strokeStyle = isForehand ? '#1B5E20' : '#B71C1C';
  }
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);

  // Display player initials
  const initials = getPlayerInitials(bowl.player);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, bowl.x, bowl.y);

  // Dead bowl X marker
  if (isDead) {
    ctx.strokeStyle = '#C62828';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bowl.x - 8, bowl.y - 8);
    ctx.lineTo(bowl.x + 8, bowl.y + 8);
    ctx.moveTo(bowl.x + 8, bowl.y - 8);
    ctx.lineTo(bowl.x - 8, bowl.y + 8);
    ctx.stroke();
  }

  ctx.restore();
}

function getCanvasCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  let clientX, clientY;
  if (e.touches) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function isNearJack(x, y) {
  const dx = x - gameState.jackPosition.x;
  const dy = y - gameState.jackPosition.y;
  return Math.sqrt(dx * dx + dy * dy) < 15;
}

function isNearBowl(x, y, bowl) {
  const dx = x - bowl.x;
  const dy = y - bowl.y;
  return Math.sqrt(dx * dx + dy * dy) < 20;
}

function constrainToCanvas(x, y, margin = 20) {
  return {
    x: Math.max(margin, Math.min(canvas.width - margin, x)),
    y: Math.max(margin, Math.min(canvas.height - margin, y))
  };
}

function handleMouseDown(e) {
  if (moveJackMode) return; // In move jack mode, use click instead

  const coords = getCanvasCoordinates(e);

  // Dead bowl mode: handle directly on mousedown/touchstart so it works on touch devices
  // (touch preventDefault in drag logic would otherwise suppress the click event)
  if (deadBowlMode) {
    const currentEndBowls = gameState.bowls.filter(b => b.end === gameState.currentEnd);
    for (let bowl of currentEndBowls) {
      if (isNearBowl(coords.x, coords.y, bowl)) {
        bowl.isDead = !bowl.isDead;
        if (bowl.isDead) {
          bowl.scoreValue = 0;
        }
        deadBowlMode = false;
        const btn = document.getElementById('deadBowlBtn');
        if (btn) { btn.classList.remove('btn-active'); btn.textContent = 'Dead Bowl'; }
        document.getElementById('deadBowlLegend').style.display = 'flex';
        persistCurrentGame();
        drawGreen();
        updateDisplay();
        e.preventDefault();
        return;
      }
    }
    // Tapped canvas but not near a bowl - keep dead bowl mode active
    e.preventDefault();
    return;
  }

  if (isNearJack(coords.x, coords.y)) {
    isDraggingJack = true;
    e.preventDefault();
    return;
  }

  const currentEndBowls = gameState.bowls.filter(b => b.end === gameState.currentEnd);
  for (let bowl of currentEndBowls) {
    if (isNearBowl(coords.x, coords.y, bowl)) {
      draggingBowl = bowl;
      dragOffset = { x: bowl.x - coords.x, y: bowl.y - coords.y };
      e.preventDefault();
      return;
    }
  }
}

function handleMouseMove(e) {
  if (isDraggingJack) {
    const coords = getCanvasCoordinates(e);
    const constrained = constrainToCanvas(coords.x, coords.y, 15);
    gameState.jackPosition = constrained;
    persistCurrentGame();
    drawGreen();
    e.preventDefault();
  } else if (draggingBowl) {
    const coords = getCanvasCoordinates(e);
    const newPos = constrainToCanvas(coords.x + dragOffset.x, coords.y + dragOffset.y, 20);

    draggingBowl.x = newPos.x;
    draggingBowl.y = newPos.y;

    const distanceFromJack = calculateDistance(newPos.x, newPos.y, gameState.jackPosition.x, gameState.jackPosition.y);
    const distanceInFeet = pixelsToFeet(distanceFromJack);

    const jackY = gameState.jackPosition.y;
    const bowlY = newPos.y;
    let resultCategory = bowlY < jackY - 10 ? 'Short' : Math.abs(bowlY - jackY) <= 10 ? 'Jack High' : 'Past';
    let distanceCategory = getDistanceCategory(distanceInFeet);

    draggingBowl.resultCategory = resultCategory;
    draggingBowl.distanceCategory = distanceCategory;
    draggingBowl.distanceInFeet = distanceInFeet;

    if (draggingBowl.team === 'yours' && draggingBowl.scoreCategory) {
      const autoScore = calculateFrontEndScore(resultCategory, distanceCategory);
      draggingBowl.scoreValue = autoScore;
      draggingBowl.scoreCategory = resultCategory;
      draggingBowl.scoreDetail = distanceCategory;
    }

    persistCurrentGame();
    drawGreen();
    e.preventDefault();
  }
}

function handleMouseUp() {
  isDraggingJack = false;
  draggingBowl = null;
}

function handleTouchStart(e) { handleMouseDown(e); }
function handleTouchMove(e) { handleMouseMove(e); }
function handleTouchEnd() { handleMouseUp(); }

function handleCanvasClick(e) {
  if (isDraggingJack || draggingBowl) return;

  const coords = getCanvasCoordinates(e);

  // Move Jack Mode - reposition the jack
  if (moveJackMode) {
    const constrained = constrainToCanvas(coords.x, coords.y, 15);
    if (!gameState.jackOriginalPosition) {
      gameState.jackOriginalPosition = { ...gameState.jackPosition };
    }
    gameState.jackPosition = constrained;
    gameState.jackMoved = true;
    moveJackMode = false;
    updateJackButtonStates();
    persistCurrentGame();
    drawGreen();
    return;
  }

  if (isNearJack(coords.x, coords.y)) return;

  // Dead bowl mode - mark nearest bowl as dead
  if (deadBowlMode) {
    const currentEndBowls = gameState.bowls.filter(b => b.end === gameState.currentEnd);
    for (let bowl of currentEndBowls) {
      if (isNearBowl(coords.x, coords.y, bowl)) {
        bowl.isDead = !bowl.isDead;
        if (bowl.isDead) {
          bowl.scoreValue = 0;
        }
        deadBowlMode = false;
        const btn = document.getElementById('deadBowlBtn');
        if (btn) { btn.classList.remove('btn-active'); btn.textContent = 'Dead Bowl'; }
        persistCurrentGame();
        drawGreen();
        updateDisplay();
        return;
      }
    }
    return;
  }

  const currentEndBowls = gameState.bowls.filter(b => b.end === gameState.currentEnd);
  for (let bowl of currentEndBowls) {
    if (isNearBowl(coords.x, coords.y, bowl)) return;
  }

  const bowlsThisEnd = gameState.bowls.filter(b => b.end === gameState.currentEnd).length;
  const maxBowlsPerEnd = gameState.bowlsPerPlayer * gameState.playersPerTeam * 2;

  if (bowlsThisEnd >= maxBowlsPerEnd) {
    alert(`Maximum ${maxBowlsPerEnd} bowls reached for this end. Click "End Notes & Next End" to continue.`);
    return;
  }

  // Determine current player name
  let currentPlayerName;
  if (gameState.currentTeam === 'yours') {
    currentPlayerName = gameState.yourPlayers[gameState.currentPlayerIndex];
  } else if (gameState.gameType === 'trial') {
    currentPlayerName = gameState.awayPlayers[gameState.currentPlayerIndex] || gameState.opponentPlayers[0];
  } else {
    currentPlayerName = gameState.opponentPlayers[0];
  }

  const distanceFromJack = calculateDistance(coords.x, coords.y, gameState.jackPosition.x, gameState.jackPosition.y);
  const distanceInFeet = pixelsToFeet(distanceFromJack);

  const jackY = gameState.jackPosition.y;
  const bowlY = coords.y;
  let resultCategory = bowlY < jackY - 10 ? 'Short' : Math.abs(bowlY - jackY) <= 10 ? 'Jack High' : 'Past';
  let distanceCategory = getDistanceCategory(distanceInFeet);

  const quickNotes = document.getElementById('quickBowlNotes').value;

  const bowl = {
    x: coords.x, y: coords.y,
    team: gameState.currentTeam,
    hand: gameState.currentHand,
    matLength: gameState.matLength,
    jackLength: gameState.jackLength,
    end: gameState.currentEnd,
    player: currentPlayerName,
    playerIndex: gameState.currentPlayerIndex,
    notes: quickNotes,
    resultCategory, distanceCategory, distanceInFeet,
    scoreCategory: '', scoreDetail: '', scoreValue: 0
  };

  if (distanceInFeet > 5) {
    pendingBowl = bowl;
    showOffRinkModal();
  } else {
    const shouldTrack = gameState.currentTeam === 'yours' || gameState.gameType === 'trial';

    if (shouldTrack) {
      const positions = getPositionsForFormat(gameState.format);
      const currentPosition = positions[gameState.currentPlayerIndex];
      const isFrontEnd = currentPosition === 'Lead' || currentPosition === 'Second';
      const isBackEnd = currentPosition === 'Third' || currentPosition === 'Skip';

      if (isFrontEnd) {
        const autoScore = calculateFrontEndScore(bowl.resultCategory, bowl.distanceCategory);
        bowl.scoreCategory = bowl.resultCategory;
        bowl.scoreDetail = bowl.distanceCategory;
        bowl.scoreValue = autoScore;
      } else if (isBackEnd) {
        // Show scoring popup for Third & Skip
        backEndPendingBowl = bowl;
        showBackEndScoringModal(currentPlayerName, currentPosition);
        return; // Don't add bowl yet - wait for scoring
      }
    }

    addBowlToGame(bowl);
  }
}

function addBowlToGame(bowl) {
  gameState.bowls.push(bowl);
  document.getElementById('quickBowlNotes').value = '';

  const shouldAdvance = gameState.currentTeam === 'yours' || gameState.gameType === 'trial';
  if (shouldAdvance) {
    advanceToNextPlayer();
  }

  persistCurrentGame();
  drawGreen();
  updateDisplay();
}

// ===== JACK MOVEMENT =====

function toggleMoveJackMode() {
  moveJackMode = !moveJackMode;
  updateJackButtonStates();
  drawGreen();
}

function toggleJackInDitch() {
  gameState.jackInDitch = !gameState.jackInDitch;

  if (gameState.jackInDitch) {
    // Move jack to ditch area
    if (!gameState.jackOriginalPosition && !gameState.jackMoved) {
      gameState.jackOriginalPosition = { ...gameState.jackPosition };
    }
    gameState.jackPosition = { x: gameState.jackPosition.x, y: canvas.height - 15 };
    gameState.jackMoved = true;
  }

  updateJackButtonStates();
  persistCurrentGame();
  drawGreen();
}

function updateJackButtonStates() {
  const moveBtn = document.getElementById('moveJackBtn');
  const ditchBtn = document.getElementById('jackInDitchBtn');

  if (moveBtn) {
    moveBtn.classList.toggle('btn-active', moveJackMode);
    moveBtn.textContent = moveJackMode ? 'Tap Green...' : 'Move Jack';
  }
  if (ditchBtn) {
    ditchBtn.classList.toggle('btn-active', gameState.jackInDitch);
    ditchBtn.textContent = gameState.jackInDitch ? 'Jack on Green' : 'Jack in Ditch';
  }
}

// ===== BACK-END SCORING (Third & Skip) =====

function showBackEndScoringModal(playerName, position) {
  selectedShotType = '';
  selectedQuality = '';

  document.getElementById('backEndScoringTitle').textContent = `Score ${position}'s Bowl`;
  document.getElementById('backEndScoringPlayer').textContent = playerName;

  // Render shot type options
  const shotTypeDiv = document.getElementById('shotTypeOptions');
  shotTypeDiv.innerHTML = SHOT_TYPES.map(type =>
    `<div class="scoring-btn" onclick="selectShotType(this, '${type}')">${type}</div>`
  ).join('');

  // Render quality options
  const qualityDiv = document.getElementById('qualityOptions');
  qualityDiv.innerHTML = QUALITY_OPTIONS.map(q =>
    `<div class="scoring-btn" onclick="selectQualityOption(this, '${q.value}', ${q.score})">${q.label} (${q.score})</div>`
  ).join('');

  document.getElementById('backEndScoringModal').classList.add('active');
}

function selectShotType(el, type) {
  selectedShotType = type;
  document.querySelectorAll('#shotTypeOptions .scoring-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function selectQualityOption(el, value, score) {
  selectedQuality = value;
  document.querySelectorAll('#qualityOptions .scoring-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function confirmBackEndScore() {
  if (!backEndPendingBowl) return;

  if (selectedShotType && selectedQuality) {
    const key = selectedShotType + '-' + selectedQuality;
    backEndPendingBowl.scoreCategory = selectedShotType;
    backEndPendingBowl.scoreDetail = selectedQuality;
    backEndPendingBowl.scoreValue = scoringTable[key] || 0;
  }

  document.getElementById('backEndScoringModal').classList.remove('active');
  addBowlToGame(backEndPendingBowl);
  backEndPendingBowl = null;
}

function skipBackEndScore() {
  if (!backEndPendingBowl) return;
  document.getElementById('backEndScoringModal').classList.remove('active');
  addBowlToGame(backEndPendingBowl);
  backEndPendingBowl = null;
}

// ===== GAME LOGIC HELPERS =====

function getDistanceCategory(distanceInFeet) {
  if (distanceInFeet < 0.5) return '< 0.5 ft';
  if (distanceInFeet < 1) return '0.5 ft - 1 ft';
  if (distanceInFeet < 2) return '1 ft - 2 ft';
  if (distanceInFeet < 3) return '2 ft - 3 ft';
  return '> 3 ft';
}

function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function pixelsToFeet(pixels) {
  return pixels / 100;
}

function calculateFrontEndScore(resultCategory, distanceCategory) {
  const key = resultCategory + '-' + distanceCategory;
  return scoringTable[key] || 0;
}

function advanceToNextPlayer() {
  const team = gameState.currentTeam;
  const maxPlayers = gameState.gameType === 'trial' && team === 'opponent'
    ? gameState.awayPlayers.length
    : gameState.playersPerTeam;

  const currentPlayerBowls = gameState.bowls.filter(b =>
    b.end === gameState.currentEnd &&
    b.team === team &&
    b.playerIndex === gameState.currentPlayerIndex
  ).length;

  if (currentPlayerBowls >= gameState.bowlsPerPlayer) {
    let nextPlayerIndex = (gameState.currentPlayerIndex + 1) % maxPlayers;
    let attempts = 0;

    while (attempts < maxPlayers) {
      const nextPlayerBowls = gameState.bowls.filter(b =>
        b.end === gameState.currentEnd &&
        b.team === team &&
        b.playerIndex === nextPlayerIndex
      ).length;

      if (nextPlayerBowls < gameState.bowlsPerPlayer) {
        gameState.currentPlayerIndex = nextPlayerIndex;
        lastPlayerIndexByTeam[gameState.currentTeam] = nextPlayerIndex;
        const buttons = document.querySelectorAll('#playerButtonsInline .radio-btn');
        buttons.forEach((btn, idx) => {
          btn.classList.toggle('active', idx === nextPlayerIndex);
        });
        break;
      }

      nextPlayerIndex = (nextPlayerIndex + 1) % maxPlayers;
      attempts++;
    }
  }
}

// ===== PERSISTENCE =====

async function persistCurrentGame() {
  // Update in-memory array
  const index = allGames.findIndex(g => (g.gameId || g.id) === (gameState.gameId || gameState.id));
  if (index !== -1) {
    allGames[index] = JSON.parse(JSON.stringify(gameState));
  }

  // Save game to IndexedDB (without bowls - they're stored separately)
  const gameToSave = { ...gameState, id: gameState.gameId || gameState.id };
  delete gameToSave.bowls;
  try {
    await saveGame(gameToSave);

    // Save bowls
    const bowlsWithIds = gameState.bowls.map(b => ({
      ...b,
      id: b.id || generateId(),
      gameId: gameState.gameId || gameState.id,
      playerId: b.team === 'yours' ? b.player : (gameState.gameType === 'trial' ? b.player : 'opponent'),
      playerName: b.player,
      endNumber: b.end,
      distance: b.distanceInFeet,
      direction: b.resultCategory,
      score: b.scoreValue,
      timestamp: b.timestamp || new Date().toISOString()
    }));
    if (bowlsWithIds.length > 0) {
      await saveBowlsBatch(bowlsWithIds);
    }
  } catch (err) {
    console.error('[App] Persist error:', err);
  }
}

function saveCurrentGame() {
  // Legacy sync function - calls async version
  persistCurrentGame();
}

// ===== GAME MANAGEMENT SCREENS =====

function showGamesManager() {
  if (gameState.gameId !== undefined) {
    saveCurrentGame();
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('gamesManagerScreen').classList.add('active');

  const gamesList = document.getElementById('gamesList');
  gamesList.innerHTML = '';

  if (allGames.length === 0) {
    gamesList.innerHTML = '<div class="no-games">No open games. Start a new game to begin.</div>';
  } else {
    allGames.forEach((game, idx) => {
      const yourTeam = (game.yourPlayers || game.players || []).join(', ');
      const oppTeam = (game.opponentPlayers || [])[0] || 'Unknown';
      const tournament = game.tournamentName
        ? `<div style="font-size: 12px; color: #999; margin-top: 4px;">${game.tournamentName}</div>`
        : '';
      const typeLabel = game.gameType === 'trial' ? ' <span class="badge-trial">Trial</span>' : '';

      const card = document.createElement('div');
      card.className = 'game-card';
      card.onclick = () => loadGame(idx);
      card.innerHTML = `
        <div class="game-card-title">${yourTeam} vs ${oppTeam}${typeLabel}</div>
        ${tournament}
        <div class="game-card-info">End ${game.currentEnd} of ${game.totalEnds || game.endCount} &bull; ${(game.bowls || []).length} bowls recorded</div>
      `;
      gamesList.appendChild(card);
    });
  }
}

function loadGame(gameIndex) {
  gameState = JSON.parse(JSON.stringify(allGames[gameIndex]));

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('gameScreen').classList.add('active');

  lastPlayerIndexByTeam = { yours: gameState.currentPlayerIndex || 0, opponent: 0 };
  createPlayerButtons();

  updateTeamLabels();
  initCanvas();
  updateDisplay();
}

function showSetupScreen() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('setupScreen').classList.add('active');

  document.getElementById('gameFormat').value = 'singles';
  document.getElementById('opponentTeamName').value = '';
  document.getElementById('tournamentName').value = '';
  selectedGameType = 'game';
  selectGameType('game');
  updateEndsDropdown();
}

function returnToCurrentGame() {
  if (gameState.gameId === undefined) {
    alert('No active game. Please start or select a game.');
    return;
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('gameScreen').classList.add('active');
}

// ===== MODALS =====

function showOffRinkModal() {
  const modal = document.getElementById('bowlScoringModal');
  const scoringOptions = document.getElementById('scoringOptions');

  scoringOptions.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <h3 style="color: var(--primary); margin-bottom: 15px;">Bowl appears to be off the rink</h3>
      <p style="color: var(--text-secondary); margin-bottom: 20px;">Distance: ${pendingBowl.distanceInFeet.toFixed(2)} ft from jack</p>
      <div class="scoring-options">
        <div class="scoring-btn" onclick="confirmOffRink()">Bowl Off Rink</div>
        <div class="scoring-btn" onclick="confirmOnRink()">Bowl On Rink</div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function confirmOffRink() {
  if (!pendingBowl) return;
  pendingBowl.scoreCategory = 'Bowl off Rink';
  pendingBowl.scoreDetail = 'Bowl off Rink';
  pendingBowl.scoreValue = 0;
  pendingBowl.resultCategory = 'Off Rink';

  gameState.bowls.push(pendingBowl);
  pendingBowl = null;
  document.getElementById('quickBowlNotes').value = '';

  if (gameState.currentTeam === 'yours' || gameState.gameType === 'trial') advanceToNextPlayer();

  persistCurrentGame();
  closeBowlScoringModal();
  drawGreen();
  updateDisplay();
}

function confirmOnRink() {
  if (!pendingBowl) return;

  const shouldTrack = gameState.currentTeam === 'yours' || gameState.gameType === 'trial';

  if (shouldTrack) {
    const positions = getPositionsForFormat(gameState.format);
    const currentPosition = positions[gameState.currentPlayerIndex];
    const isFrontEnd = currentPosition === 'Lead' || currentPosition === 'Second';

    if (isFrontEnd) {
      const autoScore = calculateFrontEndScore(pendingBowl.resultCategory, pendingBowl.distanceCategory);
      pendingBowl.scoreCategory = pendingBowl.resultCategory;
      pendingBowl.scoreDetail = pendingBowl.distanceCategory;
      pendingBowl.scoreValue = autoScore;
    }
  }

  gameState.bowls.push(pendingBowl);
  pendingBowl = null;
  document.getElementById('quickBowlNotes').value = '';

  if (shouldTrack) advanceToNextPlayer();

  persistCurrentGame();
  closeBowlScoringModal();
  drawGreen();
  updateDisplay();
}

function saveBowlScore() {
  // Save bowl score from the modal (used by off-rink flow)
  closeBowlScoringModal();
}

function closeBowlScoringModal() {
  document.getElementById('bowlScoringModal').classList.remove('active');
  document.getElementById('bowlNotes').value = '';
  pendingBowl = null;
}

function showEndNotes() {
  const bowlsThisEnd = gameState.bowls.filter(b => b.end === gameState.currentEnd).length;
  const maxBowlsPerEnd = gameState.bowlsPerPlayer * gameState.playersPerTeam * 2;

  if (bowlsThisEnd < maxBowlsPerEnd) {
    if (!confirm(`Only ${bowlsThisEnd} of ${maxBowlsPerEnd} bowls recorded for this end. Continue to next end?`)) {
      return;
    }
  }

  document.getElementById('endNotesNumber').textContent = gameState.currentEnd;
  document.getElementById('endNotes').value = gameState.endNotes[gameState.currentEnd] || '';

  // Show end score summary
  const endScore = calculateEndScore(gameState.currentEnd);
  const summaryEl = document.getElementById('endScoreSummary');
  if (summaryEl) {
    const totalScore = calculateGameScore();
    let setInfo = '';
    if (gameState.matchStructure === 'sets') {
      setInfo = ` | Set ${gameState.currentSet || 1}`;
    }
    summaryEl.innerHTML = `
      <div style="font-size: 20px; font-weight: 700; color: var(--primary);">
        End Score: ${endScore.yours} - ${endScore.opponent}
      </div>
      <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
        Total: ${totalScore.yours} - ${totalScore.opponent}${setInfo}
      </div>
    `;
  }

  // Pre-populate shots for/against from existing end data or default to 0
  const existingEndData = gameState.endScoresManual ? gameState.endScoresManual[gameState.currentEnd] : null;
  document.getElementById('endShotsFor').value = existingEndData ? existingEndData.shotsFor : '';
  document.getElementById('endShotsAgainst').value = existingEndData ? existingEndData.shotsAgainst : '';

  document.getElementById('endNotesModal').classList.add('active');
}

function saveEndNotes() {
  gameState.endNotes[gameState.currentEnd] = document.getElementById('endNotes').value;

  // Save shots for/against
  const shotsFor = parseInt(document.getElementById('endShotsFor').value) || 0;
  const shotsAgainst = parseInt(document.getElementById('endShotsAgainst').value) || 0;
  if (!gameState.endScoresManual) gameState.endScoresManual = {};
  gameState.endScoresManual[gameState.currentEnd] = { shotsFor, shotsAgainst };

  document.getElementById('endNotesModal').classList.remove('active');
  nextEnd();
}

function showEndGameDialog() {
  const yourTeam = gameState.yourPlayers.join(', ');
  const oppTeam = gameState.opponentPlayers[0];
  document.getElementById('endGameSummary').textContent =
    `${yourTeam} vs ${oppTeam} - End ${gameState.currentEnd} of ${gameState.totalEnds}`;
  document.getElementById('gameNotes').value = gameState.gameNotes || '';
  document.getElementById('endGameModal').classList.add('active');
}

async function confirmEndGame() {
  gameState.gameNotes = document.getElementById('gameNotes').value;
  gameState.completed = true;
  await persistCurrentGame();
  invalidateAnalyticsCache();
  document.getElementById('endGameModal').classList.remove('active');
  showGamesManager();
}

function closeEndGameModal() {
  document.getElementById('endGameModal').classList.remove('active');
}

// ===== CONTROLS =====

// Track last selected player index per team so switching doesn't reset to Lead
let lastPlayerIndexByTeam = { yours: 0, opponent: 0 };

function selectTeam(team) {
  // Save current player index for the team we're leaving
  lastPlayerIndexByTeam[gameState.currentTeam] = gameState.currentPlayerIndex;

  gameState.currentTeam = team;
  // Restore last selected player index for the team we're switching to
  gameState.currentPlayerIndex = lastPlayerIndexByTeam[team] || 0;

  const buttons = document.querySelectorAll('#teamGroup .radio-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('active', (idx === 0 && team === 'yours') || (idx === 1 && team === 'opponent'));
  });

  // Rebuild player buttons (different players per team in trial, and to restore active state)
  if (gameState.playersPerTeam > 1 || gameState.gameType === 'trial') {
    createPlayerButtons();
  }

  updateDisplay();
}

function selectHand(hand) {
  gameState.currentHand = hand;
  const buttons = document.querySelectorAll('#handGroup .radio-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('active', (idx === 0 && hand === 'forehand') || (idx === 1 && hand === 'backhand'));
  });
}

function selectMatLength(length) {
  gameState.matLength = length;
  const buttons = document.querySelectorAll('#matLengthGroup .radio-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('active',
      (idx === 0 && length === 'short') || (idx === 1 && length === 'medium') || (idx === 2 && length === 'long'));
  });
}

function selectJackLength(length) {
  gameState.jackLength = length;
  const buttons = document.querySelectorAll('#jackLengthGroup .radio-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('active',
      (idx === 0 && length === 'short') || (idx === 1 && length === 'medium') || (idx === 2 && length === 'long'));
  });
  drawGreen();
}

function updateDisplay() {
  const endEl = document.getElementById('currentEnd');
  if (endEl) endEl.textContent = `${gameState.currentEnd}/${gameState.totalEnds}`;

  // Set info for set format games
  const setItem = document.getElementById('setInfoItem');
  const setEl = document.getElementById('currentSet');
  if (setItem && gameState.matchStructure === 'sets') {
    setItem.style.display = '';
    if (setEl) setEl.textContent = `${gameState.currentSet || 1}/${gameState.numberOfSets || 2}`;
  } else if (setItem) {
    setItem.style.display = 'none';
  }

  // Score display
  const scoreEl = document.getElementById('currentScore');
  if (scoreEl) {
    const scores = calculateGameScore();
    scoreEl.textContent = `${scores.yours}-${scores.opponent}`;
  }

  const playerEl = document.getElementById('currentPlayer');
  if (playerEl) {
    if (gameState.currentTeam === 'yours') {
      playerEl.textContent = gameState.yourPlayers[gameState.currentPlayerIndex];
    } else if (gameState.gameType === 'trial') {
      playerEl.textContent = gameState.awayPlayers[gameState.currentPlayerIndex] || gameState.opponentPlayers[0];
    } else {
      playerEl.textContent = gameState.opponentPlayers[0];
    }
  }

  const bowlEl = document.getElementById('currentBowl');
  if (bowlEl) {
    const bowlsThisEnd = gameState.bowls.filter(b => b.end === gameState.currentEnd).length;
    const maxBowlsPerEnd = gameState.bowlsPerPlayer * gameState.playersPerTeam * 2;
    bowlEl.textContent = `${bowlsThisEnd}/${maxBowlsPerEnd}`;
  }

  // Update scoreboard
  updateScoreboard();

  // Show dead bowl legend if any dead bowls
  const deadLegend = document.getElementById('deadBowlLegend');
  if (deadLegend) {
    const hasDeadBowls = gameState.bowls.some(b => b.isDead);
    deadLegend.style.display = hasDeadBowls ? 'flex' : 'none';
  }

  // Update scoreboard team names
  const st1 = document.getElementById('scoreTeam1');
  const st2 = document.getElementById('scoreTeam2');
  if (st1) st1.textContent = gameState.gameType === 'trial' ? 'Home' : 'Your Team';
  if (st2) st2.textContent = gameState.gameType === 'trial' ? 'Away' : 'Opposition';
}

// ===== SCORING CALCULATIONS =====

function calculateGameScore() {
  let yours = 0;
  let opponent = 0;

  // Sum scored bowls per team
  const yourBowls = gameState.bowls.filter(b => b.team === 'yours' && !b.isDead);
  const oppBowls = gameState.bowls.filter(b => b.team === 'opponent' && !b.isDead);

  yourBowls.forEach(b => { yours += (b.scoreValue || 0); });
  oppBowls.forEach(b => { opponent += (b.scoreValue || 0); });

  return { yours, opponent };
}

function calculateEndScore(endNum) {
  const endBowls = gameState.bowls.filter(b => b.end === endNum && !b.isDead);
  let yours = 0;
  let opponent = 0;

  endBowls.filter(b => b.team === 'yours').forEach(b => { yours += (b.scoreValue || 0); });
  endBowls.filter(b => b.team === 'opponent').forEach(b => { opponent += (b.scoreValue || 0); });

  return { yours, opponent };
}

function updateScoreboard() {
  const container = document.getElementById('scoreboardEnds');
  if (!container) return;

  let html = '';
  for (let e = 1; e <= gameState.currentEnd; e++) {
    const score = calculateEndScore(e);
    let cls = 'score-draw';
    if (score.yours > score.opponent) cls = 'score-win';
    else if (score.opponent > score.yours) cls = 'score-lose';

    // Add set separator
    if (gameState.matchStructure === 'sets' && gameState.endsPerSet) {
      if (e > 1 && (e - 1) % gameState.endsPerSet === 0) {
        html += `<div style="width:2px; background: var(--primary); margin: 0 2px; border-radius: 1px;"></div>`;
      }
    }

    html += `<div class="scoreboard-end">
      <div class="scoreboard-end-num">E${e}</div>
      <div class="scoreboard-end-score ${cls}">${score.yours}-${score.opponent}</div>
    </div>`;
  }
  container.innerHTML = html;
}

// ===== DEAD BOWL =====

function toggleDeadBowlMode() {
  // Check there are bowls to mark as dead
  const currentEndBowls = gameState.bowls.filter(b => b.end === gameState.currentEnd);
  if (currentEndBowls.length === 0 && !deadBowlMode) {
    alert('No bowls on this end to mark as dead. Place some bowls first.');
    return;
  }

  deadBowlMode = !deadBowlMode;
  const btn = document.getElementById('deadBowlBtn');
  if (btn) {
    btn.classList.toggle('btn-active', deadBowlMode);
    btn.textContent = deadBowlMode ? 'Tap a Bowl...' : 'Dead Bowl';
  }

  // Redraw canvas with dead bowl mode indicator
  drawGreen();
}

function undoLastBowl() {
  if (gameState.bowls.length > 0) {
    gameState.bowls.pop();
    persistCurrentGame();
    drawGreen();
    updateDisplay();
  }
}

function nextEnd() {
  // Check for set format transitions
  if (gameState.matchStructure === 'sets') {
    const endsInCurrentSet = ((gameState.currentEnd - 1) % gameState.endsPerSet) + 1;

    if (endsInCurrentSet >= gameState.endsPerSet) {
      // Set complete - calculate set score
      const setStartEnd = (gameState.currentSet - 1) * gameState.endsPerSet + 1;
      let setYours = 0, setOpp = 0;
      for (let e = setStartEnd; e <= gameState.currentEnd; e++) {
        const es = calculateEndScore(e);
        setYours += es.yours;
        setOpp += es.opponent;
      }

      if (!gameState.setScores) gameState.setScores = [];
      gameState.setScores.push({ yours: setYours, opponent: setOpp, set: gameState.currentSet });

      const setsWon = gameState.setScores.filter(s => s.yours > s.opponent).length;
      const setsLost = gameState.setScores.filter(s => s.opponent > s.yours).length;

      alert(`Set ${gameState.currentSet} complete! Score: ${setYours} - ${setOpp}\nSets: ${setsWon} - ${setsLost}`);

      if (gameState.currentSet >= gameState.numberOfSets) {
        // All sets played - check if tie-break needed
        if (setsWon === setsLost && gameState.tieBreakEnds > 0) {
          alert('Sets are level! Tie-break begins.');
          gameState.currentSet++;
        } else {
          alert(`Match complete! Sets: ${setsWon} - ${setsLost}`);
          showEndGameDialog();
          return;
        }
      } else {
        gameState.currentSet++;
      }
    }
  }

  if (gameState.currentEnd >= gameState.totalEnds) {
    alert(`Game complete! You've finished all ${gameState.totalEnds} ends.`);
    showEndGameDialog();
    return;
  }

  // Record end score
  const endScore = calculateEndScore(gameState.currentEnd);
  if (!gameState.endScores) gameState.endScores = [];
  gameState.endScores.push({ ...endScore, end: gameState.currentEnd });

  gameState.currentEnd++;
  gameState.currentPlayerIndex = 0;
  gameState.currentTeam = 'yours';
  lastPlayerIndexByTeam = { yours: 0, opponent: 0 };
  gameState.jackPosition = { x: 250, y: 250 };
  gameState.jackOriginalPosition = null;
  gameState.jackMoved = false;
  gameState.jackInDitch = false;
  moveJackMode = false;
  deadBowlMode = false;

  const deadBtn = document.getElementById('deadBowlBtn');
  if (deadBtn) { deadBtn.classList.remove('btn-active'); deadBtn.textContent = 'Dead Bowl'; }

  // Reset team toggle UI to yours
  const teamBtns = document.querySelectorAll('#teamGroup .radio-btn');
  if (teamBtns[0]) teamBtns[0].classList.add('active');
  if (teamBtns[1]) teamBtns[1].classList.remove('active');

  // Reset zoom
  canvasZoom = 1; canvasPanX = 0; canvasPanY = 0;
  if (canvas) canvas.style.transform = '';

  persistCurrentGame();
  createPlayerButtons();
  updateJackButtonStates();
  drawGreen();
  updateDisplay();
}

function captureScreenshot() {
  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    tempCanvas.toBlob(function(blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const yourTeam = gameState.yourPlayers.join('-');
      const oppTeam = gameState.opponentPlayers[0];
      link.download = `${yourTeam}_vs_${oppTeam}_End${gameState.currentEnd}_${timestamp}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (error) {
    alert('Screenshot capture failed. Please try again.');
    console.error('Screenshot error:', error);
  }
}

// ===== CANVAS ZOOM =====

let canvasZoom = 1;
let canvasPanX = 0;
let canvasPanY = 0;
let isPanning = false;
let lastPinchDist = 0;
let panStartX = 0;
let panStartY = 0;

function zoomIn() {
  canvasZoom = Math.min(canvasZoom + 0.5, 4);
  applyCanvasZoom();
}

function zoomOut() {
  canvasZoom = Math.max(canvasZoom - 0.5, 1);
  if (canvasZoom === 1) { canvasPanX = 0; canvasPanY = 0; }
  applyCanvasZoom();
}

function zoomReset() {
  canvasZoom = 1;
  canvasPanX = 0;
  canvasPanY = 0;
  applyCanvasZoom();
}

function applyCanvasZoom() {
  if (!canvas) return;
  // Constrain pan so we don't go out of bounds
  const maxPan = (canvasZoom - 1) * 250; // half of 500px canvas
  canvasPanX = Math.max(-maxPan, Math.min(maxPan, canvasPanX));
  canvasPanY = Math.max(-maxPan, Math.min(maxPan, canvasPanY));

  canvas.style.transform = `scale(${canvasZoom}) translate(${canvasPanX / canvasZoom}px, ${canvasPanY / canvasZoom}px)`;
  canvas.style.transformOrigin = 'center center';
}

function setupZoomGestures() {
  const wrapper = document.querySelector('.green-canvas-wrapper');
  if (!wrapper) return;

  // Pinch to zoom on the wrapper
  wrapper.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      lastPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1 && canvasZoom > 1) {
      // Start pan when zoomed in
      isPanning = true;
      panStartX = e.touches[0].clientX - canvasPanX;
      panStartY = e.touches[0].clientY - canvasPanY;
    }
  }, { passive: false });

  wrapper.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastPinchDist > 0) {
        const scale = dist / lastPinchDist;
        canvasZoom = Math.max(1, Math.min(4, canvasZoom * scale));
        if (canvasZoom === 1) { canvasPanX = 0; canvasPanY = 0; }
        applyCanvasZoom();
      }
      lastPinchDist = dist;
    } else if (e.touches.length === 1 && isPanning && canvasZoom > 1) {
      e.preventDefault();
      canvasPanX = e.touches[0].clientX - panStartX;
      canvasPanY = e.touches[0].clientY - panStartY;
      applyCanvasZoom();
    }
  }, { passive: false });

  wrapper.addEventListener('touchend', function(e) {
    if (e.touches.length < 2) {
      lastPinchDist = 0;
    }
    if (e.touches.length === 0) {
      isPanning = false;
    }
  });

  // Mouse wheel zoom
  wrapper.addEventListener('wheel', function(e) {
    e.preventDefault();
    if (e.deltaY < 0) {
      canvasZoom = Math.min(canvasZoom + 0.25, 4);
    } else {
      canvasZoom = Math.max(canvasZoom - 0.25, 1);
    }
    if (canvasZoom === 1) { canvasPanX = 0; canvasPanY = 0; }
    applyCanvasZoom();
  }, { passive: false });
}

// ===== TIER SYSTEM =====

function selectTier(tier, e) {
  if (e) e.stopPropagation(); // Prevent double-firing from button + parent div
  currentTier = tier;
  const tierNames = { essential: 'Essential', personal: 'Personal', club: 'Club', elite: 'Elite' };
  const tierLabels = { essential: 'Free Tier', personal: '\u00A310/month', club: '\u00A340/month', elite: '\u00A350/month' };

  const badge = document.getElementById('tierBadge');
  const label = document.getElementById('tierLabel');
  if (badge) {
    badge.textContent = tierNames[tier].toUpperCase();
    badge.className = `tier-badge`;
    badge.style.background = `var(--tier-${tier === 'essential' ? '1' : tier === 'personal' ? '2' : tier === 'club' ? '3' : '4'})`;
  }
  if (label) label.textContent = tierLabels[tier];

  updateTierButtons();
  navigateTo('home');
}

function updateTierButtons() {
  const tiers = ['essential', 'personal', 'club', 'elite'];
  tiers.forEach((t, i) => {
    const btn = document.getElementById(`tierBtn${i + 1}`);
    if (btn) {
      if (t === currentTier) {
        btn.textContent = 'Current Plan';
        btn.className = 'btn-block btn-small btn-success';
      } else {
        btn.textContent = 'Select';
        btn.className = 'btn-block btn-small btn-secondary';
      }
    }
  });
}

// ===== TEAM MANAGER VIEW (Tier 3+) =====

function initManagerView() {
  refreshManagerView();
  populateManagerPlayerSelects();

  // Subscribe to real-time delivery updates for all active games
  if (typeof subscribeToAllGames === 'function' && isAuthenticated()) {
    // Unsubscribe first to avoid duplicates
    if (typeof unsubscribeAll === 'function') unsubscribeAll();

    // Subscribe to game-level changes
    subscribeToAllGames((payload) => {
      console.log('[Manager] Game update received');
      // Reload games and refresh the view
      reloadGamesFromDB().then(() => refreshManagerView());
    });

    // Subscribe to deliveries for each open game
    const openGames = allGames.filter(g => !g.completed);
    openGames.forEach(game => {
      const gid = game.gameId || game.id;
      subscribeToGameDeliveries(gid, (payload) => {
        console.log('[Manager] Delivery update for game', gid);
        if (payload.new) {
          const bowl = mapDeliveryToBowl(payload.new);
          // Update local game data
          const gameIdx = allGames.findIndex(g => (g.gameId || g.id) === gid);
          if (gameIdx !== -1) {
            const existing = allGames[gameIdx].bowls.findIndex(b => b.id === bowl.id);
            if (existing !== -1) {
              allGames[gameIdx].bowls[existing] = bowl;
            } else {
              allGames[gameIdx].bowls.push(bowl);
            }
          }
        }
        refreshManagerView();
      });
    });
  }
}

function setManagerTab(tab) {
  document.querySelectorAll('[data-mtab]').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`[data-mtab="${tab}"]`);
  if (activeTab) activeTab.classList.add('active');

  document.getElementById('managerLive').style.display = tab === 'live' ? 'block' : 'none';
  document.getElementById('managerPlayers').style.display = tab === 'players' ? 'block' : 'none';
  document.getElementById('managerComparison').style.display = tab === 'comparison' ? 'block' : 'none';
}

function refreshManagerView() {
  const rinksDiv = document.getElementById('managerRinks');
  if (!rinksDiv) return;

  const openGames = allGames.filter(g => !g.completed);

  if (openGames.length === 0) {
    rinksDiv.innerHTML = '<div class="no-games">No active games. Start tracking from the Selector App to see live data here.</div>';
    return;
  }

  rinksDiv.innerHTML = openGames.map(game => {
    const yourTeam = (game.yourPlayers || []).join(', ');
    const oppTeam = (game.opponentPlayers || [])[0] || 'Opposition';
    const bowls = game.bowls || [];
    const end = game.currentEnd || 1;
    const totalEnds = game.totalEnds || 21;

    // Calculate total scores
    let yourScore = 0, oppScore = 0;
    bowls.filter(b => b.team === 'yours' && !b.isDead).forEach(b => yourScore += (b.scoreValue || 0));
    bowls.filter(b => b.team === 'opponent' && !b.isDead).forEach(b => oppScore += (b.scoreValue || 0));

    // Mini scoreboard
    let miniEnds = '';
    for (let e = 1; e <= Math.min(end, 15); e++) {
      const eBowls = bowls.filter(b => b.end === e && !b.isDead);
      let ey = 0, eo = 0;
      eBowls.filter(b => b.team === 'yours').forEach(b => ey += (b.scoreValue || 0));
      eBowls.filter(b => b.team === 'opponent').forEach(b => eo += (b.scoreValue || 0));
      const cls = ey > eo ? 'score-win' : eo > ey ? 'score-lose' : 'score-draw';
      miniEnds += `<div class="rink-mini-end ${cls}">${ey}-${eo}</div>`;
    }

    const setInfo = game.matchStructure === 'sets' ? ` | Set ${game.currentSet || 1}` : '';
    const typeLabel = game.gameType === 'trial' ? ' <span class="badge-trial">Trial</span>' : '';

    return `<div class="rink-card">
      <div class="rink-card-header">
        <div class="rink-card-title">${yourTeam} vs ${oppTeam}${typeLabel}</div>
        <div class="rink-card-status">End ${end}/${totalEnds}${setInfo}</div>
      </div>
      <div class="rink-card-score">${yourScore} - ${oppScore}</div>
      <div class="rink-card-players">${game.format || 'singles'} | ${bowls.length} bowls recorded</div>
      <div class="rink-mini-scoreboard">${miniEnds}</div>
    </div>`;
  }).join('');
}

// Helper: get all tracked player names (yours + trial away, excluding generic 'opponent')
function getTrackedPlayerNames(allBowls) {
  return [...new Set(allBowls.map(b => b.playerId || b.playerName || b.player))].filter(n => n && n !== 'opponent');
}

async function populateManagerPlayerSelects() {
  const allBowls = await getAllBowls();
  const playerNames = getTrackedPlayerNames(allBowls);

  const selects = ['managerPlayerSelect', 'comparePlayer1', 'comparePlayer2'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const firstOpt = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(firstOpt);
    playerNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  });
}

async function loadManagerPlayerStats() {
  const playerName = document.getElementById('managerPlayerSelect').value;
  const container = document.getElementById('managerPlayerStats');
  if (!playerName || !container) { container.innerHTML = ''; return; }

  const stats = await getPlayerStats(playerName);
  if (!stats) { container.innerHTML = '<p style="color: var(--text-secondary);">No data found for this player.</p>'; return; }

  const rating = getPerformanceRating(stats.avgScore);

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 12px;">
      <div class="game-card" style="text-align: center; cursor: default;">
        <div style="font-size: 12px; color: var(--text-secondary);">Avg Score</div>
        <div style="font-size: 22px; font-weight: 700; color: var(--primary);">${stats.avgScore.toFixed(2)}</div>
        <div class="star-rating">${rating.stars}</div>
      </div>
      <div class="game-card" style="text-align: center; cursor: default;">
        <div style="font-size: 12px; color: var(--text-secondary);">Games</div>
        <div style="font-size: 22px; font-weight: 700; color: var(--primary);">${stats.gamesPlayed}</div>
      </div>
      <div class="game-card" style="text-align: center; cursor: default;">
        <div style="font-size: 12px; color: var(--text-secondary);">Bowls</div>
        <div style="font-size: 22px; font-weight: 700; color: var(--primary);">${stats.totalBowls}</div>
      </div>
      <div class="game-card" style="text-align: center; cursor: default;">
        <div style="font-size: 12px; color: var(--text-secondary);">Consistency</div>
        <div style="font-size: 22px; font-weight: 700; color: var(--primary);">${stats.consistency ? stats.consistency.toFixed(2) : 'N/A'}</div>
      </div>
    </div>
    <div style="margin-top: 12px;">
      <h4 style="color: var(--primary); margin-bottom: 6px;">Rating: ${rating.label}</h4>
      <p style="font-size: 13px; color: var(--text-secondary);">${rating.description}</p>
    </div>
    <div style="margin-top: 12px;">
      <h4 style="color: var(--primary); margin-bottom: 6px;">Positions Played</h4>
      <p style="font-size: 13px; color: var(--text-secondary);">${(stats.positions || []).join(', ') || 'N/A'}</p>
    </div>
  `;
}

async function updateManagerComparison() {
  const p1 = document.getElementById('comparePlayer1').value;
  const p2 = document.getElementById('comparePlayer2').value;
  const container = document.getElementById('managerComparisonResult');
  if (!p1 || !p2 || !container) { if (container) container.innerHTML = ''; return; }

  const stats1 = await getPlayerStats(p1);
  const stats2 = await getPlayerStats(p2);
  if (!stats1 || !stats2) { container.innerHTML = '<p>Insufficient data for comparison.</p>'; return; }

  const r1 = getPerformanceRating(stats1.avgScore);
  const r2 = getPerformanceRating(stats2.avgScore);

  container.innerHTML = `
    <table class="comparison-table">
      <thead><tr><th>Metric</th><th>${p1}</th><th>${p2}</th></tr></thead>
      <tbody>
        <tr><td>Avg Score</td><td><strong>${stats1.avgScore.toFixed(2)}</strong></td><td><strong>${stats2.avgScore.toFixed(2)}</strong></td></tr>
        <tr><td>Rating</td><td>${r1.stars} ${r1.label}</td><td>${r2.stars} ${r2.label}</td></tr>
        <tr><td>Games Played</td><td>${stats1.gamesPlayed}</td><td>${stats2.gamesPlayed}</td></tr>
        <tr><td>Total Bowls</td><td>${stats1.totalBowls}</td><td>${stats2.totalBowls}</td></tr>
        <tr><td>Consistency</td><td>${stats1.consistency ? stats1.consistency.toFixed(2) : 'N/A'}</td><td>${stats2.consistency ? stats2.consistency.toFixed(2) : 'N/A'}</td></tr>
        <tr><td>Clutch Avg</td><td>${stats1.clutchAvg ? stats1.clutchAvg.toFixed(2) : 'N/A'}</td><td>${stats2.clutchAvg ? stats2.clutchAvg.toFixed(2) : 'N/A'}</td></tr>
      </tbody>
    </table>
  `;
}

// ===== PERFORMANCE RATING =====

function getPerformanceRating(avgScore) {
  if (avgScore >= 3.4) return { stars: '\u2605\u2605\u2605\u2605\u2605', label: 'Elite', description: 'Consistently outstanding \u2014 strong selection case', pct: avgScore / 4 * 100 };
  if (avgScore >= 2.8) return { stars: '\u2605\u2605\u2605\u2605', label: 'Excellent', description: 'Above average \u2014 performing well in position', pct: avgScore / 4 * 100 };
  if (avgScore >= 2.2) return { stars: '\u2605\u2605\u2605', label: 'Good', description: 'Solid performance \u2014 competitive for selection', pct: avgScore / 4 * 100 };
  if (avgScore >= 1.6) return { stars: '\u2605\u2605', label: 'Average', description: 'Some inconsistency \u2014 monitor over more games', pct: avgScore / 4 * 100 };
  return { stars: '\u2605', label: 'Below Average', description: 'Struggling \u2014 needs development or position review', pct: avgScore / 4 * 100 };
}

// ===== ELITE ANALYTICS (Tier 4) =====

function initEliteView() {
  populateEliteSelects();
  renderHeatmap();
}

function setEliteTab(tab) {
  document.querySelectorAll('[data-etab]').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`[data-etab="${tab}"]`);
  if (activeTab) activeTab.classList.add('active');

  document.getElementById('eliteHeatmap').style.display = tab === 'heatmap' ? 'block' : 'none';
  document.getElementById('eliteRankings').style.display = tab === 'rankings' ? 'block' : 'none';
  document.getElementById('eliteTrends').style.display = tab === 'trends' ? 'block' : 'none';
  document.getElementById('eliteRecommend').style.display = tab === 'recommend' ? 'block' : 'none';

  if (tab === 'rankings') renderRankings();
  if (tab === 'trends') renderTrends();
  if (tab === 'recommend') renderRecommendations();
}

async function populateEliteSelects() {
  const allBowls = await getAllBowls();
  const playerNames = getTrackedPlayerNames(allBowls);

  ['heatmapPlayer', 'trendPlayer'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    // Keep first option
    while (sel.options.length > 1) sel.remove(1);
    playerNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  });
}

async function renderHeatmap() {
  const heatCanvas = document.getElementById('heatmapCanvas');
  if (!heatCanvas) return;

  const hCtx = heatCanvas.getContext('2d');
  heatCanvas.width = 500;
  heatCanvas.height = 500;

  const playerFilter = document.getElementById('heatmapPlayer').value;
  const positionFilter = document.getElementById('heatmapPosition').value;

  const allBowls = await getAllBowls();
  // Include all tracked bowls (yours + trial away players)
  let bowls = allBowls.filter(b => (b.playerId || b.playerName || b.player) !== 'opponent');

  if (playerFilter !== 'all') {
    bowls = bowls.filter(b => (b.playerId || b.playerName || b.player) === playerFilter);
  }
  if (positionFilter !== 'all') {
    bowls = bowls.filter(b => b.position === positionFilter);
  }

  // Draw green background
  hCtx.fillStyle = '#2d5016';
  hCtx.fillRect(0, 0, 500, 500);

  // Draw concentric circles
  for (let i = 5; i >= 1; i--) {
    const radius = (240 / 5) * i;
    hCtx.beginPath();
    hCtx.arc(250, 250, radius, 0, 2 * Math.PI);
    hCtx.strokeStyle = '#1a3810';
    hCtx.lineWidth = 1;
    hCtx.stroke();
    hCtx.fillStyle = '#4a7035';
    hCtx.font = '11px Arial';
    hCtx.textAlign = 'center';
    hCtx.fillText(`${i}ft`, 250, 250 - radius + 14);
  }

  // Draw jack
  hCtx.beginPath();
  hCtx.arc(250, 250, 8, 0, 2 * Math.PI);
  hCtx.fillStyle = '#FFD700';
  hCtx.fill();
  hCtx.strokeStyle = '#FFA500';
  hCtx.lineWidth = 2;
  hCtx.stroke();

  if (bowls.length === 0) {
    hCtx.fillStyle = 'rgba(255,255,255,0.7)';
    hCtx.font = '16px Arial';
    hCtx.textAlign = 'center';
    hCtx.fillText('No bowl data available', 250, 450);
    return;
  }

  // Create heatmap grid
  const gridSize = 20;
  const grid = {};
  let maxCount = 0;

  bowls.forEach(b => {
    const x = b.x || Math.random() * 400 + 50;
    const y = b.y || Math.random() * 400 + 50;
    const gx = Math.floor(x / gridSize);
    const gy = Math.floor(y / gridSize);
    const key = `${gx},${gy}`;
    grid[key] = (grid[key] || 0) + 1;
    maxCount = Math.max(maxCount, grid[key]);
  });

  // Draw heatmap cells
  Object.entries(grid).forEach(([key, count]) => {
    const [gx, gy] = key.split(',').map(Number);
    const intensity = count / maxCount;

    let r, g, b, a;
    if (intensity < 0.25) { r = 0; g = 0; b = 255; a = 0.15 + intensity; }
    else if (intensity < 0.5) { r = 0; g = 255; b = 128; a = 0.25 + intensity * 0.5; }
    else if (intensity < 0.75) { r = 255; g = 255; b = 0; a = 0.4 + intensity * 0.3; }
    else { r = 255; g = 0; b = 0; a = 0.5 + intensity * 0.4; }

    hCtx.fillStyle = `rgba(${r},${g},${b},${a})`;
    hCtx.beginPath();
    hCtx.arc(gx * gridSize + gridSize / 2, gy * gridSize + gridSize / 2, gridSize * 0.8, 0, 2 * Math.PI);
    hCtx.fill();
  });

  // Draw bowl count label
  hCtx.fillStyle = 'rgba(255,255,255,0.8)';
  hCtx.font = '12px Arial';
  hCtx.textAlign = 'left';
  hCtx.fillText(`${bowls.length} bowls`, 10, 490);
}

async function renderRankings() {
  const container = document.getElementById('rankingsTable');
  if (!container) return;

  const positionFilter = document.getElementById('rankingPosition').value;
  const allBowls = await getAllBowls();

  const playerNames = getTrackedPlayerNames(allBowls);

  const rankings = [];
  for (const name of playerNames) {
    const stats = await getPlayerStats(name);
    if (!stats || stats.totalBowls < 4) continue;

    if (positionFilter !== 'all' && stats.positions && !stats.positions.includes(positionFilter)) continue;

    const rating = getPerformanceRating(stats.avgScore);
    const effectivePct = stats.totalBowls > 0
      ? ((stats.scoreDistribution[4] || 0) / stats.totalBowls * 100).toFixed(0)
      : 0;
    const formTrend = stats.formTrend || 'steady';

    rankings.push({
      name,
      avgScore: stats.avgScore,
      totalBowls: stats.totalBowls,
      gamesPlayed: stats.gamesPlayed,
      consistency: stats.consistency || 0,
      effectivePct,
      formTrend,
      rating,
      positions: stats.positions || []
    });
  }

  rankings.sort((a, b) => b.avgScore - a.avgScore);

  if (rankings.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No player data available. Record some games first.</p>';
    return;
  }

  container.innerHTML = `
    <table class="rankings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Avg</th>
          <th>Eff%</th>
          <th>Form</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody>
        ${rankings.map((r, i) => `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td>${r.name}<br><span style="font-size: 10px; color: var(--text-muted);">${r.positions.join(', ')}</span></td>
            <td><strong>${r.avgScore.toFixed(2)}</strong></td>
            <td>${r.effectivePct}%</td>
            <td><span class="form-indicator form-${r.formTrend}"></span>${r.formTrend}</td>
            <td><span class="star-rating">${r.rating.stars}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function renderTrends() {
  const playerName = document.getElementById('trendPlayer').value;
  if (!playerName) return;

  const allBowls = await getAllBowls();
  const playerBowls = allBowls.filter(b => (b.playerId || b.playerName || b.player) === playerName);

  if (playerBowls.length === 0) return;

  // Group by game
  const gameIds = [...new Set(playerBowls.map(b => b.gameId))];
  const gameAvgs = gameIds.map(gid => {
    const gameBowls = playerBowls.filter(b => b.gameId === gid);
    const avg = gameBowls.reduce((s, b) => s + (b.scoreValue || b.score || 0), 0) / gameBowls.length;
    return { gameId: gid, avg, bowls: gameBowls.length };
  });

  // Trend chart
  const trendCanvas = document.getElementById('trendChart');
  if (trendCanvas) {
    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(trendCanvas, {
      type: 'line',
      data: {
        labels: gameAvgs.map((_, i) => `Game ${i + 1}`),
        datasets: [{
          label: 'Average Score',
          data: gameAvgs.map(g => g.avg),
          borderColor: '#2a5298',
          backgroundColor: 'rgba(42,82,152,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#2a5298'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: true, text: `${playerName} - Scoring Trend` } },
        scales: { y: { min: 0, max: 4, title: { display: true, text: 'Avg Score (0-4)' } } }
      }
    });
  }

  // Effectiveness chart
  const effCanvas = document.getElementById('effectivenessChart');
  if (effCanvas) {
    const effective = playerBowls.filter(b => (b.scoreValue || b.score || 0) === 4).length;
    const ineffective = playerBowls.filter(b => (b.scoreValue || b.score || 0) === 0).length;
    const other = playerBowls.length - effective - ineffective;

    if (effectivenessChartInstance) effectivenessChartInstance.destroy();
    effectivenessChartInstance = new Chart(effCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Effective (4)', 'Partial (1-3)', 'Ineffective (0)'],
        datasets: [{
          data: [effective, other, ineffective],
          backgroundColor: ['#4CAF50', '#FF9800', '#f44336']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Bowl Effectiveness' } }
      }
    });
  }
}

async function renderRecommendations() {
  const container = document.getElementById('recommendationResult');
  if (!container) return;

  const format = document.getElementById('recommendFormat').value;
  const positions = getPositionsForFormat(format);
  const allBowls = await getAllBowls();

  const playerNames = getTrackedPlayerNames(allBowls);

  // Calculate form index for each player
  const playerScores = [];
  for (const name of playerNames) {
    const stats = await getPlayerStats(name);
    if (!stats || stats.totalBowls < 4) continue;

    const effectivePct = stats.totalBowls > 0 ? (stats.scoreDistribution[4] || 0) / stats.totalBowls : 0;
    const consistencyBonus = stats.consistency < 1 ? 0.2 : 0;
    const formIndex = stats.avgScore * 0.5 + effectivePct * 4 * 0.3 + consistencyBonus + (stats.avgScore > 2.5 ? 0.2 : 0);

    playerScores.push({
      name,
      formIndex,
      avgScore: stats.avgScore,
      effectivePct: (effectivePct * 100).toFixed(0),
      positions: stats.positions || [],
      rating: getPerformanceRating(stats.avgScore)
    });
  }

  playerScores.sort((a, b) => b.formIndex - a.formIndex);

  let html = '';
  const assigned = new Set();

  positions.forEach(pos => {
    // Find best available player for this position, preferring those who've played it
    const candidates = playerScores.filter(p => !assigned.has(p.name));
    const posPlayers = candidates.sort((a, b) => {
      const aPref = a.positions.includes(pos) ? 1 : 0;
      const bPref = b.positions.includes(pos) ? 1 : 0;
      return (bPref - aPref) || (b.formIndex - a.formIndex);
    });

    html += `<div class="recommend-position">
      <h4>${pos}</h4>`;

    posPlayers.slice(0, 3).forEach((p, i) => {
      if (i === 0) assigned.add(p.name);
      html += `<div class="recommend-player">
        <span class="recommend-rank">${i + 1}</span>
        <span class="recommend-name">${p.name}</span>
        <span class="star-rating" style="font-size: 11px;">${p.rating.stars}</span>
        <span class="recommend-score">${p.avgScore.toFixed(2)} (${p.effectivePct}% eff)</span>
      </div>`;
    });

    if (posPlayers.length === 0) {
      html += `<div class="recommend-player"><span style="color: var(--text-muted);">No candidates available</span></div>`;
    }

    html += `</div>`;
  });

  container.innerHTML = html || '<p style="color: var(--text-secondary); text-align: center;">Not enough player data for recommendations. Record more games first.</p>';
}

// ===== GAMES MANAGER (updated to show set format info) =====

function showGamesManagerUpdated() {
  // This extends the original showGamesManager with set format badges
}

// Override showGamesManager to add set format info
const _originalShowGamesManager = showGamesManager;
showGamesManager = function() {
  _originalShowGamesManager();

  // Add set format badges and additional info
  const gamesList = document.getElementById('gamesList');
  if (!gamesList) return;

  allGames.forEach((game, idx) => {
    const cards = gamesList.querySelectorAll('.game-card');
    if (cards[idx] && game.matchStructure === 'sets') {
      const info = cards[idx].querySelector('.game-card-info');
      if (info) {
        info.innerHTML += ` <span class="badge-sets">Sets ${game.numberOfSets}\u00D7${game.endsPerSet}</span>`;
      }
    }
  });
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
