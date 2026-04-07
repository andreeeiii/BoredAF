-- Cleanup script: Remove or fix pool entries with invalid URLs
-- Run this once against your Supabase instance to clean up existing bad data

-- Step 1: Deactivate non-general entries with empty or missing URLs
UPDATE public.suggestion_pool
SET is_active = false
WHERE platform != 'general'
  AND is_active = true
  AND (url IS NULL OR url = '' OR url = ' ');

-- Step 2: Deactivate entries with localhost URLs
UPDATE public.suggestion_pool
SET is_active = false
WHERE is_active = true
  AND url ILIKE '%localhost%';

-- Step 3: Deactivate entries with relative URLs (no http/https prefix)
UPDATE public.suggestion_pool
SET is_active = false
WHERE is_active = true
  AND platform != 'general'
  AND url IS NOT NULL
  AND url != ''
  AND url NOT LIKE 'http://%'
  AND url NOT LIKE 'https://%';

-- Step 4: Clear URL field for general entries (they shouldn't have URLs)
UPDATE public.suggestion_pool
SET url = ''
WHERE platform = 'general'
  AND url IS NOT NULL
  AND url != '';

-- Step 5: Deactivate entries with Instagram URLs (should have been filtered)
UPDATE public.suggestion_pool
SET is_active = false
WHERE is_active = true
  AND url ILIKE '%instagram.com%';

-- Step 6: Show what was cleaned up
SELECT
  COUNT(*) FILTER (WHERE is_active = false AND url ILIKE '%localhost%') AS localhost_deactivated,
  COUNT(*) FILTER (WHERE is_active = false AND platform != 'general' AND (url IS NULL OR url = '' OR url = ' ')) AS empty_url_deactivated,
  COUNT(*) FILTER (WHERE is_active = true) AS still_active,
  COUNT(*) AS total_entries
FROM public.suggestion_pool;
