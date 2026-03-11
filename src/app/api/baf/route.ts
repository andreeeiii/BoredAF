import { NextResponse } from "next/server";
import { runBafBrain } from "@/lib/agent/bafBrain";
import { updatePersona, logNegativeSignal } from "@/lib/persona";
import { getAuthUserId } from "@/lib/supabase/api";
import { checkPressLimit, recordPress } from "@/lib/pressLimiter";

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
      const pressStatus = await checkPressLimit(userId);
      if (!pressStatus.allowed) {
        return NextResponse.json({
          error: "daily_limit_reached",
          message: "You've used all your BAF presses for today!",
          remaining: 0,
          isPremium: pressStatus.isPremium,
          credits: pressStatus.credits,
        }, { status: 429 });
      }

      const rescue = await runBafBrain(userId);

      // Record the press (increments counter, deducts credit if needed)
      recordPress(userId).catch((err) =>
        console.error("[BAF][PressLimiter] Non-blocking error:", err)
      );

      return NextResponse.json({
        ...rescue,
        pressStatus: {
          remaining: pressStatus.remaining > 0 ? pressStatus.remaining - 1 : 0,
          isPremium: pressStatus.isPremium,
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
