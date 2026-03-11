import { supabase } from "./supabase";

const FREE_DAILY_PRESSES = 3;

export interface PressStatus {
  allowed: boolean;
  remaining: number;
  isPremium: boolean;
  credits: number;
  reason?: "limit_reached" | "no_credits";
}

interface DailyPressData {
  count: number;
  date: string;
  is_premium: boolean;
  credits: number;
}

/**
 * Check if a user can press the BAF button.
 * - Premium users: unlimited
 * - Free users: 3 presses/day, then spend credits
 * - No credits: blocked
 */
export async function checkPressLimit(userId: string): Promise<PressStatus> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data } = await supabase
    .from("persona_stats")
    .select("value")
    .eq("user_id", userId)
    .eq("category", "daily_presses")
    .single();

  const current: DailyPressData = (data?.value as unknown as DailyPressData) ?? {
    count: 0,
    date: today,
    is_premium: false,
    credits: 0,
  };

  // Reset count if it's a new day
  if (current.date !== today) {
    current.count = 0;
    current.date = today;
  }

  // Premium users are unlimited
  if (current.is_premium) {
    return {
      allowed: true,
      remaining: Infinity,
      isPremium: true,
      credits: current.credits,
    };
  }

  // Free tier: check daily limit
  const remaining = Math.max(0, FREE_DAILY_PRESSES - current.count);
  if (remaining > 0) {
    return {
      allowed: true,
      remaining: remaining,
      isPremium: false,
      credits: current.credits,
    };
  }

  // Daily limit exceeded — check credits
  if (current.credits > 0) {
    return {
      allowed: true,
      remaining: 0,
      isPremium: false,
      credits: current.credits,
    };
  }

  // No presses left, no credits
  return {
    allowed: false,
    remaining: 0,
    isPremium: false,
    credits: 0,
    reason: "limit_reached",
  };
}

/**
 * Record a BAF press. Increments daily count and deducts a credit if over the free limit.
 */
export async function recordPress(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("persona_stats")
    .select("value")
    .eq("user_id", userId)
    .eq("category", "daily_presses")
    .single();

  const current: DailyPressData = (data?.value as unknown as DailyPressData) ?? {
    count: 0,
    date: today,
    is_premium: false,
    credits: 0,
  };

  // Reset on new day
  if (current.date !== today) {
    current.count = 0;
    current.date = today;
  }

  current.count += 1;

  // Deduct credit if over free limit and not premium
  if (!current.is_premium && current.count > FREE_DAILY_PRESSES && current.credits > 0) {
    current.credits -= 1;
    console.log(`[BAF][PressLimiter] User ${userId} used 1 credit (${current.credits} remaining)`);
  }

  await supabase.from("persona_stats").upsert(
    {
      user_id: userId,
      category: "daily_presses",
      value: JSON.parse(JSON.stringify(current)),
      last_updated: new Date().toISOString(),
    },
    { onConflict: "user_id,category" }
  );
}

/**
 * Add credits to a user's account (e.g., after purchase).
 */
export async function addCredits(userId: string, amount: number): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("persona_stats")
    .select("value")
    .eq("user_id", userId)
    .eq("category", "daily_presses")
    .single();

  const current: DailyPressData = (data?.value as unknown as DailyPressData) ?? {
    count: 0,
    date: today,
    is_premium: false,
    credits: 0,
  };

  current.credits += amount;

  await supabase.from("persona_stats").upsert(
    {
      user_id: userId,
      category: "daily_presses",
      value: JSON.parse(JSON.stringify(current)),
      last_updated: new Date().toISOString(),
    },
    { onConflict: "user_id,category" }
  );

  console.log(`[BAF][PressLimiter] Added ${amount} credits to user ${userId} (total: ${current.credits})`);
  return current.credits;
}

/**
 * Set a user's premium status.
 */
export async function setPremiumStatus(userId: string, isPremium: boolean): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("persona_stats")
    .select("value")
    .eq("user_id", userId)
    .eq("category", "daily_presses")
    .single();

  const current: DailyPressData = (data?.value as unknown as DailyPressData) ?? {
    count: 0,
    date: today,
    is_premium: false,
    credits: 0,
  };

  current.is_premium = isPremium;

  await supabase.from("persona_stats").upsert(
    {
      user_id: userId,
      category: "daily_presses",
      value: JSON.parse(JSON.stringify(current)),
      last_updated: new Date().toISOString(),
    },
    { onConflict: "user_id,category" }
  );

  console.log(`[BAF][PressLimiter] User ${userId} premium status: ${isPremium}`);
}
