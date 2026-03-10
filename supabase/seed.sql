INSERT INTO public.profiles (id, username)
VALUES ('00000000-0000-0000-0000-000000000000', 'BoredUser')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.persona_stats (user_id, category, value)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'chess', '{"elo": 420, "pref": "blitz"}'),
  ('00000000-0000-0000-0000-000000000000', 'energy_level', '{"current": "high"}')
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
