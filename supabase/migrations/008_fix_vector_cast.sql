-- 008: Fix vector-to-float[] cast in nudge_persona_embedding
-- pgvector no longer supports direct cast to double precision[].
-- Fix: cast through text first (vector → text → float[]).

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

  -- Convert to float arrays for arithmetic (cast through text for pgvector compat)
  cur := current_emb::text::FLOAT[];
  sug := suggestion_emb::text::FLOAT[];

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
