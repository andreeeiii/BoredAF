-- Migration 009: Add created_at to match_suggestions and fetch_popular_suggestions RPCs
-- Required for freshness decay scoring in ranking engine

-- Drop and recreate match_suggestions with created_at in return type
DROP FUNCTION IF EXISTS match_suggestions(vector(1536), INT, FLOAT);

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
  similarity FLOAT,
  created_at TIMESTAMPTZ
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
    1 - (sp.embedding <=> query_embedding) AS similarity,
    sp.created_at
  FROM public.suggestion_pool sp
  WHERE sp.embedding IS NOT NULL
    AND sp.is_active = true
    AND 1 - (sp.embedding <=> query_embedding) > match_threshold
  ORDER BY sp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Drop and recreate fetch_popular_suggestions with created_at in return type
DROP FUNCTION IF EXISTS fetch_popular_suggestions(INT);

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
  times_rejected INT,
  created_at TIMESTAMPTZ
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
    sp.created_at
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
