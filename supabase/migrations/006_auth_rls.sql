-- Migration 006: Auth integration + Row Level Security
-- Links profiles to auth.users, creates auto-profile trigger, enables RLS

-- 1. Make username nullable (auto-created profiles won't have one yet)
ALTER TABLE profiles ALTER COLUMN username DROP NOT NULL;

-- 2. Create function to auto-create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, bio)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Enable RLS on all user tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE baf_history ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 6. RLS Policies for persona_stats
CREATE POLICY "Users can view own persona stats"
  ON persona_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own persona stats"
  ON persona_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own persona stats"
  ON persona_stats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own persona stats"
  ON persona_stats FOR DELETE
  USING (auth.uid() = user_id);

-- 7. RLS Policies for interests
CREATE POLICY "Users can view own interests"
  ON interests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interests"
  ON interests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interests"
  ON interests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interests"
  ON interests FOR DELETE
  USING (auth.uid() = user_id);

-- 8. RLS Policies for baf_history
CREATE POLICY "Users can view own history"
  ON baf_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history"
  ON baf_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own history"
  ON baf_history FOR DELETE
  USING (auth.uid() = user_id);

-- 9. suggestion_pool stays public (shared content, no user data)
-- No RLS needed — all users read from the same pool.
-- Writes are done server-side via service role.

-- 10. Service role bypass: Supabase service_role key automatically bypasses RLS.
-- Our server-side singleton (lib/supabase.ts) uses the service role key,
-- so all business logic queries continue to work without changes.
