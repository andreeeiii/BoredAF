/**
 * Cleanup script: Deactivate pool entries with invalid/empty URLs.
 * 
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/cleanupBadUrls.ts
 * 
 * Requires: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
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

async function cleanup() {
  console.log("🔍 Scanning suggestion_pool for bad entries...\n");

  // Fetch all active non-general entries
  const { data: entries, error } = await supabase
    .from("suggestion_pool")
    .select("id, content_text, platform, url, is_active")
    .eq("is_active", true);

  if (error) {
    console.error("❌ Failed to fetch pool entries:", error.message);
    process.exit(1);
  }

  if (!entries || entries.length === 0) {
    console.log("Pool is empty — nothing to clean.");
    return;
  }

  console.log(`📊 Total active entries: ${entries.length}\n`);

  // Identify bad entries: non-general platform entries without a valid https:// URL
  const badEntries = entries.filter((e) => {
    if (e.platform === "general") return false; // general entries don't need URLs
    if (!e.url || e.url.trim() === "") return true; // empty URL
    const trimmed = e.url.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return true;
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return true;
      if (!host.includes(".")) return true;
      return false;
    } catch {
      return true;
    }
  });

  const goodEntries = entries.filter((e) => !badEntries.some((b) => b.id === e.id));

  console.log(`✅ Good entries (valid URL or general): ${goodEntries.length}`);
  console.log(`❌ Bad entries (missing/invalid URL): ${badEntries.length}\n`);

  if (badEntries.length === 0) {
    console.log("No bad entries found — pool is clean!");
    return;
  }

  // Show what we're deactivating
  console.log("--- Deactivating these entries ---");
  for (const e of badEntries) {
    console.log(`  [${e.platform}] "${(e.content_text || "").slice(0, 50)}" — url: "${e.url ?? "(null)"}"`);
  }
  console.log("---\n");

  // Deactivate bad entries
  const badIds = badEntries.map((e) => e.id);
  const { error: updateError } = await supabase
    .from("suggestion_pool")
    .update({ is_active: false })
    .in("id", badIds);

  if (updateError) {
    console.error("❌ Failed to deactivate bad entries:", updateError.message);
    process.exit(1);
  }

  console.log(`✅ Deactivated ${badIds.length} bad entries.`);

  // Show remaining active entries breakdown
  const { data: remaining } = await supabase
    .from("suggestion_pool")
    .select("platform")
    .eq("is_active", true);

  if (remaining) {
    const counts: Record<string, number> = {};
    for (const r of remaining) {
      counts[r.platform] = (counts[r.platform] ?? 0) + 1;
    }
    console.log(`\n📊 Remaining active pool entries: ${remaining.length}`);
    for (const [platform, count] of Object.entries(counts)) {
      console.log(`   ${platform}: ${count}`);
    }

    if (remaining.length < 10) {
      console.log("\n⚠️  Pool is very small! Users should re-complete onboarding to re-seed the pool.");
      console.log("   Clear their profile data and have them go through onboarding again.");
    }
  }
}

cleanup().catch(console.error);
