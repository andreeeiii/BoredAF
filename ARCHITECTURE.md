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
┌──────────────────────────────────────────┐
│         (2) THE BRAIN (LangGraph)        │
│   Context → Parallel Fetch → Reasoning   │
│   Archetype + Mood Sensor + Tools Data   │
└────────┬────────────────────────┬────────┘
         │                        │
         ▼ <─── (3) MEMORY ───>   ▼ <─── (4) TOOLS ───>
   [ PERSONA DATA ]          [ REAL-TIME WORLD ]
   - Archetype: The Grind    - YouTube: Last 24h videos
   - Chess ELO: 420          - Chess.com: ELO + Puzzle
   - Mood: Tired → Chill     - Platform rotation check
   - Negative signals        │
         │                        │
         └───────────┬────────────┘
                     ▼
            (5) THE SUGGESTION
      "GothamChess dropped a new video!"
      [🔗 youtube.com/watch?v=...]
                     │
            ┌────────┴────────┐
            ▼                 ▼
       [ LFG 🔥 ]        [ Nah 👎 ]
    (Opens link +       (Why? → logs
     logs accept)       negative signal
            │           + new suggestion)
            └────────┬────────┘
                     ▼
            (6) PERSONA UPDATED
      (Archetype, mood, weights adjust)
```

## Mood Sensor

The Brain doesn't just use the stored archetype — it uses a **real-time mood override**:
- **Time of day**: Night + low energy → auto-shift to The Chill
- **Rejection streaks**: 3+ consecutive Nahs → shift to The Spark (novelty mode)
- **Tired signals**: "Too tired" rejection reason → temporarily The Chill for 1 hour
- **Platform rotation**: Never suggest the same platform 3 times in a row

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
- **No-Repeat Engine**: Full history check + server-side duplicate detection
- **Platform Rotation**: Never suggests same platform 3x in a row
- **YouTube Links**: Actual video URLs from user's favorite channels (last 24h)
- **Family-Friendly**: All suggestions appropriate for all ages
- **Fallback Rescues**: 10 default suggestions if APIs fail

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind CSS + Framer Motion + TypeScript
- **Database**: Supabase Cloud (PostgreSQL + JSONB)
- **AI Brain**: LangGraph + Claude 3.5 Sonnet (Anthropic)
- **Real-Time Tools**: YouTube Data API v3 + Chess.com PubAPI
- **Validation**: Zod schemas on all tool outputs
- **Testing**: Jest + React Testing Library (54 tests across 7 suites)
