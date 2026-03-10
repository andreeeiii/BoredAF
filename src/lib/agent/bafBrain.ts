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
  toolResults: Annotation<{
    youtube: YouTubeResult | null;
    chess: ChessResult | null;
  } | null>,
  previousSuggestions: Annotation<string[]>,
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

    return { userPersona: persona, previousSuggestions, error: null };
  } catch (err) {
    return {
      userPersona: null,
      previousSuggestions: [],
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

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-20250514",
    temperature: 0.95,
    maxTokens: 300,
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

  const recentTwoRejected =
    state.userPersona.recentHistory.slice(0, 2).every((h) => h.outcome === "rejected");

  const videoList =
    state.toolResults?.youtube?.videos
      .slice(0, 5)
      .map(
        (v) =>
          `"${v.title}" by ${v.channelTitle} (${v.url}) [thumbnail: ${v.thumbnail}]`
      )
      .join("\n") || "No recent videos (last 24h)";

  const chessElo =
    state.toolResults?.chess?.currentElo ??
    (state.userPersona.stats.chess as { elo?: number })?.elo ??
    null;

  const puzzleInfo = state.toolResults?.chess?.dailyPuzzleUrl
    ? `Daily Puzzle: "${state.toolResults.chess.dailyPuzzleTitle}" — ${state.toolResults.chess.dailyPuzzleUrl}`
    : "No puzzle available";

  const energyLevel =
    (state.userPersona.stats.energy_level as { current?: string })?.current ??
    "unknown";

  const topInterests = state.userPersona.interests
    .slice(0, 5)
    .map((i) => `${i.platform}:${i.ref_id} (weight:${i.weight})`)
    .join(", ");

  const allPrevious = previousSuggestions.length > 0
    ? previousSuggestions.map((s) => `- "${s}"`).join("\n")
    : "None";

  const prompt = `You are the BAF (BoredAF) Rescue Agent. You have the user's data and live world updates.

RULES:
- If they have a new video from a favorite influencer, prioritize that.
- If they play chess (ELO ${chessElo ?? "420"}), suggest the Daily Puzzle to keep the momentum.
- If they rejected the last 2 suggestions, try something COMPLETELY different and creative.
- Be witty, punchy, and brief. MAX 15 words for the suggestion.
- NEVER repeat a previous suggestion. Every suggestion MUST be unique and different.
- If including a link, put it in the "link" field.

USER:
- Username: ${state.userPersona.profile.username}
- Energy: ${energyLevel}
- Chess ELO: ${chessElo ?? "unknown"}
- ${puzzleInfo}
- Top interests: ${topInterests}

REJECTED LAST 2 IN A ROW: ${recentTwoRejected ? "YES — go wild, try something totally unexpected" : "No"}

ALL PREVIOUS SUGGESTIONS (NEVER repeat these):
${allPrevious}

RECENT REJECTIONS:
${rejections ? `- ${rejections}` : "None"}

RECENT ACCEPTS:
${accepts ? `- ${accepts}` : "None"}

LIVE CONTENT RIGHT NOW:
${videoList}

Respond in EXACTLY this JSON format, nothing else:
{"suggestion": "max 15 words, witty and specific", "emoji": "one emoji", "vibe": "one word", "source": "youtube|chess|fallback|custom", "link": "url or null"}`;

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
    toolResults: null,
    previousSuggestions: [],
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
