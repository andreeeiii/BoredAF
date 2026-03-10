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
  getCurrentMood,
  getArchetypeStrategy,
  type MoodState,
} from "../mood";

export const RescueSchema = z.object({
  suggestion: z.string(),
  emoji: z.string(),
  vibe: z.string(),
  source: z.enum(["youtube", "chess", "fallback", "custom"]),
  link: z.string().nullable(),
});

export type Rescue = z.infer<typeof RescueSchema>;

const BafState = Annotation.Root({
  userId: Annotation<string>,
  userPersona: Annotation<Persona | null>,
  mood: Annotation<MoodState | null>,
  toolResults: Annotation<{
    youtube: YouTubeResult | null;
    chess: ChessResult | null;
  } | null>,
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

    const recentPlatforms = persona.recentHistory
      .slice(0, 3)
      .map((h) => {
        if (h.suggestion.toLowerCase().includes("youtube") || h.suggestion.toLowerCase().includes("watch")) return "youtube";
        if (h.suggestion.toLowerCase().includes("chess") || h.suggestion.toLowerCase().includes("puzzle")) return "chess";
        return "custom";
      });

    const energyLevel =
      (persona.stats.energy_level as { current?: string })?.current ?? "mixed";

    const mood = getCurrentMood(
      persona.profile.archetype ?? "The Spark",
      energyLevel,
      persona.recentHistory
    );

    return { userPersona: persona, previousSuggestions, recentPlatforms, mood, error: null };
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

  const chessStats = state.userPersona.stats.chess as
    | { username?: string }
    | undefined;

  const [youtube, chess] = await Promise.all([
    youtubeChannels.length > 0
      ? fetchYouTubeVideos(youtubeChannels)
      : Promise.resolve({ videos: [], error: null } as YouTubeResult),
    fetchChessData(chessStats?.username),
  ]);

  return { toolResults: { youtube, chess } };
}

async function reasoningNode(
  state: BafStateType
): Promise<Partial<BafStateType>> {
  const previousSuggestions = state.previousSuggestions ?? [];

  if (!state.userPersona || state.error) {
    return {
      finalRescue: {
        suggestion: getDefaultRescue(previousSuggestions),
        emoji: "🚶",
        vibe: "chill",
        source: "fallback",
        link: null,
      },
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      finalRescue: {
        suggestion: getDefaultRescue(previousSuggestions),
        emoji: "🎲",
        vibe: "random",
        source: "fallback",
        link: null,
      },
    };
  }

  const mood = state.mood!;
  const archetype = mood.effectiveArchetype;
  const strategy = getArchetypeStrategy(archetype);

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature: 0.95,
    maxTokens: 400,
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

  const videoList =
    state.toolResults?.youtube?.videos
      .slice(0, 5)
      .map(
        (v) =>
          `"${v.title}" by ${v.channelTitle} — ${v.url}`
      )
      .join("\n") || "No recent videos (last 24h)";

  const chessElo =
    state.toolResults?.chess?.currentElo ??
    (state.userPersona.stats.chess as { elo?: number })?.elo ??
    null;

  const puzzleInfo = state.toolResults?.chess?.dailyPuzzleUrl
    ? `Daily Puzzle: "${state.toolResults.chess.dailyPuzzleTitle}" — ${state.toolResults.chess.dailyPuzzleUrl}`
    : "No puzzle available";

  const topInterests = state.userPersona.interests
    .slice(0, 5)
    .map((i) => `${i.platform}:${i.ref_id} (weight:${i.weight})`)
    .join(", ");

  const allPrevious = previousSuggestions.length > 0
    ? previousSuggestions.map((s) => `- "${s}"`).join("\n")
    : "None";

  const recentPlatformList = (state.recentPlatforms ?? []).join(", ");
  const platformRotationWarning =
    state.recentPlatforms?.length === 3 &&
    new Set(state.recentPlatforms).size === 1
      ? `WARNING: Last 3 suggestions were all from "${state.recentPlatforms[0]}". You MUST pick a DIFFERENT platform this time.`
      : "";

  const prompt = `You are the BAF (BoredAF) Rescue Agent.

ARCHETYPE: "${archetype}"
STRATEGY: ${strategy}

MOOD CONTEXT:
- Time of day: ${mood.timeOfDay}
- Energy: ${mood.energyLevel}
- Tired: ${mood.isTired}
- Rejection streak: ${mood.recentRejectionStreak}
- Mood override active: ${mood.moodOverride}
${mood.moodOverride ? `(Original archetype was "${state.userPersona.profile.archetype}", temporarily shifted to "${archetype}" due to mood)` : ""}

RULES:
- Follow the ARCHETYPE STRATEGY above strictly.
- If "The Grind" and user just lost/failed, suggest a tutorial video instead.
- If "The Chill", ONLY suggest passive low-effort content.
- If "The Spark", pick the LEAST used platform for novelty.
- When suggesting YouTube content, ALWAYS include an actual YouTube video link from the LIVE CONTENT list below.
- ALL content must be family-friendly and appropriate for all ages. Never suggest 18+ content.
- Be witty, punchy, and brief. MAX 15 words for the suggestion.
- NEVER repeat a previous suggestion.
- Never suggest the same platform 3 times in a row.
${platformRotationWarning}

USER:
- Username: ${state.userPersona.profile.username}
- Base Archetype: ${state.userPersona.profile.archetype}
- Chess ELO: ${chessElo ?? "unknown"}
- ${puzzleInfo}
- Top interests: ${topInterests}
- Recent platforms used: ${recentPlatformList || "none"}

ALL PREVIOUS SUGGESTIONS (NEVER repeat these):
${allPrevious}

RECENT REJECTIONS:
${rejections ? `- ${rejections}` : "None"}

RECENT ACCEPTS:
${accepts ? `- ${accepts}` : "None"}

LIVE CONTENT RIGHT NOW:
${videoList}

Respond in EXACTLY this JSON format, nothing else:
{"suggestion": "max 15 words, witty and specific", "emoji": "one emoji", "vibe": "one word", "source": "youtube|chess|fallback|custom", "link": "actual_youtube_url_or_chess_url_or_null"}`;

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
      parsed.link = null;
    }

    const rescue = RescueSchema.parse(parsed);

    const isDuplicate = previousSuggestions.some(
      (prev) => prev.toLowerCase() === rescue.suggestion.toLowerCase()
    );

    if (isDuplicate) {
      return {
        finalRescue: {
          suggestion: getDefaultRescue(previousSuggestions),
          emoji: "🎯",
          vibe: "surprise",
          source: "fallback",
          link: null,
        },
      };
    }

    return { finalRescue: rescue };
  } catch {
    return {
      finalRescue: {
        suggestion: getDefaultRescue(previousSuggestions),
        emoji: "🎯",
        vibe: "surprise",
        source: "fallback",
        link: null,
      },
    };
  }
}

function buildGraph() {
  const graph = new StateGraph(BafState)
    .addNode("context", contextNode)
    .addNode("parallelFetch", parallelFetchNode)
    .addNode("reasoning", reasoningNode)
    .addEdge("__start__", "context")
    .addEdge("context", "parallelFetch")
    .addEdge("parallelFetch", "reasoning")
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
    }
  );
}
