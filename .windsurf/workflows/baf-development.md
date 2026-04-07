---
description: BAF project development workflow — mandatory for all code changes
---

# BAF Development Workflow

Every AI model working on this project MUST follow these steps for every task. No exceptions.

## 1. Investigate First (MANDATORY)

Before writing ANY code:

1. **Read `ARCHITECTURE.md`** at the project root — it is the Source of Truth for business logic, user flow, and the Brain pipeline.
2. **Trace the bug/feature end-to-end** — read every file in the chain from UI → API route → Brain → Tools → DB. Follow the data.
3. **Check git history** — `git log --oneline -20` to understand how the project evolved.
4. **Identify root causes** — never fix symptoms. Find the upstream origin.
5. **State your findings** — present root cause analysis to the user BEFORE writing code. Include file paths, line numbers, and the exact logic flaw.
6. **Plan the fix** — propose the minimal set of changes that address the root cause.

## 2. Update ARCHITECTURE.md First

If your change modifies any of the following, you MUST update `ARCHITECTURE.md` BEFORE writing code:

- Brain pipeline (any LangGraph node)
- Ranking logic or scoring
- Suggestion pool schema or fetch strategy
- Feedback loop (accept/reject behavior)
- Onboarding flow
- Authentication or security
- New features or architectural decisions

## 3. Write Code + Tests Together

- **Zero-Tolerance for Untested Code**: Every new function, utility, or component MUST have a corresponding unit test.
- **Test file location**: `src/__tests__/<feature>.test.ts` (or `.test.tsx` for components)
- **Test framework**: Jest + React Testing Library
- **Coverage**: Every line of new logic must be covered. UI components need rendering + event tests.
- **Existing tests**: NEVER delete or weaken existing tests without explicit user approval.

## 4. Validate

Run these commands and verify they pass:

// turbo
```
npm test
```

// turbo
```
npx tsc --noEmit
```

If tests fail → you are in **Emergency State**. Fix the tests before doing anything else. NEVER commit failing code.

## 5. Commit and Push

Only after ALL tests pass and TypeScript compiles cleanly:

```
git add -A
git commit -m "<type>: <description>"
git push origin master
```

Use **Conventional Commits**:
- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for non-functional changes
- `test:` for test-only changes
- `docs:` for documentation-only changes

## Key Rules

- **No Hardcoded Content**: All suggestions come from `suggestion_pool` (pgvector). No default streamers/creators/channels.
- **Vector-First Architecture**: `suggestion_pool` is THE primary content source. Dynamically expanded by user feedback.
- **No `any` types**: Use strict TypeScript typing for everything.
- **No Instagram/Facebook/Meta**: These platforms are forbidden in suggestions.
- **Family-Friendly**: All suggestions must be appropriate for all ages.
- **Link Integrity**: The LLM picks an INDEX from ranked content. We use the pool's own `content_text` + `url` pair. The LLM never generates free-form URLs.
- **Supabase RLS**: Use Row Level Security. Never direct SQL from frontend.
- **Service role key**: Only in server-side code (`src/lib/supabase.ts`).

## Key Files Reference

| Area | Files |
|------|-------|
| Brain pipeline | `src/lib/agent/bafBrain.ts`, `src/lib/agent/ranking.ts`, `src/lib/agent/circuitBreaker.ts` |
| Embeddings & pool | `src/lib/embeddings.ts` |
| Persona & feedback | `src/lib/persona.ts` |
| Mood & archetype | `src/lib/mood.ts` |
| API route | `src/app/api/baf/route.ts` |
| UI | `src/app/components/BafButton.tsx` |
| Tools | `src/lib/tools/registry.ts`, `src/lib/tools/socialTools.ts` |
| Auth | `src/lib/supabase/`, `src/middleware.ts`, `src/app/login/` |
| Onboarding | `src/lib/onboarding.ts`, `src/app/api/onboarding/route.ts` |
| Tests | `src/__tests__/` |
| Migrations | `supabase/migrations/` |
| Architecture | `ARCHITECTURE.md` |
