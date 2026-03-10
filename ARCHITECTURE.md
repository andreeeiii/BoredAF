# BAF (BoredAF) — Architecture & Business Plan

## Core Concept

BAF is an AI-powered anti-boredom app. The user presses the **BAF** button when bored, and the AI generates a personalized suggestion based on their persona, real-time context, and available content.

## User Flow

1. **Onboarding**: AI asks lightweight questions to build an initial persona (hobbies, social media, favorite creators, games, music, etc.)
2. **Main Screen**: User presses **BAF** → AI generates a suggestion
3. **Feedback Loop**: User accepts or rejects → persona improves over time

## Architecture

```
[ USER ]
   │
   ▼ (1) PRESSES "BAF" BUTTON
   │
┌──────────────────────────────────────────┐
│         (2) THE BRAIN (AI)               │
│   (Thinks: Who is this? What's live?)    │
└────────┬────────────────────────┬────────┘
         │                        │
         ▼ <─── (3) MEMORY ───>   ▼ <─── (4) TOOLS ───>
   [ PERSONA DATA ]          [ REAL-TIME WORLD ]
   - Chess ELO: 420          - Youtube: Amalia Live?
   - Likes: Fashion          - Twitch: Chess Tourney?
   - Mood: Low Energy        - Hobby: 5min DIY hack?
         │                        │
         └───────────┬────────────┘
                     ▼
            (5) THE SUGGESTION
      "Watch Amalia's new short!"
                     │
            ┌────────┴────────┐
            ▼                 ▼
        [ YES ]            [ NO ]
     (Logs success)    (AI asks "Why?")
            │                 │
            └────────┬────────┘
                     ▼
            (6) PERSONA UPDATED
      (App gets smarter for next time)
```

## Key Intelligence Features

- **Persona Building**: Lightweight onboarding + continuous learning from accept/reject feedback
- **Context Awareness**: Time of day, energy level, patterns (e.g. watches YouTube at night)
- **Real-Time Data**: Check if favorite creators are live, trending content, new uploads
- **Adaptive Suggestions**: On rejection, AI asks why and pivots — improving the persona

## Database Schema (Memory Tables)

- **profiles**: User identity (id, username, bio)
- **persona_stats**: Categorized scores (chess ELO, gaming rank, etc.) as JSONB
- **interests**: Platform-specific references (YouTube channels, Twitch streamers, etc.)
- **baf_history**: Every suggestion + outcome (accepted/rejected) + reason for rejection

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind CSS + TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: TBD (will power The Brain)
- **Real-Time Tools**: TBD (YouTube API, Twitch API, etc.)
