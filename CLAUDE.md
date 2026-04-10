# D&D Multiplayer App — Project Context

**Last Updated:** April 10, 2026
**Status:** MVP in active development (~50% complete)
**Repository:** `dinokong0128/dnd-side` (GitHub, `develop` branch)
**Detailed Architecture:** See `docs/ARCHITECTURE.md`

---

## Project Overview

A multiplayer D&D app where Claude acts as the Dungeon Master. Players send actions via Next.js frontend; FastAPI backend validates, embeds, and queues a Dramatiq task; a worker calls Claude with RAG context; the DM response broadcasts to all players via Supabase Realtime.

---

## 🎯 Core Tech Stack

| Component | Technology | Host |
|---|---|---|
| Frontend | Next.js 16.2.3 (App Router, TypeScript strict) | Vercel |
| Backend | FastAPI + Python | Render |
| Database | Supabase (Postgres + pgvector + Realtime) | Managed |
| Job Queue | Dramatiq + Redis | Render (Key Value) |
| Auth | Supabase Auth (JWT) | Supabase |
| LLM | `claude-sonnet-4-20250514` | Anthropic API |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) | OpenAI API (called from FastAPI backend) |

**→ Full rationale in `docs/ARCHITECTURE.md`**

---

## 🏗️ Architecture: Scenario A (DM Orchestration in FastAPI)

**Flow:** Player action → Next.js proxy → FastAPI validation + embed + RAG → Queue Dramatiq task → Worker calls Claude → Inserts DM response + events → Supabase Realtime broadcasts → Frontend re-renders

**Why FastAPI (not Next.js)?**
- ✅ No cold start penalty on DM latency (always-on Render worker)
- ✅ Proper job queue pattern (Dramatiq with retries)
- ✅ Separation of concerns (frontend = UI, backend = business logic)

**→ Detailed flow in `docs/ARCHITECTURE.md`**

---

## 📁 Project Structure

```
dnd-side/
├── frontend/          # Next.js 16.2.3 (App Router, TypeScript)
│   ├── src/
│   │   ├── app/       # Pages, API routes (proxy layer only)
│   │   ├── components/
│   │   ├── lib/       # Supabase clients, types, validations
│   │   └── proxy.ts   # Auth middleware (Next.js 16.2.3 convention)
│   └── e2e/           # Playwright end-to-end tests
├── backend/           # FastAPI (Render)
│   ├── api/routes/    # games, players, actions, invites
│   ├── services/      # dm_service, db_service, embedding_service
│   ├── tasks/         # dm_tasks.py (Dramatiq actors)
│   ├── models/        # Pydantic models
│   └── tests/         # pytest
├── docs/
│   ├── ARCHITECTURE.md  # Full design, flows, decisions
│   └── DATA_MODEL.md    # Schema reference
└── supabase/migrations/ # All DB migrations
```

**→ Complete directory tree in `docs/ARCHITECTURE.md`**

---

## 🗄️ Database Schema

Seven tables in Supabase (`ytxncykyfbhoyvxkocrs`):

| Table | Purpose |
|---|---|
| `profiles` | Extends Supabase Auth users |
| `games` | Game sessions + DM persona |
| `players` | Characters per game (class, race, level, HP, stats) |
| `player_inventory` | Items per player |
| `game_messages` | Chat log — Realtime broadcast source |
| `game_events` | Narrative events with pgvector embeddings (RAG) |
| `invites` | One-time invite codes per game |

**→ Full schema with columns, indexes, and RLS in `docs/DATA_MODEL.md`**

---

## 🔄 Key Architecture Decisions

| Decision | Choice | Why |
|---|---|---|
| DM Orchestration | FastAPI backend | Job queues, retries, always-on workers |
| Embeddings | FastAPI backend (actions.py + dm_tasks.py) | Keeps all AI logic server-side |
| Job Queue | Dramatiq + Redis | Lightweight, Render-compatible |
| Auth | Supabase JWT | Built-in, integrates with RLS |
| Realtime | Supabase Changes | Native Postgres, no extra infra |
| Auth middleware | `proxy.ts` (not `middleware.ts`) | Next.js 16.2.3 convention |

**→ Full rationale in `docs/ARCHITECTURE.md`**

---

## 🎯 Service Boundaries

### Next.js (Frontend — Vercel)
- Auth UI (login, signup via invite link)
- Dashboard, game lobby, real-time game view
- Supabase Realtime subscriptions
- **All mutations proxy through FastAPI** (no direct Supabase writes except reads for lists/lobbies)

### FastAPI (Backend — Render)
- All business logic validation
- Claude DM orchestration (RAG, prompt building, response parsing)
- OpenAI embeddings for action text + narrative events
- Job queue management (Dramatiq tasks)
- All DB mutations

### Supabase
- User auth (JWT, refresh tokens)
- Data persistence + RLS
- Realtime broadcasting (`game_messages`)
- Vector similarity search (`game_events` via pgvector)

---

## 🚀 Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | `https://dnd-side.vercel.app` |
| Backend | Render | Auto-deploy on `develop` push |

**→ Deployment details in `docs/ARCHITECTURE.md`**

---

## 🔑 Implementation Notes

**RAG Flow (in `actions.py` + `dm_tasks.py`):**
1. Embed player action text via OpenAI (in `actions.py`)
2. Cosine similarity search on `game_events` (top 5)
3. Pass context to Dramatiq task
4. Inject events into Claude system prompt
5. Parse Claude response for `<event type="...">...</event>` markers
6. Embed extracted events + insert to `game_events`

**`proxy.ts`:** Next.js 16.2.3 renamed `middleware.ts` → `proxy.ts` and `middleware()` → `proxy()`. Handles JWT session refresh + route protection for `/dashboard` and `/games/*`.

**Service role key:** Required for all `game_events` writes and DM `game_messages` inserts. Never expose in `NEXT_PUBLIC_` env vars.

---

## 📊 Current MVP Status

| Epic | Feature | Status |
|---|---|---|
| Auth & Invite | Sign up via invite link (US-01) | 🔄 In Progress |
| Auth & Invite | Login (US-02) | ✅ Done |
| Game Creation | Create game (US-04) | ✅ Done |
| Game Creation | Dashboard (US-05) | ✅ Done |
| Character Creation | Build character (US-08) | ✅ Done |
| Character Creation | Starting inventory (US-09) | ✅ Done |
| Session Lifecycle | Start session + opening narration (US-11) | 🔄 In Progress |
| Session Lifecycle | Pause/end session (US-12) | 🔄 In Progress |
| Core Game Loop | Submit action (US-14) | 🔄 In Progress |
| Core Game Loop | Receive DM response in real-time (US-15) | 🔄 In Progress |
| Core Game Loop | Scroll chat log (US-17) | 🔄 In Progress |

---

## 📚 Documentation

| Document | Contents |
|---|---|
| **docs/ARCHITECTURE.md** | Complete design: flows, decisions, code examples |
| **docs/DATA_MODEL.md** | Tables, columns, enums, indexes, triggers, RLS |
| **docs/TDD_WORKFLOW.md** | Test file placement, mocking rules, and stub patterns per layer |
| **This file (CLAUDE.md)** | Project overview & reference links for AI agents |

---

## Conventions

- **Frontend:** TypeScript strict, named exports, no `any`, `@supabase/ssr` (never deprecated auth-helpers), Zod v4 validation
- **Backend:** Type hints, Pydantic validation, docstrings, pytest tests
- **Both:** Environment variables in `.env`, migrations tracked in `supabase/migrations/`
- **No direct Supabase mutations from Next.js** — all writes go through FastAPI

---

## 🧪 TDD Skeleton Workflow

Before writing any production code for a Linear issue, produce three artifacts in order:
1. **Spec doc** — ACs from the issue, layers touched, mock boundary per layer
2. **Failing test stubs** — runnable stubs that fail (not error) immediately
3. **Implementation scaffold** — minimum stubs needed for test imports to resolve

**→ File placement conventions, mocking rules per layer, and examples: `docs/TDD_WORKFLOW.md`**

---

## Cost & Constraints (Free Tier)

- **Render:** 750 hrs/month (always-on backend + worker)
- **Supabase:** 500MB storage (~6KB per embedding vector)
- **Redis:** 30MB (Render Key Value)
- **OpenAI embeddings:** ~$0.02/1M tokens
- **Claude API:** Pay-as-you-go (`claude-sonnet-4-20250514`)

---

## References

- **Full architecture:** `docs/ARCHITECTURE.md`
- **GitHub repo:** https://github.com/dinokong0128/dnd-side
- **Supabase project:** `ytxncykyfbhoyvxkocrs`
- **Vercel project:** `dnd-side.vercel.app`
- **Linear board:** DnD Side Project
