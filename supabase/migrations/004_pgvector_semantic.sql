-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add persona_embedding to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS persona_embedding vector(1536);

-- Add embedding to interests
ALTER TABLE public.interests
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding to baf_history
ALTER TABLE public.baf_history
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create suggestion_pool table
CREATE TABLE IF NOT EXISTS public.suggestion_pool (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_text TEXT NOT NULL,
  category TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestion_pool_category ON public.suggestion_pool(category);

-- Create HNSW index for fast cosine similarity search on suggestion_pool
CREATE INDEX IF NOT EXISTS idx_suggestion_pool_embedding
ON public.suggestion_pool
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- RPC function: match suggestions by cosine similarity to a query embedding
CREATE OR REPLACE FUNCTION match_suggestions(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  content_text TEXT,
  category TEXT,
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
    1 - (sp.embedding <=> query_embedding) AS similarity
  FROM public.suggestion_pool sp
  WHERE sp.embedding IS NOT NULL
    AND 1 - (sp.embedding <=> query_embedding) > match_threshold
  ORDER BY sp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- RPC function: update persona embedding (used by feedback loop)
CREATE OR REPLACE FUNCTION nudge_persona_embedding(
  p_user_id UUID,
  suggestion_emb vector(1536),
  learning_rate FLOAT DEFAULT 0.05,
  direction INT DEFAULT 1  -- 1 = toward (accept), -1 = away (reject)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  current_emb vector(1536);
  new_emb FLOAT[];
  cur FLOAT[];
  sug FLOAT[];
BEGIN
  SELECT persona_embedding INTO current_emb
  FROM public.profiles WHERE id = p_user_id;

  IF current_emb IS NULL THEN
    -- No persona embedding yet, set it directly if accepting
    IF direction = 1 THEN
      UPDATE public.profiles SET persona_embedding = suggestion_emb WHERE id = p_user_id;
    END IF;
    RETURN;
  END IF;

  -- Convert to float arrays for arithmetic
  cur := current_emb::FLOAT[];
  sug := suggestion_emb::FLOAT[];

  -- Compute nudge: new = current + direction * learning_rate * (suggestion - current)
  SELECT ARRAY(
    SELECT cur[i] + direction * learning_rate * (sug[i] - cur[i])
    FROM generate_series(1, 1536) AS i
  ) INTO new_emb;

  UPDATE public.profiles
  SET persona_embedding = new_emb::vector(1536)
  WHERE id = p_user_id;
END;
$$;
