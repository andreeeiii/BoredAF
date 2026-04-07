import OpenAI from "openai";
import { supabase } from "./supabase";
import { validateYouTubeChannels, extractYouTubeHandle } from "./tools/registry";
import { fetchTwitchUsers } from "./tools/socialTools";

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

/**
 * Batch-embed multiple texts in a single OpenAI API call.
 * Returns an array of embeddings in the same order as the input texts.
 * Null entries indicate failures for individual texts.
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
  const openai = getOpenAI();
  if (!openai || texts.length === 0) return texts.map(() => null);

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    // OpenAI returns embeddings sorted by index
    const sorted = response.data.sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  } catch (err) {
    console.error("[BAF][Embedding] Batch embedding failed:", err instanceof Error ? err.message : err);
    return texts.map(() => null);
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
  category: string,
  platform: string = "general",
  url: string = ""
): Promise<string | null> {
  const embedding = await generateEmbedding(contentText);
  if (!embedding) return null;

  const embeddingStr = `[${embedding.join(",")}]`;
  const { data, error } = await supabase
    .from("suggestion_pool")
    .insert({
      content_text: contentText,
      category,
      platform,
      url,
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

export interface OnboardingAnswer {
  slot: string;
  question: string;
  answer: string;
}

export interface OnboardingMapping {
  archetype: string;
  tags: string[];
  personaData: { energy: string; focus: string };
  extractedInterests: Array<{ platform: string; ref_id: string; weight: number }>;
}

export async function seedPoolFromOnboarding(
  answers: OnboardingAnswer[],
  mapping: OnboardingMapping
): Promise<number> {
  const openai = getOpenAI();
  if (!openai) {
    console.log("[BAF][OnboardingSeed] No OpenAI key — skipping pool seeding");
    return 0;
  }

  const answersText = answers
    .map((a) => `[${a.slot.toUpperCase()}] Q: "${a.question}" A: "${a.answer}"`)
    .join("\n");

  const interestsText = mapping.extractedInterests.length > 0
    ? `Extracted interests: ${mapping.extractedInterests.map((i) => `${i.platform}/${i.ref_id}`).join(", ")}`
    : "No specific interests extracted";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `You generate personalized content suggestions for an anti-boredom app called BAF. All suggestions must be family-friendly and safe for all ages. Return ONLY a JSON array, no markdown or explanation.`,
        },
        {
          role: "user",
          content: `A new user just completed onboarding for an anti-boredom app. Generate 15 personalized suggestions with REAL creator names and URLs.

User profile:
- Archetype: ${mapping.archetype}
- Energy: ${mapping.personaData.energy}, Focus: ${mapping.personaData.focus}
- Tags: ${mapping.tags.join(", ")}
- ${interestsText}

Their EXACT onboarding answers (READ CAREFULLY):
${answersText}

CRITICAL RULES:
1. If the user mentions SPECIFIC creators by name → include those EXACT people AND 5-10 similar creators from the SAME niche/country/language
2. If the user mentions a country or culture (e.g. "Greek") → suggest REAL well-known creators from that country
3. ONLY suggest creators you are CONFIDENT are real and popular (100K+ followers). Use their EXACT known handle for the URL.
4. If a creator's exact handle is uncertain, use their most commonly known channel name
5. Format: "CreatorName — short description" (e.g. "Agadmator — chess analysis with storytelling")
6. Do NOT write generic descriptions — use REAL creator names only
7. Max 3 general activity suggestions (no URL), the rest MUST be real verified creators
8. Include "followers_approx" — your best estimate of their follower/subscriber count
9. FORBIDDEN PLATFORMS: NEVER suggest Instagram, Facebook, or any Meta platforms. Only use: youtube|twitch|tiktok|chess|general

Return ONLY a JSON array: [{"text": "CreatorName — what they do (under 60 chars)", "platform": "youtube|twitch|tiktok|chess|general", "url": "https://exact-handle-url", "category": "influencer|gaming|creative|physical|learning|music|adventure|general", "followers_approx": 500000}]`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return 0;

    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as PoolExpansionSuggestion[];

    if (!Array.isArray(parsed)) return 0;

    const MIN_FOLLOWERS = 50_000;
    const valid = parsed
      .filter((s) => {
        if (!s.text || !s.platform || !s.category) return false;
        // Filter out Instagram URLs
        if (s.url && s.url.toLowerCase().includes('instagram.com')) {
          console.log(`[BAF][OnboardingSeed] Filtered Instagram URL: "${s.text.slice(0, 40)}..."`);
          return false;
        }
        // General activities (no URL) don't need follower check
        if (s.platform === "general") return true;
        // Require followers_approx for platform-specific entries
        if (s.followers_approx === undefined || s.followers_approx < MIN_FOLLOWERS) {
          console.log(`[BAF][OnboardingSeed] Filtered low/missing followers: "${s.text.slice(0, 40)}..." (${s.followers_approx ?? "unknown"} followers)`);
          return false;
        }
        return true;
      })
      .slice(0, 15);

    // Validate against real platform APIs (YouTube subs, Twitch broadcaster_type)
    const validated = await validatePoolEntries(valid, "OnboardingSeed");
    console.log(`[BAF][OnboardingSeed] ${valid.length} passed LLM filter → ${validated.length} passed API validation`);

    // Dedup against existing pool entries
    const fresh: typeof validated = [];
    for (const s of validated) {
      const { data: existing } = await supabase
        .from("suggestion_pool")
        .select("id")
        .or(`content_text.eq.${s.text}${s.url ? `,url.eq.${s.url}` : ""}`)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[BAF][OnboardingSeed] Skipped duplicate: "${s.text.slice(0, 40)}..."`);
        continue;
      }
      fresh.push(s);
    }

    if (fresh.length === 0) return 0;

    // Batch-embed all entries in a single API call
    const embeddings = await generateEmbeddingsBatch(fresh.map((s) => s.text));

    let inserted = 0;
    for (let i = 0; i < fresh.length; i++) {
      const s = fresh[i];
      const embedding = embeddings[i];
      if (!embedding) continue;

      const embeddingStr = `[${embedding.join(",")}]`;
      const { data, error } = await supabase
        .from("suggestion_pool")
        .insert({
          content_text: s.text,
          category: s.category,
          platform: s.platform,
          url: s.url || "",
          embedding: embeddingStr,
        })
        .select("id")
        .single();

      if (!error && data?.id) {
        inserted++;
        console.log(`[BAF][OnboardingSeed] Added: "${s.text.slice(0, 40)}..." (${s.platform}) → ${data.id}`);
      }
    }

    console.log(`[BAF][OnboardingSeed] Seeded ${inserted} personalized entries from onboarding`);
    return inserted;
  } catch (err) {
    console.error("[BAF][OnboardingSeed] LLM error:", err instanceof Error ? err.message : err);
    return 0;
  }
}

export interface PoolExpansionSuggestion {
  text: string;
  platform: string;
  url: string;
  category: string;
  followers_approx?: number;
}

const MIN_YOUTUBE_SUBS = 50_000;

/**
 * Validate pool entries against real platform APIs before insertion.
 * - YouTube: checks real subscriber count via Data API v3
 * - Twitch: checks broadcaster_type (must be partner or affiliate)
 * Filters out entries that fail validation. General entries pass through.
 */
async function validatePoolEntries(
  entries: PoolExpansionSuggestion[],
  logPrefix: string
): Promise<PoolExpansionSuggestion[]> {
  // Collect YouTube handles and Twitch usernames for batch validation
  const ytHandles: { handle: string; index: number }[] = [];
  const twitchUsernames: { username: string; index: number }[] = [];

  entries.forEach((s, i) => {
    if (s.platform === "youtube" && s.url) {
      const handle = extractYouTubeHandle(s.url);
      if (handle) ytHandles.push({ handle, index: i });
    }
    if (s.platform === "twitch" && s.url) {
      const match = s.url.match(/twitch\.tv\/([^/?]+)/);
      if (match) twitchUsernames.push({ username: match[1], index: i });
    }
  });

  // Run YouTube + Twitch validation in parallel
  const [ytStats, twitchResult] = await Promise.all([
    ytHandles.length > 0
      ? validateYouTubeChannels(ytHandles.map((h) => h.handle))
      : Promise.resolve(new Map()),
    twitchUsernames.length > 0
      ? fetchTwitchUsers(twitchUsernames.map((t) => t.username))
      : Promise.resolve({ users: [], error: null }),
  ]);

  // Build sets of valid entries
  const blockedIndices = new Set<number>();

  // Filter out Instagram URLs first
  entries.forEach((s, i) => {
    if (s.url && s.url.toLowerCase().includes('instagram.com')) {
      console.log(`[BAF][${logPrefix}] Instagram URL not allowed: "${s.url}" - filtered`);
      blockedIndices.add(i);
    }
  });

  // Check YouTube channels
  for (const { handle, index } of ytHandles) {
    const stats = ytStats.get(handle.toLowerCase());
    if (!stats || !stats.exists) {
      console.log(`[BAF][${logPrefix}] YouTube channel "@${handle}" not found — filtered`);
      blockedIndices.add(index);
    } else if (stats.subscriberCount < MIN_YOUTUBE_SUBS) {
      console.log(`[BAF][${logPrefix}] YouTube "@${handle}" has ${stats.subscriberCount.toLocaleString()} subs (need ${MIN_YOUTUBE_SUBS.toLocaleString()}) — filtered`);
      blockedIndices.add(index);
    } else {
      console.log(`[BAF][${logPrefix}] YouTube "@${handle}" verified: ${stats.subscriberCount.toLocaleString()} subs ✓`);
    }
  }

  // Check Twitch users
  const validTwitchLogins = new Set(
    twitchResult.users
      .filter((u) => u.broadcasterType === "partner" || u.broadcasterType === "affiliate")
      .map((u) => u.login)
  );

  for (const { username, index } of twitchUsernames) {
    const found = twitchResult.users.some((u) => u.login === username.toLowerCase());
    if (!found) {
      console.log(`[BAF][${logPrefix}] Twitch "${username}" not found — filtered`);
      blockedIndices.add(index);
    } else if (!validTwitchLogins.has(username.toLowerCase())) {
      console.log(`[BAF][${logPrefix}] Twitch "${username}" is not affiliate/partner — filtered`);
      blockedIndices.add(index);
    } else {
      console.log(`[BAF][${logPrefix}] Twitch "${username}" verified ✓`);
    }
  }

  return entries.filter((_, i) => !blockedIndices.has(i));
}

export async function generateSimilarSuggestions(
  acceptedText: string,
  platform: string,
  category: string
): Promise<PoolExpansionSuggestion[]> {
  const openai = getOpenAI();
  if (!openai) {
    console.log("[BAF][PoolExpansion] No OpenAI key — skipping expansion");
    return [];
  }

  const platformUrlExamples: Record<string, string> = {
    twitch: "https://twitch.tv/username",
    youtube: "https://youtube.com/@ChannelName",
    tiktok: "https://tiktok.com/@username",
    chess: "https://chess.com/...",
  };

  const urlHint = platformUrlExamples[platform] ?? "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You generate content suggestions for an anti-boredom app. All suggestions must be family-friendly and safe for all ages. Return ONLY a JSON array, no markdown.`,
        },
        {
          role: "user",
          content: `A user liked: "${acceptedText}" (platform: ${platform}, category: ${category}).

Generate exactly 3 similar creators/content. Format: "CreatorName — what they do".
${urlHint ? `URL format: ${urlHint}` : ""}

Return JSON array: [{"text": "CreatorName — description under 60 chars", "platform": "${platform}", "url": "exact_handle_url", "category": "${category}", "followers_approx": 500000}]

Rules:
- ONLY suggest creators you are CONFIDENT are real and popular (100K+ followers)
- Use their EXACT known handle/username for the URL
- Same niche/vibe/country as the original
- Include "followers_approx" — your best estimate of their follower count
- If unsure about a creator's handle, skip them — do NOT guess
- FORBIDDEN: Never suggest Instagram, Facebook, or any Meta platforms`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return [];

    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as PoolExpansionSuggestion[];

    if (!Array.isArray(parsed)) return [];

    const MIN_FOLLOWERS = 50_000;
    return parsed
      .filter((s) => {
        if (!s.text || !s.platform || !s.url || !s.category) return false;
        // Filter out Instagram URLs
        if (s.url && s.url.toLowerCase().includes('instagram.com')) {
          console.log(`[BAF][PoolExpansion] Filtered Instagram URL: "${s.text.slice(0, 40)}..."`);
          return false;
        }
        // Require followers_approx for all platform-specific entries
        if (s.followers_approx === undefined || s.followers_approx < MIN_FOLLOWERS) {
          console.log(`[BAF][PoolExpansion] Filtered low/missing followers: "${s.text.slice(0, 40)}..." (${s.followers_approx ?? "unknown"})`);
          return false;
        }
        return true;
      })
      .slice(0, 3);
  } catch (err) {
    console.error("[BAF][PoolExpansion] LLM error:", err instanceof Error ? err.message : err);
    return [];
  }
}

const POOL_EXPANSION_THRESHOLD = 500;

/**
 * Check if the pool already has enough entries for a platform/category combo.
 * Returns true if expansion should be skipped (pool is mature).
 */
async function isPoolMature(platform: string, category: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("suggestion_pool")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("platform", platform)
    .eq("category", category);

  if (error) {
    console.error("[BAF][PoolCheck] Error checking pool density:", error.message);
    return false;
  }

  const currentCount = count ?? 0;
  if (currentCount >= POOL_EXPANSION_THRESHOLD) {
    console.log(`[BAF][PoolCheck] Pool mature for ${platform}/${category} (${currentCount} entries) — skipping expansion`);
    return true;
  }

  console.log(`[BAF][PoolCheck] Pool sparse for ${platform}/${category} (${currentCount}/${POOL_EXPANSION_THRESHOLD}) — expanding`);
  return false;
}

export async function expandPoolFromAccept(
  acceptedText: string,
  platform: string,
  category: string
): Promise<number> {
  // Rate-limit: skip expansion if pool is already mature for this combo
  if (await isPoolMature(platform, category)) return 0;

  const raw = await generateSimilarSuggestions(acceptedText, platform, category);
  if (raw.length === 0) return 0;

  // Validate against real platform APIs before insertion
  const suggestions = await validatePoolEntries(raw, "PoolExpansion");
  if (suggestions.length === 0) return 0;

  // Dedup against existing pool entries
  const fresh: typeof suggestions = [];
  for (const s of suggestions) {
    const { data: existing } = await supabase
      .from("suggestion_pool")
      .select("id")
      .or(`content_text.eq.${s.text},url.eq.${s.url}`)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[BAF][PoolExpansion] Skipped duplicate: "${s.text.slice(0, 40)}..."`);
      continue;
    }
    fresh.push(s);
  }

  if (fresh.length === 0) return 0;

  // Batch-embed all entries in a single API call
  const embeddings = await generateEmbeddingsBatch(fresh.map((s) => s.text));

  let inserted = 0;
  for (let i = 0; i < fresh.length; i++) {
    const s = fresh[i];
    const embedding = embeddings[i];
    if (!embedding) continue;

    const embeddingStr = `[${embedding.join(",")}]`;
    const { data, error } = await supabase
      .from("suggestion_pool")
      .insert({
        content_text: s.text,
        category: s.category,
        platform: s.platform,
        url: s.url,
        embedding: embeddingStr,
      })
      .select("id")
      .single();

    if (!error && data?.id) {
      inserted++;
      console.log(`[BAF][PoolExpansion] Added: "${s.text.slice(0, 40)}..." (${s.platform}) → ${data.id}`);
    }
  }

  console.log(`[BAF][PoolExpansion] Expanded pool by ${inserted} entries from "${acceptedText.slice(0, 40)}..."`);
  return inserted;
}

export async function expandPoolFromReject(
  rejectedText: string,
  platform: string,
  category: string,
  reason: string
): Promise<number> {
  const openai = getOpenAI();
  if (!openai) return 0;

  const reasonHints: Record<string, string> = {
    "too tired": "Suggest LOW-ENERGY alternatives: passive watching, short videos, chill streams, relaxing activities. Nothing physical or demanding.",
    "not interested": "Suggest DIFFERENT types of content on the same or different platforms. Shift category/genre entirely.",
    "already did that": "Suggest FRESH content the user hasn't seen — newer creators, trending content, different sub-genres.",
    "other": "Suggest something completely different — new platform, new category, surprise the user.",
  };

  const hint = reasonHints[reason] ?? reasonHints["other"];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.95,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You generate content suggestions for an anti-boredom app. All suggestions must be family-friendly. Return ONLY a JSON array, no markdown.`,
        },
        {
          role: "user",
          content: `A user REJECTED this suggestion: "${rejectedText}" (platform: ${platform}, category: ${category}).
Reason: "${reason}"

${hint}

Generate exactly 3 ALTERNATIVE suggestions that address their rejection reason. Format: "CreatorName — what they do".

ONLY suggest creators you are CONFIDENT are real and popular (100K+ followers). Use their EXACT known handle for URLs.
URL formats: YouTube: https://youtube.com/@ExactHandle, Twitch: https://twitch.tv/exacthandle, TikTok: https://tiktok.com/@exacthandle, General activities: empty url
FORBIDDEN: Never suggest Instagram, Facebook, or any Meta platforms.

Return JSON array: [{"text": "CreatorName — description under 60 chars", "platform": "youtube|twitch|tiktok|chess|general", "url": "exact_handle_url_or_empty", "category": "influencer|gaming|creative|physical|learning|music|adventure|general", "followers_approx": 500000}]`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return 0;

    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as PoolExpansionSuggestion[];
    if (!Array.isArray(parsed)) return 0;

    const MIN_FOLLOWERS = 50_000;
    const valid = parsed
      .filter((s) => {
        if (!s.text || !s.platform || !s.category) return false;
        // Filter out Instagram URLs
        if (s.url && s.url.toLowerCase().includes('instagram.com')) {
          console.log(`[BAF][RejectExpansion] Filtered Instagram URL: "${s.text.slice(0, 40)}..."`);
          return false;
        }
        if (s.platform === "general") return true;
        // Require followers_approx for all platform-specific entries
        if (s.followers_approx === undefined || s.followers_approx < MIN_FOLLOWERS) {
          console.log(`[BAF][RejectExpansion] Filtered low/missing followers: "${s.text.slice(0, 40)}..." (${s.followers_approx ?? "unknown"})`);
          return false;
        }
        return true;
      })
      .slice(0, 3);

    // Validate against real platform APIs before insertion
    const validated = await validatePoolEntries(valid, "RejectExpansion");

    let inserted = 0;

    for (const s of validated) {
      const { data: existing } = await supabase
        .from("suggestion_pool")
        .select("id")
        .or(`content_text.eq.${s.text}${s.url ? `,url.eq.${s.url}` : ""}`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      const id = await embedSuggestionPoolEntry(s.text, s.category, s.platform, s.url || "");
      if (id) {
        inserted++;
        console.log(`[BAF][RejectExpansion] Added: "${s.text.slice(0, 40)}..." (${s.platform}) → ${id}`);
      }
    }

    console.log(`[BAF][RejectExpansion] Expanded pool by ${inserted} entries (reason: "${reason}")`);
    return inserted;
  } catch (err) {
    console.error("[BAF][RejectExpansion] LLM error:", err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function deactivateUnderperformingEntries(): Promise<number> {
  const { data: candidates, error: fetchErr } = await supabase
    .from("suggestion_pool")
    .select("id, times_shown, times_accepted")
    .eq("is_active", true)
    .gt("times_shown", 10);

  if (fetchErr || !candidates) {
    console.error("[BAF][PoolCleanup] Failed to fetch candidates:", fetchErr?.message);
    return 0;
  }

  const toDeactivate = candidates.filter(
    (e) => e.times_shown > 0 && e.times_accepted / e.times_shown < 0.1
  );

  if (toDeactivate.length === 0) return 0;

  const ids = toDeactivate.map((e) => e.id);
  const { error: updateErr } = await supabase
    .from("suggestion_pool")
    .update({ is_active: false })
    .in("id", ids);

  if (updateErr) {
    console.error("[BAF][PoolCleanup] Failed to deactivate:", updateErr.message);
    return 0;
  }

  console.log(`[BAF][PoolCleanup] Deactivated ${ids.length} underperforming entries (<10% accept rate)`);
  return ids.length;
}
