/**
 * Wipe all misclassified pool entries (creators stored as "general" with no URLs)
 * and display instructions for re-seeding.
 * 
 * Usage:
 *   npx ts-node --project scripts/tsconfig.scripts.json scripts/wipeAndReseed.ts
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

async function wipeAndReseed() {
  console.log("🧹 Wiping misclassified pool entries...\n");

  // Deactivate ALL general entries that contain creator names (have " — " in text)
  // These are creators that should have been youtube/twitch/tiktok but got stored as general
  const { data: badGenerals, error: fetchErr } = await supabase
    .from("suggestion_pool")
    .select("id, content_text, platform")
    .eq("is_active", true)
    .eq("platform", "general");

  if (fetchErr) {
    console.error("❌ Failed to fetch:", fetchErr.message);
    process.exit(1);
  }

  // Identify creator entries wrongly classified as general
  // (they have " — " separator typical of "CreatorName — description" format)
  const misclassified = (badGenerals ?? []).filter((e) => 
    e.content_text.includes(" — ") || e.content_text.includes(" - ")
  );

  if (misclassified.length > 0) {
    console.log(`Found ${misclassified.length} misclassified creator entries (general platform with creator names):`);
    for (const e of misclassified.slice(0, 15)) {
      console.log(`  ❌ "${(e.content_text || "").slice(0, 60)}"`);
    }
    if (misclassified.length > 15) console.log(`  ... and ${misclassified.length - 15} more`);

    const ids = misclassified.map((e) => e.id);
    const { error: delErr } = await supabase
      .from("suggestion_pool")
      .delete()
      .in("id", ids);

    if (delErr) {
      console.error("❌ Failed to delete:", delErr.message);
    } else {
      console.log(`\n✅ Deleted ${ids.length} misclassified entries.`);
    }
  } else {
    console.log("No misclassified entries found.");
  }

  // Also delete inactive entries (they're just clutter)
  const { error: inactiveErr } = await supabase
    .from("suggestion_pool")
    .delete()
    .eq("is_active", false);

  if (!inactiveErr) {
    console.log("✅ Cleaned up inactive entries.");
  }

  // Show remaining pool state
  const { data: remaining } = await supabase
    .from("suggestion_pool")
    .select("platform")
    .eq("is_active", true);

  const counts: Record<string, number> = {};
  for (const r of remaining ?? []) {
    counts[r.platform] = (counts[r.platform] ?? 0) + 1;
  }

  console.log(`\n📊 Remaining active pool: ${remaining?.length ?? 0} entries`);
  for (const [p, c] of Object.entries(counts)) {
    console.log(`   ${p}: ${c}`);
  }

  if ((remaining?.length ?? 0) < 5) {
    console.log("\n⚠️  Pool is nearly empty. To re-seed:");
    console.log("   1. Clear your profile: run supabase/wipe_all_data.sql in Supabase SQL Editor");
    console.log("   2. Restart dev server: npm run dev");
    console.log("   3. Go through onboarding again — the pool will re-seed with proper URLs this time");
  }
}

wipeAndReseed().catch(console.error);
