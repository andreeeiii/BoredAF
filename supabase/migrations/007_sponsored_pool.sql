-- 007: Add sponsored pool entries + sponsor event tracking
-- Adds columns to suggestion_pool for sponsored content and a new table for tracking impressions/clicks.

-- Add sponsored columns to suggestion_pool
ALTER TABLE suggestion_pool ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT false;
ALTER TABLE suggestion_pool ADD COLUMN IF NOT EXISTS sponsor_id TEXT DEFAULT NULL;
ALTER TABLE suggestion_pool ADD COLUMN IF NOT EXISTS sponsor_cpm NUMERIC(10,2) DEFAULT NULL;

-- Create sponsor_events table for impression/click tracking
CREATE TABLE IF NOT EXISTS sponsor_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES suggestion_pool(id) ON DELETE CASCADE,
  sponsor_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast sponsor reporting queries
CREATE INDEX IF NOT EXISTS idx_sponsor_events_sponsor_id ON sponsor_events(sponsor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sponsor_events_pool_id ON sponsor_events(pool_id, event_type);
CREATE INDEX IF NOT EXISTS idx_suggestion_pool_sponsored ON suggestion_pool(is_sponsored) WHERE is_sponsored = true;
