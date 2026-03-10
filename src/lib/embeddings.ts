import OpenAI from "openai";
import { supabase } from "./supabase";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const LEARNING_RATE = 0.05;

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const openai = getOpenAI();
  if (!openai) {
    console.log("[BAF][Embedding] OpenAI API key not configured — skipping embedding");
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error("[BAF][Embedding] Failed to generate embedding:", err instanceof Error ? err.message : err);
    return null;
  }
}

export interface PersonaTextInput {
  archetype: string;
  tags: string[];
  energy: string;
  focus: string;
  interests: Array<{ platform: string; ref_id: string; weight: number }>;
  chessElo?: number | null;
  onboardingAnswers?: Array<{ question: string; answer: string }>;
}

export function buildPersonaText(input: PersonaTextInput): string {
  const parts: string[] = [];

  parts.push(`${input.archetype} archetype user.`);

  if (input.tags.length > 0) {
    parts.push(`Personality traits: ${input.tags.join(", ")}.`);
  }

  parts.push(`Energy level: ${input.energy}. Focus style: ${input.focus}.`);

  if (input.interests.length > 0) {
    const grouped: Record<string, string[]> = {};
    for (const i of input.interests) {
      if (!grouped[i.platform]) grouped[i.platform] = [];
      grouped[i.platform].push(i.ref_id);
    }
    const interestParts = Object.entries(grouped)
      .map(([platform, refs]) => `${platform}: ${refs.join(", ")}`)
      .join("; ");
    parts.push(`Interests: ${interestParts}.`);
  }

  if (input.chessElo) {
    parts.push(`Competitive chess player with ${input.chessElo} ELO.`);
  }

  if (input.onboardingAnswers && input.onboardingAnswers.length > 0) {
    const answerText = input.onboardingAnswers
      .map((a) => `Q: ${a.question} A: ${a.answer}`)
      .join(" | ");
    parts.push(`Self-description: ${answerText}`);
  }

  return parts.join(" ");
}

export async function generateAndStorePersonaEmbedding(
  userId: string,
  personaText: string
): Promise<number[] | null> {
  const embedding = await generateEmbedding(personaText);
  if (!embedding) return null;

  const embeddingStr = `[${embedding.join(",")}]`;
  const { error } = await supabase
    .from("profiles")
    .update({ persona_embedding: embeddingStr })
    .eq("id", userId);

  if (error) {
    console.error("[BAF][Embedding] Failed to store persona embedding:", error.message);
    return null;
  }

  console.log(`[BAF][Embedding] Stored persona embedding for user ${userId} (${embedding.length} dims)`);
  return embedding;
}

export interface SemanticMatch {
  id: string;
  content_text: string;
  category: string;
  platform: string;
  url: string;
  times_shown: number;
  times_accepted: number;
  times_rejected: number;
  similarity: number;
}

export async function searchSemanticSuggestions(
  personaEmbedding: number[],
  matchCount: number = 10,
  matchThreshold: number = 0.0
): Promise<SemanticMatch[]> {
  const embeddingStr = `[${personaEmbedding.join(",")}]`;

  const { data, error } = await supabase.rpc("match_suggestions", {
    query_embedding: embeddingStr,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    console.error("[BAF][SemanticSearch] RPC error:", error.message);
    return [];
  }

  const results = (data ?? []) as SemanticMatch[];
  console.log(`[BAF][SemanticSearch] Found ${results.length} matches (threshold: ${matchThreshold})`);
  return results;
}

export async function nudgePersonaVector(
  userId: string,
  suggestionText: string,
  direction: "toward" | "away"
): Promise<void> {
  const suggestionEmbedding = await generateEmbedding(suggestionText);
  if (!suggestionEmbedding) return;

  const embeddingStr = `[${suggestionEmbedding.join(",")}]`;
  const directionInt = direction === "toward" ? 1 : -1;

  const { error } = await supabase.rpc("nudge_persona_embedding", {
    p_user_id: userId,
    suggestion_emb: embeddingStr,
    learning_rate: LEARNING_RATE,
    direction: directionInt,
  });

  if (error) {
    console.error(`[BAF][VectorFeedback] Failed to nudge persona (${direction}):`, error.message);
    return;
  }

  console.log(`[BAF][VectorFeedback] Nudged persona ${direction} "${suggestionText.slice(0, 40)}..." (rate: ${LEARNING_RATE})`);
}

export interface PoolEntry {
  id: string;
  content_text: string;
  category: string;
  platform: string;
  url: string;
  times_shown: number;
  times_accepted: number;
  times_rejected: number;
}

export async function fetchPopularSuggestions(
  count: number = 20
): Promise<PoolEntry[]> {
  const { data, error } = await supabase.rpc("fetch_popular_suggestions", {
    fetch_count: count,
  });

  if (error) {
    console.error("[BAF][PopularFetch] RPC error:", error.message);
    return [];
  }

  const results = (data ?? []) as PoolEntry[];
  console.log(`[BAF][PopularFetch] Got ${results.length} popular suggestions`);
  return results;
}

export async function updatePoolEngagement(
  poolId: string,
  outcome: "shown" | "accepted" | "rejected"
): Promise<void> {
  const { error } = await supabase.rpc("update_pool_engagement", {
    p_pool_id: poolId,
    p_outcome: outcome,
  });

  if (error) {
    console.error(`[BAF][PoolEngagement] Failed to update ${outcome} for ${poolId}:`, error.message);
    return;
  }

  console.log(`[BAF][PoolEngagement] Updated ${outcome} for pool entry ${poolId}`);
}

export async function embedSuggestionPoolEntry(
  contentText: string,
  category: string
): Promise<string | null> {
  const embedding = await generateEmbedding(contentText);
  if (!embedding) return null;

  const embeddingStr = `[${embedding.join(",")}]`;
  const { data, error } = await supabase
    .from("suggestion_pool")
    .insert({
      content_text: contentText,
      category,
      embedding: embeddingStr,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[BAF][SeedPool] Failed to insert:", error.message);
    return null;
  }

  return data?.id ?? null;
}
