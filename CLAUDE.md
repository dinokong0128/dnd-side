# D&D Multiplayer App — Project Context

**Last Updated:** April 17, 2026
**Status:** MVP complete ✅ — Post-MVP (v1.0 — Full Gameplay) in progress
**Repository:** `dinokong0128/dnd-side` (GitHub, `develop` branch)
**Detailed Architecture:** See `docs/ARCHITECTURE.md`

---

## Project Overview

A multiplayer D&D app where Claude acts as the Dungeon Master. Players submit actions via the Next.js frontend; FastAPI validates, embeds, and orchestrates the DM response with RAG context; Claude streams narration back over SSE while structured block data (`<state_changes>`, `<dice_rolls>`, `<suggested_actions>`, `<event>`) travels alongside for the frontend and backend to apply.

---

## 🎯 Core Tech Stack

| Component | Technology | Host |
|---|---|---|
| Frontend | Next.js 16.2.3 (App Router, TypeScript strict), React 19.2.5, Tailwind 4 | Vercel |
| Backend | FastAPI 0.135 + Python | Render (web service — Dramatiq worker embedded in the start command) |
| Database | Supabase (Postgres + pgvector + Realtime) | Managed (`ytxncykyfbhoyvxkocrs`) |
| Job Queue | Dramatiq 2.1 + Redis 7 | Render Key Value |
| Auth | Supabase Auth via `@supabase/ssr` 0.10 (JWT) | Supabase |
| LLM | `claude-sonnet-4-20250514` (streaming via `anthropic` 0.93) | Anthropic API |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim, `openai` 2.31) | OpenAI API (called from FastAPI) |
| Validation | Zod v4 (frontend), Pydantic v2 (backend) | — |

**→ Full rationale in `docs/ARCHITECTURE.md`**

---

## 🏗️ Architecture

**Flow (DIN-66 streaming):**

1. Player submits action → Next.js proxy route → FastAPI `POST /games/{id}/actions`
2. FastAPI validates JWT, inserts player message, returns 202 immediately
3. Background coroutine in FastAPI: embed action → RAG search on `game_events` → call Claude with `stream=True`
4. Each streamed token/block is published to Redis channel `stream:{game_id}`
5. The acting player's browser subscribes to `GET /games/{id}/events` (SSE); tokens render live
6. When stream completes: FastAPI inserts the full DM message (Supabase Realtime fans out to other players), then enqueues `dm_bookkeeping_task` (Dramatiq) to embed extracted events + persist `suggested_actions`

**Why FastAPI (not Next.js) for DM orchestration?**
- ✅ No cold start penalty — Render web service is always-on
- ✅ Job queue pattern for durable bookkeeping (Dramatiq retries)
- ✅ Separation of concerns: frontend = UI, backend = business logic + AI
- ✅ Server-side embeddings keep OpenAI keys off the client

**→ Detailed flow in `docs/ARCHITECTURE.md`**

---

## 📁 Project Structure

```
dnd-side/
├── frontend/                   # Next.js 16 (App Router, TypeScript)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/            # Proxy routes to FastAPI
│   │   │   ├── auth/           # login, signup, callback
│   │   │   ├── dashboard/
│   │   │   └── games/[gameId]/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── games/          # Chat, character sheet, session, dice
│   │   │   └── dice/           # DiceRoller
│   │   ├── lib/                # Supabase clients, types, Zod validations, utils
│   │   └── proxy.ts            # Auth middleware (Next.js 16 convention)
│   └── e2e/                    # Playwright
├── backend/                    # FastAPI (Render)
│   ├── api/routes/             # games, players, actions, invites, messages, level_up, events
│   ├── services/               # dm_service, db_service, embedding_service, stream_parser
│   ├── tasks/                  # dm_tasks.py (Dramatiq actors)
│   ├── utils/                  # dnd.py (class tables, XP thresholds, hit dice)
│   ├── models/                 # Pydantic models
│   └── tests/                  # pytest
├── docs/                       # ARCHITECTURE.md, DATA_MODEL.md, TDD_WORKFLOW.md
└── supabase/migrations/
```

**→ Complete directory tree in `docs/ARCHITECTURE.md`**

---

## 🗄️ Database Schema

Seven public tables in Supabase (`ytxncykyfbhoyvxkocrs`) + a `secrets` table for server-side credentials:

| Table | Purpose |
|---|---|
| `profiles` | Extends Supabase Auth users |
| `games` | Game sessions + DM persona + `suggested_actions` cache |
| `players` | Characters per game (class, race, level, HP, stats JSONB) |
| `player_inventory` | Items per player |
| `game_messages` | Chat log — Realtime broadcast source; `dice_rolls` JSONB for mechanical overlays |
| `game_events` | Narrative events with pgvector embeddings (RAG memory) |
| `invites` | One-time invite codes per game |

**`players.stats` JSONB** holds ability scores plus optional keys added by Epic-7 / Epic-8: `xp`, `spell_slots`, `cantrips` — no schema migration needed when new state types are added.

**→ Full schema with columns, indexes, and RLS in `docs/DATA_MODEL.md`**

---

## 🔄 Key Architecture Decisions

| Decision | Choice | Why |
|---|---|---|
| DM Orchestration | FastAPI backend | Always-on, streaming, job queues |
| Streaming | SSE via Redis pub/sub (`stream:{gameId}`) | Fans out natively to all players in multiplayer (DIN-67) |
| Structured blocks | `<state_changes>`, `<dice_rolls>`, `<suggested_actions>`, `<event>` | Keeps narrative prose clean while passing mechanical data; each block has its own extractor + sink |
| Embeddings | FastAPI backend (`embed_text()` in `embedding_service.py`) | Keeps API keys server-side |
| Job Queue | Dramatiq + Redis | Lightweight, embedded into Render web service start command |
| Auth | Supabase JWT | Built-in, integrates with RLS |
| Realtime | Supabase Postgres Changes | Native, no extra infra |
| Auth middleware | `proxy.ts` (not `middleware.ts`) | Next.js 16 convention |

**→ Full rationale in `docs/ARCHITECTURE.md`**

---

## 🎯 Service Boundaries

### Next.js (Vercel)
- Auth UI (login, signup via invite, account management)
- Dashboard, game lobby, real-time game view
- Supabase Realtime subscriptions + SSE stream consumer
- **All mutations proxy through FastAPI** (direct Supabase reads are acceptable for lists/lobbies)

### FastAPI (Render)
- All business logic validation
- Claude DM orchestration (RAG, prompt building, streaming, block extraction)
- OpenAI embeddings for actions + narrative events
- Dramatiq tasks (bookkeeping after stream completes)
- All DB mutations via service role

### Supabase
- User auth (JWT, refresh tokens)
- Data persistence + RLS
- Realtime broadcasting (`game_messages`)
- Vector similarity search (`game_events` via pgvector HNSW)

---

## 🚀 Deployment

| Service | Platform | URL / ID |
|---|---|---|
| Frontend | Vercel | `https://dnd-side.vercel.app` (project `prj_fgN3YvJDnx0o0IWPws3nxPDjvp2i`) |
| Backend | Render (auto-deploy on `develop` push) | `https://dnd-backend-xk1o.onrender.com` (service `srv-d72p7jvfte5s73a5lbrg`) |
| Redis | Render Key Value | Referenced via `REDIS_URL` env var |

**Render start command** (Dramatiq + Gunicorn combined — Render free tier doesn't allow a separate worker service):

```
dramatiq tasks.dm_tasks --processes 1 --threads 2 & gunicorn main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

**→ Deployment details in `docs/ARCHITECTURE.md`**

---

## 🔑 Implementation Notes

**RAG flow (in `actions.py` + `dm_tasks.py`):**
1. Embed player action text via OpenAI (in `actions.py`, inside the background coroutine)
2. Cosine similarity search on `game_events` (top 5)
3. Inject RAG context + party state into Claude system prompt
4. Stream Claude response → publish to Redis → SSE to browser
5. Parse streamed tokens for `<event>`, `<state_changes>`, `<dice_rolls>`, `<suggested_actions>` blocks
6. Apply `<state_changes>` immediately (HP/spell slots/XP/inventory). Persist `dice_rolls` on the DM message row. Cache `suggested_actions` on the game row.
7. `dm_bookkeeping_task` (Dramatiq) embeds extracted events and inserts to `game_events`

**`proxy.ts`:** Next.js 16 renamed `middleware.ts` → `proxy.ts` and `middleware()` → `proxy()`. Handles JWT session refresh + route protection for `/dashboard` and `/games/*`.

**Service role key:** Required for all `game_events` writes and DM `game_messages` inserts. Never expose in `NEXT_PUBLIC_` env vars.

**Realtime JWT propagation:** `@supabase/ssr` browser client doesn't auto-send JWT to Realtime WebSocket — `GameSessionView.tsx` calls `supabase.realtime.setAuth(session.access_token)` inside `initializeSession`.

---

## 📊 Current Status

### MVP — Complete ✅

All MVP epics shipped: Auth & Invite, Game Creation, Lobby & Joining, Character Creation, Session Lifecycle, Core Game Loop, Character State (Epic-7), Combat (Epic-8). Live at `dnd-side.vercel.app`.

### Post-MVP — "v1.0 — Full Gameplay" (in progress)

Organized under three epics, sequenced rules → multiplayer → polish:

**Epic-9: Rules Engine** — move mechanical state from Claude's memory into the DB
- DIN-37 Conditions · DIN-39 Skill Proficiency · DIN-38 Rests · DIN-40 Heroic Inspiration · DIN-48 Death saves
- Suggested start: DIN-37 + DIN-39 in parallel (both foundational, High priority)

**Epic-10: Multiplayer** — features that require 2+ players
- DIN-23 Lobby host view · DIN-44 IC/OOC chat · DIN-45 Whispers · DIN-43 Group decisions

**Epic-11: Immersion & Polish** — quality-of-life and atmosphere
- DIN-29 Visual turn-based combat · DIN-41 Session recap · DIN-46 Ambience · DIN-47 Portraits

### "v1.1: Campaign Depth & Progression" (scoped, not started)

NPC memory, feats, backgrounds, magic items, currency, journal, encounter tables, push notifications, mid-session join.

---

## 📚 Documentation

| Document | Contents |
|---|---|
| **docs/ARCHITECTURE.md** | Complete design: flows, decisions, code examples, streaming |
| **docs/DATA_MODEL.md** | Tables, columns, enums, indexes, triggers, RLS, migrations |
| **docs/TDD_WORKFLOW.md** | Test file placement, mocking rules per layer, stub patterns |
| **SMOKE_TEST.md** (Claude project file, not in repo) | Post-merge smoke test script |
| **This file (CLAUDE.md)** | Project overview + reference links for AI agents |

---

## Conventions

- **Frontend:** TypeScript strict, named exports, no `any`, no `console.log`, `@supabase/ssr` (never deprecated auth-helpers), Zod v4 validation, no Supabase calls in components (they go through Next.js API routes → FastAPI)
- **Backend:** Type hints, Pydantic v2 validation, docstrings, pytest with full mocks
- **Both:** `.env` files for secrets, all migrations tracked in `supabase/migrations/`
- **Issue tracking:** Linear ("DnD Side Project") — GitHub Issues deprecated

---

## 🧪 TDD Skeleton Workflow

Before writing production code for a Linear issue, produce three artifacts in order:
1. **Spec doc** — ACs from the issue, layers touched, mock boundary per layer
2. **Failing test stubs** — runnable stubs that fail (not error) immediately
3. **Implementation scaffold** — minimum stubs so test imports resolve

Five test layers: React components, Next.js API routes, Supabase lib helpers, FastAPI endpoints, Dramatiq tasks.

**→ File placement conventions, mocking rules per layer, and examples: `docs/TDD_WORKFLOW.md`**

---

## Cost & Constraints (Free Tier)

- **Render:** 750 hrs/month (web service hosts FastAPI + embedded Dramatiq worker)
- **Supabase:** 500MB storage (~6KB per 1536-dim embedding)
- **Redis (Render Key Value):** 30MB
- **OpenAI embeddings:** ~$0.02 / 1M tokens (`text-embedding-3-small`)
- **Claude API:** pay-as-you-go (`claude-sonnet-4-20250514`)

---

## References

- **Full architecture:** `docs/ARCHITECTURE.md`
- **GitHub repo:** https://github.com/dinokong0128/dnd-side
- **Supabase project:** `ytxncykyfbhoyvxkocrs`
- **Vercel project:** `dnd-side.vercel.app`
- **Linear board:** DnD Side Project (milestone `v1.0 — Full Gameplay`)
