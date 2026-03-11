import { NextResponse } from "next/server";
import { runBafBrain } from "@/lib/agent/bafBrain";
import { updatePersona, logNegativeSignal } from "@/lib/persona";
import { getAuthUserId } from "@/lib/supabase/api";

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as string;

    if (action === "baf") {
      const rescue = await runBafBrain(userId);
      return NextResponse.json(rescue);
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
