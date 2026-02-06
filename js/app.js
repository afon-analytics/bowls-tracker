// Bowls Performance Tracker - Main Application Logic
// Adapted for IndexedDB persistence

let allGames = [];
let currentGameId = 0;
let pendingBowl = null;
let canvas, ctx;
let isDraggingJack = false;
let draggingBowl = null;
let dragOffset = { x: 0, y: 0 };
let currentView = 'home';
let deferredInstallPrompt = null;

let gameState = {
  gameId: 0,
  tournamentName: '',
  format: 'singles',
  yourPlayers: [],
  opponentPlayers: [],
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
  jackPosition: null
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

// ===== APP INITIALIZATION =====

async function initApp() {
  try {
    // Open database
    await openDB();
    console.log('[App] Database ready');

    // Migrate localStorage if needed
    await migrateFromLocalStorage();

    // Load open games from IndexedDB
    const openGames = await getOpenGames();
    allGames = openGames.map(g => ({
      ...g,
      gameId: g.id,
      yourPlayers: g.players || g.yourPlayers || [],
      bowls: [] // Bowls are stored separately in IndexedDB
    }));

    // Load bowls for each game
    for (let i = 0; i < allGames.length; i++) {
      const bowls = await getBowlsByGame(allGames[i].id);
      allGames[i].bowls = bowls;
    }

    currentGameId = allGames.length;

    // Check first time user
    const hasVisited = await getSetting('hasVisited');
    if (!hasVisited) {
      showOnboarding();
    }

    // Register service worker
    registerServiceWorker();

    // Setup PWA install prompt
    setupInstallPrompt();

    console.log('[App] Initialization complete');
  } catch (err) {
    console.error('[App] Init error:', err);
  }
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
      break;
    case 'games':
      showGamesManager();
      break;
    case 'analytics':
      document.getElementById('analyticsScreen').classList.add('active');
      renderAnalytics('player');
      setAnalyticsTab('player');
      break;
  }

  // Show/hide FAB
  const fab = document.getElementById('fabNewGame');
  if (fab) {
    fab.style.display = (view === 'home' || view === 'games') ? 'flex' : 'none';
  }
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
    if (statusEl) statusEl.textContent = 'Error loading demo data.';
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
    if (statusEl) statusEl.textContent = 'Error loading demo data.';
  }
}

// ===== GAME SETUP =====

function updateEndsDropdown() {
  const format = document.getElementById('gameFormat').value;
  const endsGroup = document.getElementById('endsGroup');

  if (format !== 'singles') {
    endsGroup.style.display = 'block';
  } else {
    endsGroup.style.display = 'none';
  }

  updatePlayerInputs(format);
}

function updatePlayerInputs(format) {
  const positions = {
    'singles': ['Player'],
    'pairs4': ['Lead', 'Skip'],
    'pairs3': ['Lead', 'Skip'],
    'triples3': ['Lead', 'Second', 'Skip'],
    'triples2': ['Lead', 'Second', 'Skip'],
    'fours': ['Lead', 'Second', 'Third', 'Skip']
  };

  const playerPositions = positions[format];
  const yourTeamDiv = document.getElementById('yourTeamPlayers');
  yourTeamDiv.innerHTML = '<h3>Your Team</h3>';
  playerPositions.forEach((position, idx) => {
    yourTeamDiv.innerHTML += `
      <div class="form-group">
        <label for="yourPlayer${idx}">${position}</label>
        <input type="text" id="yourPlayer${idx}" placeholder="Enter ${position.toLowerCase()} name">
      </div>
    `;
  });
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

  const gameId = generateId();

  gameState = {
    gameId: gameId,
    id: gameId,
    tournamentName: tournamentName,
    format: format,
    yourPlayers: yourPlayers,
    players: yourPlayers,
    opponentPlayers: [opponentTeamName],
    bowlsPerPlayer: config.bowls,
    playersPerTeam: config.players,
    totalEnds: config.ends,
    endCount: config.ends,
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

  if (config.players === 1) {
    document.getElementById('playerSelector').style.display = 'none';
  } else {
    document.getElementById('playerSelector').style.display = 'block';
    createPlayerButtons();
  }

  initCanvas();
  updateDisplay();
}

function createPlayerButtons() {
  const positionsByFormat = {
    'singles': ['Player'],
    'pairs4': ['Lead', 'Skip'],
    'pairs3': ['Lead', 'Skip'],
    'triples3': ['Lead', 'Second', 'Skip'],
    'triples2': ['Lead', 'Second', 'Skip'],
    'fours': ['Lead', 'Second', 'Third', 'Skip']
  };

  const positions = positionsByFormat[gameState.format] || ['Lead', 'Second', 'Third', 'Skip'];
  const playerButtonsDiv = document.getElementById('playerButtons');
  playerButtonsDiv.innerHTML = '';

  for (let i = 0; i < gameState.playersPerTeam; i++) {
    const btn = document.createElement('div');
    btn.className = 'radio-btn' + (i === gameState.currentPlayerIndex ? ' active' : '');
    btn.textContent = positions[i];
    btn.onclick = () => selectPlayer(i);
    playerButtonsDiv.appendChild(btn);
  }
}

function selectPlayer(index) {
  gameState.currentPlayerIndex = index;
  const buttons = document.querySelectorAll('#playerButtons .radio-btn');
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

  drawGreen();
}

function drawGreen() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState.jackLength === 'long') {
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
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

  if (gameState.jackPosition) {
    drawJack(gameState.jackPosition.x, gameState.jackPosition.y);
  }

  const currentEndBowls = gameState.bowls.filter(b => b.end === gameState.currentEnd);
  currentEndBowls.forEach(bowl => drawBowl(bowl));
}

function drawJack(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, 2 * Math.PI);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
  ctx.strokeStyle = '#FFA500';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawBowl(bowl) {
  ctx.beginPath();
  ctx.arc(bowl.x, bowl.y, 18, 0, 2 * Math.PI);
  ctx.fillStyle = bowl.team === 'yours' ? '#4CAF50' : '#f44336';
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = 'white';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bowl.hand === 'forehand' ? 'F' : 'B', bowl.x, bowl.y);
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
  const coords = getCanvasCoordinates(e);

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

  if (isNearJack(coords.x, coords.y)) return;

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

  const currentPlayerName = gameState.currentTeam === 'yours'
    ? gameState.yourPlayers[gameState.currentPlayerIndex]
    : gameState.opponentPlayers[0];

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
    playerIndex: gameState.currentTeam === 'yours' ? gameState.currentPlayerIndex : 0,
    notes: quickNotes,
    resultCategory, distanceCategory, distanceInFeet,
    scoreCategory: '', scoreDetail: '', scoreValue: 0
  };

  if (distanceInFeet > 5) {
    pendingBowl = bowl;
    showOffRinkModal();
  } else {
    if (gameState.currentTeam === 'yours') {
      const positionsByFormat = {
        'singles': ['Player'], 'pairs4': ['Lead', 'Skip'], 'pairs3': ['Lead', 'Skip'],
        'triples3': ['Lead', 'Second', 'Skip'], 'triples2': ['Lead', 'Second', 'Skip'],
        'fours': ['Lead', 'Second', 'Third', 'Skip']
      };
      const positions = positionsByFormat[gameState.format] || ['Lead', 'Second', 'Third', 'Skip'];
      const currentPosition = positions[gameState.currentPlayerIndex];
      const isFrontEnd = currentPosition === 'Lead' || currentPosition === 'Second';

      if (isFrontEnd) {
        const autoScore = calculateFrontEndScore(bowl.resultCategory, bowl.distanceCategory);
        bowl.scoreCategory = bowl.resultCategory;
        bowl.scoreDetail = bowl.distanceCategory;
        bowl.scoreValue = autoScore;
      }
    }

    gameState.bowls.push(bowl);
    document.getElementById('quickBowlNotes').value = '';

    if (gameState.currentTeam === 'yours') {
      advanceToNextPlayer();
    }

    persistCurrentGame();
    drawGreen();
    updateDisplay();
  }
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
  const currentPlayerBowls = gameState.bowls.filter(b =>
    b.end === gameState.currentEnd &&
    b.team === 'yours' &&
    b.playerIndex === gameState.currentPlayerIndex
  ).length;

  if (currentPlayerBowls >= gameState.bowlsPerPlayer) {
    let nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.playersPerTeam;
    let attempts = 0;

    while (attempts < gameState.playersPerTeam) {
      const nextPlayerBowls = gameState.bowls.filter(b =>
        b.end === gameState.currentEnd &&
        b.team === 'yours' &&
        b.playerIndex === nextPlayerIndex
      ).length;

      if (nextPlayerBowls < gameState.bowlsPerPlayer) {
        gameState.currentPlayerIndex = nextPlayerIndex;
        const buttons = document.querySelectorAll('#playerButtons .radio-btn');
        buttons.forEach((btn, idx) => {
          btn.classList.toggle('active', idx === nextPlayerIndex);
        });
        break;
      }

      nextPlayerIndex = (nextPlayerIndex + 1) % gameState.playersPerTeam;
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
      playerId: b.team === 'yours' ? b.player : 'opponent',
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

      const card = document.createElement('div');
      card.className = 'game-card';
      card.onclick = () => loadGame(idx);
      card.innerHTML = `
        <div class="game-card-title">${yourTeam} vs ${oppTeam}</div>
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

  if (gameState.playersPerTeam === 1) {
    document.getElementById('playerSelector').style.display = 'none';
  } else {
    document.getElementById('playerSelector').style.display = 'block';
    createPlayerButtons();
  }

  initCanvas();
  updateDisplay();
}

function showSetupScreen() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('setupScreen').classList.add('active');

  document.getElementById('gameFormat').value = 'singles';
  document.getElementById('opponentTeamName').value = '';
  document.getElementById('tournamentName').value = '';
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

  if (gameState.currentTeam === 'yours') advanceToNextPlayer();

  persistCurrentGame();
  closeBowlScoringModal();
  drawGreen();
  updateDisplay();
}

function confirmOnRink() {
  if (!pendingBowl) return;

  if (gameState.currentTeam === 'yours') {
    const positionsByFormat = {
      'singles': ['Player'], 'pairs4': ['Lead', 'Skip'], 'pairs3': ['Lead', 'Skip'],
      'triples3': ['Lead', 'Second', 'Skip'], 'triples2': ['Lead', 'Second', 'Skip'],
      'fours': ['Lead', 'Second', 'Third', 'Skip']
    };
    const positions = positionsByFormat[gameState.format] || ['Lead', 'Second', 'Third', 'Skip'];
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

  if (gameState.currentTeam === 'yours') advanceToNextPlayer();

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
  document.getElementById('endNotesModal').classList.add('active');
}

function saveEndNotes() {
  gameState.endNotes[gameState.currentEnd] = document.getElementById('endNotes').value;
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

function selectTeam(team) {
  gameState.currentTeam = team;
  const buttons = document.querySelectorAll('#teamGroup .radio-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('active', (idx === 0 && team === 'yours') || (idx === 1 && team === 'opponent'));
  });
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

  const teamEl = document.getElementById('currentTeam');
  if (teamEl) teamEl.textContent = gameState.currentTeam === 'yours' ? 'Your Team' : 'Opponent';

  const playerEl = document.getElementById('currentPlayer');
  if (playerEl) {
    playerEl.textContent = gameState.currentTeam === 'yours'
      ? gameState.yourPlayers[gameState.currentPlayerIndex]
      : gameState.opponentPlayers[0];
  }

  const bowlEl = document.getElementById('currentBowl');
  if (bowlEl) {
    const bowlsThisEnd = gameState.bowls.filter(b => b.end === gameState.currentEnd).length;
    const maxBowlsPerEnd = gameState.bowlsPerPlayer * gameState.playersPerTeam * 2;
    bowlEl.textContent = `${bowlsThisEnd}/${maxBowlsPerEnd}`;
  }
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
  if (gameState.currentEnd >= gameState.totalEnds) {
    alert(`Game complete! You've finished all ${gameState.totalEnds} ends.`);
    showEndGameDialog();
    return;
  }

  gameState.currentEnd++;
  gameState.currentPlayerIndex = 0;
  gameState.jackPosition = { x: 250, y: 250 };
  persistCurrentGame();
  createPlayerButtons();
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
