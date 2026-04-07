/**
 * Wipe all user data for a fresh re-onboarding.
 * Pool was already wiped by wipeAndReseed.ts.
 * 
 * Usage:
 *   npx ts-node --project scripts/tsconfig.scripts.json scripts/wipeUserData.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeUserData() {
  console.log("🧹 Wiping user data for fresh re-onboarding...\n");

  // Wipe baf_history
  const { error: histErr } = await supabase.from("baf_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (histErr) {
    console.log(`⚠️  baf_history: ${histErr.message}`);
  } else {
    console.log("✅ Wiped baf_history");
  }

  // Wipe persona_stats
  const { error: statsErr } = await supabase.from("persona_stats").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
  if (statsErr) {
    console.log(`⚠️  persona_stats: ${statsErr.message}`);
  } else {
    console.log("✅ Wiped persona_stats");
  }

  // Wipe interests
  const { error: intErr } = await supabase.from("interests").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
  if (intErr) {
    console.log(`⚠️  interests: ${intErr.message}`);
  } else {
    console.log("✅ Wiped interests");
  }

  // Reset profiles (clear persona_embedding and archetype)
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ persona_embedding: null, archetype: null })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (profErr) {
    console.log(`⚠️  profiles: ${profErr.message}`);
  } else {
    console.log("✅ Reset profiles (persona_embedding + archetype cleared)");
  }

  console.log("\n🎉 User data wiped! Now:");
  console.log("   1. Restart dev server: npm run dev");
  console.log("   2. Clear browser localStorage (DevTools → Application → Clear)");
  console.log("   3. Refresh the app — you'll start from onboarding");
  console.log("   4. The pool will re-seed with proper YouTube/Twitch/TikTok URLs this time");
}

wipeUserData().catch(console.error);
