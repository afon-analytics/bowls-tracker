-- ============================================================================
-- BOWLSTRACK MULTI-TENANCY MIGRATION
-- Applied: 2026-03-18
-- Project: ckgppsxswmpzrngzpacv (afon-analytics)
-- ============================================================================

-- 1. Create organisations table
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'essential' CHECK (plan IN ('essential', 'personal', 'club', 'elite')),
  stripe_customer_id TEXT UNIQUE,
  settings JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  seat_count INTEGER NOT NULL DEFAULT 1,
  max_seats INTEGER NOT NULL DEFAULT 1,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create users table (public mirror of auth.users with org link)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  org_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  org_role TEXT DEFAULT 'member' CHECK (org_role IN ('owner', 'admin', 'manager', 'member')),
  role TEXT DEFAULT 'selector' CHECK (role IN ('selector', 'manager')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Add org_id to existing tables
ALTER TABLE players ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE ends ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_players_org_id ON players(org_id);
CREATE INDEX IF NOT EXISTS idx_games_org_id ON games(org_id);
CREATE INDEX IF NOT EXISTS idx_ends_org_id ON ends(org_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_org_id ON deliveries(org_id);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_organisations_slug ON organisations(slug);

-- 6. Helper function: get current user's org_id
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid()
$$;

-- 7. Auto-set org_id trigger function
CREATE OR REPLACE FUNCTION public.set_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.user_org_id();
  END IF;
  RETURN NEW;
END;
$$;

-- 8. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 9. Auto-set org_id triggers
CREATE OR REPLACE TRIGGER set_players_org_id BEFORE INSERT ON players FOR EACH ROW EXECUTE FUNCTION set_org_id();
CREATE OR REPLACE TRIGGER set_games_org_id BEFORE INSERT ON games FOR EACH ROW EXECUTE FUNCTION set_org_id();
CREATE OR REPLACE TRIGGER set_ends_org_id BEFORE INSERT ON ends FOR EACH ROW EXECUTE FUNCTION set_org_id();
CREATE OR REPLACE TRIGGER set_deliveries_org_id BEFORE INSERT ON deliveries FOR EACH ROW EXECUTE FUNCTION set_org_id();
CREATE OR REPLACE TRIGGER set_users_org_id BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION set_org_id();

-- 10. Updated_at triggers
CREATE OR REPLACE TRIGGER set_organisations_updated_at BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE TRIGGER set_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 11. RPC: create organisation for Stripe customer
CREATE OR REPLACE FUNCTION public.create_organisation_for_customer(
  p_org_name TEXT, p_org_slug TEXT, p_plan TEXT DEFAULT 'essential',
  p_user_id UUID DEFAULT NULL, p_stripe_customer_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL, p_stripe_price_id TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_org_id UUID;
BEGIN
  INSERT INTO organisations (name, slug, plan, stripe_customer_id)
  VALUES (p_org_name, p_org_slug, p_plan, p_stripe_customer_id)
  RETURNING id INTO v_org_id;
  IF p_stripe_subscription_id IS NOT NULL THEN
    INSERT INTO subscriptions (org_id, stripe_subscription_id, stripe_price_id, status, seat_count, max_seats)
    VALUES (v_org_id, p_stripe_subscription_id, p_stripe_price_id, 'active', 1,
      CASE p_plan WHEN 'essential' THEN 1 WHEN 'personal' THEN 1 WHEN 'club' THEN 8 WHEN 'elite' THEN 999 ELSE 1 END);
  END IF;
  IF p_user_id IS NOT NULL THEN
    INSERT INTO users (id, org_id, org_role, role) VALUES (p_user_id, v_org_id, 'owner', 'manager')
    ON CONFLICT (id) DO UPDATE SET org_id = v_org_id, org_role = 'owner';
  END IF;
  RETURN v_org_id;
END; $$;

-- 12. Drop old user-based RLS policies
DROP POLICY IF EXISTS "auth users manage games" ON games;
DROP POLICY IF EXISTS "auth users manage players" ON players;
DROP POLICY IF EXISTS "auth users manage ends" ON ends;
DROP POLICY IF EXISTS "auth users manage deliveries" ON deliveries;

-- 13. Enable RLS on new tables
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- 14. Create org-scoped RLS policies
CREATE POLICY "org members can read own org" ON organisations FOR SELECT USING (id = public.user_org_id());
CREATE POLICY "org owners can update own org" ON organisations FOR UPDATE USING (id = public.user_org_id());
CREATE POLICY "users can read own org members" ON users FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "users can manage own record" ON users FOR ALL USING (id = auth.uid());
CREATE POLICY "org members can read subscription" ON subscriptions FOR SELECT USING (org_id = public.user_org_id());
CREATE POLICY "org members manage players" ON players FOR ALL USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());
CREATE POLICY "org members manage games" ON games FOR ALL USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());
CREATE POLICY "org members manage ends" ON ends FOR ALL USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());
CREATE POLICY "org members manage deliveries" ON deliveries FOR ALL USING (org_id = public.user_org_id()) WITH CHECK (org_id = public.user_org_id());
