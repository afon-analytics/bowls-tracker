-- ============================================================================
-- EXISTING DATA MIGRATION
-- Run AFTER the main multi-tenancy migration
-- Assigns all existing data to "Welsh Bowls Demo" organisation
-- ============================================================================

-- Create default organisation for existing demo/test data
INSERT INTO organisations (id, name, slug, plan, settings)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::UUID,
    'Welsh Bowls Demo',
    'welsh-bowls-demo',
    'elite',
    '{"is_demo": true}'::JSONB
) ON CONFLICT (slug) DO NOTHING;

-- Assign all existing players to the demo org
UPDATE players
SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Assign all existing games to the demo org
UPDATE games
SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Assign all existing ends to the demo org
UPDATE ends
SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Assign all existing deliveries to the demo org
UPDATE deliveries
SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Link any existing users to the demo org as owners
UPDATE users
SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID,
    org_role = 'owner'
WHERE org_id IS NULL;

-- Create a demo subscription record
INSERT INTO subscriptions (org_id, status, seat_count, max_seats)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::UUID,
    'active',
    10,
    10
) ON CONFLICT DO NOTHING;
