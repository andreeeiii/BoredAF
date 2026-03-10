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
┌─────────────────────────────────────────────────────┐
│              (2) THE BRAIN (LangGraph)              │
│  Context → Parallel Fetch → Ranking → Reasoning     │
│  Archetype + Mood + 4 Tools + Priority Scoring      │
└────────┬───────────────────────────────────┬────────┘
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
- **Duplicate penalty**: -100 if content matches previous suggestion

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
- **Negative Signals**: Rejection reasons logged per category, adjusting future suggestions
- **No-Repeat Engine**: Full history check + server-side duplicate detection + unique request IDs
- **Platform Rotation**: Never suggests same platform 3x in a row
- **Ranking Engine**: Priority scoring per archetype, LIVE +50 bonus, duplicate penalties
- **4-Tool Parallel Fetch**: YouTube, Twitch, TikTok, Chess all fetched simultaneously
- **LIVE Detection**: Twitch streams get glowing "LIVE NOW" badge + priority boost
- **Forced Links**: Every suggestion includes a clickable URL from real content
- **Platform Icons**: Color-coded per platform (YouTube red, Twitch purple, TikTok, Chess green)
- **Archetype Tracking**: Every baf_history entry records which archetype was used
- **Family-Friendly**: All suggestions appropriate for all ages
- **Fallback Rescues**: 10 default suggestions if APIs fail

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind CSS + Framer Motion + TypeScript
- **Database**: Supabase Cloud (PostgreSQL + JSONB)
- **AI Brain**: LangGraph + Claude 3.5 Sonnet (Anthropic)
- **Real-Time Tools**: YouTube Data API v3 + Twitch Helix API + TikTok Deep Links + Chess.com PubAPI
- **Validation**: Zod schemas on all tool outputs
- **Testing**: Jest + React Testing Library (74 tests across 9 suites)
