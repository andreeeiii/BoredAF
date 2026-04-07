import { NextResponse } from "next/server";
import { runBafBrain } from "@/lib/agent/bafBrain";
import { updatePersona, logNegativeSignal } from "@/lib/persona";
import { getAuthUserId } from "@/lib/supabase/api";
import { checkPressLimit, recordPress } from "@/lib/pressLimiter";
import { updatePoolEngagement } from "@/lib/embeddings";

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as string;

    if (action === "baf") {
      // Enforce daily press limit (free=3/day, premium=unlimited, credits=extra)
      // Bypass in development to avoid blocking testing
      const isDev = process.env.NODE_ENV === "development";
      const pressStatus = await checkPressLimit(userId);

      if (!pressStatus.allowed && !isDev) {
        return NextResponse.json({
          error: "daily_limit_reached",
          message: "You've used all your BAF presses for today!",
          remaining: 0,
          isPremium: pressStatus.isPremium,
          credits: pressStatus.credits,
        }, { status: 429 });
      }

      const rescue = await runBafBrain(userId);

      // Increment times_shown on display (fire-and-forget)
      if (rescue.poolId) {
        updatePoolEngagement(rescue.poolId, "shown").catch((err) =>
          console.error("[BAF][Engagement] times_shown increment error:", err)
        );
      }

      // Record the press (increments counter, deducts credit if needed)
      if (!isDev) {
        recordPress(userId).catch((err) =>
          console.error("[BAF][PressLimiter] Non-blocking error:", err)
        );
      }

      return NextResponse.json({
        ...rescue,
        pressStatus: {
          remaining: isDev ? Infinity : (pressStatus.remaining > 0 ? pressStatus.remaining - 1 : 0),
          isPremium: isDev ? true : pressStatus.isPremium,
          credits: pressStatus.credits,
        },
      });
    }

    if (action === "feedback") {
      const { suggestion, outcome, reason, source, archetype, link, poolId, category } = body;

      await updatePersona(userId, {
        suggestion,
        outcome,
        reason,
        archetype,
        source,
        link,
        poolId,
        category,
      });

      if (outcome === "rejected" && reason && source) {
        await logNegativeSignal(userId, source, reason);
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
