CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  bio TEXT
);

CREATE TABLE persona_stats (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, category)
);

CREATE TABLE interests (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  weight INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, platform, ref_id)
);

CREATE TABLE baf_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suggestion TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted', 'rejected')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_persona_stats_user ON persona_stats(user_id);
CREATE INDEX idx_interests_user ON interests(user_id);
CREATE INDEX idx_baf_history_user ON baf_history(user_id);
CREATE INDEX idx_baf_history_created ON baf_history(created_at DESC);
