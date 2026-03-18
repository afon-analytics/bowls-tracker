-- ============================================================
-- BowlsTrack: Enhanced Organisation & Subscription Functions
-- Migration 002: Stripe onboarding support
-- ============================================================

-- Function: Create organisation for a new Stripe customer
-- Called by the stripe-webhook edge function after checkout.session.completed
CREATE OR REPLACE FUNCTION public.create_organisation_for_customer(
  p_name TEXT,
  p_slug TEXT,
  p_plan TEXT,
  p_owner_id UUID,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_stripe_price_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_slug TEXT := p_slug;
  v_counter INT := 0;
BEGIN
  -- Ensure slug is unique by appending a counter if needed
  WHILE EXISTS (SELECT 1 FROM organisations WHERE slug = v_slug) LOOP
    v_counter := v_counter + 1;
    v_slug := p_slug || '-' || v_counter;
  END LOOP;

  -- Create the organisation
  INSERT INTO organisations (name, slug, plan, stripe_customer_id, created_at, updated_at)
  VALUES (p_name, v_slug, p_plan, p_stripe_customer_id, NOW(), NOW())
  RETURNING id INTO v_org_id;

  -- Create the subscription record
  INSERT INTO subscriptions (
    org_id,
    stripe_subscription_id,
    stripe_price_id,
    plan,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_org_id,
    p_stripe_subscription_id,
    p_stripe_price_id,
    p_plan,
    'active',
    NOW(),
    NOW()
  );

  -- Link the owner to the organisation
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('org_id', v_org_id::TEXT, 'role', 'owner')
  WHERE id = p_owner_id;

  -- Also add to org_members table if it exists
  INSERT INTO org_members (org_id, user_id, role, created_at)
  VALUES (v_org_id, p_owner_id, 'owner', NOW())
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'slug', v_slug,
    'plan', p_plan,
    'owner_id', p_owner_id
  );
END;
$$;

-- Function: Look up organisation by Stripe customer ID
CREATE OR REPLACE FUNCTION public.get_org_by_stripe_customer(p_stripe_customer_id TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  plan TEXT,
  stripe_customer_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, o.slug, o.plan, o.stripe_customer_id
  FROM organisations o
  WHERE o.stripe_customer_id = p_stripe_customer_id;
END;
$$;

-- Function: Check if a subscription is currently active
CREATE OR REPLACE FUNCTION public.is_subscription_active(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM subscriptions
  WHERE org_id = p_org_id
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_status IN ('active', 'trialing');
END;
$$;

-- Function: Get current user's subscription status (for RLS / client use)
CREATE OR REPLACE FUNCTION public.my_subscription_status()
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  plan TEXT,
  status TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get org_id from the user's app metadata
  v_org_id := (auth.jwt() -> 'app_metadata' ->> 'org_id')::UUID;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id AS org_id,
    o.name AS org_name,
    s.plan,
    s.status,
    s.stripe_subscription_id,
    s.current_period_end
  FROM organisations o
  LEFT JOIN subscriptions s ON s.org_id = o.id
  WHERE o.id = v_org_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_organisation_for_customer TO service_role;
GRANT EXECUTE ON FUNCTION public.get_org_by_stripe_customer TO service_role;
GRANT EXECUTE ON FUNCTION public.is_subscription_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_subscription_status TO authenticated;
