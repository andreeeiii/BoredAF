import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { z } from "zod";
import { getPersona, type Persona } from "../persona";
import {
  fetchYouTubeVideos,
  fetchChessData,
  getDefaultRescue,
  type YouTubeResult,
  type ChessResult,
} from "../tools/registry";
import {
  fetchTwitchStreams,
  fetchTikTokLinks,
  type TwitchResult,
  type TikTokResult,
} from "../tools/socialTools";
import {
  getCurrentMood,
  getArchetypeStrategy,
  type MoodState,
} from "../mood";
import { rankContent, type RankedItem, type RankingInput } from "./ranking";

export const RescueSchema = z.object({
  suggestion: z.string(),
  emoji: z.string(),
  vibe: z.string(),
  source: z.enum(["youtube", "chess", "twitch", "tiktok", "fallback", "custom"]),
  link: z.string().nullable(),
  isLive: z.boolean().optional(),
  archetype: z.string().optional(),
});

export type Rescue = z.infer<typeof RescueSchema>;

const BafState = Annotation.Root({
  userId: Annotation<string>,
  userPersona: Annotation<Persona | null>,
  mood: Annotation<MoodState | null>,
  toolResults: Annotation<RankingInput | null>,
  rankedContent: Annotation<RankedItem[]>,
  previousSuggestions: Annotation<string[]>,
  recentPlatforms: Annotation<string[]>,
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

    const recentPlatforms = persona.recentHistory.slice(0, 3).map((h) => {
      const s = h.suggestion.toLowerCase();
      if (s.includes("twitch") || s.includes("stream")) return "twitch";
      if (s.includes("tiktok")) return "tiktok";
      if (s.includes("youtube") || s.includes("watch") || s.includes("video")) return "youtube";
      if (s.includes("chess") || s.includes("puzzle") || s.includes("elo")) return "chess";
      return "custom";
    });

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

async function parallelFetchNode(
  state: BafStateType
): Promise<Partial<BafStateType>> {
  if (!state.userPersona) {
    return { toolResults: null };
  }

  const youtubeChannels = state.userPersona.interests
    .filter((i) => i.platform === "youtube")
    .map((i) => i.ref_id);

  const twitchUsernames = state.userPersona.interests
    .filter((i) => i.platform === "twitch")
    .map((i) => i.ref_id);

  const tiktokUsernames = state.userPersona.interests
    .filter((i) => i.platform === "tiktok")
    .map((i) => i.ref_id);

  const chessStats = state.userPersona.stats.chess as
    | { username?: string }
    | undefined;

  const [youtube, chess, twitch, tiktok] = await Promise.all([
    youtubeChannels.length > 0
      ? fetchYouTubeVideos(youtubeChannels)
      : Promise.resolve({ videos: [], error: null } as YouTubeResult),
    fetchChessData(chessStats?.username),
    twitchUsernames.length > 0
      ? fetchTwitchStreams(twitchUsernames)
      : Promise.resolve({ streams: [], error: null } as TwitchResult),
    Promise.resolve(
      tiktokUsernames.length > 0
        ? fetchTikTokLinks(tiktokUsernames)
        : ({ links: [], error: null } as TikTokResult)
    ),
  ]);

  return { toolResults: { youtube, chess, twitch, tiktok } };
}

async function rankingNode(
  state: BafStateType
): Promise<Partial<BafStateType>> {
  if (!state.toolResults || !state.mood) {
    return { rankedContent: [] };
  }

  const ranked = rankContent(
    state.toolResults,
    state.mood.effectiveArchetype,
    state.recentPlatforms ?? [],
    state.previousSuggestions ?? []
  );

  return { rankedContent: ranked };
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
      return {
        finalRescue: {
          suggestion: `Check out: ${topItem.title.slice(0, 60)}`,
          emoji: topItem.isLive ? "🔴" : "🎯",
          vibe: topItem.isLive ? "live" : "discover",
          source: topItem.platform,
          link: topItem.url,
          isLive: topItem.isLive,
          archetype: state.mood?.effectiveArchetype ?? "The Spark",
        },
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

  const ranked = (state.rankedContent ?? []).slice(0, 8);
  const contentList = ranked.length > 0
    ? ranked.map((r) =>
        `[${r.platform.toUpperCase()}${r.isLive ? " 🔴 LIVE" : ""}] "${r.title}" — ${r.url} (score: ${r.score})`
      ).join("\n")
    : "No live content available";

  const liveStreams = ranked.filter((r) => r.isLive);
  const hasLive = liveStreams.length > 0;

  const chessElo =
    state.toolResults?.chess?.currentElo ??
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

  const prompt = `You are the BAF (BoredAF) Rescue Agent. Generate a UNIQUE suggestion for user "${state.userPersona.profile.username}". Request ID: ${uniqueId}

ARCHETYPE: "${archetype}"
STRATEGY: ${strategy}

MOOD: ${mood.timeOfDay} | energy: ${mood.energyLevel} | tired: ${mood.isTired} | rejection streak: ${mood.recentRejectionStreak}
${mood.moodOverride ? `(Mood shifted from "${state.userPersona.profile.archetype}" to "${archetype}")` : ""}

CRITICAL RULES:
1. Your suggestion text MUST be completely unique — never the same wording as any previous suggestion listed below. Rephrase, use different words, different angles.
2. You MUST include a real clickable URL in the "link" field. Pick one from the RANKED CONTENT below.
3. If suggesting YouTube/Twitch/TikTok, the link MUST be from the list. Do NOT make up URLs.
4. If a streamer is LIVE, strongly prefer them (especially for Chill/Spark).
5. ALL content must be family-friendly. No 18+ content ever.
6. MAX 15 words. Be witty, punchy, specific to the content you're linking.
7. Never suggest the same platform 3 times in a row. Recent: [${recentPlatformList || "none"}]
${archetype === "The Spark" ? "8. SPARK MODE: Pick the most unexpected/unusual content from the list." : ""}
${archetype === "The Grind" ? `8. GRIND MODE: Chess ELO is ${chessElo ?? "unknown"}. Prioritize skill-building content.` : ""}
${archetype === "The Chill" ? "8. CHILL MODE: Only passive, relaxing content. Nothing that feels like work." : ""}
${hasLive ? `\n🔴 LIVE STREAMS AVAILABLE — Consider these first for Chill/Spark users.` : ""}

RANKED CONTENT (pick from these, higher score = better match):
${contentList}

ALL PREVIOUS SUGGESTIONS (NEVER repeat wording — use completely different words):
${allPrevious}

RECENT REJECTIONS:
${rejections ? `- ${rejections}` : "None"}

RECENT ACCEPTS:
${accepts ? `- ${accepts}` : "None"}

Respond in EXACTLY this JSON format:
{"suggestion": "unique witty text max 15 words", "emoji": "one emoji", "vibe": "one word", "source": "youtube|chess|twitch|tiktok|custom", "link": "real_url_from_list_above", "isLive": false}`;

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

    const rescue = RescueSchema.parse(parsed);

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
        return {
          finalRescue: {
            suggestion: `${fallbackItem.isLive ? "🔴 LIVE: " : ""}${fallbackItem.title.slice(0, 60)}`,
            emoji: fallbackItem.isLive ? "🔴" : "🎯",
            vibe: fallbackItem.isLive ? "live" : "discover",
            source: fallbackItem.platform,
            link: fallbackItem.url,
            isLive: fallbackItem.isLive,
            archetype,
          },
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
      return {
        finalRescue: {
          suggestion: `${topItem.isLive ? "🔴 LIVE: " : ""}${topItem.title.slice(0, 60)}`,
          emoji: topItem.isLive ? "🔴" : "🎯",
          vibe: topItem.isLive ? "live" : "discover",
          source: topItem.platform,
          link: topItem.url,
          isLive: topItem.isLive,
          archetype,
        },
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

function buildGraph() {
  const graph = new StateGraph(BafState)
    .addNode("context", contextNode)
    .addNode("parallelFetch", parallelFetchNode)
    .addNode("ranking", rankingNode)
    .addNode("reasoning", reasoningNode)
    .addEdge("__start__", "context")
    .addEdge("context", "parallelFetch")
    .addEdge("parallelFetch", "ranking")
    .addEdge("ranking", "reasoning")
    .addEdge("reasoning", END);

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
    toolResults: null,
    rankedContent: [],
    previousSuggestions: [],
    recentPlatforms: [],
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
