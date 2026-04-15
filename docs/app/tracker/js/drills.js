// BowlsTrack - Drill Library Engine
// Implements 11 drills with scoring, benchmarks, history, and tier gating

// ===== DRILL DEFINITIONS =====

const DRILL_DEFINITIONS = [
  {
    id: 'corridor',
    name: 'Corridor Drill',
    category: 'line',
    categoryLabel: 'Line Control',
    difficulty: 'All Levels',
    position: 'All',
    description: '6 bowls through a narrow corridor. Score each bowl based on whether it stays inside the corridor.',
    totalBowls: 6,
    maxScore: 12,
    scoringType: 'manual',
    scoreOptions: [
      { value: 2, label: '2 — Fully inside corridor' },
      { value: 1, label: '1 — Touches boundary' },
      { value: 0, label: '0 — Outside corridor' }
    ],
    benchmarks: [
      { label: 'Beginner', threshold: 6 },
      { label: 'Club', threshold: 9 },
      { label: 'Advanced', threshold: 11 }
    ],
    instructions: 'Set up a narrow corridor on the green. Deliver 6 bowls and score each based on how well they stay within the corridor.'
  },
  {
    id: 'jack-length',
    name: 'Jack Length Challenge',
    category: 'weight',
    categoryLabel: 'Weight Control',
    difficulty: 'All Levels',
    position: 'All',
    description: '5 jacks at different distances, 2 bowls each. Score based on how close each bowl finishes to the jack.',
    totalBowls: 10,
    maxScore: 30,
    scoringType: 'canvas',
    autoScoreRules: 'jack-length',
    benchmarks: [
      { label: 'Beginner', threshold: 10 },
      { label: 'Club', threshold: 18 },
      { label: 'Advanced', threshold: 26 }
    ],
    instructions: 'Place the jack at 5 different distances. For each jack, deliver 2 bowls trying to match the distance.',
    sets: [
      { name: 'Jack 1 — Short', jackY: 350 },
      { name: 'Jack 2 — Medium-Short', jackY: 310 },
      { name: 'Jack 3 — Medium', jackY: 250 },
      { name: 'Jack 4 — Medium-Long', jackY: 190 },
      { name: 'Jack 5 — Long', jackY: 140 }
    ],
    bowlsPerSet: 2
  },
  {
    id: 'four-bowl-grouping',
    name: 'Four-Bowl Grouping',
    category: 'consistency',
    categoryLabel: 'Consistency',
    difficulty: 'All Levels',
    position: 'All',
    description: '4 bowls delivered together. Scored by how tightly they cluster — lower scatter radius is better.',
    totalBowls: 4,
    maxScore: null,
    scoringType: 'canvas',
    autoScoreRules: 'grouping',
    benchmarks: [],
    instructions: 'Deliver 4 bowls aiming for the same spot. Your score is the scatter radius — smaller is better. Track your personal best.'
  },
  {
    id: 'draw-ladder',
    name: 'Draw Ladder',
    category: 'weight',
    categoryLabel: 'Weight Control',
    difficulty: 'Beginner-Intermediate',
    position: 'All',
    description: '4 targets from short to full length, 2 bowls each in order. Bonus for hitting all 4 in order.',
    totalBowls: 8,
    maxScore: 10,
    scoringType: 'canvas',
    autoScoreRules: 'draw-ladder',
    benchmarks: [
      { label: 'Beginner', threshold: 4 },
      { label: 'Intermediate', threshold: 7 },
      { label: 'Advanced', threshold: 9 }
    ],
    instructions: 'Targets at 4 lengths (short to full). Deliver 2 bowls per target in order. 1pt per bowl within mat length. +2 bonus if all 4 targets hit.',
    sets: [
      { name: 'Short', jackY: 370 },
      { name: 'Medium', jackY: 290 },
      { name: 'Three-Quarter', jackY: 200 },
      { name: 'Full Length', jackY: 130 }
    ],
    bowlsPerSet: 2
  },
  {
    id: 'draw-around',
    name: 'Draw Around the Bowl',
    category: 'tactical',
    categoryLabel: 'Tactical',
    difficulty: 'Intermediate',
    position: 'Lead/Second',
    description: 'Draw past blockers to the jack. 4 bowls per end, scored per end. 2 ends FH + 2 ends BH = 4 ends.',
    totalBowls: 4,
    maxScore: 8,
    scoringType: 'manual',
    scoreOptions: [
      { value: 2, label: '2 — Drew around blockers, close to jack' },
      { value: 1, label: '1 — Close but didn\'t fully draw around' },
      { value: 0, label: '0 — Hit a blocker or missed' }
    ],
    benchmarks: [
      { label: 'Intermediate', threshold: 4 },
      { label: 'Advanced', threshold: 6 }
    ],
    instructions: 'Place 2 blocker bowls in front of the jack. Deliver 4 bowls per end. Score the end overall (0-2). 2 ends forehand, 2 ends backhand.',
    ends: 4,
    bowlsPerEnd: 1,
    handPattern: ['forehand', 'forehand', 'backhand', 'backhand']
  },
  {
    id: 'pressure-pair',
    name: 'The Pressure Pair',
    category: 'consistency',
    categoryLabel: 'Consistency',
    difficulty: 'All Levels',
    position: 'All',
    description: '2 bowls per pair — second must beat the first. 10 pairs per session.',
    totalBowls: 20,
    maxScore: 20,
    minScore: -10,
    scoringType: 'canvas',
    autoScoreRules: 'pressure-pair',
    benchmarks: [
      { label: 'Beginner', threshold: 5 },
      { label: 'Club', threshold: 8 },
      { label: 'Advanced', threshold: 9 }
    ],
    instructions: 'Deliver 2 bowls per pair. The second bowl must be closer to the jack than the first. 2pts if second beats first by >2ft, 1pt if second beats first, -1pt if second is worse.',
    pairs: 10
  },
  {
    id: 'trail-rest',
    name: 'Trail and Rest',
    category: 'tactical',
    categoryLabel: 'Tactical',
    difficulty: 'Intermediate-Advanced',
    position: 'Third/Skip',
    description: 'Trail the jack to a marker behind it, or rest on the jack. 6 ends.',
    totalBowls: 6,
    maxScore: 18,
    scoringType: 'manual',
    scoreOptions: [
      { value: 3, label: '3 — Successful trail to marker' },
      { value: 2, label: '2 — Resting touch on jack' },
      { value: 1, label: '1 — Within mat width' },
      { value: 0, label: '0 — Missed' }
    ],
    benchmarks: [
      { label: 'Intermediate', threshold: 8 },
      { label: 'Advanced', threshold: 13 }
    ],
    instructions: 'Place a marker behind the jack. Attempt to trail the jack back to the marker, or rest on the jack. Score each delivery.'
  },
  {
    id: 'upshot',
    name: 'Upshot Drill',
    category: 'tactical',
    categoryLabel: 'Tactical',
    difficulty: 'Intermediate-Advanced',
    position: 'Third/Skip',
    description: 'Pass between 2 target bowls. 6 ends, 2 bowls per end.',
    totalBowls: 12,
    maxScore: 24,
    scoringType: 'manual',
    scoreOptions: [
      { value: 2, label: '2 — Passed between the 2 target bowls' },
      { value: 1, label: '1 — Hit one bowl' },
      { value: 0, label: '0 — Missed entirely' }
    ],
    benchmarks: [
      { label: 'Intermediate', threshold: 10 },
      { label: 'Advanced', threshold: 17 }
    ],
    instructions: 'Set up 2 target bowls. Attempt to pass your bowl between them. 6 ends, 2 bowls per end.'
  },
  {
    id: 'driving',
    name: 'Driving Drill',
    category: 'weight',
    categoryLabel: 'Weight Control',
    difficulty: 'Advanced',
    position: 'Third/Skip',
    description: 'Drive accuracy at 3 lengths. 6 ends, 4 bowls per end (2 FH + 2 BH).',
    totalBowls: 24,
    maxScore: 24,
    scoringType: 'manual',
    scoreOptions: [
      { value: 1, label: '1 — Hit' },
      { value: 0, label: '0 — Miss' }
    ],
    benchmarks: [
      { label: 'Intermediate', threshold: 8 },
      { label: 'Advanced', threshold: 15 },
      { label: 'Elite', threshold: 20 }
    ],
    instructions: 'Drive at a target bowl at 3 different lengths. 6 ends, 4 bowls per end (2 forehand + 2 backhand). 1pt per hit.',
    ends: 6,
    bowlsPerEnd: 4
  },
  {
    id: 'draw-ditch',
    name: 'Drawing to the Ditch',
    category: 'weight',
    categoryLabel: 'Weight Control',
    difficulty: 'Intermediate-Advanced',
    position: 'All',
    description: 'Draw close to the ditch. 6 ends: 2 short, 2 medium, 2 long. 4 bowls per end.',
    totalBowls: 24,
    maxScore: 48,
    scoringType: 'canvas',
    autoScoreRules: 'draw-ditch',
    benchmarks: [
      { label: 'Intermediate', threshold: 24 },
      { label: 'Advanced', threshold: 36 }
    ],
    instructions: 'Draw as close to the ditch as possible. 6 ends at varying lengths. 2 FH + 2 BH per end. 2pts if within 2 mat lengths of ditch, 1pt if past tee but further, 0 if short of tee.',
    ends: 6,
    bowlsPerEnd: 4
  },
  {
    id: 'match-sim',
    name: 'Match Simulation',
    category: 'tactical',
    categoryLabel: 'Tactical',
    difficulty: 'All Levels',
    position: 'All',
    description: 'Create a scenario, play under time pressure. Self-score whether each bowl improved your position.',
    totalBowls: 10,
    maxScore: 10,
    scoringType: 'manual-timed',
    scoreOptions: [
      { value: 1, label: '1 — Improved position' },
      { value: 0, label: '0 — Did not improve' }
    ],
    benchmarks: [],
    instructions: 'Describe a match scenario, then deliver 10 bowls with a 30-second decision timer. Score each bowl based on whether it improved your position.'
  }
];

// ===== DRILL STATE =====

let drillState = null;
let drillCanvas = null;
let drillCtx = null;
let drillTimer = null;
let drillHistory = {}; // { drillId: [{ score, maxScore, scatterRadius, date }] }

// Load drill history from localStorage
function loadDrillHistory() {
  try {
    const saved = localStorage.getItem('bowlstrack_drill_history');
    if (saved) drillHistory = JSON.parse(saved);
  } catch (e) {
    drillHistory = {};
  }
}

function saveDrillHistory() {
  try {
    localStorage.setItem('bowlstrack_drill_history', JSON.stringify(drillHistory));
  } catch (e) {
    console.warn('[Drills] Could not save history to localStorage');
  }
}

function getDrillPersonalBest(drillId) {
  const history = drillHistory[drillId];
  if (!history || history.length === 0) return null;
  const drill = DRILL_DEFINITIONS.find(d => d.id === drillId);
  if (drill && drill.id === 'four-bowl-grouping') {
    // Lower scatter = better
    return history.reduce((best, h) => {
      if (h.scatterRadius == null) return best;
      if (best == null || h.scatterRadius < best.scatterRadius) return h;
      return best;
    }, null);
  }
  return history.reduce((best, h) => (h.score > (best ? best.score : -Infinity)) ? h : best, null);
}

function getDrillLastScores(drillId, count) {
  const history = drillHistory[drillId];
  if (!history) return [];
  return history.slice(-count);
}

// ===== DRILL LIBRARY RENDERING =====

function renderDrillLibrary(categoryFilter) {
  loadDrillHistory();
  const container = document.getElementById('drillLibraryCards');
  if (!container) return;

  const drills = categoryFilter && categoryFilter !== 'all'
    ? DRILL_DEFINITIONS.filter(d => d.category === categoryFilter)
    : DRILL_DEFINITIONS;

  container.innerHTML = drills.map(drill => {
    const pb = getDrillPersonalBest(drill.id);
    const lastScores = getDrillLastScores(drill.id, 5);
    const canSaveHistory = typeof currentTier !== 'undefined' && currentTier !== 'essential';

    let historyHtml = '';
    if (canSaveHistory && lastScores.length > 0) {
      if (drill.id === 'four-bowl-grouping') {
        const pbVal = pb ? pb.scatterRadius.toFixed(1) + ' ft' : '--';
        historyHtml = `
          <div class="drill-card-history">
            <div>PB: <span class="drill-card-pb">${pbVal}</span></div>
            <div>Last: ${lastScores[lastScores.length - 1].scatterRadius.toFixed(1)} ft</div>
          </div>`;
      } else {
        const pbVal = pb ? pb.score : '--';
        const sparkHtml = renderSparkline(lastScores.map(s => s.score), drill.maxScore);
        historyHtml = `
          <div class="drill-card-history">
            <div>PB: <span class="drill-card-pb">${pbVal}${drill.maxScore ? '/' + drill.maxScore : ''}</span></div>
            ${sparkHtml}
          </div>`;
      }
    }

    return `
      <div class="drill-card" onclick="startDrill('${drill.id}')">
        <div class="drill-card-header">
          <div class="drill-card-title">${drill.name}</div>
        </div>
        <div class="drill-card-desc">${drill.description}</div>
        <div class="drill-card-meta">
          <span class="drill-badge drill-badge-${drill.category}">${drill.categoryLabel}</span>
          <span class="drill-badge-difficulty">${drill.difficulty}</span>
          <span class="drill-badge-position">${drill.position}</span>
        </div>
        <div class="drill-card-footer">
          ${historyHtml}
          <button class="drill-start-btn" onclick="event.stopPropagation(); startDrill('${drill.id}')">Start Drill</button>
        </div>
      </div>`;
  }).join('');
}

function renderSparkline(scores, maxScore) {
  if (!scores.length || !maxScore) return '';
  const maxH = 20;
  const bars = scores.map(s => {
    const h = Math.max(2, (s / maxScore) * maxH);
    return `<div class="drill-sparkline-bar" style="height: ${h}px;"></div>`;
  }).join('');
  return `<div class="drill-sparkline">${bars}</div>`;
}

function filterDrills(category) {
  document.querySelectorAll('.drill-tab').forEach(t => t.classList.remove('active'));
  const tab = document.querySelector(`.drill-tab[data-category="${category}"]`);
  if (tab) tab.classList.add('active');
  renderDrillLibrary(category);
}

// ===== START A DRILL =====

function startDrill(drillId) {
  const drill = DRILL_DEFINITIONS.find(d => d.id === drillId);
  if (!drill) return;

  drillState = {
    drill: drill,
    bowlIndex: 0,
    scores: [],
    bowlPositions: [],
    currentSetIndex: 0,
    currentEndIndex: 0,
    currentPairIndex: 0,
    pairFirstBowl: null,
    totalScore: 0,
    startTime: Date.now(),
    hand: 'forehand',
    scenarioText: '',
    timerActive: false,
    timerSeconds: 30,
    jackPosition: null,
    bonusEarned: false
  };

  // Navigate to drill session screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('drillSessionScreen').classList.add('active');

  // Update header
  document.getElementById('drillSessionTitle').textContent = drill.name;
  document.getElementById('drillSessionBreadcrumb').textContent = drill.name;
  document.getElementById('drillSessionDesc').textContent = drill.instructions;
  updateDrillProgress();

  // Setup appropriate UI
  if (drill.scoringType === 'canvas') {
    setupCanvasDrill();
  } else if (drill.scoringType === 'manual-timed') {
    setupTimedManualDrill();
  } else {
    setupManualDrill();
  }

  document.getElementById('drillNextBtn').style.display = 'none';
  window.scrollTo(0, 0);
}

// ===== CANVAS-BASED DRILLS =====

function setupCanvasDrill() {
  document.getElementById('drillCanvasArea').style.display = 'block';
  document.getElementById('drillManualArea').style.display = 'none';
  document.getElementById('drillTimerOverlay').style.display = 'none';

  drillCanvas = document.getElementById('drillCanvas');
  drillCtx = drillCanvas.getContext('2d');
  drillCanvas.width = 500;
  drillCanvas.height = 500;

  // Remove old listeners and re-add
  drillCanvas.replaceWith(drillCanvas.cloneNode(true));
  drillCanvas = document.getElementById('drillCanvas');
  drillCtx = drillCanvas.getContext('2d');
  drillCanvas.addEventListener('click', handleDrillCanvasClick);

  // Set initial jack position based on drill type
  const drill = drillState.drill;
  if (drill.sets && drill.sets.length > 0) {
    drillState.jackPosition = { x: 250, y: drill.sets[0].jackY };
  } else if (drill.autoScoreRules === 'draw-ditch') {
    drillState.jackPosition = { x: 250, y: 470 }; // Near ditch
  } else {
    drillState.jackPosition = { x: 250, y: 250 };
  }

  // Setup controls
  const controlsDiv = document.getElementById('drillCanvasControls');
  controlsDiv.innerHTML = `
    <div class="drill-running-score">
      <div class="drill-running-score-label">Score</div>
      <div class="drill-running-score-value" id="drillCanvasScore">${drill.id === 'four-bowl-grouping' ? '--' : '0'}</div>
      <div class="drill-running-score-label" id="drillCanvasMaxLabel">${drill.maxScore ? '/ ' + drill.maxScore : ''}</div>
    </div>
    <div class="drill-instruction" id="drillCanvasInstruction">${getCanvasDrillInstruction()}</div>
  `;

  drawDrillGreen();
}

function getCanvasDrillInstruction() {
  const drill = drillState.drill;
  const bowlNum = drillState.bowlIndex + 1;

  if (drill.autoScoreRules === 'jack-length') {
    const setIdx = drillState.currentSetIndex;
    const set = drill.sets[setIdx];
    const bowlInSet = (drillState.bowlIndex % drill.bowlsPerSet) + 1;
    return `${set.name} — Bowl ${bowlInSet} of ${drill.bowlsPerSet}. Tap to place your bowl.`;
  }

  if (drill.autoScoreRules === 'grouping') {
    return `Bowl ${bowlNum} of 4. Tap to place your bowl on the green.`;
  }

  if (drill.autoScoreRules === 'draw-ladder') {
    const setIdx = drillState.currentSetIndex;
    const set = drill.sets[setIdx];
    const bowlInSet = (drillState.bowlIndex % drill.bowlsPerSet) + 1;
    return `Target: ${set.name} — Bowl ${bowlInSet} of ${drill.bowlsPerSet}. Tap to place.`;
  }

  if (drill.autoScoreRules === 'pressure-pair') {
    const pairNum = drillState.currentPairIndex + 1;
    const isFirst = drillState.pairFirstBowl === null;
    return `Pair ${pairNum} of ${drill.pairs} — ${isFirst ? 'First bowl' : 'Second bowl (must beat the first!)'}. Tap to place.`;
  }

  if (drill.autoScoreRules === 'draw-ditch') {
    const endNum = drillState.currentEndIndex + 1;
    const bowlInEnd = (drillState.bowlIndex % drill.bowlsPerEnd) + 1;
    const handLabel = drillState.hand === 'forehand' ? 'FH' : 'BH';
    return `End ${endNum}/6 — Bowl ${bowlInEnd}/${drill.bowlsPerEnd} (${handLabel}). Draw close to the ditch!`;
  }

  return `Bowl ${bowlNum} of ${drill.totalBowls}. Tap to place your bowl.`;
}

function drawDrillGreen() {
  if (!drillCtx) return;
  const c = drillCanvas;
  drillCtx.clearRect(0, 0, c.width, c.height);

  // Draw ditch area for draw-ditch drill
  const ditchHeight = 30;
  if (drillState.drill.autoScoreRules === 'draw-ditch') {
    drillCtx.fillStyle = '#8B4513';
    drillCtx.fillRect(0, c.height - ditchHeight, c.width, ditchHeight);
    drillCtx.fillStyle = 'white';
    drillCtx.font = 'bold 12px Arial';
    drillCtx.textAlign = 'center';
    drillCtx.fillText('DITCH', c.width / 2, c.height - 12);
  }

  // Concentric rings
  const centerX = c.width / 2;
  const centerY = c.height / 2;
  const maxRadius = Math.min(c.width, c.height) / 2 - 10;
  for (let i = 5; i >= 1; i--) {
    const radius = (maxRadius / 5) * i;
    drillCtx.beginPath();
    drillCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    drillCtx.strokeStyle = '#1a3810';
    drillCtx.lineWidth = 1;
    drillCtx.stroke();
    drillCtx.fillStyle = '#4a7035';
    drillCtx.font = '12px Arial';
    drillCtx.textAlign = 'center';
    drillCtx.fillText(`${i}ft`, centerX, centerY - radius + 15);
  }

  // Draw jack
  if (drillState.jackPosition) {
    const jp = drillState.jackPosition;
    drillCtx.beginPath();
    drillCtx.arc(jp.x, jp.y, 10, 0, 2 * Math.PI);
    drillCtx.fillStyle = '#FFD700';
    drillCtx.fill();
    drillCtx.strokeStyle = '#FFA500';
    drillCtx.lineWidth = 2;
    drillCtx.stroke();
  }

  // Draw placed bowls
  drillState.bowlPositions.forEach((bowl, idx) => {
    drillCtx.beginPath();
    drillCtx.arc(bowl.x, bowl.y, 14, 0, 2 * Math.PI);
    drillCtx.fillStyle = '#4CAF50';
    drillCtx.fill();
    drillCtx.strokeStyle = bowl.hand === 'backhand' ? '#B71C1C' : '#1B5E20';
    drillCtx.lineWidth = 3;
    drillCtx.stroke();

    // Number label
    drillCtx.fillStyle = 'white';
    drillCtx.font = 'bold 11px Arial';
    drillCtx.textAlign = 'center';
    drillCtx.textBaseline = 'middle';
    drillCtx.fillText(String(idx + 1), bowl.x, bowl.y);
    drillCtx.textBaseline = 'alphabetic';
  });

  // For pressure-pair, highlight first bowl of current pair
  if (drillState.drill.autoScoreRules === 'pressure-pair' && drillState.pairFirstBowl) {
    const fb = drillState.pairFirstBowl;
    drillCtx.beginPath();
    drillCtx.arc(fb.x, fb.y, 18, 0, 2 * Math.PI);
    drillCtx.strokeStyle = '#FFD700';
    drillCtx.lineWidth = 2;
    drillCtx.setLineDash([4, 3]);
    drillCtx.stroke();
    drillCtx.setLineDash([]);
  }
}

function getDrillCanvasCoordinates(e) {
  const rect = drillCanvas.getBoundingClientRect();
  const scaleX = drillCanvas.width / rect.width;
  const scaleY = drillCanvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  return { x: Math.round(x), y: Math.round(y) };
}

function handleDrillCanvasClick(e) {
  if (!drillState || drillState.bowlIndex >= drillState.drill.totalBowls) return;

  const pos = getDrillCanvasCoordinates(e);
  const drill = drillState.drill;

  // Clamp to canvas
  pos.x = Math.max(15, Math.min(485, pos.x));
  pos.y = Math.max(15, Math.min(485, pos.y));

  const bowl = {
    x: pos.x,
    y: pos.y,
    hand: drillState.hand,
    bowlIndex: drillState.bowlIndex
  };

  drillState.bowlPositions.push(bowl);

  // Auto-score based on drill rules
  let bowlScore = 0;

  if (drill.autoScoreRules === 'jack-length') {
    bowlScore = scoreJackLength(bowl);
  } else if (drill.autoScoreRules === 'grouping') {
    // Scoring deferred until all 4 bowls placed
    bowlScore = 0;
  } else if (drill.autoScoreRules === 'draw-ladder') {
    bowlScore = scoreDrawLadder(bowl);
  } else if (drill.autoScoreRules === 'pressure-pair') {
    bowlScore = scorePressurePair(bowl);
  } else if (drill.autoScoreRules === 'draw-ditch') {
    bowlScore = scoreDrawDitch(bowl);
  }

  drillState.scores.push(bowlScore);
  drillState.totalScore += bowlScore;
  drillState.bowlIndex++;

  // Advance set/end/pair
  advanceDrillStep();

  // Update UI
  updateDrillProgress();
  updateDrillScoreDisplay();
  drawDrillGreen();

  const instructionEl = document.getElementById('drillCanvasInstruction');
  if (instructionEl) instructionEl.textContent = getCanvasDrillInstruction();

  // Check if drill complete
  if (drillState.bowlIndex >= drill.totalBowls) {
    finishDrill();
  }
}

function advanceDrillStep() {
  const drill = drillState.drill;

  if (drill.autoScoreRules === 'jack-length' || drill.autoScoreRules === 'draw-ladder') {
    const bowlInSet = drillState.bowlIndex % drill.bowlsPerSet;
    if (bowlInSet === 0 && drillState.bowlIndex < drill.totalBowls) {
      drillState.currentSetIndex++;
      if (drill.sets[drillState.currentSetIndex]) {
        drillState.jackPosition = { x: 250, y: drill.sets[drillState.currentSetIndex].jackY };
        // Clear bowls from canvas for new set
        drillState.bowlPositions = [];
      }
    }
  }

  if (drill.autoScoreRules === 'pressure-pair') {
    if (drillState.pairFirstBowl === null) {
      // First bowl of pair was just placed
      drillState.pairFirstBowl = drillState.bowlPositions[drillState.bowlPositions.length - 1];
    } else {
      // Second bowl of pair was just placed — reset
      drillState.pairFirstBowl = null;
      drillState.currentPairIndex++;
      // Clear bowls from canvas for next pair
      drillState.bowlPositions = [];
    }
  }

  if (drill.autoScoreRules === 'draw-ditch') {
    const bowlInEnd = drillState.bowlIndex % drill.bowlsPerEnd;
    // Alternate hands: 2 FH then 2 BH per end
    if (bowlInEnd < 2) {
      drillState.hand = 'forehand';
    } else {
      drillState.hand = 'backhand';
    }
    // Update hand radio buttons
    updateDrillHandButtons();

    if (bowlInEnd === 0 && drillState.bowlIndex < drill.totalBowls) {
      drillState.currentEndIndex++;
      drillState.bowlPositions = [];
      drillState.hand = 'forehand';
      updateDrillHandButtons();
    }
  }
}

// ===== SCORING FUNCTIONS =====

function scoreJackLength(bowl) {
  // Distance from bowl to jack
  const dist = Math.sqrt(Math.pow(bowl.x - drillState.jackPosition.x, 2) +
    Math.pow(bowl.y - drillState.jackPosition.y, 2));
  const distFeet = dist / 100; // 100px = 1ft

  // 3pts = within mat width (2ft), 2pts = within mat length (4ft),
  // 1pt = within 1m (~3.3ft), 0 = beyond
  // Evaluate narrowest band first, awarding highest score for closest
  if (distFeet <= 2) return 3;
  if (distFeet <= 3.3) return 2;
  if (distFeet <= 4) return 1;
  return 0;
}

function scoreDrawLadder(bowl) {
  const dist = Math.sqrt(Math.pow(bowl.x - drillState.jackPosition.x, 2) +
    Math.pow(bowl.y - drillState.jackPosition.y, 2));
  const distFeet = dist / 100;
  return distFeet <= 4 ? 1 : 0; // Within mat length = 1pt
}

function scorePressurePair(bowl) {
  if (drillState.pairFirstBowl === null) {
    // First bowl — no score yet
    return 0;
  }
  // Second bowl — compare distances to jack
  const jp = drillState.jackPosition;
  const firstDist = Math.sqrt(Math.pow(drillState.pairFirstBowl.x - jp.x, 2) +
    Math.pow(drillState.pairFirstBowl.y - jp.y, 2));
  const secondDist = Math.sqrt(Math.pow(bowl.x - jp.x, 2) +
    Math.pow(bowl.y - jp.y, 2));
  const firstFeet = firstDist / 100;
  const secondFeet = secondDist / 100;

  if (secondFeet < firstFeet) {
    const improvement = firstFeet - secondFeet;
    return improvement > 2 ? 2 : 1;
  }
  return -1;
}

function scoreDrawDitch(bowl) {
  // Score based on distance to ditch (bottom of canvas = y:470 since ditch starts at 470)
  const ditchY = 470;
  const teeY = 250; // Middle of canvas = tee line

  if (bowl.y < teeY) return 0; // Short of tee
  const distToDitch = ditchY - bowl.y;
  const distToDitchFeet = distToDitch / 100;

  // 2 mat lengths = ~8ft, which is 800px/100 = ~80px distance from ditch
  if (distToDitchFeet <= 0.8) return 2; // Within 2 mat lengths of ditch (scaled for canvas)
  if (bowl.y > teeY) return 1; // Past tee but further
  return 0;
}

function calculateGroupingScore() {
  if (drillState.bowlPositions.length < 4) return null;
  const positions = drillState.bowlPositions;

  // Calculate centroid
  const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
  const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;

  // Calculate standard deviation (scatter radius)
  const sqDists = positions.map(p =>
    Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2)
  );
  const avgSqDist = sqDists.reduce((s, d) => s + d, 0) / sqDists.length;
  const scatterPixels = Math.sqrt(avgSqDist);
  const scatterFeet = scatterPixels / 100;

  return scatterFeet;
}

// ===== MANUAL SCORING DRILLS =====

function setupManualDrill() {
  document.getElementById('drillCanvasArea').style.display = 'none';
  document.getElementById('drillManualArea').style.display = 'block';
  document.getElementById('drillTimerOverlay').style.display = 'none';

  renderManualDrillUI();
}

function renderManualDrillUI() {
  const drill = drillState.drill;
  const content = document.getElementById('drillManualContent');
  const bowlNum = drillState.bowlIndex + 1;

  let handLabel = '';
  if (drill.handPattern) {
    const endIdx = drillState.currentEndIndex;
    const requiredHand = drill.handPattern[endIdx];
    if (requiredHand) {
      handLabel = `<div class="drill-hand-indicator">${requiredHand === 'forehand' ? 'Forehand' : 'Backhand'} End</div>`;
    }
  }

  let endInfo = '';
  if (drill.ends) {
    const endNum = drillState.currentEndIndex + 1;
    const bowlInEnd = (drillState.bowlIndex % (drill.bowlsPerEnd || 1)) + 1;
    endInfo = `<div style="text-align: center; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">End ${endNum} of ${drill.ends} — Bowl ${bowlInEnd} of ${drill.bowlsPerEnd || 1}</div>`;
  }

  content.innerHTML = `
    ${handLabel}
    ${endInfo}
    <div class="drill-instruction">Bowl ${bowlNum} of ${drill.totalBowls}: Score this delivery</div>
    <div class="drill-running-score">
      <div class="drill-running-score-label">Score</div>
      <div class="drill-running-score-value">${drillState.totalScore}${drill.maxScore ? ' / ' + drill.maxScore : ''}</div>
    </div>
    <div class="drill-score-buttons" id="drillManualButtons">
      ${drill.scoreOptions.map(opt =>
        `<button class="drill-score-btn drill-score-btn-${opt.value}" onclick="recordManualScore(${opt.value})">${opt.label}</button>`
      ).join('')}
    </div>
  `;
}

function recordManualScore(score) {
  if (!drillState) return;
  const drill = drillState.drill;

  drillState.scores.push(score);
  drillState.totalScore += score;
  drillState.bowlIndex++;

  // Advance end tracking
  if (drill.ends && drill.bowlsPerEnd) {
    const bowlInEnd = drillState.bowlIndex % drill.bowlsPerEnd;
    if (bowlInEnd === 0) {
      drillState.currentEndIndex++;
    }
  }

  updateDrillProgress();

  if (drillState.bowlIndex >= drill.totalBowls) {
    finishDrill();
  } else {
    renderManualDrillUI();
  }
}

// ===== TIMED MANUAL DRILL (Match Simulation) =====

function setupTimedManualDrill() {
  document.getElementById('drillCanvasArea').style.display = 'none';
  document.getElementById('drillManualArea').style.display = 'block';
  document.getElementById('drillTimerOverlay').style.display = 'none';

  const content = document.getElementById('drillManualContent');
  content.innerHTML = `
    <div class="drill-instruction">Describe the match scenario you want to simulate:</div>
    <textarea class="drill-scenario-input" id="drillScenarioInput" rows="3" placeholder="e.g. Down by 3 shots, last end, 2 opposition bowls near jack..."></textarea>
    <div class="action-buttons" style="margin-top: 10px;">
      <button onclick="beginTimedDrill()">Start Simulation</button>
    </div>
  `;
}

function beginTimedDrill() {
  const input = document.getElementById('drillScenarioInput');
  drillState.scenarioText = input ? input.value : '';
  drillState.timerActive = true;

  document.getElementById('drillTimerOverlay').style.display = 'block';

  renderTimedDrillBowl();
}

function renderTimedDrillBowl() {
  const drill = drillState.drill;
  const bowlNum = drillState.bowlIndex + 1;
  const content = document.getElementById('drillManualContent');

  // Reset timer
  drillState.timerSeconds = 30;
  updateTimerDisplay();
  clearInterval(drillTimer);
  drillTimer = setInterval(() => {
    drillState.timerSeconds--;
    updateTimerDisplay();
    if (drillState.timerSeconds <= 0) {
      clearInterval(drillTimer);
      // Auto-score 0 for timeout
      recordTimedScore(0);
    }
  }, 1000);

  content.innerHTML = `
    <div class="drill-instruction">Bowl ${bowlNum} of ${drill.totalBowls} — Score this delivery</div>
    <div class="drill-running-score">
      <div class="drill-running-score-label">Score</div>
      <div class="drill-running-score-value">${drillState.totalScore} / ${drill.maxScore}</div>
    </div>
    <div class="drill-score-buttons">
      ${drill.scoreOptions.map(opt =>
        `<button class="drill-score-btn drill-score-btn-${opt.value}" onclick="recordTimedScore(${opt.value})">${opt.label}</button>`
      ).join('')}
    </div>
  `;
}

function recordTimedScore(score) {
  if (!drillState) return;

  clearInterval(drillTimer);
  drillState.scores.push(score);
  drillState.totalScore += score;
  drillState.bowlIndex++;

  updateDrillProgress();

  if (drillState.bowlIndex >= drillState.drill.totalBowls) {
    document.getElementById('drillTimerOverlay').style.display = 'none';
    finishDrill();
  } else {
    renderTimedDrillBowl();
  }
}

function updateTimerDisplay() {
  const el = document.getElementById('drillTimerDisplay');
  if (el) {
    el.textContent = drillState.timerSeconds;
    el.style.color = drillState.timerSeconds <= 5 ? '#f44336' : 'white';
  }
}

// ===== DRILL PROGRESS & UI UPDATES =====

function updateDrillProgress() {
  if (!drillState) return;
  const pct = (drillState.bowlIndex / drillState.drill.totalBowls) * 100;
  const fill = document.getElementById('drillProgressFill');
  if (fill) fill.style.width = pct + '%';

  const info = document.getElementById('drillSessionInfo');
  if (info) {
    info.innerHTML = `Bowl <span>${drillState.bowlIndex}</span> of <span>${drillState.drill.totalBowls}</span>`;
  }
}

function updateDrillScoreDisplay() {
  const el = document.getElementById('drillCanvasScore');
  if (!el) return;
  const drill = drillState.drill;

  if (drill.id === 'four-bowl-grouping') {
    if (drillState.bowlPositions.length >= 4) {
      const scatter = calculateGroupingScore();
      el.textContent = scatter != null ? scatter.toFixed(1) + ' ft' : '--';
    } else {
      el.textContent = '--';
    }
  } else {
    el.textContent = drillState.totalScore;
  }
}

function selectDrillHand(hand) {
  if (drillState) drillState.hand = hand;
  updateDrillHandButtons();
}

function updateDrillHandButtons() {
  const group = document.getElementById('drillHandGroup');
  if (!group || !drillState) return;
  group.querySelectorAll('.radio-btn').forEach(btn => {
    const isActive = btn.textContent.toLowerCase() === drillState.hand;
    btn.classList.toggle('active', isActive);
  });
}

function undoDrillBowl() {
  if (!drillState || drillState.bowlIndex === 0) return;

  drillState.bowlIndex--;
  const removedScore = drillState.scores.pop();
  drillState.totalScore -= removedScore;
  drillState.bowlPositions.pop();

  // Undo set/pair/end advancement
  const drill = drillState.drill;
  if (drill.autoScoreRules === 'pressure-pair') {
    if (drillState.pairFirstBowl) {
      drillState.pairFirstBowl = null;
    } else {
      drillState.currentPairIndex = Math.max(0, drillState.currentPairIndex - 1);
      // Restore first bowl of previous pair if exists
      if (drillState.bowlPositions.length > 0) {
        drillState.pairFirstBowl = drillState.bowlPositions[drillState.bowlPositions.length - 1];
      }
    }
  }

  updateDrillProgress();
  updateDrillScoreDisplay();
  drawDrillGreen();

  const instructionEl = document.getElementById('drillCanvasInstruction');
  if (instructionEl) instructionEl.textContent = getCanvasDrillInstruction();
}

// ===== FINISH & RESULTS =====

function finishDrill() {
  if (!drillState) return;
  clearInterval(drillTimer);

  const drill = drillState.drill;
  const duration = Math.round((Date.now() - drillState.startTime) / 1000);

  // Calculate draw-ladder bonus
  let bonus = 0;
  if (drill.autoScoreRules === 'draw-ladder') {
    // Check if all 4 targets were hit (at least 1 bowl per target scored)
    const setsCount = drill.sets.length;
    let allHit = true;
    for (let s = 0; s < setsCount; s++) {
      const setScores = drillState.scores.slice(s * drill.bowlsPerSet, (s + 1) * drill.bowlsPerSet);
      if (!setScores.some(sc => sc > 0)) {
        allHit = false;
        break;
      }
    }
    if (allHit) {
      bonus = 2;
      drillState.bonusEarned = true;
      drillState.totalScore += bonus;
    }
  }

  // Build result object
  const isGrouping = drill.id === 'four-bowl-grouping';
  const scatterRadius = isGrouping ? calculateGroupingScore() : null;

  const result = {
    drillId: drill.id,
    drillName: drill.name,
    score: isGrouping ? null : drillState.totalScore,
    maxScore: drill.maxScore,
    scatterRadius: scatterRadius,
    scores: drillState.scores,
    date: new Date().toISOString(),
    duration: duration,
    category: drill.category
  };

  // Save to history
  const canSave = typeof currentTier !== 'undefined' && currentTier !== 'essential';

  if (canSave) {
    if (!drillHistory[drill.id]) drillHistory[drill.id] = [];
    drillHistory[drill.id].push(result);
    // Keep only last 50
    if (drillHistory[drill.id].length > 50) {
      drillHistory[drill.id] = drillHistory[drill.id].slice(-50);
    }
    saveDrillHistory();
    saveDrillToSupabase(result);
  }

  // Show results
  showDrillResults(result, canSave);
}

async function saveDrillToSupabase(result) {
  // Only attempt if Supabase is available and user is authenticated
  if (typeof supabaseClient === 'undefined' && typeof db === 'undefined') return;
  const client = typeof db !== 'undefined' ? db : (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  if (!client) return;

  try {
    const { error } = await client.from('drill_sessions').insert({
      drill_id: result.drillId,
      drill_name: result.drillName,
      category: result.category,
      score: result.score,
      max_score: result.maxScore,
      scatter_radius: result.scatterRadius,
      details: { scores: result.scores },
      duration_seconds: result.duration
    });
    if (error) console.warn('[Drills] Supabase save error:', error.message);
  } catch (e) {
    console.warn('[Drills] Could not save to Supabase:', e.message);
  }
}

function showDrillResults(result, canSave) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('drillResultsScreen').classList.add('active');

  const drill = drillState.drill;
  const container = document.getElementById('drillResultsContent');
  const isGrouping = drill.id === 'four-bowl-grouping';

  // Determine personal best
  const pb = getDrillPersonalBest(drill.id);
  let pbHtml = '';
  if (isGrouping) {
    const isNewPB = !pb || (result.scatterRadius != null && result.scatterRadius < pb.scatterRadius);
    if (isNewPB && canSave) {
      pbHtml = `<div class="drill-results-pb drill-results-pb-new">New Personal Best!</div>`;
    } else if (pb) {
      pbHtml = `<div class="drill-results-pb">Personal Best: ${pb.scatterRadius.toFixed(1)} ft</div>`;
    }
  } else {
    const isNewPB = !pb || result.score > pb.score;
    if (isNewPB && canSave) {
      pbHtml = `<div class="drill-results-pb drill-results-pb-new">New Personal Best!</div>`;
    } else if (pb) {
      pbHtml = `<div class="drill-results-pb">Personal Best: ${pb.score}${drill.maxScore ? '/' + drill.maxScore : ''}</div>`;
    }
  }

  // Benchmark comparison
  let benchmarkHtml = '';
  if (drill.benchmarks.length > 0 && !isGrouping) {
    const benchLevel = getBenchmarkLevel(result.score, drill.benchmarks);
    benchmarkHtml = renderBenchmarkBar(result.score, drill.maxScore, drill.benchmarks, benchLevel);
  }

  // Score display
  let scoreHtml = '';
  if (isGrouping) {
    scoreHtml = `
      <div class="drill-results-score">${result.scatterRadius != null ? result.scatterRadius.toFixed(1) : '--'}<span class="drill-results-max"> ft scatter</span></div>
      <p style="color: var(--text-secondary); font-size: 13px;">Lower scatter radius = more consistent grouping</p>
    `;
  } else {
    scoreHtml = `
      <div class="drill-results-score">${result.score}<span class="drill-results-max">${drill.maxScore ? ' / ' + drill.maxScore : ''}</span></div>
    `;
  }

  // Bonus info for draw-ladder
  let bonusHtml = '';
  if (drill.autoScoreRules === 'draw-ladder' && drillState.bonusEarned) {
    bonusHtml = `<p style="color: var(--success); font-weight: 600; font-size: 13px;">+2 bonus: All 4 targets hit in order!</p>`;
  }

  // Upgrade prompt for Essential tier
  let upgradeHtml = '';
  if (!canSave) {
    upgradeHtml = `
      <div class="drill-upgrade-prompt">
        <p>Save your scores and track progress over time</p>
        <button class="btn-small" onclick="navigateTo('tiers')">Upgrade to Personal (&pound;35/yr)</button>
      </div>
    `;
  }

  // Duration
  const mins = Math.floor(result.duration / 60);
  const secs = result.duration % 60;
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  container.innerHTML = `
    <div class="drill-results-card">
      <div class="drill-results-title">${drill.name}</div>
      ${scoreHtml}
      ${bonusHtml}
      ${benchmarkHtml}
      ${pbHtml}
      <p style="color: var(--text-muted); font-size: 12px; margin-top: 10px;">Duration: ${durationStr}</p>
      ${upgradeHtml}
    </div>
  `;

  window.scrollTo(0, 0);
}

function getBenchmarkLevel(score, benchmarks) {
  let level = 'below';
  for (let i = 0; i < benchmarks.length; i++) {
    if (score >= benchmarks[i].threshold) {
      level = benchmarks[i].label.toLowerCase();
    }
  }
  return level;
}

function renderBenchmarkBar(score, maxScore, benchmarks, level) {
  if (!maxScore) return '';
  const pct = Math.min(100, (score / maxScore) * 100);

  // Color based on level
  const colors = {
    below: '#ef5350',
    beginner: '#FFA000',
    club: '#FFA000',
    intermediate: '#1976D2',
    advanced: '#4CAF50',
    elite: '#7B1FA2'
  };
  const fillColor = colors[level] || colors.beginner;

  // Benchmark markers
  const markers = benchmarks.map(b => {
    const bPct = (b.threshold / maxScore) * 100;
    return `<div class="drill-benchmark-marker" style="left: ${bPct}%;">
      <span class="drill-benchmark-marker-label">${b.label} (${b.threshold})</span>
    </div>`;
  }).join('');

  // Level badge
  const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);
  const badgeClass = `benchmark-${level === 'club' ? 'beginner' : level}`;

  return `
    <div class="drill-benchmark-bar">
      <div class="drill-benchmark-fill" style="width: ${pct}%; background: ${fillColor};"></div>
      ${markers}
    </div>
    <div>
      <span class="drill-results-benchmark ${badgeClass}">${levelLabel} Level</span>
    </div>
  `;
}

// ===== DRILL NAVIGATION =====

function confirmAbandonDrill() {
  const modal = document.getElementById('drillAbandonModal');
  if (modal) modal.classList.add('active');
}

function closeDrillAbandonModal() {
  const modal = document.getElementById('drillAbandonModal');
  if (modal) modal.classList.remove('active');
}

function abandonDrill() {
  closeDrillAbandonModal();
  clearInterval(drillTimer);
  document.getElementById('drillTimerOverlay').style.display = 'none';
  drillState = null;
  navigateTo('drills');
}

function restartDrill() {
  if (drillState && drillState.drill) {
    startDrill(drillState.drill.id);
  } else {
    navigateTo('drills');
  }
}

function drillNextStep() {
  // Placeholder for drills that need explicit next-step buttons
}
