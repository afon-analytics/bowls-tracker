// supabase.js - Supabase integration with offline-first sync
// Loaded BEFORE db.js so `db` is available globally as the Supabase client.

const SUPABASE_URL = 'https://ckgppsxswmpzrngzpacv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_jhJmn9v-nJdHHA6riwqjBw_R5kSatXp';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== AUTH STATE =====

let currentUser = null;
let userRole = null;   // 'manager' | 'selector'
let playerRecord = null;

// ===== AUTH FUNCTIONS =====

async function supabaseLogin(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;

  currentUser = data.user;

  // Look up the player row to get role
  const { data: player, error: pErr } = await db.from('players')
    .select('role, name')
    .eq('user_id', data.user.id)
    .single();

  if (pErr && pErr.code !== 'PGRST116') {
    console.warn('[Supabase] Player lookup warning:', pErr.message);
  }

  playerRecord = player || null;
  userRole = player?.role || 'selector';

  return { user: data.user, role: userRole, player: playerRecord };
}

async function supabaseLogout() {
  unsubscribeAll();
  await db.auth.signOut();
  currentUser = null;
  userRole = null;
  playerRecord = null;
}

async function checkSession() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return null;

    currentUser = session.user;

    const { data: player } = await db.from('players')
      .select('role, name')
      .eq('user_id', session.user.id)
      .single();

    playerRecord = player || null;
    userRole = player?.role || 'selector';

    return { user: session.user, role: userRole, player: playerRecord };
  } catch (err) {
    console.warn('[Supabase] Session check failed:', err.message);
    return null;
  }
}

function isAuthenticated() {
  return currentUser !== null;
}

// ===== OFFLINE QUEUE =====

const QUEUE_KEY = 'bowlstrack_sync_queue';

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

function saveQueueToStorage(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function enqueue(operation) {
  const queue = getQueue();
  queue.push({ ...operation, ts: Date.now() });
  saveQueueToStorage(queue);
  updateSyncIndicator();
}

async function processQueue() {
  if (!navigator.onLine || !isAuthenticated()) return;

  const queue = getQueue();
  if (queue.length === 0) return;

  console.log(`[Supabase] Processing ${queue.length} queued operations...`);
  updateSyncIndicator('syncing');

  const failed = [];
  for (const op of queue) {
    try {
      await executeQueuedOp(op);
    } catch (err) {
      console.error('[Supabase] Queue op failed:', op.type, err.message);
      failed.push(op);
    }
  }

  saveQueueToStorage(failed);
  updateSyncIndicator(failed.length > 0 ? 'offline' : 'online');
  if (failed.length === 0) {
    console.log('[Supabase] Queue fully synced');
  } else {
    console.warn(`[Supabase] ${failed.length} ops still pending`);
  }
}

async function executeQueuedOp(op) {
  switch (op.type) {
    case 'upsert_game': {
      const { error } = await db.from('games').upsert(op.data, { onConflict: 'id' });
      if (error) throw error;
      break;
    }
    case 'upsert_deliveries': {
      const { error } = await db.from('deliveries').upsert(op.data, { onConflict: 'id' });
      if (error) throw error;
      break;
    }
    case 'upsert_end': {
      const { error } = await db.from('ends').upsert(op.data, { onConflict: 'id' });
      if (error) throw error;
      break;
    }
    case 'upsert_ends': {
      const { error } = await db.from('ends').upsert(op.data, { onConflict: 'id' });
      if (error) throw error;
      break;
    }
    case 'delete_game': {
      await db.from('deliveries').delete().eq('game_id', op.gameId);
      await db.from('ends').delete().eq('game_id', op.gameId);
      await db.from('games').delete().eq('id', op.gameId);
      break;
    }
    case 'insert_drill_session': {
      const { error } = await db.from('drill_sessions').insert(op.data);
      if (error) throw error;
      break;
    }
    default:
      console.warn('[Supabase] Unknown queue op:', op.type);
  }
}

// Auto-sync when coming back online
window.addEventListener('online', () => {
  console.log('[Supabase] Back online — syncing queue');
  updateSyncIndicator('syncing');
  processQueue();
});

window.addEventListener('offline', () => {
  console.log('[Supabase] Gone offline');
  updateSyncIndicator('offline');
});

// ===== SYNC INDICATOR UI =====

function updateSyncIndicator(state) {
  const el = document.getElementById('syncIndicator');
  if (!el) return;

  if (!state) state = navigator.onLine ? 'online' : 'offline';

  const dot = el.querySelector('.sync-dot');
  const label = el.querySelector('.sync-label');
  if (!dot || !label) return;

  dot.className = 'sync-dot';
  switch (state) {
    case 'online':
      dot.classList.add('online');
      label.textContent = 'Synced';
      break;
    case 'offline':
      dot.classList.add('offline');
      label.textContent = 'Offline';
      break;
    case 'syncing':
      dot.classList.add('syncing');
      label.textContent = 'Syncing...';
      break;
  }
}

// ===== DATA MAPPING: App → Supabase =====

function mapGameToSupabase(game) {
  return {
    id: game.id || game.gameId,
    tournament_name: game.tournamentName || '',
    format: game.format || 'singles',
    game_type: game.gameType || 'game',
    match_structure: game.matchStructure || 'traditional',
    total_ends: game.totalEnds || game.endCount || 21,
    current_end: game.currentEnd || 1,
    completed: game.completed || false,
    date: game.date || new Date().toISOString(),
    your_players: game.yourPlayers || game.players || [],
    opponent_players: game.opponentPlayers || [],
    away_players: game.awayPlayers || [],
    bowls_per_player: game.bowlsPerPlayer || 4,
    players_per_team: game.playersPerTeam || 1,
    number_of_sets: game.numberOfSets || null,
    ends_per_set: game.endsPerSet || null,
    tie_break_ends: game.tieBreakEnds || null,
    current_set: game.currentSet || 1,
    set_scores: game.setScores || [],
    end_notes: game.endNotes || {},
    game_notes: game.gameNotes || game.notes || '',
    jack_position: game.jackPosition || null,
    created_by: currentUser?.id || null
  };
}

function mapSupabaseToGame(row) {
  return {
    id: row.id,
    gameId: row.id,
    tournamentName: row.tournament_name || '',
    format: row.format || 'singles',
    gameType: row.game_type || 'game',
    matchStructure: row.match_structure || 'traditional',
    totalEnds: row.total_ends || 21,
    endCount: row.total_ends || 21,
    currentEnd: row.current_end || 1,
    completed: row.completed ?? (row.status === 'completed'),
    date: row.date,
    yourPlayers: row.your_players || [],
    players: row.your_players || [],
    opponentPlayers: row.opponent_players || [],
    awayPlayers: row.away_players || [],
    bowlsPerPlayer: row.bowls_per_player || 4,
    playersPerTeam: row.players_per_team || 1,
    numberOfSets: row.number_of_sets || null,
    endsPerSet: row.ends_per_set || null,
    tieBreakEnds: row.tie_break_ends || null,
    currentSet: row.current_set || 1,
    setScores: row.set_scores || [],
    endNotes: row.end_notes || {},
    gameNotes: row.game_notes || '',
    jackPosition: row.jack_position || { x: 250, y: 250 },
    bowls: [] // Bowls loaded separately
  };
}

function mapBowlToDelivery(bowl, gameId) {
  return {
    id: bowl.id,
    game_id: gameId || bowl.gameId,
    end_number: bowl.endNumber || bowl.end,
    player_name: bowl.playerName || bowl.player,
    player_id: bowl.playerId || null,
    team: bowl.team,
    x: bowl.x,
    y: bowl.y,
    hand: bowl.hand || null,
    position: bowl.position || null,
    score_value: bowl.score != null ? bowl.score : (bowl.scoreValue || 0),
    result_category: bowl.resultCategory || bowl.direction || null,
    distance_category: bowl.distanceCategory || null,
    distance_in_feet: bowl.distance || bowl.distanceInFeet || 0,
    score_category: bowl.scoreCategory || null,
    score_detail: bowl.scoreDetail || null,
    mat_length: bowl.matLength || null,
    jack_length: bowl.jackLength || null,
    shot_type: bowl.shotType || null,
    quality: bowl.quality || null,
    is_dead: bowl.isDead || false,
    notes: bowl.notes || '',
    timestamp: bowl.timestamp || new Date().toISOString()
  };
}

function mapDeliveryToBowl(d) {
  return {
    id: d.id,
    gameId: d.game_id,
    end: d.end_number || null,
    endNumber: d.end_number || null,
    bowlNumber: d.bowl_number || null,
    player: d.player_name,
    playerName: d.player_name,
    playerId: d.player_id,
    team: d.team || null,
    x: d.x,
    y: d.y,
    hand: d.hand || d.shot_type || null,
    position: d.position || null,
    scoreValue: d.score_value ?? d.mark ?? 0,
    score: d.score_value ?? d.mark ?? 0,
    resultCategory: d.result_category || d.bowl_result || null,
    direction: d.result_category || d.bowl_result || null,
    distanceCategory: d.distance_category || null,
    distanceInFeet: d.distance_in_feet || 0,
    distance: d.distance_in_feet || 0,
    scoreCategory: d.score_category || d.scoring_method || null,
    scoreDetail: d.score_detail || null,
    matLength: d.mat_length || d.mat_position || null,
    jackLength: d.jack_length || null,
    shotType: d.shot_type || null,
    quality: d.quality || null,
    isDead: d.is_dead || false,
    notes: d.notes || '',
    timestamp: d.timestamp || d.created_at || new Date().toISOString()
  };
}

function mapEndToSupabase(gameId, endNumber, endData) {
  return {
    id: `${gameId}_end_${endNumber}`,
    game_id: gameId,
    end_number: endNumber,
    your_score: endData.yours || 0,
    opponent_score: endData.opponent || 0,
    notes: endData.notes || ''
  };
}

// ===== SUPABASE WRITE LAYER =====
// These functions sync data to Supabase after IndexedDB writes.
// Called from the overridden db.js functions (set up in initSupabaseSync).

async function syncGameToSupabase(game) {
  if (!isAuthenticated()) return;
  const mapped = mapGameToSupabase(game);

  if (navigator.onLine) {
    try {
      const { error } = await db.from('games').upsert(mapped, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.warn('[Supabase] Game sync queued:', err.message);
      enqueue({ type: 'upsert_game', data: mapped });
    }
  } else {
    enqueue({ type: 'upsert_game', data: mapped });
  }
}

async function syncDeliveriesToSupabase(bowls, gameId) {
  if (!isAuthenticated()) return;
  const deliveries = bowls.map(b => mapBowlToDelivery(b, gameId));
  if (deliveries.length === 0) return;

  if (navigator.onLine) {
    try {
      const { error } = await db.from('deliveries').upsert(deliveries, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.warn('[Supabase] Deliveries sync queued:', err.message);
      enqueue({ type: 'upsert_deliveries', data: deliveries });
    }
  } else {
    enqueue({ type: 'upsert_deliveries', data: deliveries });
  }
}

async function syncEndsToSupabase(gameId, endScores, endNotes) {
  if (!isAuthenticated()) return;
  if (!endScores || endScores.length === 0) return;

  const ends = endScores.map((es, i) => ({
    id: `${gameId}_end_${es.end || i + 1}`,
    game_id: gameId,
    end_number: es.end || i + 1,
    your_score: es.yours || 0,
    opponent_score: es.opponent || 0,
    notes: (endNotes && endNotes[es.end || i + 1]) || ''
  }));

  if (navigator.onLine) {
    try {
      const { error } = await db.from('ends').upsert(ends, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.warn('[Supabase] Ends sync queued:', err.message);
      enqueue({ type: 'upsert_ends', data: ends });
    }
  } else {
    enqueue({ type: 'upsert_ends', data: ends });
  }
}

async function syncDeleteGame(gameId) {
  if (!isAuthenticated()) return;

  if (navigator.onLine) {
    try {
      await db.from('deliveries').delete().eq('game_id', gameId);
      await db.from('ends').delete().eq('game_id', gameId);
      await db.from('games').delete().eq('id', gameId);
    } catch (err) {
      console.warn('[Supabase] Delete sync queued:', err.message);
      enqueue({ type: 'delete_game', gameId });
    }
  } else {
    enqueue({ type: 'delete_game', gameId });
  }
}

// ===== OVERRIDE db.js FUNCTIONS =====
// Called after db.js loads via initSupabaseSync() from app init.

function initSupabaseSync() {
  // Override saveGame
  const _origSaveGame = window.saveGame;
  window.saveGame = async function(game) {
    const result = await _origSaveGame(game);
    // Fire-and-forget Supabase sync
    syncGameToSupabase(game);
    // Sync end scores if present
    if (game.endScores && game.endScores.length > 0) {
      syncEndsToSupabase(game.id || game.gameId, game.endScores, game.endNotes);
    }
    return result;
  };

  // Override saveBowlsBatch
  const _origSaveBowlsBatch = window.saveBowlsBatch;
  window.saveBowlsBatch = async function(bowls) {
    const result = await _origSaveBowlsBatch(bowls);
    if (bowls.length > 0) {
      syncDeliveriesToSupabase(bowls, bowls[0].gameId);
    }
    return result;
  };

  // Override saveBowl
  const _origSaveBowl = window.saveBowl;
  window.saveBowl = async function(bowl) {
    const result = await _origSaveBowl(bowl);
    syncDeliveriesToSupabase([bowl], bowl.gameId);
    return result;
  };

  // Override deleteGame
  const _origDeleteGame = window.deleteGame;
  window.deleteGame = async function(id) {
    const result = await _origDeleteGame(id);
    syncDeleteGame(id);
    return result;
  };

  console.log('[Supabase] Sync layer initialized — writes go to IndexedDB + Supabase');
}

// ===== INITIAL DATA PULL =====
// On login, pull latest data from Supabase into IndexedDB.

async function pullDataFromSupabase() {
  if (!isAuthenticated() || !navigator.onLine) return;

  console.log('[Supabase] Pulling latest data from cloud...');
  updateSyncIndicator('syncing');

  try {
    // Pull games
    const { data: games, error: gErr } = await db.from('games')
      .select('*')
      .order('date', { ascending: false });

    if (gErr) throw gErr;

    for (const row of (games || [])) {
      const game = mapSupabaseToGame(row);
      game.id = row.id;
      await window._origSaveGame
        ? window._origSaveGame(game)
        : saveGame(game);
    }

    // Pull deliveries
    const { data: deliveries, error: dErr } = await db.from('deliveries')
      .select('*')
      .order('timestamp', { ascending: true });

    if (dErr) throw dErr;

    if (deliveries && deliveries.length > 0) {
      const bowls = deliveries.map(mapDeliveryToBowl);
      // Group by game and batch save
      const byGame = {};
      bowls.forEach(b => {
        if (!byGame[b.gameId]) byGame[b.gameId] = [];
        byGame[b.gameId].push(b);
      });
      for (const gid of Object.keys(byGame)) {
        await (window._origSaveBowlsBatch
          ? window._origSaveBowlsBatch(byGame[gid])
          : saveBowlsBatch(byGame[gid]));
      }
    }

    console.log(`[Supabase] Pulled ${(games || []).length} games, ${(deliveries || []).length} deliveries`);
    updateSyncIndicator('online');
  } catch (err) {
    console.error('[Supabase] Pull failed:', err.message);
    updateSyncIndicator('offline');
  }
}

// ===== REAL-TIME SUBSCRIPTIONS =====

let activeSubscriptions = [];

function subscribeToGameDeliveries(gameId, onDelivery) {
  const channel = db.channel(`deliveries-game-${gameId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'deliveries',
      filter: `game_id=eq.${gameId}`
    }, (payload) => {
      console.log('[Supabase RT] Delivery change:', payload.eventType);
      if (onDelivery) onDelivery(payload);
    })
    .subscribe((status) => {
      console.log('[Supabase RT] Subscription status:', status);
    });

  activeSubscriptions.push(channel);
  return channel;
}

function subscribeToAllGames(onGameChange) {
  const channel = db.channel('all-games')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'games'
    }, (payload) => {
      console.log('[Supabase RT] Game change:', payload.eventType);
      if (onGameChange) onGameChange(payload);
    })
    .subscribe();

  activeSubscriptions.push(channel);
  return channel;
}

function unsubscribeAll() {
  activeSubscriptions.forEach(ch => {
    try { ch.unsubscribe(); } catch {}
  });
  activeSubscriptions = [];
}

// ===== LOGIN / LOGOUT UI HANDLERS =====

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const spinner = document.getElementById('loginSpinner');
  const btn = document.getElementById('loginBtn');

  if (!email || !password) {
    errorEl.textContent = 'Please enter email and password';
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  spinner.style.display = 'block';
  btn.disabled = true;

  try {
    const { role } = await supabaseLogin(email, password);

    // Pull cloud data into local DB
    await pullDataFromSupabase();

    // Process any pending offline queue
    await processQueue();

    // Show appropriate view based on role
    showAuthenticatedUI(role);
  } catch (err) {
    errorEl.textContent = err.message || 'Login failed';
    errorEl.style.display = 'block';
  } finally {
    spinner.style.display = 'none';
    btn.disabled = false;
  }
}

function continueOffline() {
  // Skip auth, use local IndexedDB only
  showAuthenticatedUI(null);
}

async function handleLogout() {
  try {
    await supabaseLogout();
  } catch {}
  // Show login screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('loginScreen').classList.add('active');
  const userBar = document.getElementById('userBar');
  if (userBar) userBar.style.display = 'none';
  const tierBanner = document.getElementById('tierBanner');
  if (tierBanner) tierBanner.style.display = 'none';
}

function showAuthenticatedUI(role) {
  // Hide login
  document.getElementById('loginScreen').classList.remove('active');

  // Show user bar if authenticated
  const userBar = document.getElementById('userBar');
  if (userBar && isAuthenticated()) {
    userBar.style.display = 'flex';
    const nameEl = userBar.querySelector('.user-bar-name');
    const roleEl = userBar.querySelector('.user-bar-role');
    if (nameEl) nameEl.textContent = playerRecord?.name || currentUser?.email || 'User';
    if (roleEl) {
      roleEl.textContent = userRole;
      roleEl.className = 'user-bar-role ' + (userRole === 'manager' ? 'role-manager' : 'role-selector');
    }
  }

  // Show/hide tier banner (managers see it, selectors don't need it)
  const tierBanner = document.getElementById('tierBanner');
  if (tierBanner) {
    tierBanner.style.display = (role === 'manager' || !role) ? 'flex' : 'none';
  }

  updateSyncIndicator();

  // Apply role-based UI visibility
  applyRoleVisibility(role);

  // Always land on the home screen
  navigateTo('home');

  // Show install prompt on first login
  if (typeof checkAndShowInstallPrompt === 'function') {
    checkAndShowInstallPrompt();
  }
}

function applyRoleVisibility(role) {
  const isSelector = role === 'selector';

  // Show/hide elements with class 'role-manager-only'
  document.querySelectorAll('.role-manager-only').forEach(el => {
    el.style.display = isSelector ? 'none' : '';
  });
}

// ===== SUBSCRIPTION TIER =====

async function getUserTier() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return 'essential';

  const { data: userData } = await db
    .from('users')
    .select('org_id')
    .eq('id', user.id)
    .single();

  if (!userData?.org_id) return 'essential';

  const { data: org } = await db
    .from('organisations')
    .select('plan')
    .eq('id', userData.org_id)
    .single();

  return org?.plan ?? 'essential';
}

async function applyTierClass() {
  const tier = await getUserTier();
  document.body.classList.remove('tier-essential', 'tier-personal', 'tier-club', 'tier-elite');
  document.body.classList.add(`tier-${tier}`);
  if (typeof currentTier !== 'undefined') currentTier = tier;
  if (typeof updateTierButtons === 'function') updateTierButtons();
  return tier;
}

// Enter key triggers login
document.addEventListener('DOMContentLoaded', () => {
  const pwField = document.getElementById('loginPassword');
  if (pwField) {
    pwField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }
});
