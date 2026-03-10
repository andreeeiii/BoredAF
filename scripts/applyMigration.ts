/**
 * Apply the pgvector migration via Supabase Management API.
 * 
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/applyMigration.ts
 * 
 * Requires: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 * 
 * NOTE: If this script fails due to permissions, apply the migration manually:
 *   1. Go to https://supabase.com/dashboard → your project → SQL Editor
 *   2. Paste the contents of supabase/migrations/004_pgvector_semantic.sql
 *   3. Click "Run"
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

async function checkMigration() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Checking if pgvector migration has been applied...\n");

  // Check if suggestion_pool table exists
  const { data: poolData, error: poolError } = await supabase
    .from("suggestion_pool")
    .select("id")
    .limit(1);

  if (poolError && poolError.message.includes("does not exist")) {
    console.log("❌ suggestion_pool table does NOT exist");
    console.log("\n📋 To apply the migration:");
    console.log("   1. Go to https://supabase.com/dashboard → SQL Editor");
    console.log("   2. Paste contents of: supabase/migrations/004_pgvector_semantic.sql");
    console.log("   3. Click 'Run'\n");

    const migrationPath = path.resolve(__dirname, "../supabase/migrations/004_pgvector_semantic.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");
    console.log("--- Migration SQL (copy this) ---");
    console.log(sql);
    console.log("--- End ---");
    return false;
  }

  console.log("✅ suggestion_pool table exists");

  // Check if profiles has persona_embedding column
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("persona_embedding")
    .limit(1);

  if (profileError) {
    console.log("❌ profiles.persona_embedding column missing:", profileError.message);
    return false;
  }
  console.log("✅ profiles.persona_embedding column exists");

  // Check if match_suggestions RPC works
  const { error: rpcError } = await supabase.rpc("match_suggestions", {
    query_embedding: Array(1536).fill(0).join(","),
    match_count: 1,
    match_threshold: 0.0,
  });

  if (rpcError && !rpcError.message.includes("No rows")) {
    console.log("⚠️  match_suggestions RPC:", rpcError.message);
  } else {
    console.log("✅ match_suggestions RPC function exists");
  }

  // Count suggestion_pool entries
  const { count } = await supabase
    .from("suggestion_pool")
    .select("*", { count: "exact", head: true });

  console.log(`\n📊 suggestion_pool has ${count ?? 0} entries`);
  if ((count ?? 0) === 0) {
    console.log("   Run the seed script: npx ts-node --compiler-options '{\"module\":\"commonjs\"}' scripts/seedSuggestionPool.ts");
  }

  return true;
}

checkMigration().catch(console.error);
