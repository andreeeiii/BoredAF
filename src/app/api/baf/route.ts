import { NextResponse } from "next/server";
import { runBafAgent } from "@/lib/agent";
import { updatePersona } from "@/lib/persona";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "baf") {
      const userId = (body.userId as string) ?? DEFAULT_USER_ID;
      const rescue = await runBafAgent(userId);
      return NextResponse.json(rescue);
    }

    if (action === "feedback") {
      const userId = (body.userId as string) ?? DEFAULT_USER_ID;
      const { suggestion, outcome, reason } = body;

      await updatePersona(userId, {
        suggestion,
        outcome,
        reason,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
