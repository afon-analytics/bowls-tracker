// Demo Data Loader for Bowls Performance Tracker
// Fetches real data from Supabase tables and loads it into IndexedDB as demo data

const DEMO_DATA_MARKER = '__loaded_from_supabase';

async function generateDemoData() {
  console.log('[Demo] Fetching data from Supabase tables...');

  // Fetch games from Supabase
  const { data: supabaseGames, error: gErr } = await db.from('games')
    .select('*')
    .order('date', { ascending: false });

  if (gErr) throw new Error('Failed to fetch games: ' + gErr.message);
  if (!supabaseGames || supabaseGames.length === 0) {
    throw new Error('No games found in Supabase. Add some data to your Supabase tables first.');
  }

  // Fetch all deliveries from Supabase
  const { data: supabaseDeliveries, error: dErr } = await db.from('deliveries')
    .select('*')
    .order('created_at', { ascending: true });

  if (dErr) throw new Error('Failed to fetch deliveries: ' + dErr.message);

  // Group deliveries by game_id for efficient lookup
  const deliveriesByGame = {};
  for (const d of (supabaseDeliveries || [])) {
    if (!deliveriesByGame[d.game_id]) deliveriesByGame[d.game_id] = [];
    deliveriesByGame[d.game_id].push(d);
  }

  // Track which game IDs we load so removeDemoData can clean them up
  const loadedGameIds = [];

  for (const row of supabaseGames) {
    // Map Supabase row to app game format
    const game = mapSupabaseToGame(row);

    // Preserve fields needed for IndexedDB and app compatibility
    game.completed = row.completed || false;
    game.currentPlayerIndex = 0;
    game.currentTeam = 'yours';
    game.currentHand = 'forehand';
    game.matLength = 'short';
    game.jackLength = 'medium';
    game.gameNumber = loadedGameIds.length + 1;

    // Mark as demo data for cleanup
    game[DEMO_DATA_MARKER] = true;

    await saveGame(game);
    loadedGameIds.push(game.id);

    // Map and save deliveries (bowls) for this game
    const gameDeliveries = deliveriesByGame[row.id] || [];
    if (gameDeliveries.length > 0) {
      const bowls = gameDeliveries.map(d => {
        const bowl = mapDeliveryToBowl(d);
        // Ensure all fields the app expects are present
        bowl.bowlNumber = bowl.bowlNumber || 1;
        bowl.angle = bowl.angle || 0;
        bowl[DEMO_DATA_MARKER] = true;
        return bowl;
      });
      await saveBowlsBatch(bowls);
    }
  }

  // Store the list of loaded game IDs so we can remove them later
  await saveSetting('demoGameIds', loadedGameIds);
  await saveSetting('demoDataLoaded', true);

  console.log(`[Demo] Loaded ${supabaseGames.length} games and ${(supabaseDeliveries || []).length} deliveries from Supabase`);

  return {
    name: 'Supabase Data',
    gamesLoaded: supabaseGames.length,
    deliveriesLoaded: (supabaseDeliveries || []).length
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
