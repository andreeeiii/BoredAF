/**
 * Inspect the suggestion pool: show platform breakdown and sample entries.
 * 
 * Usage:
 *   npx ts-node --project scripts/tsconfig.scripts.json scripts/inspectPool.ts
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

async function inspect() {
  // Count by platform (active only)
  const { data: active, error } = await supabase
    .from("suggestion_pool")
    .select("id, content_text, platform, url, category, is_active, times_shown, times_accepted")
    .eq("is_active", true);

  if (error) {
    console.error("❌ Failed to fetch:", error.message);
    process.exit(1);
  }

  console.log(`\n📊 Total active pool entries: ${active?.length ?? 0}\n`);

  // Group by platform
  const byPlatform: Record<string, typeof active> = {};
  for (const e of active ?? []) {
    if (!byPlatform[e.platform]) byPlatform[e.platform] = [];
    byPlatform[e.platform]!.push(e);
  }

  for (const [platform, entries] of Object.entries(byPlatform)) {
    const withUrl = entries!.filter((e) => e.url && e.url.trim().length > 0);
    console.log(`\n--- ${platform.toUpperCase()} (${entries!.length} entries, ${withUrl.length} with URLs) ---`);
    for (const e of entries!.slice(0, 10)) {
      const urlShort = e.url ? (e.url.length > 50 ? e.url.slice(0, 50) + "..." : e.url) : "(no URL)";
      console.log(`  [${e.category}] "${(e.content_text || "").slice(0, 50)}" — ${urlShort}`);
    }
    if (entries!.length > 10) {
      console.log(`  ... and ${entries!.length - 10} more`);
    }
  }

  // Also count inactive
  const { count: inactiveCount } = await supabase
    .from("suggestion_pool")
    .select("*", { count: "exact", head: true })
    .eq("is_active", false);

  console.log(`\n📦 Inactive entries: ${inactiveCount ?? 0}`);
}

inspect().catch(console.error);
