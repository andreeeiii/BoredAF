# BAF (BoredAF) — Architecture & Business Plan

## Core Concept

BAF is an AI-powered anti-boredom app. The user presses the **BAF** button when bored, and the AI generates a personalized suggestion based on their archetype, mood, real-time context, and available content. All content is family-friendly and safe for all ages.

## User Flow

1. **Authentication**: User signs up/logs in via Google OAuth or Email/Password → Supabase Auth → session cookie
2. **Routing**: New user (no archetype) → Onboarding | Returning user → Dashboard
3. **Dynamic Onboarding**: Randomized 4-question chat interview → "Building Your Persona" animation → AI maps to archetype + interest tags
4. **Main Screen**: User presses **BAF** → Brain reasons with archetype + mood + tools → personalized suggestion
5. **Feedback Loop**: LFG (accept, opens link) or Nah (reject → Why? → persona updates → new suggestion)

## Authentication Architecture

### Stack
- **@supabase/ssr** — cookie-based session management for Next.js App Router
- **Supabase Auth** — handles Google OAuth + Email/Password sign-up/login
- **Next.js Middleware** — session refresh + route protection

### Auth Flow
```
/login → [Google OAuth | Email+Password] → Supabase Auth → session cookie
  ↓
Middleware validates session on every request
  ↓
Protected routes (/) → getAuthUserId() extracts user ID from cookie
  ↓
New user (no archetype) → Onboarding → Dashboard
Returning user → Dashboard directly
```

### Key Files
- `src/lib/supabase/client.ts` — browser-side Supabase client (anon key, for auth operations)
- `src/lib/supabase/server.ts` — server-side Supabase client (cookie-based session)
- `src/lib/supabase/api.ts` — `getAuthUserId()` helper for API routes
- `src/lib/supabase.ts` — server singleton (service role key, bypasses RLS for trusted operations)
- `src/middleware.ts` — session refresh, redirects unauthenticated → `/login`, authenticated away from `/login`
- `src/app/login/page.tsx` — login/signup UI with Google OAuth + Email/Password
- `src/app/login/actions.ts` — server actions: `login`, `signup`, `signInWithGoogle`, `logout`
- `src/app/auth/callback/route.ts` — OAuth callback handler

### Security
- **RLS enabled** on `profiles`, `persona_stats`, `interests`, `baf_history`
- **Policies**: users can only read/write their own data via `auth.uid() = user_id`
- **Service role key**: server singleton bypasses RLS for trusted server-side operations
- **`suggestion_pool`**: shared content, no RLS (all users read from the same pool)
- **SQL trigger**: `handle_new_user()` auto-creates a `profiles` row on auth signup

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon key (browser client + middleware)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server singleton, bypasses RLS)

## Boredom Archetypes

| Archetype | Goal | Suggestion Strategy |
|-----------|------|-------------------|
| **The Grind** | Mastery | Puzzles, coding katas, how-to videos, rank updates. If failed recently → tutorial instead. |
| **The Chill** | Relaxation | Long-form video essays, Twitch streams, fashion lookbooks. Low-effort only. |
| **The Spark** | Novelty | Random Wikipedia, new hobbies, "chaos" mode. Least-used platform first. |

## Architecture (Vector-First)

```
[ USER ]
   │
   ▼ (1) PRESSES "BAF" BUTTON
   │
┌──────────────────────────────────────────────────────────────┐
│                    (2) THE BRAIN (LangGraph)                  │
│  Context → Pool Fetch → Ranking → Reasoning → Validation     │
│  Archetype + Mood + Circuit Breaker + Vector DB + Scoring     │
└────────┬────────────────────────────────────────────┬────────┘
         │                                   │
         ▼ <─── (3) MEMORY ───>              ▼ <─── (4) SUGGESTION POOL ───>
   [ PERSONA DATA ]                    [ VECTOR DATABASE ]
   - Archetype: The Grind             - 150+ suggestions with URLs
   - persona_embedding vector         - Influencers (Twitch/YT/TikTok)
   - Mood: Tired → Chill              - Activities (physical/creative)
   - Negative signals                 - Engagement counters per item
         │                                   │
         └──────────────┬────────────────────┘
                        ▼
               (5) RANKING NODE
         Score each item by:
         - Vector similarity to persona
         - Engagement ratio (accepts/shows)
         - Archetype bonuses
         - Circuit Breaker weights
         - Graduated Rotation penalty
         - Item + Platform Blacklists
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
        logs accept +      negative signal +
        engagement++)      engagement++ +
                           new suggestion)
               └────────┬────────┘
                        ▼
               (7) PERSONA + POOL UPDATED
         persona_embedding nudged
         pool entry engagement counters updated
```

## Mood Sensor

The Brain doesn't just use the stored archetype — it uses a **real-time mood override**:
- **Time of day**: Night + low energy → auto-shift to The Chill
- **Rejection streaks**: 3+ consecutive Nahs → shift to The Spark (novelty mode)
- **Tired signals**: "Too tired" rejection reason → temporarily The Chill for 1 hour
- **Platform rotation**: Never suggest the same platform 3 times in a row
- **Circuit Breaker**: 1 Nah → -70% weight for that category; 2 consecutive Nahs → 0% (total lock for session)
- **60-min Item Blacklist**: Rejected specific items (by URL) stored in `persona_stats` JSONB, enforced as score = -999 for 60 minutes — prevents the same TikTok creator or Twitch streamer from returning after rejection. No platform-level blacklist — rejecting one YouTube video does NOT block all YouTube.
- **Graduated Rotation**: Last platform = -60, 2nd-last = -30, 3rd-last = -15 — creates a spreading effect that naturally mixes platforms

## Content Source: suggestion_pool (Vector DB)

The `suggestion_pool` is the **sole content source**. No hardcoded defaults exist anywhere.

| Column | Type | Purpose |
|--------|------|--------|
| `content_text` | TEXT | The suggestion text shown to users |
| `category` | TEXT | Category (influencer, physical, creative, gaming, etc.) |
| `platform` | TEXT | Platform tag (youtube, twitch, tiktok, chess, general) |
| `url` | TEXT | Real clickable URL |
| `embedding` | vector(1536) | Semantic vector for similarity search |
| `times_shown` | INT | How many times this was surfaced |
| `times_accepted` | INT | How many times users clicked LFG |
| `times_rejected` | INT | How many times users clicked Nah |
| `is_active` | BOOLEAN | Can be deactivated without deletion |

### Fetch Strategy
1. **With persona_embedding**: Cosine similarity search → top 20 matches
2. **Without persona_embedding**: Popularity-weighted random (engagement ratio)
3. **Optional enrichment**: External APIs (Twitch live check, Chess puzzle) enhance pool entries if API keys are configured

### External API Tools (Optional Enrichment)

| Tool | API | Purpose |
|------|-----|--------|
| **Twitch** | Twitch Helix API | Check if pool's Twitch streamers are LIVE → boost score |
| **Chess** | Chess.com PubAPI | Fetch daily puzzle URL for chess-category pool entries |

## Ranking Engine

After fetching, a **ranking node** scores each piece of content:
- Base scores: YouTube 30, Chess 25, TikTok 20, Twitch offline 10
- **LIVE bonus**: +50 for Chill and Spark archetypes
- **Archetype bonuses**: Grind → Chess +30; Chill → Twitch +20; Spark → least-used +25
- **Platform rotation penalty**: -40 if same platform 3x in a row
- **Duplicate penalty**: -100 if content URL matches any previous suggestion's URL (URL-based, not text-based)
- **Category Cooldown**: -80% if platform appeared 3+ times in last 5 history entries
- **Circuit Breaker Weights**: Score × category weight (0.0–1.0 based on rejection history)
- **Item Blacklist**: Score = -999 for specific URLs rejected in last 60 minutes (no platform-level blacklist)
- **Graduated Rotation**: -60 for last platform, -30 for 2nd-last, -15 for 3rd-last
- **Weighted Randomization**: Top-3 items shuffled by weighted random (higher score = higher probability, not guaranteed)

## Link Integrity (Index-Based Selection)

The LLM **never** generates free-form URLs. Instead, each ranked content item is assigned a numbered index, and the LLM returns the index of its pick. The system then uses the pool entry's own `content_text` + `url` pair, which are always correctly matched.

```
RANKED CONTENT (passed to LLM):
  [0] [YOUTUBE] "MrBeast's latest challenge" — https://youtube.com/@MrBeast (score: 42)
  [1] [TWITCH 🔴 LIVE] "GothamChess live chess" — https://twitch.tv/gothamchess (score: 38)
  [2] [TIKTOK] "Khaby Lame life hacks" — https://tiktok.com/@khaby.lame (score: 35)

LLM RETURNS:
  {"pick": 1, "suggestion": "GothamChess is live — jump in!", "emoji": "♟️", ...}

SYSTEM RESOLVES:
  pick=1 → url="https://twitch.tv/gothamchess", poolId=<uuid>, category="influencer"
```

### Consistency Check
After the LLM generates its `suggestion` text, a consistency check verifies the creator/subject name from the pool's `content_text` appears in the LLM's text:
- Extract the subject name (text before " — " or first 2 words) from `content_text`
- Check if it appears (case-insensitive) in the LLM's `suggestion`
- **If mismatch**: discard LLM text, use pool's `content_text` directly
- **If index out of bounds or missing**: fall back to top-ranked item

### Why This Matters
Previously, the LLM could write about "Creator A" while picking "Creator B"'s URL, causing users to land on the wrong page. Index-based selection makes `poolId`, `url`, `category`, and `content_text` deterministic from the ranked list.

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
- **Item-Level Blacklist**: Rejected specific URLs banned for 60 minutes — no platform-level blocking
- **Strict Rotation**: -60 penalty prevents same platform twice in a row
- **Persona-First Validation**: LangGraph validation node discards suggestions not matching user interests
- **Weighted Randomization**: Top-3 picks shuffled by weighted random to prevent "mathematical winner" always winning
- **Interest-Gated Fetching**: Tools only fetch data for platforms the user actually has interests in
- **Negative Signals**: Rejection reasons logged per category, adjusting future suggestions
- **No-Repeat Engine**: Full history check + server-side duplicate detection + unique request IDs
- **Ranking Engine**: Priority scoring per archetype, LIVE +50 bonus, cooldown/blacklist/weight penalties
- **Vector-First Fetch**: All suggestions come from the `suggestion_pool` vector DB — no hardcoded defaults
- **LIVE Detection**: Twitch streams get glowing "LIVE NOW" badge + priority boost
- **Rich Twitch Cards**: Stream title, game, viewer count displayed in purple UI strip
- **Link Integrity**: Index-based LLM selection guarantees suggestion text matches the URL (no free-form URL generation)
- **Platform Icons**: Color-coded per platform (YouTube red, Twitch purple, TikTok, Chess green)
- **Archetype Tracking**: Every baf_history entry records which archetype was used
- **Family-Friendly**: All suggestions appropriate for all ages
- **Fallback Rescues**: 10 default activity suggestions if pool is empty AND APIs fail
- **Dynamic Pool Engagement**: Every accept/reject updates `times_shown`/`times_accepted`/`times_rejected` counters on the pool entry

## Post-Onboarding Pool Seeding (Personalized Day-One Content)

After onboarding, the system generates **10–15 personalized suggestions** based on the user's 4 answers:

```
[ USER COMPLETES ONBOARDING ]
  "I like Greek YouTube influencers, chess, and chill vibes"
         │
         ▼
  seedPoolFromOnboarding(answers, mapping)
         │
         ▼
  OpenAI Chat (gpt-4o-mini): "Generate 15 suggestions
  matching these interests with real URLs"
         │
         ▼
  [
    { text: "Nile Red — chemistry experiments that blow your mind", platform: "youtube", url: "https://youtube.com/@NileRed" },
    { text: "Agadmator — chess analysis with storytelling", platform: "youtube", url: "https://youtube.com/@agadmator" },
    { text: "Fθrza — Greek gaming and vlogs", platform: "youtube", url: "https://youtube.com/@ForzaGreek" },
    ...12 more tailored to user's exact interests
  ]
         │
         ▼
  For each: generateEmbedding() → INSERT into suggestion_pool (deduped)
         │
         ▼
  User's first BAF press has content matching their exact taste!
```

### Rules
- **Triggered once per user** — only during onboarding completion
- **Non-blocking**: fire-and-forget, doesn't delay the onboarding flow
- **Deduplication**: Skips if `content_text` or `url` already exists
- **Shared pool**: New entries benefit ALL users with similar interests
- **Cost**: ~1000 tokens per onboarding = $0.00005

## Dynamic Pool Expansion (Self-Growing Pool)

When a user **accepts** a suggestion, the pool automatically expands with similar content:

```
[ USER ACCEPTS "GothamChess live — learn chess while being entertained" ]
         │
         ▼
  expandPoolFromAccept(acceptedText, platform, category)
         │
         ▼
  OpenAI Chat (gpt-4o-mini): "Generate 3 similar suggestions
  with real URLs for platform=twitch, category=influencer"
         │
         ▼
  [
    { text: "BotezLive — chess sisters with chaotic energy", platform: "twitch", url: "https://twitch.tv/botezlive" },
    { text: "Eric Rosen — chill chess and traps", platform: "twitch", url: "https://twitch.tv/imrosen" },
    { text: "Anna Cramling — chess with family vibes", platform: "twitch", url: "https://twitch.tv/annacramling" }
  ]
         │
         ▼
  For each: generateEmbedding() → INSERT into suggestion_pool
         │
         ▼
  Pool grows organically from user taste!
```

### On Accept (LFG)
- 3 similar suggestions generated and inserted (non-blocking)
- Deduplication: Skips if `content_text` or `url` already exists

### On Reject (Nah)
- 3 **alternative** suggestions generated based on the rejection reason (non-blocking)
- "Too tired" → low-energy alternatives; "Not interested" → different genre; "Already did that" → fresher content
- Rejected item blacklisted by text + URL for 30 minutes (substring matching)
- Persona vector nudges AWAY from rejected content
- No platform-level blacklist — rejecting one YouTube video does NOT block all YouTube

### Deactivation
- Entries with >10 shows and <10% accept rate are marked `is_active = false`
- **Cost**: ~500 tokens per expansion = $0.00001 per interaction

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
- **suggestion_pool** (new table): `id`, `content_text`, `category`, `platform`, `url`, `embedding vector(1536)`, `times_shown`, `times_accepted`, `times_rejected`, `is_active`

### Postgres RPC Function

`match_suggestions(query_embedding, match_count, match_threshold)` — returns top-N suggestions ordered by cosine similarity to the user's persona vector, filtered by a minimum similarity threshold.

### Feedback Loop (Continuous Learning)

Every interaction shifts the persona vector:
- **LFG (accept)**: `persona_embedding += learning_rate × (suggestion_embedding - persona_embedding)` — moves TOWARD the accepted suggestion
- **Nah (reject)**: `persona_embedding -= learning_rate × (suggestion_embedding - persona_embedding)` — moves AWAY from the rejected suggestion
- **Learning rate**: 0.05 (small nudge per interaction, cumulative over time)
- Result: The vector "map" of the user's mind literally shifts with every click

### Integration with LangGraph

The suggestion pool is the **primary content source** in the Brain pipeline:
```
Context → Pool Fetch [SemanticSearch OR PopularFetch] → Optional Live Enrichment → Ranking → Reasoning → Validation
```
Pool entries are scored: base 35 × similarity + engagement bonus + archetype bonuses + rotation/blacklist penalties.

## Cost Analysis (Unit Economics)

### Models Used

| Model | Purpose | Pricing (per 1M tokens) |
|-------|---------|------------------------|
| **GPT-4o-mini** | Reasoning (per BAF click) + Onboarding persona parsing + Pool seeding + Pool expansion | $0.15 input / $0.60 output |
| **text-embedding-3-small** | All vector embeddings (persona, pool entries, nudges) | $0.02 |

### Cost per Onboarding (one-time per user)

| Step | Model | Input Tokens | Output Tokens | Cost |
|------|-------|-------------|---------------|------|
| parsePersona | GPT-4o-mini | ~400 | ~100 | $0.00012 |
| generatePersonaEmbedding | text-embedding-3-small | ~100 | — | $0.000002 |
| seedPoolFromOnboarding | GPT-4o-mini | ~500 | ~1500 | $0.000975 |
| 15× embedSuggestionPoolEntry | text-embedding-3-small | ~900 | — | $0.000018 |
| **Total per Onboarding** | | | | **~$0.0011** |

### Cost per BAF Click

| Step | Model | Input Tokens | Output Tokens | Cost |
|------|-------|-------------|---------------|------|
| contextNode | Supabase (free) | — | — | $0.00 |
| poolFetchNode | Supabase pgvector + Twitch API (free) | — | — | $0.00 |
| rankingNode | Pure computation | — | — | $0.00 |
| **reasoningNode** | **GPT-4o-mini** | **~800** | **~100** | **$0.00018** |
| validationNode | Pure computation | — | — | $0.00 |
| **Subtotal (Brain)** | | | | **$0.00018** |

#### Post-Click Feedback (async, on every accept/reject)

| Step | Model | Tokens | Cost |
|------|-------|--------|------|
| nudgePersonaVector | text-embedding-3-small | ~60 | $0.0000012 |
| expandPool (accept or reject) | GPT-4o-mini | ~700 | $0.000285 |
| 3× embedSuggestionPoolEntry | text-embedding-3-small | ~180 | $0.0000036 |
| deactivateUnderperforming | Supabase (free) | — | $0.00 |
| **Subtotal (Feedback)** | | | **$0.000290** |

| | |
|---|---|
| **Total per BAF click** | **~$0.00047** |

### Monthly Burn Estimate (1,000 users × 3 clicks/day)

| Item | Calculation | Cost |
|------|------------|------|
| Onboarding (one-time) | 1,000 × $0.0011 | $1.10 |
| BAF clicks | 1,000 × 3 × 30 × $0.00047 | $42.30 |
| **Total monthly (1K users)** | | **~$43** |
| **Per user per month** | | **~$0.043** |

### Cost Optimizations Applied

✅ **Claude Sonnet → GPT-4o-mini** (DONE — 9× cheaper overall)
✅ **Rate-limited pool expansion** — only expands when pool has < 500 entries per platform/category combo
✅ **Reject-expansion removed** — vector nudge + circuit breaker handle personalization; no LLM call on reject
✅ **Reasoning cache** — 30-second TTL prevents duplicate LLM calls on rapid-fire clicks
✅ **Batch embeddings** — multiple texts embedded in a single OpenAI API call

### Optimized Cost Breakdown
- **Brain reasoning (GPT-4o-mini)**: $0.00018/click — dominant cost, cached for rapid clicks
- **Pool expansion**: near-zero at mature pool (rate-limited, no reject expansion)
- **Embeddings**: $0.000005/click — batched
- **Supabase / Twitch / YouTube**: $0 (free tiers)

### Optimized Monthly Burn (100K users × 3 clicks/day)

| Item | Calculation | Cost |
|------|------------|------|
| Onboarding (one-time, amortized) | 100K × $0.0011 / 12 | ~$9 |
| BAF clicks (with cache) | 100K × 3 × 30 × $0.00009 (50% cache hit) | ~$810 |
| Pool expansion (rate-limited) | ~100 LLM calls/day × 30 | ~$100 |
| Supabase Pro | — | $25 |
| Vercel Pro | — | $20 |
| **Total monthly (100K users)** | | **~$964** |
| **Per user per month** | | **~$0.0096** |

## Monetization Model

### Revenue Stream A: Freemium + Credits

| Tier | BAF Presses/Day | Price |
|------|-----------------|-------|
| **Free** | 3 per day | $0 |
| **BAF+** (subscription) | Unlimited | $2.99/mo |
| **Credit Packs** | +10 presses | $0.99 one-time |

### Revenue Stream B: Partner Program (Sponsored Recommendations)

Sponsored suggestions look like organic recommendations but are labeled "Sponsored."
- `suggestion_pool.is_sponsored` flag + `sponsor_id` + `sponsor_cpm`
- Sponsored entries get +30 score boost in ranking, capped at 1 per 5 suggestions
- Tracked via `sponsor_events` table (impressions + clicks)
- Charged CPM ($5-15) or CPC ($0.30-0.80)

### Press Limiting Architecture

- `persona_stats` category `"daily_presses"` stores `{ count, date, is_premium, credits }`
- Free tier: 3 presses/day (auto-refills at midnight UTC)
- BAF+ subscribers: unlimited (`is_premium: true` bypasses limit)
- Credits: each press costs 1 credit if daily limit exceeded
- Check happens in `/api/baf` route before calling `runBafBrain()`

> **Bottom line**: At 100K MAU with 10% conversion to BAF+, revenue is ~$49,850/mo vs. ~$964/mo infra cost = **98% gross margin**. Breakeven at ~2,300 MAU.

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind CSS + Framer Motion + TypeScript
- **Database**: Supabase Cloud (PostgreSQL + JSONB + **pgvector**)
- **AI Brain**: LangGraph + GPT-4o-mini (OpenAI)
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Real-Time Tools**: YouTube Data API v3 + Twitch Helix API + TikTok Deep Links + Chess.com PubAPI
- **Validation**: Zod schemas on all tool outputs
- **Auth**: Supabase Auth + @supabase/ssr (Google OAuth + Email/Password)
- **Testing**: Jest + React Testing Library (144 tests across 12 suites)
