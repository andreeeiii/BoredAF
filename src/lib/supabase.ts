import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}

// Server singleton: prefer service role key (bypasses RLS) for trusted
// server-side operations. Falls back to anon key if service key is not set.
const serverKey = supabaseServiceKey ?? supabaseAnonKey;

if (!serverKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
}

export const supabase = createClient<Database>(supabaseUrl, serverKey);
