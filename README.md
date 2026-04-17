# dnd-side

A multiplayer D&D web app where **Claude acts as the Dungeon Master**. Players send free-text actions; the AI DM streams rich narration in real time, tracks narrative events in a vector database, and uses RAG to maintain long-term story memory across sessions.

---

## What it does

- **Invite-only onboarding** — hosts generate unique invite links; players sign up and land directly in the game lobby
- **Character creation** — choose class, race, roll stats; receive class-appropriate starting inventory
- **AI Dungeon Master** — Claude (`claude-sonnet-4-20250514`) narrates the campaign, streams responses over SSE, extracts and stores story events, and adjudicates dice rolls + state changes through structured blocks
- **RAG memory** — narrative events are embedded with OpenAI and stored in pgvector; the most relevant past events are injected into every Claude prompt
- **Live character sheet** — HP, XP, spell slots, inventory, and dice rolls update in real time via Supabase Realtime as the story unfolds
- **Real-time multiplayer** — all players see DM responses via Supabase Realtime; the acting player sees the stream token-by-token

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4, Zod v4 |
| Backend | FastAPI (Python), Dramatiq + Redis (bookkeeping queue) |
| Database | Supabase — Postgres + pgvector + Realtime |
| Auth | Supabase Auth (JWT) via `@supabase/ssr` |
| AI | Claude `claude-sonnet-4-20250514` (streaming DM), OpenAI `text-embedding-3-small` (embeddings) |
| Hosting | Vercel (frontend), Render (backend + embedded Dramatiq worker) |

---

## Architecture

```
Player action (UI)
       ↓
Next.js proxy route  →  FastAPI POST /games/{id}/actions
                              ↓
                     Validate + insert player message + return 202
                              ↓ (background coroutine)
                     Embed action + RAG search (pgvector)
                              ↓
                     Stream Claude response → publish to Redis stream:{gameId}
                              ↓                              ↓
            GET /events (SSE) ← Browser subscribes      Stream completes
                                                              ↓
                     Apply <state_changes> (HP/XP/inventory)
                     Insert DM message (Supabase Realtime fan-out)
                     Enqueue dm_bookkeeping_task → embed <event>s → game_events
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design, and [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for the complete schema.

---

## Project Structure

```
dnd-side/
├── frontend/               # Next.js 16 app (Vercel)
│   ├── src/
│   │   ├── app/            # Pages + API proxy routes
│   │   ├── components/     # Auth, game, and dice UI
│   │   ├── lib/            # Supabase clients, types, Zod schemas, utils
│   │   └── proxy.ts        # Auth middleware (Next.js 16 convention)
│   └── e2e/                # Playwright tests
├── backend/                # FastAPI app (Render)
│   ├── api/routes/         # games, players, actions, invites, messages, level_up, events
│   ├── services/           # dm_service, db_service, embedding_service, stream_parser
│   ├── tasks/              # dm_tasks.py (Dramatiq actors)
│   ├── utils/              # dnd.py (class tables, XP thresholds)
│   ├── models/             # Pydantic models
│   └── tests/              # pytest
├── docs/                   # ARCHITECTURE.md, DATA_MODEL.md, TDD_WORKFLOW.md
└── supabase/migrations/    # All applied DB migrations
```

---

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- A running Redis instance (or use Docker: `docker run -p 6379:6379 redis`)
- Supabase project (or local Supabase CLI)

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_BACKEND_URL
npm install
npm run dev
```

### Backend

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
# ANTHROPIC_API_KEY, OPENAI_API_KEY, REDIS_URL, FRONTEND_URL

pip install -r requirements.txt

# Start API server
uvicorn main:app --reload

# Start Dramatiq worker (separate terminal, local-dev only — on Render it's embedded in the start command)
python -m dramatiq tasks.dm_tasks
```

### Tests

```bash
# Backend
cd backend && pytest

# Frontend unit tests
cd frontend && npm test

# Frontend e2e (requires running dev server)
cd frontend && npx playwright test
```

---

## Environment Variables

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `NEXT_PUBLIC_BACKEND_URL` | FastAPI base URL |

### Backend (`.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only, never expose) |
| `SUPABASE_ANON_KEY` | Anon key (for JWT validation) |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key (embeddings) |
| `REDIS_URL` | Redis connection URL |
| `FRONTEND_URL` | Frontend origin (CORS) |

---

## Key Design Decisions

**All mutations go through FastAPI.** Next.js is a proxy and render layer only — it never writes directly to Supabase. This keeps business logic centralized and prevents RLS bypass via client-side service keys.

**Streaming + structured blocks.** The DM response streams over SSE via Redis pub/sub (`stream:{gameId}`), while mechanical data (`<state_changes>`, `<dice_rolls>`, `<suggested_actions>`, `<event>`) rides along in tagged blocks and is extracted + applied by the backend.

**Embeddings are server-side.** Both action embeddings (for RAG search) and event embeddings (for storage) happen in the FastAPI backend, keeping OpenAI API keys off the client.

**`proxy.ts`, not `middleware.ts`.** This project uses Next.js 16, which renamed the file convention from `middleware.ts` → `proxy.ts` and the export from `middleware()` → `proxy()`.

**`game_events` inserts require service role.** There is no RLS insert policy on `game_events` — writes go through FastAPI using `SUPABASE_SERVICE_ROLE_KEY`. This prevents clients from injecting false narrative memory.

---

## Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | [dnd-side.vercel.app](https://dnd-side.vercel.app) |
| Backend | Render (auto-deploy on `develop` push) | `dnd-backend-xk1o.onrender.com` (Dramatiq worker is embedded in the web service start command) |

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full system design, flows, service boundaries, deployment |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Schema, columns, enums, indexes, RLS, migrations |
| [`docs/TDD_WORKFLOW.md`](docs/TDD_WORKFLOW.md) | Test layers, mocking rules, stub patterns |
| [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) | Condensed project context for AI coding agents |

---

## Project Status

MVP is complete ✅ — auth, game creation, lobby, character creation, session lifecycle, core game loop, character state (Epic-7), and combat (Epic-8) are all live at [dnd-side.vercel.app](https://dnd-side.vercel.app).

Post-MVP work is tracked in the `v1.0 — Full Gameplay` milestone in [Linear (DnD Side Project)](https://linear.app/dino-kong) and organized into three epics:

| Epic | Theme | Status |
|---|---|---|
| Epic-9: Rules Engine | Conditions, rests, skill proficiencies, death saves, inspiration | 🔄 Next up |
| Epic-10: Multiplayer | IC/OOC chat, whispers, group decisions, host lobby view | 📋 Queued |
| Epic-11: Immersion & Polish | Visual combat UI, session recap, ambience, portraits | 📋 Queued |
