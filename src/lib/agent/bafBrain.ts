import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { z } from "zod";
import { getPersona, type Persona } from "../persona";
import { getDefaultRescue } from "../tools/registry";
import {
  getCurrentMood,
  getArchetypeStrategy,
  type MoodState,
} from "../mood";
import { rankContent, type RankedItem } from "./ranking";
import { computeCategoryWeights, type CategoryWeights } from "./circuitBreaker";
import { searchSemanticSuggestions, fetchPopularSuggestions, type SemanticMatch } from "../embeddings";
import {
  fetchTwitchStreams,
  type TwitchStream,
} from "../tools/socialTools";

export const RescueSchema = z.object({
  suggestion: z.string(),
  emoji: z.string(),
  vibe: z.string(),
  source: z.enum(["youtube", "chess", "twitch", "tiktok", "general", "semantic", "fallback", "custom"]),
  link: z.string().nullable(),
  isLive: z.boolean().optional(),
  archetype: z.string().optional(),
  twitchUsername: z.string().optional(),
  viewerCount: z.number().nullable().optional(),
  gameName: z.string().nullable().optional(),
  poolId: z.string().nullable().optional(),
});

export type Rescue = z.infer<typeof RescueSchema>;

const BafState = Annotation.Root({
  userId: Annotation<string>,
  userPersona: Annotation<Persona | null>,
  mood: Annotation<MoodState | null>,
  poolSuggestions: Annotation<SemanticMatch[]>,
  rankedContent: Annotation<RankedItem[]>,
  previousSuggestions: Annotation<string[]>,
  recentPlatforms: Annotation<string[]>,
  blacklistedPlatforms: Annotation<string[]>,
  blacklistedItems: Annotation<string[]>,
  categoryWeights: Annotation<CategoryWeights>,
  liveStreams: Annotation<TwitchStream[]>,
  finalRescue: Annotation<Rescue | null>,
  error: Annotation<string | null>,
});

type BafStateType = typeof BafState.State;

async function contextNode(
  state: BafStateType
): Promise<Partial<BafStateType>> {
  try {
    const persona = await getPersona(state.userId);

    const previousSuggestions = persona.recentHistory.map((h) => h.suggestion);

    const recentPlatforms = persona.recentHistory
      .slice(0, 5)
      .map((h) => h.source ?? "custom")
      .filter((s) => s !== "custom" && s !== "fallback");

    const categoryWeights = computeCategoryWeights(persona.recentHistory);
    console.log(`[BAF][Context] Archetype: "${persona.profile.archetype}"`);
    console.log(`[BAF][Context] Interests: ${JSON.stringify(persona.interests)}`);
    console.log(`[BAF][Context] Blacklisted: [${persona.blacklistedPlatforms.join(", ")}]`);
    console.log(`[BAF][Context] Recent platforms (from source field): [${recentPlatforms.join(", ")}]`);
    console.log(`[BAF][CircuitBreaker] Category weights: ${JSON.stringify(categoryWeights)}`);

    const energyLevel =
      (persona.stats.energy_level as { current?: string })?.current ?? "mixed";

    const mood = getCurrentMood(
      persona.profile.archetype ?? "The Spark",
      energyLevel,
      persona.recentHistory
    );

    return {
      userPersona: persona,
      previousSuggestions,
      recentPlatforms,
      blacklistedPlatforms: persona.blacklistedPlatforms,
      blacklistedItems: persona.blacklistedItems,
      categoryWeights,
      mood,
      error: null,
    };
  } catch (err) {
    return {
      userPersona: null,
      mood: null,
      previousSuggestions: [],
      recentPlatforms: [],
      error: err instanceof Error ? err.message : "Context fetch failed",
    };
  }
}

async function poolFetchNode(
  state: BafStateType
): Promise<Partial<BafStateType>> {
  if (!state.userPersona) {
    return { poolSuggestions: [] };
  }

  const personaEmbedding = state.userPersona.profile.persona_embedding;

  let poolSuggestions: SemanticMatch[];

  if (personaEmbedding) {
    poolSuggestions = await searchSemanticSuggestions(personaEmbedding, 20, 0.0);
    console.log(`[BAF][PoolFetch] Semantic search returned ${poolSuggestions.length} matches`);
  } else {
    const popular = await fetchPopularSuggestions(20);
    poolSuggestions = popular.map((p) => ({
      ...p,
      similarity: 0.5,
    }));
    console.log(`[BAF][PoolFetch] No persona embedding — using ${poolSuggestions.length} popular suggestions`);
  }

  if (poolSuggestions.length > 0) {
    console.log(`[BAF][PoolFetch] Top: "${poolSuggestions[0].content_text.slice(0, 40)}..." (${poolSuggestions[0].platform}, sim=${poolSuggestions[0].similarity.toFixed(3)})`);
  }

  const twitchUsernames = poolSuggestions
    .filter((s) => s.platform === "twitch" && s.url)
    .map((s) => {
      const match = s.url.match(/twitch\.tv\/([^/?]+)/);
      return match ? match[1] : null;
    })
    .filter((u): u is string => u !== null);

  let liveStreams: TwitchStream[] = [];
  if (twitchUsernames.length > 0) {
    try {
      const twitchResult = await fetchTwitchStreams(Array.from(new Set(twitchUsernames)));
      liveStreams = twitchResult.streams.filter((s) => s.isLive);
      if (liveStreams.length > 0) {
        console.log(`[BAF][LiveEnrich] ${liveStreams.length} Twitch streamers are LIVE: ${liveStreams.map((s) => s.username).join(", ")}`);
      }
    } catch (err) {
      console.error(`[BAF][LiveEnrich] Twitch check failed:`, err instanceof Error ? err.message : err);
    }
  }

  return { poolSuggestions, liveStreams };
}

async function rankingNode(
  state: BafStateType
): Promise<Partial<BafStateType>> {
  if (!state.mood) {
    return { rankedContent: [] };
  }

  const recentHistory = (state.userPersona?.recentHistory ?? []).map((h) => ({
    suggestion: h.suggestion,
    outcome: h.outcome,
    source: h.source,
  }));

  const ranked = rankContent(
    state.poolSuggestions ?? [],
    state.liveStreams ?? [],
    state.mood.effectiveArchetype,
    state.recentPlatforms ?? [],
    state.previousSuggestions ?? [],
    recentHistory,
    state.blacklistedPlatforms ?? [],
    state.blacklistedItems ?? [],
    state.categoryWeights ?? {}
  );

  return { rankedContent: ranked };
}

function enrichWithTwitchMeta(
  rescue: Rescue,
  ranked: RankedItem[]
): Rescue {
  if (rescue.source !== "twitch") return rescue;

  const match = ranked.find(
    (r) => r.platform === "twitch" && r.url === rescue.link
  ) ?? ranked.find((r) => r.platform === "twitch");

  if (!match) return rescue;

  return {
    ...rescue,
    twitchUsername: (match.metadata.username as string) ?? undefined,
    viewerCount: (match.metadata.viewerCount as number) ?? null,
    gameName: (match.metadata.gameName as string) ?? null,
  };
}

async function reasoningNode(
  state: BafStateType
): Promise<Partial<BafStateType>> {
  const previousSuggestions = state.previousSuggestions ?? [];
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (!state.userPersona || state.error) {
    return {
      finalRescue: {
        suggestion: getDefaultRescue(previousSuggestions),
        emoji: "🚶",
        vibe: "chill",
        source: "fallback",
        link: null,
        isLive: false,
        archetype: "fallback",
      },
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const topItem = (state.rankedContent ?? [])[0];
    if (topItem) {
      const base: Rescue = {
        suggestion: `Check out: ${topItem.title.slice(0, 60)}`,
        emoji: topItem.isLive ? "🔴" : "🎯",
        vibe: topItem.isLive ? "live" : "discover",
        source: topItem.platform as Rescue["source"],
        link: topItem.url,
        isLive: topItem.isLive,
        archetype: state.mood?.effectiveArchetype ?? "The Spark",
        poolId: (topItem.metadata?.poolId as string) ?? null,
      };
      return {
        finalRescue: enrichWithTwitchMeta(base, state.rankedContent ?? []),
      };
    }
    return {
      finalRescue: {
        suggestion: getDefaultRescue(previousSuggestions),
        emoji: "🎲",
        vibe: "random",
        source: "fallback",
        link: null,
        isLive: false,
        archetype: "fallback",
      },
    };
  }

  const mood = state.mood!;
  const archetype = mood.effectiveArchetype;
  const strategy = getArchetypeStrategy(archetype);

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature: 0.97,
    maxTokens: 500,
    apiKey,
  });

  const rejections = state.userPersona.recentHistory
    .filter((h) => h.outcome === "rejected")
    .map((h) => `"${h.suggestion}" (reason: ${h.reason ?? "unknown"})`)
    .join("\n- ");

  const accepts = state.userPersona.recentHistory
    .filter((h) => h.outcome === "accepted")
    .map((h) => `"${h.suggestion}"`)
    .join("\n- ");

  const allRanked = state.rankedContent ?? [];
  const ranked = weightedTopPick(allRanked).slice(0, 8);
  const contentList = ranked.length > 0
    ? ranked.map((r) =>
        `[${r.platform.toUpperCase()}${r.isLive ? " 🔴 LIVE" : ""}] "${r.title}" — ${r.url} (score: ${r.score})`
      ).join("\n")
    : "No live content available";

  const liveStreams = ranked.filter((r) => r.isLive);
  const hasLive = liveStreams.length > 0;

  const chessElo =
    (state.userPersona.stats.chess as { elo?: number })?.elo ??
    null;

  const topInterests = state.userPersona.interests
    .slice(0, 5)
    .map((i) => `${i.platform}:${i.ref_id} (weight:${i.weight})`)
    .join(", ");

  const allPrevious = previousSuggestions.length > 0
    ? previousSuggestions.map((s) => `- "${s}"`).join("\n")
    : "None";

  const recentPlatformList = (state.recentPlatforms ?? []).join(", ");

  const prompt = `You are an adaptive life-coach and curator for the BAF (BoredAF) app — NOT a search engine. You understand the user's IDENTITY and suggest content that matches WHO THEY ARE, not just what data you have.

A "Nah" is NOT a request for a "better" version of the same thing — it means the user is BORED OF THAT ENTIRE SUBJECT. Pivot 180 degrees. If you suggested a game, suggest a video. If you suggested a video, suggest a physical activity or social content.

Generate a UNIQUE suggestion for user "${state.userPersona.profile.username}". Request ID: ${uniqueId}

USER IDENTITY:
- Archetype: "${archetype}" — Strategy: ${strategy}
- Core interests: [${topInterests || "none specified"}]
- Mood: ${mood.timeOfDay} | energy: ${mood.energyLevel} | tired: ${mood.isTired} | rejection streak: ${mood.recentRejectionStreak}
${mood.moodOverride ? `- Mood shifted from "${state.userPersona.profile.archetype}" to "${archetype}"` : ""}

ABSOLUTE RULES (violating ANY = failure):
1. PERSONA-FIRST: Only suggest content that matches the user's CORE INTERESTS listed above. If the content doesn't connect to their interests, DO NOT suggest it.
2. You MUST include a real clickable URL in the "link" field from the RANKED CONTENT below.
3. Do NOT make up URLs. Only use URLs from the list.
4. ALL content must be family-friendly.
5. MAX 15 words. Be witty, punchy, specific.
6. STRICT ROTATION: You are FORBIDDEN from suggesting the same platform twice in a row. Recent: [${recentPlatformList || "none"}]. Pick a DIFFERENT platform.
${(state.blacklistedPlatforms ?? []).length > 0 ? `7. BLACKLISTED (user rejected — DO NOT suggest): [${(state.blacklistedPlatforms ?? []).join(", ")}]. These are BANNED.\n` : ""}8. Every "Nah" = COMMAND to switch to a COMPLETELY different platform AND subject. Never retry rejected categories.
${archetype === "The Spark" ? "9. SPARK MODE: Pick the most unexpected/unusual content." : ""}
${archetype === "The Grind" ? `9. GRIND MODE: Chess ELO is ${chessElo ?? "unknown"}. Skill-building content — but ONLY if chess is in their interests.` : ""}
${archetype === "The Chill" ? "9. CHILL MODE: Passive, relaxing content only." : ""}
${hasLive ? `\n🔴 LIVE STREAMS AVAILABLE — Strongly prefer these.` : ""}

RANKED CONTENT (pick from these — higher score = better persona match):
${contentList}

PREVIOUS SUGGESTIONS (NEVER repeat):
${allPrevious}

REJECTIONS (these subjects are DEAD — never revisit):
${rejections ? `- ${rejections}` : "None"}

ACCEPTS:
${accepts ? `- ${accepts}` : "None"}

Respond in EXACTLY this JSON format:
{"suggestion": "unique witty text max 15 words", "emoji": "one emoji", "vibe": "one word", "source": "youtube|chess|twitch|tiktok|general|semantic|custom", "link": "real_url_from_list_above_or_null_for_semantic", "isLive": false}`;

  try {
    const response = await llm.invoke(prompt);
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.link === "null" || parsed.link === "") {
      const topItem = ranked[0];
      parsed.link = topItem?.url ?? null;
    }

    if (!parsed.isLive) parsed.isLive = false;

    parsed.archetype = archetype;

    const rescue = enrichWithTwitchMeta(
      RescueSchema.parse(parsed),
      ranked
    );

    const isDuplicate = previousSuggestions.some(
      (prev) => prev.toLowerCase() === rescue.suggestion.toLowerCase()
    );

    if (isDuplicate) {
      const fallbackItem = ranked.find(
        (r) =>
          !previousSuggestions.some((p) =>
            p.toLowerCase().includes(r.title.toLowerCase().slice(0, 15))
          )
      );

      if (fallbackItem) {
        const base: Rescue = {
          suggestion: `${fallbackItem.isLive ? "🔴 LIVE: " : ""}${fallbackItem.title.slice(0, 60)}`,
          emoji: fallbackItem.isLive ? "🔴" : "🎯",
          vibe: fallbackItem.isLive ? "live" : "discover",
          source: fallbackItem.platform as Rescue["source"],
          link: fallbackItem.url,
          isLive: fallbackItem.isLive,
          archetype,
          poolId: (fallbackItem.metadata?.poolId as string) ?? null,
        };
        return {
          finalRescue: enrichWithTwitchMeta(base, ranked),
        };
      }

      return {
        finalRescue: {
          suggestion: getDefaultRescue(previousSuggestions),
          emoji: "🎯",
          vibe: "surprise",
          source: "fallback",
          link: null,
          isLive: false,
          archetype,
        },
      };
    }

    return { finalRescue: rescue };
  } catch {
    const topItem = (state.rankedContent ?? [])[0];
    if (topItem) {
      const base: Rescue = {
        suggestion: `${topItem.isLive ? "🔴 LIVE: " : ""}${topItem.title.slice(0, 60)}`,
        emoji: topItem.isLive ? "🔴" : "🎯",
        vibe: topItem.isLive ? "live" : "discover",
        source: topItem.platform as Rescue["source"],
        link: topItem.url,
        isLive: topItem.isLive,
        archetype,
        poolId: (topItem.metadata?.poolId as string) ?? null,
      };
      return {
        finalRescue: enrichWithTwitchMeta(base, state.rankedContent ?? []),
      };
    }
    return {
      finalRescue: {
        suggestion: getDefaultRescue(previousSuggestions),
        emoji: "🎯",
        vibe: "surprise",
        source: "fallback",
        link: null,
        isLive: false,
        archetype: archetype ?? "fallback",
      },
    };
  }
}

function weightedTopPick(items: RankedItem[]): RankedItem[] {
  if (items.length <= 3) return items;

  const top3 = items.slice(0, 3);
  const rest = items.slice(3);

  const minScore = Math.min(...top3.map((i) => i.score));
  const weights = top3.map((i) => Math.max(1, i.score - minScore + 10));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let roll = Math.random() * totalWeight;
  let pickedIndex = 0;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      pickedIndex = i;
      break;
    }
  }

  const picked = top3[pickedIndex];
  const remaining = [...top3.slice(0, pickedIndex), ...top3.slice(pickedIndex + 1), ...rest];
  console.log(`[BAF][WeightedRandom] Picked "${picked.platform}" (score:${picked.score}) from top-3: ${top3.map((i) => `${i.platform}:${i.score}`).join(", ")}`);
  return [picked, ...remaining];
}

async function validationNode(
  state: BafStateType
): Promise<Partial<BafStateType>> {
  const rescue = state.finalRescue;
  if (!rescue || !state.userPersona) return {};

  if (rescue.source === "fallback" || rescue.source === "custom" || rescue.source === "semantic") return {};

  const userPlatforms = state.userPersona.interests.map((i) => i.platform);

  if (userPlatforms.length === 0) {
    console.log(`[BAF][Validation] SKIP — no interests defined, accepting all platforms`);
    return {};
  }

  const hasInterest = userPlatforms.includes(rescue.source) ||
    (rescue.source === "chess" && userPlatforms.some((p) => p === "chess" || p === "game"));

  if (hasInterest) {
    console.log(`[BAF][Validation] PASS — "${rescue.source}" matches user interests [${userPlatforms.join(", ")}]`);
    return {};
  }

  console.log(`[BAF][Validation] FAIL — "${rescue.source}" not in user interests [${userPlatforms.join(", ")}]. Re-rolling...`);

  const ranked = state.rankedContent ?? [];
  const matchingItem = ranked.find((r) =>
    userPlatforms.includes(r.platform) ||
    (r.platform === "chess" && userPlatforms.some((p) => p === "chess" || p === "game"))
  );

  if (matchingItem) {
    const base: Rescue = {
      suggestion: `${matchingItem.isLive ? "\u{1F534} LIVE: " : ""}${matchingItem.title.slice(0, 60)}`,
      emoji: matchingItem.isLive ? "\u{1F534}" : "\u{1F3AF}",
      vibe: matchingItem.isLive ? "live" : "discover",
      source: matchingItem.platform as Rescue["source"],
      link: matchingItem.url,
      isLive: matchingItem.isLive,
      archetype: state.mood?.effectiveArchetype ?? "The Spark",
      poolId: (matchingItem.metadata?.poolId as string) ?? null,
    };
    console.log(`[BAF][Validation] Re-rolled to "${matchingItem.platform}" — "${matchingItem.title}"`);
    return { finalRescue: enrichWithTwitchMeta(base, ranked) };
  }

  return {};
}

function buildGraph() {
  const graph = new StateGraph(BafState)
    .addNode("context", contextNode)
    .addNode("poolFetch", poolFetchNode)
    .addNode("ranking", rankingNode)
    .addNode("reasoning", reasoningNode)
    .addNode("validation", validationNode)
    .addEdge("__start__", "context")
    .addEdge("context", "poolFetch")
    .addEdge("poolFetch", "ranking")
    .addEdge("ranking", "reasoning")
    .addEdge("reasoning", "validation")
    .addEdge("validation", END);

  return graph.compile();
}

let compiledGraph: ReturnType<typeof buildGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildGraph();
  }
  return compiledGraph;
}

export async function runBafBrain(userId: string): Promise<Rescue> {
  const graph = getGraph();

  const result = await graph.invoke({
    userId,
    userPersona: null,
    mood: null,
    poolSuggestions: [],
    rankedContent: [],
    previousSuggestions: [],
    recentPlatforms: [],
    blacklistedPlatforms: [],
    blacklistedItems: [],
    categoryWeights: {},
    liveStreams: [],
    finalRescue: null,
    error: null,
  });

  return (
    result.finalRescue ?? {
      suggestion: getDefaultRescue(),
      emoji: "🌀",
      vibe: "mystery",
      source: "fallback",
      link: null,
      isLive: false,
      archetype: "fallback",
    }
  );
}
