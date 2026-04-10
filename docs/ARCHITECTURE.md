# D&D Multiplayer App — Architecture & Tech Stack

**Last Updated:** April 10, 2026
**Status:** MVP in active development
**Repository:** `dinokong0128/dnd-side` (`develop` branch)

---

## 📊 Tech Stack

| Layer | Technology | Hosting | Notes |
|---|---|---|---|
| **Frontend** | Next.js 16.2.3 (App Router, TypeScript strict) | Vercel | Proxy layer only — no direct DB mutations |
| **Backend** | FastAPI + Python | Render (free tier, always-on) | All business logic + AI orchestration |
| **Database** | Supabase (Postgres + pgvector + Realtime) | Managed | `ytxncykyfbhoyvxkocrs` |
| **Job Queue** | Dramatiq + Redis | Render (Key Value) | Named service: `dnd-redis` |
| **Auth** | Supabase Auth (JWT) | Supabase | Session managed via `@supabase/ssr` |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536-dim) | OpenAI API | Called from FastAPI — `actions.py` (action embed) + `dm_tasks.py` (event embed) |
| **LLM** | `claude-sonnet-4-20250514` | Anthropic API | Called from Dramatiq worker |

---

## 🏗️ Architecture: DM Orchestration in FastAPI

### Full Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js on Vercel)                                    │
│  Player submits action via UI                                   │
│  → POST /api/games/{gameId}/actions  (Next.js proxy route)      │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/JSON (proxy to FastAPI)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (FastAPI on Render)                                     │
│  POST /games/{gameId}/actions                                   │
│  1. Validate JWT + player membership                            │
│  2. Validate action (Pydantic + game rule checks)               │
│  3. Insert player message to game_messages                      │
│  4. Embed action text via OpenAI                                │
│  5. RAG search on game_events (match_game_events RPC, top 5)    │
│  6. Queue Dramatiq task: dm_response_task(...)                  │
│  7. Return 202 Accepted immediately                             │
│                         │                                        │
│  Dramatiq Worker (always-on):                                   │
│  1. Fetch game state + party roster                             │
│  2. Build Claude system prompt with RAG context                 │
│  3. Call claude-sonnet-4-20250514 API (max_tokens=1024)         │
│  4. Extract <event type="...">...</event> markers               │
│  5. Embed extracted events via OpenAI                           │
│  6. Insert DM response to game_messages (triggers Realtime)     │
│  7. Insert events to game_events (with vectors, service role)   │
│  8. Update games.updated_at                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │ Supabase Realtime (Postgres Changes)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js)                                              │
│  Supabase Realtime subscription on game_messages                │
│  New DM response received → re-renders chat log                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why FastAPI?

- ✅ **No cold start:** Dramatiq worker is always-on on Render; DM latency = Claude API time only
- ✅ **Job queue pattern:** Dramatiq with `max_retries=3`, exponential backoff, dead-letter fallback
- ✅ **Separation of concerns:** Frontend = UI; Backend = all AI logic, validation, mutations
- ✅ **Server-side embeddings:** All OpenAI calls stay server-side, keys never exposed to browser

---

## 📁 Monorepo Structure

```
dnd-side/
├── .github/workflows/
│   └── dependency-check.yml
│
├── frontend/                      # Next.js 16.2.3 (Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── auth/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── signup/page.tsx
│   │   │   │   └── callback/route.ts
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx
│   │   │   │   └── new/page.tsx
│   │   │   ├── games/[gameId]/page.tsx
│   │   │   └── api/
│   │   │       ├── auth/signup/route.ts
│   │   │       └── games/
│   │   │           └── [gameId]/
│   │   │               ├── actions/route.ts   ← proxies to FastAPI
│   │   │               ├── invites/route.ts
│   │   │               └── players/route.ts
│   │   ├── components/
│   │   │   ├── auth/          # LoginForm, SignUpForm, InviteRequiredMessage
│   │   │   └── games/         # CharacterCreationForm, CharacterLobbyPanel,
│   │   │                      # CharacterSummaryCard, CreateGameForm,
│   │   │                      # InventoryPanel, InviteSection
│   │   └── lib/
│   │       ├── supabase/      # client.ts, server.ts, games.ts, invites.ts, players.ts
│   │       ├── types/         # player.ts
│   │       ├── validations/   # character.ts (Zod)
│   │       └── constants/     # game.ts
│   ├── proxy.ts               # Auth middleware (Next.js 16.2.3 — replaces middleware.ts)
│   ├── e2e/                   # Playwright tests
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.local.example
│
├── backend/                   # FastAPI (Render)
│   ├── main.py                # FastAPI app entry point
│   ├── config.py              # Settings, Supabase/Anthropic/OpenAI clients
│   ├── redis_broker.py        # Dramatiq + Redis config
│   ├── constants.py           # Enum string constants (matches Supabase enums)
│   ├── wsgi.py                # Gunicorn entry point
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── games.py       # GET/POST /games
│   │   │   ├── players.py     # GET /players
│   │   │   ├── actions.py     # POST /games/{id}/actions  ← critical path
│   │   │   └── invites.py     # POST/GET /games/{id}/invites
│   │   ├── dependencies.py    # JWT auth, player validation
│   │   └── middleware.py      # CORS, logging
│   │
│   ├── services/
│   │   ├── dm_service.py      # validate_action, search_rag, extract_events
│   │   ├── db_service.py      # Supabase query helpers
│   │   └── embedding_service.py  # OpenAI embed_text() helper
│   │
│   ├── models/
│   │   ├── game.py            # Pydantic models
│   │   ├── player.py
│   │   ├── action.py
│   │   └── message.py
│   │
│   ├── tasks/
│   │   └── dm_tasks.py        # @dramatiq.actor — dm_response_task, aggregation_task
│   │
│   ├── tests/                 # pytest (full suite)
│   ├── requirements.txt
│   ├── pytest.ini
│   └── .env.example
│
├── docs/
│   ├── ARCHITECTURE.md        # This file
│   └── DATA_MODEL.md          # Schema reference
│
├── supabase/
│   └── migrations/            # All applied Supabase migrations
│
├── README.md
├── CLAUDE.md                  # AI agent context (overview)
├── AGENT.md                   # AI agent context (same as CLAUDE.md)
└── .gitignore
```

---

## 🔐 Supabase Auth Integration (JWT)

### Frontend (Next.js):
```typescript
// proxy.ts — Next.js 16.2.3 convention (replaces middleware.ts)
// Exported function is proxy(), not middleware()
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Uses getUser() (validates with auth server) not getSession() (cookies only)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  return supabaseResponse  // Must return supabaseResponse to propagate cookie refreshes
}
```

### Backend (FastAPI):
```python
# api/dependencies.py
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Verify Supabase JWT and return user_id (profile_id)"""
    user = supabase_client.auth.get_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user.user.id
```

---

## 🎯 Service Boundaries

### Next.js Handles:
- ✅ Authentication UI (login, signup, invite flow)
- ✅ Game lobby + player list (direct Supabase reads are OK)
- ✅ Real-time game view (Supabase Realtime subscription)
- ✅ Action input form + client-side validation
- ✅ Token refresh + session management via `proxy.ts`
- ❌ **Does NOT directly mutate Supabase** (all writes go through FastAPI)

### FastAPI Handles:
- ✅ Business logic validation (game rules, player state via Pydantic)
- ✅ Claude DM orchestration (RAG context, prompt building, event extraction)
- ✅ OpenAI embeddings (action text + narrative events)
- ✅ Job queue management (Dramatiq — `dm_response_task`)
- ✅ All DB mutations (inserts, updates via `SUPABASE_SERVICE_ROLE_KEY`)
- ✅ External API calls (Anthropic, OpenAI)

### Supabase Handles:
- ✅ User auth (JWT, refresh tokens)
- ✅ Data persistence (7 tables)
- ✅ RLS policies (row-level security per user)
- ✅ Real-time broadcasting (`game_messages`)
- ✅ Vector similarity search (`game_events` via `match_game_events` RPC)

---

## 🚀 Deployment

### Frontend (Vercel)
- Auto-deploys on `develop` push
- Project: `dnd-side.vercel.app`
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL`

### Backend (Render)
- Auto-deploys on `develop` push
- Always-on service (not serverless) — required for Dramatiq workers
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `REDIS_URL`, `FRONTEND_URL`
- `DATABASE_URL` is present in `config.py` but currently unused — all DB operations use `supabase-py`

### Cost (Free Tier)
- **Vercel:** Free tier (100GB bandwidth/month)
- **Render:** FastAPI + Dramatiq worker, free tier (750 hrs/month)
- **Supabase:** Postgres + pgvector, free tier (500MB storage)
- **OpenAI:** ~$0.02 per 1M tokens (embeddings)
- **Anthropic:** `claude-sonnet-4-20250514`, pay-as-you-go

---

## 📝 Key Implementation Notes

### RAG Flow
1. **Embed** incoming action text via OpenAI in `actions.py`
2. **Search** `game_events` using `match_game_events` Supabase RPC (cosine similarity `<=>`, top 5)
3. **Pass** `rag_context` as pre-computed list to Dramatiq task
4. **Inject** into Claude system prompt in `dm_tasks.py`
5. **Parse** Claude response for `<event type="combat|discovery|dialogue|death|milestone">...</event>` markers
6. **Embed** extracted events via OpenAI in `dm_tasks.py`
7. **Insert** to `game_events` with vectors (requires service role key — no RLS insert policy)

### Event Extraction Format
Claude responses use XML-style tags to mark narrative events:
```xml
<event type="combat">The party defeated three goblins in the forest clearing.</event>
<event type="discovery">The players found a hidden door behind the bookshelf.</event>
```
The `extract_events_from_response()` function in `dm_service.py` parses these with a regex.

### Dramatiq Task
```python
@dramatiq.actor(max_retries=3, min_backoff=1000)
def dm_response_task(game_id, message_id, action_text, rag_context):
    # If fails 3 times → dead-letter queue (manual review)
```

### Realtime Broadcasting
- Backend inserts DM message to `game_messages` → Supabase triggers Postgres Changes broadcast
- Frontend subscribes: `supabase.channel('game:${gameId}').on('postgres_changes', ...)`
- No polling needed

---

## Conventions

- **Frontend:** TypeScript strict mode, named exports, no `any`, no `console.log`, `@supabase/ssr` (never deprecated auth-helpers), Zod v4 validation, no Supabase calls in components
- **Backend:** Type hints everywhere, Pydantic v2 validation, docstrings on all functions, pytest with full mocks
- **Both:** `.env` files for secrets, all migrations tracked in `supabase/migrations/`
- **Issue tracking:** Linear (DnD Side Project) — GitHub Issues deprecated
