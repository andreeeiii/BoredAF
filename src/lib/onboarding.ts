import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { supabase } from "./supabase";
import { mapToArchetype } from "./mood";
import { buildPersonaText, generateAndStorePersonaEmbedding, seedPoolFromOnboarding } from "./embeddings";

export const PersonaMappingSchema = z.object({
  archetype: z.string(),
  tags: z.array(z.string()),
  personaData: z.object({
    energy: z.string(),
    focus: z.string(),
  }),
  extractedInterests: z.array(
    z.object({
      platform: z.string(),
      ref_id: z.string(),
      weight: z.number(),
    })
  ),
});

export type PersonaMapping = z.infer<typeof PersonaMappingSchema>;

export interface OnboardingAnswer {
  slot: "digital" | "skill" | "energy" | "wildcard";
  question: string;
  answer: string;
}

export async function parsePersona(
  answers: OnboardingAnswer[]
): Promise<PersonaMapping> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return buildFallbackPersona(answers);
  }

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature: 0.3,
    maxTokens: 500,
    apiKey,
  });

  const formattedAnswers = answers
    .map((a) => `[${a.slot.toUpperCase()}] Q: "${a.question}" A: "${a.answer}"`)
    .join("\n");

  const prompt = `Given these 4 user answers from an anti-boredom app onboarding, do the following:

1. Categorize the user into a primary archetype. Pick ONE:
   - "The Grind" (competitive, skill-focused, mastery-driven)
   - "The Chill" (passive consumer, relaxation, watches/reads)
   - "The Spark" (novelty seeker, curious, tries new things)

2. Extract 3-6 interest tags (lowercase, short).

3. Determine energy preference ("high", "low", or "mixed") and focus type ("logic", "visual", "physical", "creative", "social").

4. Extract any specific platform handles/references (YouTube channels, Twitch streamers, subreddits, games) with platform type and a relevance weight (1-10).

USER ANSWERS:
${formattedAnswers}

Respond in EXACTLY this JSON format, nothing else:
{"archetype": "The Grind|The Chill|The Spark", "tags": ["tag1", "tag2"], "personaData": {"energy": "high|low|mixed", "focus": "logic|visual|physical|creative|social"}, "extractedInterests": [{"platform": "youtube|twitch|reddit|game|other", "ref_id": "handle_or_name", "weight": 8}]}`;

  try {
    const response = await llm.invoke(prompt);
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in LLM response");

    return PersonaMappingSchema.parse(JSON.parse(jsonMatch[0]));
  } catch {
    return buildFallbackPersona(answers);
  }
}

function buildFallbackPersona(answers: OnboardingAnswer[]): PersonaMapping {
  const energyAnswer = answers.find((a) => a.slot === "energy");
  const energy =
    energyAnswer?.answer.toLowerCase().includes("couch") ||
    energyAnswer?.answer.toLowerCase().includes("zone out") ||
    energyAnswer?.answer.toLowerCase().includes("low")
      ? "low"
      : "high";

  return {
    archetype: "The Explorer",
    tags: ["curious", "varied"],
    personaData: { energy, focus: "visual" },
    extractedInterests: [],
  };
}

export async function saveOnboardingResult(
  userId: string,
  mapping: PersonaMapping,
  answers: OnboardingAnswer[] = []
): Promise<void> {
  const coreArchetype = mapToArchetype(mapping.archetype);

  await supabase
    .from("profiles")
    .update({ archetype: coreArchetype })
    .eq("id", userId);

  await supabase.from("persona_stats").upsert(
    {
      user_id: userId,
      category: "archetype",
      value: {
        name: coreArchetype,
        tags: mapping.tags,
      },
      last_updated: new Date().toISOString(),
    },
    { onConflict: "user_id,category" }
  );

  await supabase.from("persona_stats").upsert(
    {
      user_id: userId,
      category: "energy_level",
      value: { current: mapping.personaData.energy },
      last_updated: new Date().toISOString(),
    },
    { onConflict: "user_id,category" }
  );

  await supabase.from("persona_stats").upsert(
    {
      user_id: userId,
      category: "focus",
      value: { type: mapping.personaData.focus },
      last_updated: new Date().toISOString(),
    },
    { onConflict: "user_id,category" }
  );

  await supabase.from("persona_stats").upsert(
    {
      user_id: userId,
      category: "onboarding_complete",
      value: { completed: true, completedAt: new Date().toISOString() },
      last_updated: new Date().toISOString(),
    },
    { onConflict: "user_id,category" }
  );

  for (const interest of mapping.extractedInterests) {
    await supabase.from("interests").upsert(
      {
        user_id: userId,
        platform: interest.platform,
        ref_id: interest.ref_id,
        weight: interest.weight,
      },
      { onConflict: "user_id,platform,ref_id" }
    );
  }

  const personaText = buildPersonaText({
    archetype: coreArchetype,
    tags: mapping.tags,
    energy: mapping.personaData.energy,
    focus: mapping.personaData.focus,
    interests: mapping.extractedInterests,
  });

  await generateAndStorePersonaEmbedding(userId, personaText);

  if (answers.length > 0) {
    console.log("[BAF][OnboardingSeed] Starting personalized pool seeding...");
    try {
      const count = await seedPoolFromOnboarding(answers, mapping);
      console.log(`[BAF][OnboardingSeed] Completed: ${count} personalized entries added`);
    } catch (err) {
      console.error("[BAF][OnboardingSeed] Error during seeding:", err);
    }
  }
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("persona_stats")
    .select("value")
    .eq("user_id", userId)
    .eq("category", "onboarding_complete")
    .single();

  if (!data) return false;
  return (data.value as { completed?: boolean })?.completed === true;
}
