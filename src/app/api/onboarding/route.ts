import { NextResponse } from "next/server";
import {
  parsePersona,
  saveOnboardingResult,
  isOnboardingComplete,
  type OnboardingAnswer,
} from "@/lib/onboarding";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;
    const userId = (body.userId as string) ?? DEFAULT_USER_ID;

    if (action === "check") {
      const complete = await isOnboardingComplete(userId);
      return NextResponse.json({ complete });
    }

    if (action === "submit") {
      const answers = body.answers as OnboardingAnswer[];

      if (!answers || answers.length !== 4) {
        return NextResponse.json(
          { error: "Exactly 4 answers required" },
          { status: 400 }
        );
      }

      const mapping = await parsePersona(answers);
      await saveOnboardingResult(userId, mapping);

      return NextResponse.json({
        success: true,
        archetype: mapping.archetype,
        tags: mapping.tags,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
