import { ChatAnthropic } from "@langchain/anthropic";
import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { z } from "zod";
import { getPersona, type Persona } from "./persona";
import {
  fetchYouTubeVideos,
  fetchChessData,
  getFallbackSuggestion,
  type YouTubeResult,
  type ChessResult,
} from "@/actions/tools";

export const RescueSchema = z.object({
  suggestion: z.string(),
  emoji: z.string(),
  vibe: z.string(),
  source: z.string(),
});

export type Rescue = z.infer<typeof RescueSchema>;

const BafState = Annotation.Root({
  userId: Annotation<string>,
  persona: Annotation<Persona | null>,
  youtubeData: Annotation<YouTubeResult | null>,
  chessData: Annotation<ChessResult | null>,
  rescue: Annotation<Rescue | null>,
  error: Annotation<string | null>,
});

type BafStateType = typeof BafState.State;

async function fetchNode(state: BafStateType): Promise<Partial<BafStateType>> {
  try {
    const persona = await getPersona(state.userId);

    const youtubeChannels = persona.interests
      .filter((i) => i.platform === "youtube")
      .map((i) => i.ref_id);

    const chessStats = persona.stats.chess as
      | { username?: string }
      | undefined;

    const [youtubeData, chessData] = await Promise.all([
      youtubeChannels.length > 0
        ? fetchYouTubeVideos(youtubeChannels)
        : Promise.resolve({ videos: [], error: null } as YouTubeResult),
      fetchChessData(chessStats?.username),
    ]);

    return { persona, youtubeData, chessData, error: null };
  } catch (err) {
    return {
      persona: null,
      youtubeData: null,
      chessData: null,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

async function reasonNode(
  state: BafStateType
): Promise<Partial<BafStateType>> {
  if (!state.persona || state.error) {
    return {
      rescue: {
        suggestion: getFallbackSuggestion(),
        emoji: "🚶",
        vibe: "chill",
        source: "fallback",
      },
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      rescue: {
        suggestion: getFallbackSuggestion(),
        emoji: "🎲",
        vibe: "random",
        source: "fallback",
      },
    };
  }

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature: 0.9,
    maxTokens: 300,
    apiKey,
  });

  const rejections = state.persona.recentHistory
    .filter((h) => h.outcome === "rejected")
    .map((h) => `"${h.suggestion}" (reason: ${h.reason ?? "unknown"})`)
    .join(", ");

  const accepts = state.persona.recentHistory
    .filter((h) => h.outcome === "accepted")
    .map((h) => `"${h.suggestion}"`)
    .join(", ");

  const videoList =
    state.youtubeData?.videos
      .slice(0, 5)
      .map((v) => `"${v.title}" by ${v.channelTitle} (${v.url})`)
      .join("\n") || "No videos available";

  const chessInfo = state.chessData?.elo
    ? `Chess ELO: ${state.chessData.elo}`
    : state.persona.stats.chess
      ? `Chess ELO: ${(state.persona.stats.chess as { elo?: number }).elo ?? "unknown"}`
      : "No chess data";

  const puzzleInfo = state.chessData?.dailyPuzzleUrl
    ? `Daily puzzle: ${state.chessData.dailyPuzzleUrl}`
    : "";

  const energyLevel =
    (state.persona.stats.energy_level as { current?: string })?.current ??
    "unknown";

  const topInterests = state.persona.interests
    .slice(0, 5)
    .map((i) => `${i.platform}:${i.ref_id} (weight:${i.weight})`)
    .join(", ");

  const prompt = `You are BAF, the anti-boredom AI. Your job is to give ONE punchy, specific suggestion to rescue the user from boredom.

USER PROFILE:
- Username: ${state.persona.profile.username}
- Energy Level: ${energyLevel}
- ${chessInfo}
- ${puzzleInfo}
- Top interests: ${topInterests}

RECENT REJECTIONS: ${rejections || "None"}
RECENT ACCEPTS: ${accepts || "None"}

AVAILABLE CONTENT RIGHT NOW:
${videoList}

RULES:
- Give exactly ONE suggestion. Be specific (include video title, link, or exact action).
- If user rejected something similar recently, DO NOT suggest it again.
- Match the suggestion to their energy level.
- Be punchy, fun, and direct. No lectures. Max 2 sentences.
- If energy is low, suggest passive activities (watching, listening).
- If energy is high, suggest active activities (playing, creating).

Respond in EXACTLY this JSON format, no other text:
{"suggestion": "your suggestion here", "emoji": "one emoji", "vibe": "one-word vibe", "source": "youtube|chess|fallback|custom"}`;

  try {
    const response = await llm.invoke(prompt);
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = RescueSchema.parse(JSON.parse(jsonMatch[0]));
    return { rescue: parsed };
  } catch {
    return {
      rescue: {
        suggestion: getFallbackSuggestion(),
        emoji: "🎯",
        vibe: "surprise",
        source: "fallback",
      },
    };
  }
}

function buildGraph() {
  const graph = new StateGraph(BafState)
    .addNode("fetch", fetchNode)
    .addNode("reason", reasonNode)
    .addEdge("__start__", "fetch")
    .addEdge("fetch", "reason")
    .addEdge("reason", END);

  return graph.compile();
}

let compiledGraph: ReturnType<typeof buildGraph> | null = null;

function getGraph() {
  if (!compiledGraph) {
    compiledGraph = buildGraph();
  }
  return compiledGraph;
}

export async function runBafAgent(userId: string): Promise<Rescue> {
  const graph = getGraph();

  const result = await graph.invoke({
    userId,
    persona: null,
    youtubeData: null,
    chessData: null,
    rescue: null,
    error: null,
  });

  return (
    result.rescue ?? {
      suggestion: getFallbackSuggestion(),
      emoji: "🌀",
      vibe: "mystery",
      source: "fallback",
    }
  );
}
