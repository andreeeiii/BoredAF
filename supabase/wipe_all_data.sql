-- ============================================
-- FULL DATA WIPE — Run in Supabase SQL Editor
-- This wipes ALL user data and pool entries
-- for a completely fresh start
-- ============================================

-- 1. Wipe all suggestion pool entries
TRUNCATE TABLE suggestion_pool;

-- 2. Wipe all user history
TRUNCATE TABLE baf_history;

-- 3. Wipe all persona stats (blacklists, energy, archetype, onboarding status)
TRUNCATE TABLE persona_stats;

-- 4. Wipe all interests
TRUNCATE TABLE interests;

-- 5. Reset user profile (clear persona embedding + archetype)
UPDATE profiles
SET persona_embedding = NULL,
    archetype = NULL
WHERE id = '00000000-0000-0000-0000-000000000000';

-- Done! After running this:
-- 1. Re-run the seed script: npx ts-node scripts/seedSuggestionPool.ts
-- 2. Refresh the app — you'll start from onboarding
