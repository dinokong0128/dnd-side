# D&D Multiplayer App — Architecture & Tech Stack

**Last Updated:** April 17, 2026
**Status:** MVP complete ✅ — Post-MVP (v1.0 — Full Gameplay) in progress
**Repository:** `dinokong0128/dnd-side` (`develop` branch)

---

## 📊 Tech Stack

| Layer | Technology | Hosting | Notes |
|---|---|---|---|
| **Frontend** | Next.js 16.2.3 (App Router, TypeScript strict), React 19.2.5, Tailwind 4 | Vercel | Proxy layer + SSE stream consumer; no direct DB mutations |
| **Backend** | FastAPI 0.135 + Python | Render free tier, always-on | All business logic, streaming, AI orchestration |
| **Database** | Supabase (Postgres 15 + pgvector 0.8 + Realtime) | Managed | `ytxncykyfbhoyvxkocrs` |
| **Job Queue** | Dramatiq 2.1 + Redis 7 | Render Key Value + embedded in backend service | Bookkeeping after the stream finishes |
| **Auth** | Supabase Auth (JWT) via `@supabase/ssr` 0.10 | Supabase | Realtime auth requires explicit `setAuth()` |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536-dim, `openai` 2.31) | OpenAI API | Called from FastAPI only (`embedding_service.py`) |
| **LLM** | `claude-sonnet-4-20250514` (streaming, `anthropic` 0.93) | Anthropic API | Streaming directly from the request coroutine |
| **Validation** | Zod v4 (frontend), Pydantic v2 (backend) | — | — |

---

## 🏗️ Architecture: Streaming DM Orchestration in FastAPI

### Full Request Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js on Vercel)                                     │
│   1. User types action → optimistic player message appears       │
│   2. POST /api/games/{gameId}/actions  (Next.js proxy route)     │
│   3. Open SSE: GET /api/games/{gameId}/events (or direct)        │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTP/JSON + SSE
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ BACKEND (FastAPI on Render)                                      │
│                                                                  │
│ POST /games/{gameId}/actions:                                    │
│   1. Validate JWT + player membership + Pydantic input           │
│   2. Insert player message into game_messages                    │
│   3. Spawn background coroutine _stream_to_redis(...)            │
│   4. Return 202 Accepted immediately                             │
│                                                                  │
│ Background coroutine (in the same process):                      │
│   a. Embed action via OpenAI (httpx connection-pooled)           │
│   b. RAG search on game_events (match_game_events RPC, top 5)    │
│   c. Build system prompt (party state, RAG, combat rules)        │
│   d. Call Claude API with stream=True                            │
│   e. For each streamed token/block → PUBLISH to Redis            │
│      channel `stream:{gameId}` as JSON {type: chunk|block|...}   │
│   f. When stream completes:                                      │
│      - Publish {type: "done"} to Redis                           │
│      - Strip tag blocks from raw response for display            │
│      - Apply <state_changes> (HP, spell slots, XP, inventory)    │
│      - Insert DM message to game_messages with dice_rolls JSONB  │
│        (this triggers Supabase Realtime for *other* players)     │
│      - Enqueue dm_bookkeeping_task(game_id, raw_response)        │
│                                                                  │
│ GET /games/{gameId}/events (SSE):                                │
│   - Subscribe to Redis `stream:{gameId}`                         │
│   - Forward each pub/sub message as an SSE `data:` frame         │
│   - Close connection when `{type: "done"}` is seen               │
│                                                                  │
│ Dramatiq worker (dm_bookkeeping_task):                           │
│   - Re-parse <event> markers, embed via OpenAI, insert into      │
│     game_events (with service role key — no RLS insert policy)   │
│   - Persist <suggested_actions> into games.suggested_actions     │
│   - max_retries=3, exponential backoff                           │
└─────────────────────────┬────────────────────────────────────────┘
                          │ Supabase Realtime (Postgres Changes)
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js)                                               │
│   - Acting player: sees SSE tokens stream into                   │
│     StreamingDmMessage in real time                              │
│   - Other players (DIN-67): see full DM message when the         │
│     game_messages INSERT fires over Realtime                     │
│   - CharacterSheetPanel subscribes to `players` UPDATE for live  │
│     HP / XP / spell slot / inventory deltas                      │
└──────────────────────────────────────────────────────────────────┘
```

### Why FastAPI (not Next.js)?

- ✅ **No cold start:** always-on Render web service; first streamed token in ~1–2s
- ✅ **Streaming-native:** the background coroutine + Redis pub/sub pattern fans out to all players with zero additional code (DIN-67 adds multiplayer subscribers only)
- ✅ **Durable bookkeeping:** Dramatiq task with `max_retries=3` retries on embedding / event-write failures
- ✅ **Separation of concerns:** frontend = UI, backend = all AI logic, validation, and mutations
- ✅ **Server-side embeddings:** OpenAI calls stay server-side; keys never exposed

### Structured Block Protocol

Claude's response weaves four kinds of structured data into the narrative. Each block has its own extractor and sink:

| Block | Purpose | Sink |
|---|---|---|
| `<event type="combat\|discovery\|dialogue\|death\|milestone">` | Narrative memory for RAG | `game_events` (embedded, service role) |
| `<state_changes>` JSON | Mechanical writes: HP, XP, spell slots, inventory | `players.*` + `player_inventory` via `apply_state_changes()` |
| `<dice_rolls>` JSON array | Mechanical overlays for UI (d20s, damage, advantage, DCs) | `game_messages.dice_rolls` JSONB column |
| `<suggested_actions>` | Context-aware action hints for the chat input (DIN-42) | `games.suggested_actions` text[] |

All blocks are stripped from the display text before insertion into `game_messages.content`. See `services/dm_service.py` for `extract_events_from_response()`, `extract_state_changes()`, `apply_state_changes()`, `extract_dice_rolls()`; and `api/routes/actions.py` for `_strip_all_known_tags()`.

---

## 📁 Monorepo Structure

```
dnd-side/
├── .github/workflows/
│   └── dependency-check.yml
│
├── frontend/                     # Next.js 16 (Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── auth/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── signup/page.tsx
│   │   │   │   ├── callback/route.ts
│   │   │   │   └── reset-password/page.tsx
│   │   │   ├── account/page.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx
│   │   │   │   └── new/page.tsx
│   │   │   ├── games/[gameId]/page.tsx
│   │   │   └── api/
│   │   │       ├── auth/
│   │   │       │   ├── logout/route.ts
│   │   │       │   ├── profile/route.ts
│   │   │       │   └── signup/route.ts
│   │   │       ├── generate-text/route.ts
│   │   │       ├── games/route.ts
│   │   │       └── games/[gameId]/
│   │   │           ├── actions/route.ts    ← proxies to FastAPI
│   │   │           ├── end/route.ts
│   │   │           ├── events/route.ts     ← SSE stream proxy
│   │   │           ├── invites/route.ts
│   │   │           ├── level-up/route.ts
│   │   │           ├── messages/[messageId]/route.ts
│   │   │           ├── pause/route.ts
│   │   │           ├── players/route.ts
│   │   │           ├── resume/route.ts
│   │   │           └── start/route.ts
│   │   ├── components/
│   │   │   ├── auth/             # LoginForm, SignUpForm, InviteRequiredMessage, ProfileDropdown
│   │   │   ├── dice/             # DiceRoller
│   │   │   └── games/            # Chat/Session/Character components (see below)
│   │   ├── lib/
│   │   │   ├── supabase/         # client.ts, server.ts, games.ts, invites.ts, players.ts
│   │   │   ├── types/            # player.ts, message.ts, streaming.ts
│   │   │   ├── validations/      # character.ts, action.ts (Zod)
│   │   │   ├── constants/        # game.ts
│   │   │   └── utils/            # dnd.ts, profile.ts
│   │   └── proxy.ts              # Auth middleware (Next.js 16 — replaces middleware.ts)
│   ├── e2e/                      # Playwright tests
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.local.example
│
├── backend/                      # FastAPI (Render)
│   ├── main.py                   # FastAPI app entry point + /health
│   ├── config.py                 # Settings, Supabase/Anthropic/OpenAI clients (sync + async)
│   ├── redis_broker.py           # Dramatiq + Redis config
│   ├── constants.py              # Enum string constants
│   ├── wsgi.py                   # Gunicorn entry point
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── games.py          # GET/POST/PATCH /games, lifecycle endpoints
│   │   │   ├── players.py        # GET /players, inventory
│   │   │   ├── actions.py        # POST /games/{id}/actions  ← streams via Redis
│   │   │   ├── events.py         # GET /games/{id}/events (SSE subscriber)
│   │   │   ├── invites.py        # POST/GET /games/{id}/invites
│   │   │   ├── level_up.py       # POST /games/{id}/level-up
│   │   │   └── messages.py       # PATCH/DELETE /games/{id}/messages/{id}
│   │   ├── dependencies.py       # JWT auth, player validation
│   │   └── middleware.py         # CORS, logging
│   │
│   ├── services/
│   │   ├── dm_service.py         # validate_action, search_rag, extract_events/state/dice
│   │   ├── db_service.py         # Supabase query helpers
│   │   ├── embedding_service.py  # OpenAI embed_text() (connection-pooled httpx)
│   │   └── stream_parser.py      # Incremental block parser for streaming responses
│   │
│   ├── models/                   # action, game, message, player (Pydantic)
│   ├── tasks/
│   │   └── dm_tasks.py           # @dramatiq.actor — dm_bookkeeping_task, dm_response_task
│   ├── utils/
│   │   └── dnd.py                # XP thresholds, hit dice, spell slot tables
│   │
│   ├── tests/                    # pytest (full suite, conftest-driven fixtures)
│   ├── requirements.txt
│   ├── pytest.ini
│   └── .env.example
│
├── docs/
│   ├── ARCHITECTURE.md           # This file
│   ├── DATA_MODEL.md             # Schema reference
│   └── TDD_WORKFLOW.md           # Test layers, mocking rules, stub patterns
│
├── supabase/
│   └── migrations/               # All applied Supabase migrations
│
├── README.md
├── CLAUDE.md                     # AI agent context (overview)
├── AGENTS.md                     # Pointer file for Codex compatibility
└── .gitignore
```

**Frontend `components/games/` inventory:** `CharacterCreationForm`, `CharacterLobbyPanel`, `CharacterSheetPanel`, `CharacterSummaryCard`, `ChatInput`, `ChatLog`, `ChatMessage`, `ConfirmModal`, `CreateGameForm`, `E2EGamePage`, `GameHeader`, `GameSessionView`, `InventoryPanel`, `InviteSection`, `LevelUpModal`, `SessionStatusBanner`, `StartSessionButton`, `StreamingDmMessage`, `TypingIndicator`.

---

## 🔐 Supabase Auth Integration (JWT)

### Frontend (Next.js):
```typescript
// proxy.ts — Next.js 16 convention (replaces middleware.ts)
// Exported function is proxy(), not middleware()
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Uses getUser() (validates with auth server), not getSession() (cookies only)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  return supabaseResponse  // Must return supabaseResponse to propagate cookie refreshes
}
```

**Realtime auth:** `@supabase/ssr` browser client does NOT auto-attach the user JWT to the Realtime WebSocket. `GameSessionView.tsx` explicitly calls `supabase.realtime.setAuth(session.access_token)` inside `initializeSession` before subscribing to `game_messages` / `players` channels.

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
- ✅ Authentication UI (login, signup, invite flow, account management, password reset)
- ✅ Game lobby + player list (direct Supabase reads are OK)
- ✅ Real-time game view (Supabase Realtime subscription + SSE stream consumer)
- ✅ Action input form + client-side validation (Zod)
- ✅ Token refresh + session management via `proxy.ts`
- ❌ **Does NOT directly mutate Supabase** (all writes go through FastAPI)

### FastAPI Handles:
- ✅ Business logic validation (Pydantic + game rule checks)
- ✅ Claude DM orchestration (RAG context, streaming, block extraction, state application)
- ✅ OpenAI embeddings (action text + narrative events)
- ✅ Redis pub/sub fan-out for SSE streaming
- ✅ Dramatiq bookkeeping task (event embedding + `suggested_actions` persistence)
- ✅ All DB mutations (via `SUPABASE_SERVICE_ROLE_KEY`)

### Supabase Handles:
- ✅ User auth (JWT, refresh tokens)
- ✅ Data persistence (7 public tables)
- ✅ RLS policies
- ✅ Real-time broadcasting (`game_messages`, `players`)
- ✅ Vector similarity search (`game_events` via `match_game_events` RPC)

---

## 🚀 Deployment

### Frontend (Vercel)
- Auto-deploys on `develop` push
- Project: `dnd-side.vercel.app` (ID `prj_fgN3YvJDnx0o0IWPws3nxPDjvp2i`)
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL`, `ANTHROPIC_API_KEY` (for `/api/generate-text` only)

### Backend (Render)
- Auto-deploys on `develop` push (branch: `develop`)
- Service: `dnd-backend` at `dnd-backend-xk1o.onrender.com` (ID `srv-d72p7jvfte5s73a5lbrg`)
- Always-on web service (Render free tier doesn't allow a separate worker service, so the Dramatiq worker is embedded in the start command)
- **Build command:** `pip install -r requirements.txt`
- **Start command:**
  ```
  dramatiq tasks.dm_tasks --processes 1 --threads 2 &
  gunicorn main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
  ```
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `REDIS_URL`, `FRONTEND_URL`

### Cost (Free Tier)
- **Vercel:** Free tier (100GB bandwidth/month)
- **Render:** Web service, free tier (750 hrs/month)
- **Supabase:** Postgres + pgvector, free tier (500MB storage)
- **OpenAI:** ~$0.02 per 1M tokens (embeddings, `text-embedding-3-small`)
- **Anthropic:** `claude-sonnet-4-20250514`, pay-as-you-go

---

## 📝 Key Implementation Notes

### RAG Flow
1. **Embed** incoming action text via OpenAI in `actions.py` (background coroutine, connection-pooled `httpx`)
2. **Search** `game_events` using `match_game_events` Supabase RPC (cosine `<=>`, top 5)
3. **Inject** into Claude system prompt (built in `dm_service.build_dm_system_prompt()`)
4. **Stream** Claude response with `stream=True` and `max_tokens=1024`
5. **Parse** streamed content incrementally with `services/stream_parser.py` — extract block events as they appear
6. **Apply** `<state_changes>` immediately, persist `dice_rolls` on the message row, cache `suggested_actions`
7. **Bookkeep** via `dm_bookkeeping_task` — embed `<event>` markers and insert to `game_events` (service role)

### Event Extraction Format
Claude responses use XML-style tags to mark narrative events; JSON inside the structured blocks:
```xml
<event type="combat">The party defeated three goblins in the forest clearing.</event>
<event type="discovery">The players found a hidden door behind the bookshelf.</event>

<state_changes>
{"hp_changes":[{"character_id":"uuid","delta":-8,"reason":"Goblin arrow"}]}
</state_changes>

<dice_rolls>
[{"type":"dice_roll","die":"d20","count":1,"result":14,"modifier":3,"total":17,"label":"Stealth Check","dc":15,"success":true}]
</dice_rolls>
```

### Dramatiq Task
```python
@dramatiq.actor(max_retries=3, min_backoff=1000)
def dm_bookkeeping_task(game_id, raw_response):
    # Embed <event> markers + persist to game_events
    # Persist <suggested_actions> to games.suggested_actions
    # If fails 3 times → dead-letter queue (manual review)
```

### Realtime Broadcasting
- Backend inserts DM message → Postgres Changes broadcast
- Frontend subscribes: `supabase.channel('game:${gameId}').on('postgres_changes', ...)`
- `players` UPDATE events drive live HP / XP / spell slot rendering in `CharacterSheetPanel`
- No polling needed

---

## Conventions

- **Frontend:** TypeScript strict mode, named exports, no `any`, no `console.log`, `@supabase/ssr` (never deprecated auth-helpers), Zod v4 validation, no Supabase calls in components (they go via Next.js API routes → FastAPI)
- **Backend:** Type hints everywhere, Pydantic v2 validation, docstrings on all functions, pytest with full mocks
- **Both:** `.env` files for secrets, all migrations tracked in `supabase/migrations/`
- **Issue tracking:** Linear (DnD Side Project) — GitHub Issues deprecated
