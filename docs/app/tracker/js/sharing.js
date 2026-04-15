// sharing.js — Data sharing preferences, selector squad dashboard, and My Season report

// ===== DATA SHARING PREFERENCES =====

async function initSharingSettings() {
  const locked = document.getElementById('dataSharingLocked');
  const controls = document.getElementById('dataSharingControls');

  if (currentTier === 'essential') {
    if (locked) locked.style.display = 'block';
    if (controls) controls.style.display = 'none';
    return;
  }

  if (locked) locked.style.display = 'none';
  if (controls) controls.style.display = 'block';

  // Load existing preferences
  await loadSharingPreferences();
}

async function loadSharingPreferences() {
  // Try Supabase first, fall back to IndexedDB settings
  let prefs = null;

  if (isAuthenticated() && navigator.onLine && playerRecord) {
    try {
      const { data, error } = await db.from('player_sharing_preferences')
        .select('*')
        .eq('player_name', playerRecord.name)
        .maybeSingle();
      if (!error && data) prefs = data;
    } catch (e) {
      console.warn('[Sharing] Supabase load failed:', e.message);
    }
  }

  // Fallback to local settings
  if (!prefs) {
    const local = await getSetting('sharing_preferences');
    if (local) prefs = local;
  }

  if (prefs) {
    document.getElementById('shareEnabled').checked = prefs.share_enabled || false;
    document.getElementById('shareMlPct').checked = prefs.share_ml_pct !== false;
    document.getElementById('share40Bowl').checked = prefs.share_40bowl_test !== false;
    document.getElementById('shareFhBh').checked = prefs.share_fh_bh_split !== false;
    document.getElementById('shareDrills').checked = prefs.share_drill_scores !== false;
    document.getElementById('shareSeasonTrend').checked = prefs.share_season_trend !== false;

    if (prefs.share_enabled) {
      document.getElementById('granularControls').style.display = 'block';
    }
  }
}

function toggleMasterShare() {
  const enabled = document.getElementById('shareEnabled').checked;
  const granular = document.getElementById('granularControls');
  granular.style.display = enabled ? 'block' : 'none';
  saveSharingPreferences();
}

async function saveSharingPreferences() {
  const prefs = {
    share_enabled: document.getElementById('shareEnabled').checked,
    share_ml_pct: document.getElementById('shareMlPct').checked,
    share_40bowl_test: document.getElementById('share40Bowl').checked,
    share_fh_bh_split: document.getElementById('shareFhBh').checked,
    share_drill_scores: document.getElementById('shareDrills').checked,
    share_season_trend: document.getElementById('shareSeasonTrend').checked
  };

  // Save locally
  await saveSetting('sharing_preferences', prefs);

  // Save to Supabase
  if (isAuthenticated() && navigator.onLine && playerRecord) {
    try {
      const { error } = await db.from('player_sharing_preferences')
        .upsert({
          player_name: playerRecord.name,
          ...prefs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'org_id,player_name' });

      if (error) throw error;
    } catch (e) {
      console.warn('[Sharing] Supabase save failed:', e.message);
    }
  }

  showSaveStatus('Preferences saved');
}

function showSaveStatus(msg) {
  const el = document.getElementById('sharingSaveStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2000);
}

// ===== SHARING PREVIEW =====

async function showSharingPreview() {
  const content = document.getElementById('sharingPreviewContent');
  if (!content) return;

  const playerName = playerRecord?.name || 'You';
  const prefs = {
    share_ml_pct: document.getElementById('shareMlPct').checked,
    share_40bowl_test: document.getElementById('share40Bowl').checked,
    share_fh_bh_split: document.getElementById('shareFhBh').checked,
    share_drill_scores: document.getElementById('shareDrills').checked,
    share_season_trend: document.getElementById('shareSeasonTrend').checked
  };

  const stats = await getPlayerStats(playerName);
  const playerData = buildSharedPlayerData(playerName, stats, prefs);

  content.innerHTML = `
    <div class="preview-card">
      <div class="preview-player-name">${playerData.name}</div>
      <div class="preview-metrics">
        ${playerData.mlPct !== null ? `<div class="preview-metric"><span class="preview-metric-label">ML% this season</span><span class="preview-metric-value">${playerData.mlPct}%</span></div>` : ''}
        ${playerData.fortyBowl !== null ? `<div class="preview-metric"><span class="preview-metric-label">Latest 40-Bowl Test</span><span class="preview-metric-value">${playerData.fortyBowl}</span></div>` : ''}
        ${playerData.fhBhGap !== null ? `<div class="preview-metric"><span class="preview-metric-label">FH vs BH gap</span><span class="preview-metric-value">${playerData.fhBhGap}</span></div>` : ''}
        ${playerData.drillScore !== null ? `<div class="preview-metric"><span class="preview-metric-label">Best drill score</span><span class="preview-metric-value">${playerData.drillScore}</span></div>` : ''}
        ${playerData.seasonTrend !== null ? `<div class="preview-metric"><span class="preview-metric-label">Season trend</span><span class="preview-metric-value trend-${playerData.seasonTrendClass}">${playerData.seasonTrend}</span></div>` : ''}
      </div>
      ${Object.values(prefs).every(v => !v) ? '<p style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">No data shared — all toggles are off.</p>' : ''}
    </div>
  `;

  document.getElementById('sharingPreviewModal').classList.add('active');
}

function closeSharingPreview() {
  document.getElementById('sharingPreviewModal').classList.remove('active');
}

// ===== SHARED PLAYER DATA BUILDER =====

function buildSharedPlayerData(playerName, stats, prefs) {
  const data = { name: playerName, mlPct: null, fortyBowl: null, fhBhGap: null, drillScore: null, seasonTrend: null, seasonTrendClass: 'stable', lastActive: null };

  if (!stats) return data;

  // ML% — percentage of bowls within ~4ft of jack (score >= 3)
  if (prefs.share_ml_pct) {
    const scored = stats.scoreDistribution;
    const total = stats.totalBowls;
    if (total > 0) {
      const matLength = (scored[3] || 0) + (scored[4] || 0);
      data.mlPct = Math.round(matLength / total * 100);
    } else {
      data.mlPct = 0;
    }
  }

  // 40-Bowl Test — use drill_sessions if available, otherwise N/A
  if (prefs.share_40bowl_test) {
    data.fortyBowl = 'N/A';
  }

  // FH vs BH gap
  if (prefs.share_fh_bh_split && stats.handDistribution) {
    const fhCount = stats.handDistribution.forehand || 0;
    const bhCount = stats.handDistribution.backhand || 0;
    // Calculate accuracy per hand from bowls data
    data.fhBhGap = computeHandGap(stats);
  }

  // Drill scores
  if (prefs.share_drill_scores) {
    data.drillScore = 'N/A';
  }

  // Season trend
  if (prefs.share_season_trend && stats.gamePerformance && stats.gamePerformance.length >= 2) {
    const trend = computeSeasonTrend(stats.gamePerformance);
    data.seasonTrend = trend.label;
    data.seasonTrendClass = trend.cls;
  } else if (prefs.share_season_trend) {
    data.seasonTrend = 'Insufficient data';
    data.seasonTrendClass = 'stable';
  }

  // Last active
  if (stats.gamePerformance && stats.gamePerformance.length > 0) {
    const last = stats.gamePerformance[stats.gamePerformance.length - 1];
    data.lastActive = last.date ? formatDate(last.date) : 'Unknown';
  }

  return data;
}

function computeHandGap(stats) {
  // We don't have per-hand accuracy from getPlayerStats directly.
  // Use handDistribution counts as proxy — report count split.
  const fh = stats.handDistribution.forehand || 0;
  const bh = stats.handDistribution.backhand || 0;
  const total = fh + bh;
  if (total === 0) return 'No data';

  const fhPct = Math.round(fh / total * 100);
  const bhPct = Math.round(bh / total * 100);
  const diff = fhPct - bhPct;

  if (Math.abs(diff) < 5) return 'Balanced';
  if (diff > 0) return `+${diff}% FH`;
  return `+${Math.abs(diff)}% BH`;
}

function computeSeasonTrend(gamePerformance) {
  // Use last 8 sessions (or all if fewer)
  const recent = gamePerformance.slice(-8);
  if (recent.length < 2) return { label: 'Stable', cls: 'stable' };

  const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
  const secondHalf = recent.slice(Math.floor(recent.length / 2));

  const avgFirst = firstHalf.reduce((s, g) => s + g.avgScore, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, g) => s + g.avgScore, 0) / secondHalf.length;

  const diff = avgSecond - avgFirst;
  if (diff > 0.2) return { label: 'Improving', cls: 'improving' };
  if (diff < -0.2) return { label: 'Declining', cls: 'declining' };
  return { label: 'Stable', cls: 'stable' };
}

// ===== SELECTOR SQUAD DATA VIEW =====

async function initSquadDataView() {
  const tierLock = document.getElementById('squadTierLock');
  const content = document.getElementById('squadDataContent');
  const banner = document.getElementById('squadSharingBanner');

  // Role check — only selectors, owners, admins, managers
  const hasAccess = !userRole || userRole === 'manager' ||
    (typeof playerRecord !== 'undefined' && playerRecord &&
     ['owner', 'admin', 'manager'].includes(playerRecord.org_role));

  if (!hasAccess && userRole === 'selector') {
    // Selectors need specific role
  }

  // Tier check
  if (currentTier !== 'club' && currentTier !== 'elite') {
    if (tierLock) tierLock.style.display = 'block';
    if (content) content.innerHTML = '';
    if (banner) banner.innerHTML = '';
    return;
  }

  if (tierLock) tierLock.style.display = 'none';

  // Load player sharing preferences from Supabase
  let sharedPrefs = [];
  if (isAuthenticated() && navigator.onLine) {
    try {
      const { data, error } = await db.from('player_sharing_preferences')
        .select('*');
      if (!error && data) sharedPrefs = data;
    } catch (e) {
      console.warn('[Squad] Failed to load sharing prefs:', e.message);
    }
  }

  // Also get all tracked player names
  const allBowls = await getAllBowls();
  const allPlayerNames = getTrackedPlayerNames(allBowls);

  // Tier limit
  const maxPlayers = currentTier === 'elite' ? Infinity : 8;

  // Build squad data
  const optedIn = sharedPrefs.filter(p => p.share_enabled);
  const optedInNames = new Set(optedIn.map(p => p.player_name));

  // Show banner
  if (banner) {
    banner.innerHTML = `<span>${optedIn.length} of ${allPlayerNames.length} players have shared their data with you</span>`;
  }

  // Build table rows
  let rows = [];
  let shownCount = 0;

  for (const name of allPlayerNames) {
    if (shownCount >= maxPlayers) break;

    const prefs = optedIn.find(p => p.player_name === name);
    if (prefs) {
      const stats = await getPlayerStats(name);
      const shared = buildSharedPlayerData(name, stats, {
        share_ml_pct: prefs.share_ml_pct,
        share_40bowl_test: prefs.share_40bowl_test,
        share_fh_bh_split: prefs.share_fh_bh_split,
        share_drill_scores: prefs.share_drill_scores,
        share_season_trend: prefs.share_season_trend
      });
      rows.push({ ...shared, optedIn: true, sortMl: shared.mlPct || 0, sortTrend: shared.seasonTrendClass });
      shownCount++;
    } else {
      rows.push({ name: 'Anonymous player', optedIn: false, mlPct: null, fortyBowl: null, fhBhGap: null, drillScore: null, seasonTrend: null, seasonTrendClass: 'stable', lastActive: null, sortMl: -1, sortTrend: '' });
    }
  }

  renderSquadTable(content, rows);
}

let squadSortColumn = 'name';
let squadSortAsc = true;

function renderSquadTable(container, rows) {
  if (!container) return;

  if (rows.length === 0) {
    container.innerHTML = '<div class="no-games">No player data available yet. Players need to track sessions and opt in to sharing.</div>';
    return;
  }

  // Store rows for re-sorting
  window._squadRows = rows;

  container.innerHTML = `
    <div class="squad-table-wrapper">
      <table class="squad-data-table">
        <thead>
          <tr>
            <th class="sortable" onclick="sortSquadTable('name')">Player ${squadSortColumn === 'name' ? (squadSortAsc ? '&#9650;' : '&#9660;') : ''}</th>
            <th class="sortable" onclick="sortSquadTable('mlPct')">ML% ${squadSortColumn === 'mlPct' ? (squadSortAsc ? '&#9650;' : '&#9660;') : ''}</th>
            <th class="sortable" onclick="sortSquadTable('fortyBowl')">40-Bowl ${squadSortColumn === 'fortyBowl' ? (squadSortAsc ? '&#9650;' : '&#9660;') : ''}</th>
            <th class="sortable" onclick="sortSquadTable('fhBhGap')">FH/BH Gap ${squadSortColumn === 'fhBhGap' ? (squadSortAsc ? '&#9650;' : '&#9660;') : ''}</th>
            <th class="sortable" onclick="sortSquadTable('seasonTrend')">Trend ${squadSortColumn === 'seasonTrend' ? (squadSortAsc ? '&#9650;' : '&#9660;') : ''}</th>
            <th class="sortable" onclick="sortSquadTable('lastActive')">Last Active ${squadSortColumn === 'lastActive' ? (squadSortAsc ? '&#9650;' : '&#9660;') : ''}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            if (!r.optedIn) {
              return `<tr class="squad-row-anonymous">
                <td>${r.name}</td>
                <td colspan="5" style="text-align: center; color: var(--text-muted); font-style: italic;">Player has not enabled data sharing</td>
              </tr>`;
            }
            return `<tr>
              <td><strong>${r.name}</strong></td>
              <td>${r.mlPct !== null ? r.mlPct + '%' : '&mdash;'}</td>
              <td>${r.fortyBowl || '&mdash;'}</td>
              <td>${r.fhBhGap || '&mdash;'}</td>
              <td><span class="trend-${r.seasonTrendClass}">${r.seasonTrend || '&mdash;'}</span></td>
              <td>${r.lastActive || '&mdash;'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function sortSquadTable(column) {
  if (squadSortColumn === column) {
    squadSortAsc = !squadSortAsc;
  } else {
    squadSortColumn = column;
    squadSortAsc = true;
  }

  const rows = window._squadRows || [];

  rows.sort((a, b) => {
    // Non-opted-in always at bottom
    if (!a.optedIn && b.optedIn) return 1;
    if (a.optedIn && !b.optedIn) return -1;
    if (!a.optedIn && !b.optedIn) return 0;

    let va = a[column];
    let vb = b[column];

    // Null/undefined handling
    if (va == null) va = '';
    if (vb == null) vb = '';

    if (typeof va === 'number' && typeof vb === 'number') {
      return squadSortAsc ? va - vb : vb - va;
    }

    va = String(va).toLowerCase();
    vb = String(vb).toLowerCase();
    if (va < vb) return squadSortAsc ? -1 : 1;
    if (va > vb) return squadSortAsc ? 1 : -1;
    return 0;
  });

  const container = document.getElementById('squadDataContent');
  renderSquadTable(container, rows);
}

// ===== MY SEASON REPORT =====

async function showSeasonReport() {
  if (currentTier === 'essential') {
    alert('My Season Report is available on Personal tier and above. Upgrade to unlock this feature.');
    return;
  }

  const modal = document.getElementById('seasonReportModal');
  const content = document.getElementById('seasonReportContent');
  if (!modal || !content) return;

  // Get current player from analytics selector or playerRecord
  const playerSelect = document.getElementById('analyticsPlayerSelect');
  const playerName = playerSelect ? playerSelect.value : (playerRecord?.name || 'Player');

  const stats = await getPlayerStats(playerName);
  if (!stats) {
    content.innerHTML = `
      <h2>My Season Report</h2>
      <p style="text-align: center; color: var(--text-secondary); padding: 20px;">No data available for ${playerName}. Play some sessions first.</p>
      <div class="action-buttons"><button onclick="closeSeasonReport()">Close</button></div>
    `;
    modal.classList.add('active');
    return;
  }

  // Compute metrics
  const scored = stats.scoreDistribution;
  const total = stats.totalBowls;
  const matLength = total > 0 ? Math.round(((scored[3] || 0) + (scored[4] || 0)) / total * 100) : 0;

  const fhCount = stats.handDistribution.forehand || 0;
  const bhCount = stats.handDistribution.backhand || 0;
  const handTotal = fhCount + bhCount;
  const fhPct = handTotal > 0 ? Math.round(fhCount / handTotal * 100) : 50;
  const bhPct = handTotal > 0 ? Math.round(bhCount / handTotal * 100) : 50;

  const trend = computeSeasonTrend(stats.gamePerformance);

  // Season date range
  const dates = stats.gamePerformance.map(g => g.date).filter(Boolean).sort();
  const seasonStart = dates.length > 0 ? formatDate(dates[0]) : 'N/A';
  const seasonEnd = dates.length > 0 ? formatDate(dates[dates.length - 1]) : 'N/A';

  // Improvement calculation
  let improvementText = '';
  if (stats.gamePerformance.length >= 2) {
    const first = stats.gamePerformance[0].avgScore;
    const last = stats.gamePerformance[stats.gamePerformance.length - 1].avgScore;
    const diff = last - first;
    const pctChange = first > 0 ? Math.round(Math.abs(diff) / first * 100) : 0;
    if (diff > 0.1) {
      improvementText = `Your accuracy has improved ${pctChange}% since ${seasonStart}.`;
    } else if (diff < -0.1) {
      improvementText = `Your accuracy has decreased ${pctChange}% since ${seasonStart}. Keep practicing!`;
    } else {
      improvementText = `Your accuracy has remained consistent since ${seasonStart}.`;
    }
  }

  content.innerHTML = `
    <div class="season-report" id="seasonReportPrintable">
      <div class="season-report-header">
        <div class="season-report-logo">&#127923; BowlsTrack</div>
        <h2 style="margin: 8px 0 4px;">My Season Report</h2>
        <div class="season-report-player">${playerName}</div>
        <div class="season-report-dates">${seasonStart} &mdash; ${seasonEnd}</div>
      </div>

      <div class="season-report-grid">
        <div class="season-report-stat">
          <div class="season-report-stat-value">${stats.gamesPlayed}</div>
          <div class="season-report-stat-label">Sessions Played</div>
        </div>
        <div class="season-report-stat">
          <div class="season-report-stat-value">${stats.totalBowls}</div>
          <div class="season-report-stat-label">Total Bowls</div>
        </div>
        <div class="season-report-stat">
          <div class="season-report-stat-value">${matLength}%</div>
          <div class="season-report-stat-label">ML% This Season</div>
        </div>
        <div class="season-report-stat">
          <div class="season-report-stat-value">${stats.avgScore.toFixed(2)}</div>
          <div class="season-report-stat-label">Avg Score (0-4)</div>
        </div>
      </div>

      <div class="season-report-section">
        <h4>Forehand / Backhand Split</h4>
        <div class="season-report-hand-bar">
          <div class="hand-bar-fh" style="width: ${fhPct}%;">${fhPct}% FH</div>
          <div class="hand-bar-bh" style="width: ${bhPct}%;">${bhPct}% BH</div>
        </div>
      </div>

      <div class="season-report-section">
        <h4>Season Trend</h4>
        <div class="season-report-trend trend-${trend.cls}">
          ${trend.label}
        </div>
        ${improvementText ? `<p class="season-report-narrative">${improvementText}</p>` : ''}
      </div>

      <div class="season-report-footer">
        Generated by BowlsTrack &bull; ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
    </div>

    <div class="action-buttons season-report-actions">
      <button onclick="printSeasonReport()">Print / Save as PDF</button>
      <button class="btn-secondary" onclick="closeSeasonReport()">Close</button>
    </div>
  `;

  modal.classList.add('active');
}

function closeSeasonReport() {
  document.getElementById('seasonReportModal').classList.remove('active');
}

function printSeasonReport() {
  const printContent = document.getElementById('seasonReportPrintable');
  if (!printContent) return;

  const printWindow = window.open('', '_blank', 'width=800,height=600');
  printWindow.document.write(`<!DOCTYPE html>
<html><head><title>My Season Report - BowlsTrack</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; }
  .season-report-header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1e3c72; padding-bottom: 16px; }
  .season-report-logo { font-size: 24px; font-weight: 700; color: #1e3c72; }
  h2 { color: #1e3c72; font-size: 20px; }
  .season-report-player { font-size: 18px; font-weight: 700; margin-top: 4px; }
  .season-report-dates { font-size: 13px; color: #666; }
  .season-report-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
  .season-report-stat { text-align: center; padding: 12px; background: #f5f5f5; border-radius: 8px; }
  .season-report-stat-value { font-size: 28px; font-weight: 700; color: #1e3c72; }
  .season-report-stat-label { font-size: 12px; color: #666; margin-top: 4px; }
  .season-report-section { margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 8px; }
  .season-report-section h4 { color: #1e3c72; margin-bottom: 8px; font-size: 14px; }
  .season-report-hand-bar { display: flex; height: 30px; border-radius: 15px; overflow: hidden; font-size: 12px; font-weight: 600; color: white; }
  .hand-bar-fh { background: #2a5298; display: flex; align-items: center; justify-content: center; }
  .hand-bar-bh { background: #f44336; display: flex; align-items: center; justify-content: center; }
  .season-report-trend { font-size: 18px; font-weight: 700; }
  .trend-improving { color: #4CAF50; }
  .trend-declining { color: #f44336; }
  .trend-stable { color: #FF9800; }
  .season-report-narrative { font-size: 14px; color: #666; margin-top: 8px; line-height: 1.5; }
  .season-report-footer { text-align: center; font-size: 11px; color: #999; margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; }
  @media print { body { padding: 15px; } }
</style></head><body>${printContent.innerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}
