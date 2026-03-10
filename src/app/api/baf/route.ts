import { NextResponse } from "next/server";
import { runBafBrain } from "@/lib/agent/bafBrain";
import { updatePersona, logNegativeSignal } from "@/lib/persona";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;
    const userId = (body.userId as string) ?? DEFAULT_USER_ID;

    if (action === "baf") {
      const rescue = await runBafBrain(userId);
      return NextResponse.json(rescue);
    }

    if (action === "feedback") {
      const { suggestion, outcome, reason, source, archetype } = body;

      await updatePersona(userId, {
        suggestion,
        outcome,
        reason,
        archetype,
        source,
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
