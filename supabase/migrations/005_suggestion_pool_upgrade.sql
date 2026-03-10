-- Upgrade suggestion_pool: add platform, url, engagement counters, is_active
-- This enables the vector-first architecture where suggestion_pool is the SOLE content source.

ALTER TABLE public.suggestion_pool
ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'general',
ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS times_shown INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS times_accepted INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS times_rejected INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_suggestion_pool_platform ON public.suggestion_pool(platform);
CREATE INDEX IF NOT EXISTS idx_suggestion_pool_is_active ON public.suggestion_pool(is_active);

-- Update match_suggestions RPC to return new columns and filter by is_active
CREATE OR REPLACE FUNCTION match_suggestions(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  content_text TEXT,
  category TEXT,
  platform TEXT,
  url TEXT,
  times_shown INT,
  times_accepted INT,
  times_rejected INT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.content_text,
    sp.category,
    sp.platform,
    sp.url,
    sp.times_shown,
    sp.times_accepted,
    sp.times_rejected,
    1 - (sp.embedding <=> query_embedding) AS similarity
  FROM public.suggestion_pool sp
  WHERE sp.embedding IS NOT NULL
    AND sp.is_active = true
    AND 1 - (sp.embedding <=> query_embedding) > match_threshold
  ORDER BY sp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- New RPC: fetch popular suggestions (for users without persona_embedding)
CREATE OR REPLACE FUNCTION fetch_popular_suggestions(
  fetch_count INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  content_text TEXT,
  category TEXT,
  platform TEXT,
  url TEXT,
  times_shown INT,
  times_accepted INT,
  times_rejected INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.content_text,
    sp.category,
    sp.platform,
    sp.url,
    sp.times_shown,
    sp.times_accepted,
    sp.times_rejected
  FROM public.suggestion_pool sp
  WHERE sp.is_active = true
  ORDER BY
    CASE
      WHEN sp.times_shown = 0 THEN 0.5
      ELSE sp.times_accepted::FLOAT / GREATEST(sp.times_shown, 1)
    END DESC,
    RANDOM()
  LIMIT fetch_count;
END;
$$;

-- New RPC: update engagement counters on a pool entry
CREATE OR REPLACE FUNCTION update_pool_engagement(
  p_pool_id UUID,
  p_outcome TEXT  -- 'shown', 'accepted', or 'rejected'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_outcome = 'shown' THEN
    UPDATE public.suggestion_pool SET times_shown = times_shown + 1 WHERE id = p_pool_id;
  ELSIF p_outcome = 'accepted' THEN
    UPDATE public.suggestion_pool SET times_accepted = times_accepted + 1, times_shown = times_shown + 1 WHERE id = p_pool_id;
  ELSIF p_outcome = 'rejected' THEN
    UPDATE public.suggestion_pool SET times_rejected = times_rejected + 1, times_shown = times_shown + 1 WHERE id = p_pool_id;
  END IF;
END;
$$;
