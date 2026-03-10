# BAF (BoredAF) — Architecture & Business Plan

## Core Concept

BAF is an AI-powered anti-boredom app. The user presses the **BAF** button when bored, and the AI generates a personalized suggestion based on their archetype, mood, real-time context, and available content. All content is family-friendly and safe for all ages.

## User Flow

1. **Dynamic Onboarding**: Randomized 4-question chat interview → AI maps to archetype + interest tags
2. **Main Screen**: User presses **BAF** → Brain reasons with archetype + mood + tools → personalized suggestion
3. **Feedback Loop**: LFG (accept, opens link) or Nah (reject → Why? → persona updates → new suggestion)

## Boredom Archetypes

| Archetype | Goal | Suggestion Strategy |
|-----------|------|-------------------|
| **The Grind** | Mastery | Puzzles, coding katas, how-to videos, rank updates. If failed recently → tutorial instead. |
| **The Chill** | Relaxation | Long-form video essays, Twitch streams, fashion lookbooks. Low-effort only. |
| **The Spark** | Novelty | Random Wikipedia, new hobbies, "chaos" mode. Least-used platform first. |

## Architecture

```
[ USER ]
   │
   ▼ (1) PRESSES "BAF" BUTTON
   │
┌──────────────────────────────────────────────────────────────┐
│                    (2) THE BRAIN (LangGraph)                  │
│  Context → Parallel Fetch → Ranking → Reasoning → Validation │
│  Archetype + Mood + Circuit Breaker + 4 Tools + Scoring      │
└────────┬────────────────────────────────────────────┬────────┘
         │                                   │
         ▼ <─── (3) MEMORY ───>              ▼ <─── (4) TOOLS ───>
   [ PERSONA DATA ]                    [ REAL-TIME WORLD ]
   - Archetype: The Grind             - YouTube: Last 24h videos
   - Chess ELO: 420                   - Twitch: LIVE streams ← 🔴
   - Mood: Tired → Chill              - TikTok: Deep links
   - Negative signals                 - Chess.com: ELO + Puzzle
         │                                   │
         └──────────────┬────────────────────┘
                        ▼
               (5) RANKING NODE
         Score each item by archetype:
         Grind → Chess +30, YouTube +15
         Chill → Twitch +20, TikTok +15
         Spark → Least-used platform +25
         LIVE streams → +50 for Chill/Spark
         + Circuit Breaker weights
         + Strict Rotation penalty
         + Blacklist enforcement
                        │
                        ▼
            (5b) VALIDATION NODE
         Persona-first filter:
         Does suggestion match user interests?
         If not → re-roll from ranked content
                        │
                        ▼
               (6) THE SUGGESTION
         "GothamChess is LIVE — 5K watching!"
         [🔗 twitch.tv/gothamchess] 🔴 LIVE NOW
                        │
               ┌────────┴────────┐
               ▼                 ▼
          [ LFG 🔥 ]        [ Nah 👎 ]
       (Opens link +       (Why? → logs
        logs accept +      negative signal
        archetype used)    + new suggestion)
               └────────┬────────┘
                        ▼
               (7) PERSONA UPDATED
         baf_history tracks archetype used
```

## Mood Sensor

The Brain doesn't just use the stored archetype — it uses a **real-time mood override**:
- **Time of day**: Night + low energy → auto-shift to The Chill
- **Rejection streaks**: 3+ consecutive Nahs → shift to The Spark (novelty mode)
- **Tired signals**: "Too tired" rejection reason → temporarily The Chill for 1 hour
- **Platform rotation**: Never suggest the same platform 3 times in a row
- **Circuit Breaker**: 1 Nah → -70% weight for that category; 2 consecutive Nahs → 0% (total lock for session)
- **30-min Platform Blacklist**: Rejected platform stored in `persona_stats` JSONB, enforced as score = -999 for 30 minutes
- **60-min Item Blacklist**: Rejected specific items (by URL) stored in `persona_stats` JSONB, enforced as score = -999 for 60 minutes — prevents the same TikTok creator or Twitch streamer from returning after rejection
- **Graduated Rotation**: Last platform = -60, 2nd-last = -30, 3rd-last = -15 — creates a spreading effect that naturally mixes platforms

## Tool Registry (4 Parallel Tools)

| Tool | API | Data Retrieved |
|------|-----|---------------|
| **YouTube** | YouTube Data API v3 | Last 24h videos from favorite channels (with clickable URLs) |
| **Twitch** | Twitch Helix API | Live stream status, viewer count, game name, stream title |
| **TikTok** | Deep Link Generator | Direct profile URLs for favorite TikTok creators |
| **Chess** | Chess.com PubAPI | Current ELO, daily puzzle URL + title |

All tools run **in parallel** via `Promise.all`. Every tool output is Zod-validated.

## Ranking Engine

After fetching, a **ranking node** scores each piece of content:
- Base scores: YouTube 30, Chess 25, TikTok 20, Twitch offline 10
- **LIVE bonus**: +50 for Chill and Spark archetypes
- **Archetype bonuses**: Grind → Chess +30; Chill → Twitch +20; Spark → least-used +25
- **Platform rotation penalty**: -40 if same platform 3x in a row
- **Duplicate penalty**: -100 if content URL matches any previous suggestion's URL (URL-based, not text-based)
- **Category Cooldown**: -80% if platform appeared 3+ times in last 5 history entries
- **Circuit Breaker Weights**: Score × category weight (0.0–1.0 based on rejection history)
- **Platform Blacklist**: Score = -999 for platforms rejected in last 30 minutes
- **Item Blacklist**: Score = -999 for specific URLs rejected in last 60 minutes
- **Graduated Rotation**: -60 for last platform, -30 for 2nd-last, -15 for 3rd-last
- **Weighted Randomization**: Top-3 items shuffled by weighted random (higher score = higher probability, not guaranteed)

## Persona-First Validation

After reasoning, a **validation node** checks:
1. Does the suggestion's source platform exist in the user's `interests` table?
2. If not → discard and re-roll from ranked content that matches user interests
3. Tools are only fetched for platforms the user has interests in (e.g., no chess data if no chess interests)

## Dynamic Onboarding

4 randomized question slots, 3 variants each (never the same experience twice):
- **Slot 1 (Digital Anchor)**: YouTubers / Twitch streamers / online communities
- **Slot 2 (Current Skill)**: Competitive rank / skill level / teachable skill
- **Slot 3 (Energy State)**: Couch vs restless / zone out vs active / time-of-day vibe
- **Slot 4 (Wildcard)**: Current obsession / free time fantasy / procrastinated goal

AI parses answers → maps to archetype + extracts interest tags + populates DB.

## Database Schema

- **profiles**: User identity (id, username, bio, **archetype**)
- **persona_stats**: Flexible JSONB (chess ELO, energy, archetype tags, **negative_signals**, onboarding status)
- **interests**: Platform-specific references with weights (YouTube channels, Twitch, Reddit, games)
- **baf_history**: Every suggestion + outcome + reason — powers no-repeat and streak detection

## Key Intelligence Features

- **Archetype-Based Reasoning**: Different strategies for Grind/Chill/Spark users
- **Mood Sensor**: Time-of-day, energy, rejection streaks dynamically shift archetype
- **Circuit Breaker**: Category weights drop on rejection (1 Nah = -70%, 2 consecutive = locked at 0%)
- **30-Min Platform Blacklist**: Rejected platform banned for 30 minutes via `persona_stats` JSONB
- **Strict Rotation**: -60 penalty prevents same platform twice in a row
- **Persona-First Validation**: LangGraph validation node discards suggestions not matching user interests
- **Weighted Randomization**: Top-3 picks shuffled by weighted random to prevent "mathematical winner" always winning
- **Interest-Gated Fetching**: Tools only fetch data for platforms the user actually has interests in
- **Negative Signals**: Rejection reasons logged per category, adjusting future suggestions
- **No-Repeat Engine**: Full history check + server-side duplicate detection + unique request IDs
- **Ranking Engine**: Priority scoring per archetype, LIVE +50 bonus, cooldown/blacklist/weight penalties
- **4-Tool Parallel Fetch**: YouTube, Twitch, TikTok, Chess all fetched simultaneously (gated by interests)
- **LIVE Detection**: Twitch streams get glowing "LIVE NOW" badge + priority boost
- **Rich Twitch Cards**: Stream title, game, viewer count displayed in purple UI strip
- **Forced Links**: Every suggestion includes a clickable URL from real content
- **Platform Icons**: Color-coded per platform (YouTube red, Twitch purple, TikTok, Chess green)
- **Archetype Tracking**: Every baf_history entry records which archetype was used
- **Family-Friendly**: All suggestions appropriate for all ages
- **Fallback Rescues**: 10 default suggestions if APIs fail

## Semantic Persona Matching (pgvector)

The Brain uses **pgvector** to turn user personality into a mathematical vector and find suggestions via cosine similarity.

### How It Works

```
[ ONBOARDING ANSWERS + STATS ]
         │
         ▼
  buildPersonaText()
  "Novelty-seeking user. Interests: fashion, streaming.
   Energy: high. Focus: visual. Chess ELO: 420"
         │
         ▼
  OpenAI text-embedding-3-small
         │
         ▼
  persona_embedding vector(1536)  ← stored in profiles
         │
         ▼
  SELECT * FROM suggestion_pool
  ORDER BY embedding <=> persona_embedding
  LIMIT 10;
         │
         ▼
  Top-10 semantically closest suggestions
  merged into ranking alongside live content
```

### Database Changes

- **profiles**: Added `persona_embedding vector(1536)` column
- **interests**: Added `embedding vector(1536)` column
- **baf_history**: Added `embedding vector(1536)` column
- **suggestion_pool** (new table): `id`, `content_text`, `category`, `embedding vector(1536)`

### Postgres RPC Function

`match_suggestions(query_embedding, match_count, match_threshold)` — returns top-N suggestions ordered by cosine similarity to the user's persona vector, filtered by a minimum similarity threshold.

### Feedback Loop (Continuous Learning)

Every interaction shifts the persona vector:
- **LFG (accept)**: `persona_embedding += learning_rate × (suggestion_embedding - persona_embedding)` — moves TOWARD the accepted suggestion
- **Nah (reject)**: `persona_embedding -= learning_rate × (suggestion_embedding - persona_embedding)` — moves AWAY from the rejected suggestion
- **Learning rate**: 0.05 (small nudge per interaction, cumulative over time)
- Result: The vector "map" of the user's mind literally shifts with every click

### Integration with LangGraph

Semantic search is a **5th parallel tool** alongside YouTube/Twitch/TikTok/Chess:
```
Context → Parallel Fetch [YouTube, Twitch, TikTok, Chess, SemanticSearch] → Ranking → Reasoning → Validation
```
Semantic matches get a base score of 35 and are ranked alongside live content.

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind CSS + Framer Motion + TypeScript
- **Database**: Supabase Cloud (PostgreSQL + JSONB + **pgvector**)
- **AI Brain**: LangGraph + Claude 3.5 Sonnet (Anthropic)
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Real-Time Tools**: YouTube Data API v3 + Twitch Helix API + TikTok Deep Links + Chess.com PubAPI
- **Validation**: Zod schemas on all tool outputs
- **Testing**: Jest + React Testing Library (107 tests across 11 suites)
