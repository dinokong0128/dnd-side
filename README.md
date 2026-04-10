# dnd-side

A multiplayer D&D web app where **Claude acts as the Dungeon Master**. Players send free-text actions; the AI DM responds with rich narration, tracks narrative events in a vector database, and uses RAG to maintain long-term story memory across sessions.

---

## What it does

- **Invite-only onboarding** — hosts generate unique invite links; players sign up and land directly in the game lobby
- **Character creation** — choose class, race, roll stats; receive class-appropriate starting inventory
- **AI Dungeon Master** — Claude (`claude-sonnet-4-20250514`) narrates the campaign, responds to player actions, extracts and stores story events
- **RAG memory** — narrative events are embedded with OpenAI and stored in pgvector; the most relevant past events are injected into every Claude prompt
- **Real-time multiplayer** — all players see DM responses simultaneously via Supabase Realtime

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.2.3, TypeScript strict, Tailwind 4, Zod v4 |
| Backend | FastAPI (Python), Dramatiq + Redis (job queue) |
| Database | Supabase — Postgres + pgvector + Realtime |
| Auth | Supabase Auth (JWT) |
| AI | Claude `claude-sonnet-4-20250514` (DM), OpenAI `text-embedding-3-small` (embeddings) |
| Hosting | Vercel (frontend), Render (backend + worker) |

---

## Architecture

```
Player action (UI)
       ↓
Next.js API route  →  FastAPI backend
                           ↓
                  Validate + embed action (OpenAI)
                           ↓
                  RAG search on game_events (pgvector)
                           ↓
                  Queue Dramatiq task  →  202 Accepted
                           ↓ (async)
                  Dramatiq worker calls Claude
                           ↓
                  Extract <event> markers
                           ↓
                  Embed + store events in game_events
                           ↓
                  Insert DM response → game_messages
                           ↓
                  Supabase Realtime broadcasts
                           ↓
                     All players see response
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design, and [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for the complete schema.

---

## Project Structure

```
dnd-side/
├── frontend/               # Next.js 16.2.3 app (Vercel)
│   ├── src/
│   │   ├── app/            # Pages + API proxy routes
│   │   ├── components/     # Auth + game UI components
│   │   ├── lib/            # Supabase clients, types, Zod schemas
│   │   └── proxy.ts        # Auth middleware (Next.js 16)
│   └── e2e/                # Playwright tests
├── backend/                # FastAPI app (Render)
│   ├── api/routes/         # games, players, actions, invites
│   ├── services/           # dm_service, db_service, embedding_service
│   ├── tasks/              # dm_tasks.py (Dramatiq actors)
│   ├── models/             # Pydantic models
│   └── tests/              # pytest
├── docs/                   # ARCHITECTURE.md, DATA_MODEL.md
└── supabase/migrations/    # All applied DB migrations
```

---

## Local Development

### Prerequisites

- Node.js 22+
- Python 3.13+
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

# Start Dramatiq worker (separate terminal)
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

**Embeddings are server-side.** Both action embeddings (for RAG search) and event embeddings (for storage) happen in the FastAPI backend, keeping OpenAI API keys off the client.

**`proxy.ts`, not `middleware.ts`.** This project uses Next.js 16.2.3, which renamed the file convention from `middleware.ts` → `proxy.ts` and the export from `middleware()` → `proxy()`.

**`game_events` inserts require service role.** There is no RLS insert policy on `game_events` — writes go through FastAPI using `SUPABASE_SERVICE_ROLE_KEY`. This prevents clients from injecting false narrative memory.

---

## Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | [dnd-side.vercel.app](https://dnd-side.vercel.app) |
| Backend | Render | Auto-deploy on `develop` push |

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full system design, flows, service boundaries, deployment |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Schema, columns, enums, indexes, RLS, migrations |
| [`CLAUDE.md`](CLAUDE.md) / [`AGENT.md`](AGENT.md) | Condensed project context for AI coding agents |

---

## Project Status

MVP is actively in development. Progress is tracked in [Linear (DnD Side Project)](https://linear.app/dino-kong).

| Area | Status |
|---|---|
| Auth (login, signup via invite) | ✅ Done |
| Game creation + dashboard | ✅ Done |
| Character creation + inventory | ✅ Done |
| Session lifecycle (start/pause/end) | 🔄 In Progress |
| Core game loop (action → DM response → realtime) | 🔄 In Progress |
| Character sheet during game | 📋 Todo |
| Dice roller UI | 📋 Todo |
