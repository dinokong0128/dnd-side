# D&D Multiplayer App — CLAUDE.md

## Project Overview
A multiplayer D&D app where Claude acts as the Dungeon Master. Players join games
in real-time, send actions, and receive AI-generated DM responses with long-term
narrative memory via RAG.

**Status:** Early development — schema designed, DB connected, building core features.
**Stack:** Next.js (App Router) · React · TypeScript · Supabase · Anthropic API · OpenAI (embeddings)

---

## Stack & Services

| Service | Purpose | Notes |
|---|---|---|
| Next.js (App Router) | Frontend + API routes | TypeScript strict mode |
| Supabase (`ytxncykyfbhoyvxkocrs`) | Postgres + pgvector + Realtime + Auth | Free tier |
| Anthropic API | Claude as Dungeon Master | `claude-sonnet-4-20250514` |
| OpenAI API | Embeddings only | `text-embedding-3-small` (1536-dim) |

All services on free tier — cost awareness matters (see Cost section).

---

## Database Schema

Six tables in the `public` schema. RLS enabled on all.

| Table | Purpose |
|---|---|
| `profiles` | Extends Supabase Auth `auth.users` via trigger |
| `games` | Game sessions, DM persona config |
| `players` | Players in a game, stats stored as `jsonb` |
| `player_inventory` | Items per player |
| `game_messages` | Chat log — source of Realtime broadcasts |
| `game_events` | Structured narrative events with pgvector embeddings |

**`game_events` embedding column:** `vector(1536)` — OpenAI `text-embedding-3-small`

**Supabase extensions enabled:**
- `pgvector` v0.8.0
- `uuid-ossp`
- `pgcrypto`

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth | Supabase Auth + `profiles` shadow table | Built-in, easy RLS integration |
| Realtime | Postgres Changes + Broadcast channels, scoped per game | Both mechanisms used |
| Claude DM delivery | Full message on completion (no streaming) | Simpler client logic |
| Embedding model | OpenAI `text-embedding-3-small` (1536-dim) | Cheapest, sufficient quality |
| Who calls embedding API | Next.js API route, before insert | No edge function needed at this scale |
| Event extraction | **Hybrid** — Claude flags events inline as JSON in DM response, parsed out by API route | Fits non-streaming architecture, single API call |
| Realtime trigger table | `game_messages` only | Keeps `game_events` lean and write-safe |
| Player stats storage |
