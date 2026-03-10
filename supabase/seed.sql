INSERT INTO public.profiles (id, username, archetype)
VALUES ('00000000-0000-0000-0000-000000000000', 'BoredUser', 'The Grind')
ON CONFLICT (id) DO UPDATE SET archetype = 'The Grind';

INSERT INTO public.persona_stats (user_id, category, value)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'chess', '{"elo": 420, "pref": "blitz", "username": "boreduser420"}'),
  ('00000000-0000-0000-0000-000000000000', 'energy_level', '{"current": "high"}'),
  ('00000000-0000-0000-0000-000000000000', 'archetype', '{"name": "The Grind", "tags": ["chess", "competitive", "logic"]}'),
  ('00000000-0000-0000-0000-000000000000', 'onboarding_complete', '{"completed": true, "completedAt": "2025-01-01T00:00:00Z"}')
ON CONFLICT (user_id, category) DO NOTHING;

INSERT INTO public.interests (user_id, platform, ref_id, weight)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'youtube', 'UCsn6YST89nS_IAn7S_S00S', 10),
  ('00000000-0000-0000-0000-000000000000', 'youtube', 'UC16niRr50-MSBwiO3YDb3RA', 8),
  ('00000000-0000-0000-0000-000000000000', 'twitch', 'gothamchess', 5)
ON CONFLICT (user_id, platform, ref_id) DO NOTHING;

INSERT INTO public.baf_history (user_id, suggestion, outcome, reason)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'Play a rapid chess game', 'rejected', 'too tired'),
  ('00000000-0000-0000-0000-000000000000', 'Watch Amalia latest', 'accepted', 'perfect vibe');
