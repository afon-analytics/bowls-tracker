-- ============================================================================
-- PLAYER DATA-SHARING PREFERENCES
-- Applied: 2026-04-15
-- Purpose: Allow players to opt-in to sharing performance data with selectors
-- ============================================================================

-- 1. Create player_sharing_preferences table
CREATE TABLE IF NOT EXISTS player_sharing_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  player_name TEXT NOT NULL,
  share_enabled BOOLEAN DEFAULT false,
  share_ml_pct BOOLEAN DEFAULT true,
  share_40bowl_test BOOLEAN DEFAULT true,
  share_fh_bh_split BOOLEAN DEFAULT true,
  share_drill_scores BOOLEAN DEFAULT true,
  share_season_trend BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, player_name)
);

-- 2. Enable RLS
ALTER TABLE player_sharing_preferences ENABLE ROW LEVEL SECURITY;

-- 3. Org-scoped RLS policy (consistent with existing pattern)
CREATE POLICY "org_isolation" ON player_sharing_preferences
  FOR ALL
  USING (org_id = public.user_org_id())
  WITH CHECK (org_id = public.user_org_id());

-- 4. Auto-set org_id trigger (consistent with existing tables)
CREATE OR REPLACE TRIGGER set_sharing_prefs_org_id
  BEFORE INSERT ON player_sharing_preferences
  FOR EACH ROW EXECUTE FUNCTION set_org_id();

-- 5. Updated_at trigger
CREATE OR REPLACE TRIGGER set_sharing_prefs_updated_at
  BEFORE UPDATE ON player_sharing_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sharing_prefs_org_id ON player_sharing_preferences(org_id);
CREATE INDEX IF NOT EXISTS idx_sharing_prefs_player ON player_sharing_preferences(org_id, player_name);
