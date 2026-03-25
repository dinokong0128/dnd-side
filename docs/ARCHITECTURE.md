# D&D Multiplayer App — Final Architecture & Tech Stack

**Last Updated:** March 22, 2026  
**Status:** Ready for implementation  
**Repository:** Single monorepo (frontend + backend)

---

## 📊 Final Tech Stack (Decided)

| Layer | Technology | Hosting | Rationale |
|---|---|---|---|
| **Frontend** | Next.js latest (App Router, TypeScript) | Vercel | ISR caching, edge optimization, frontend patterns from ICT |
| **Backend** | FastAPI + Python 3.11+ | Render (free tier) | Persistent workers, job queues, async tasks, learning opportunity |
| **Database** | Supabase (Postgres + pgvector + Realtime) | Managed | Existing project (`ytxncykyfbhoyvxkocrs`), RLS, embeddings, Realtime |
| **Job Queue** | Dramatiq + Redis | Render (same instance) | Lightweight, simple, handles DM retries + background tasks |
| **Auth** | Supabase Auth (JWT) | Supabase | Built-in, JWT tokens, session management |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536-dim) | API | Called from Next.js API route before action insert |
| **LLM** | Claude Sonnet (Anthropic API) | API | Called from FastAPI worker for DM responses |

---

## 🏗️ Architecture Decision: Scenario A (DM Orchestration in FastAPI)

### Flow: Player Action → Claude DM Response

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js on Vercel)                                    │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Player sends action via UI                                │   │
│ │ → POST /api/games/{gameId}/actions (Next.js API route)   │   │
│ └───────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/JSON
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (FastAPI on Render)                                     │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ POST /games/{gameId}/actions                              │   │
│ │ 1. Validate action (Pydantic)                             │   │
│ │ 2. Store action in game_messages table                    │   │
│ │ 3. Embed action text via OpenAI API                       │   │
│ │ 4. RAG search on game_events (pgvector)                   │   │
│ │ 5. Queue Dramatiq task: dm_response_task()               │   │
│ │ 6. Return 202 Accepted                                    │   │
│ └───────────────────────────────────────────────────────────┘   │
│                         │                                        │
│                         ↓                                        │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Dramatiq Worker (persistent, always-on)                  │   │
│ │ @dramatiq_app.actor (options={"max_retries": 3})         │   │
│ │ 1. Call Claude API with RAG context                       │   │
│ │ 2. Extract events from Claude response (JSON parsing)     │   │
│ │ 3. Embed events via OpenAI                                │   │
│ │ 4. Insert DM response to game_messages                    │   │
│ │ 5. Insert events to game_events (with vectors)            │   │
│ │ 6. Update game state in players table                     │   │
│ └───────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │ Supabase Realtime (Broadcast)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (Next.js)                                              │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Supabase Realtime subscription to game_messages           │   │
│ │ Receives new DM response → Re-renders chat log            │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Why Scenario A?

✅ **Separation of Concerns:**  
- Frontend = UI + auth  
- Backend = business logic, Claude orchestration, queuing  

✅ **No Cold Start Penalty:**  
- Dramatiq worker is always-on on Render  
- DM response latency = Claude API time, not function startup  

✅ **Learning Outcome:**  
- You build real backend patterns: async tasks, retries, worker processes  
- Transfers to future projects  

✅ **Scalability:**  
- As player load grows, scale Dramatiq workers independently  
- Frontend stays lightweight  

---

## 📁 Monorepo Structure

```
dnd-multiplayer/
├── .github/workflows/
│   ├── test-backend.yml        # pytest on backend/
│   ├── deploy-frontend.yml     # Vercel deployment (auto on main)
│   └── deploy-backend.yml      # Render deployment (auto on main)
│
├── frontend/                   # Next.js (Vercel)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Game lobby / list
│   │   ├── games/[gameId]/
│   │   │   ├── page.tsx        # Game view (real-time chat + board)
│   │   │   └── layout.tsx
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── callback/page.tsx (Supabase Auth callback)
│   │   └── api/
│   │       ├── games/
│   │       │   └── [gameId]/actions/route.ts  # POST action → backend
│   │       └── auth/
│   │           └── refresh/route.ts          # Token refresh
│   ├── components/
│   │   ├── GameBoard.tsx       # Realtime game view
│   │   ├── ChatLog.tsx         # Messages (game_messages)
│   │   ├── ActionForm.tsx      # Send action
│   │   ├── AuthGuard.tsx       # Session check
│   │   └── RealtimeSubscriber.tsx
│   ├── lib/
│   │   ├── api-client.ts       # Fetch wrapper for FastAPI
│   │   ├── supabase-client.ts  # Supabase (auth + DB)
│   │   └── realtime.ts         # Supabase Realtime subscriptions
│   ├── types/
│   │   ├── game.ts
│   │   ├── player.ts
│   │   └── message.ts
│   ├── middleware.ts           # Supabase auth middleware
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── .env.local.example
│   └── vercel.json (optional)
│
├── backend/                    # FastAPI (Render)
│   ├── main.py                 # FastAPI app + Dramatiq init
│   ├── config.py               # Settings, Supabase client, etc.
│   ├── redis_broker.py         # Dramatiq + Redis config
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── games.py        # GET/POST /games
│   │   │   ├── players.py      # GET /players/{id}
│   │   │   └── actions.py      # POST /games/{id}/actions (critical)
│   │   ├── dependencies.py     # Auth, DB session, etc.
│   │   └── middleware.py       # CORS, logging
│   │
│   ├── services/
│   │   ├── dm_service.py       # Claude orchestration (non-async)
│   │   │                        # - RAG search
│   │   │                        # - State validation
│   │   │                        # - Event extraction
│   │   ├── db_service.py       # Supabase queries
│   │   ├── embedding_service.py# OpenAI embeddings
│   │   └── queue_service.py    # Dramatiq task definitions
│   │
│   ├── models/
│   │   ├── game.py             # Pydantic models
│   │   ├── player.py
│   │   ├── action.py
│   │   └── message.py
│   │
│   ├── tasks/
│   │   ├── dm_tasks.py         # @dramatiq_app.actor
│   │   │                        # - dm_response_task(game_id, action_id)
│   │   │                        # - aggregation_task (background summaries)
│   │   └── __init__.py
│   │
│   ├── tests/
│   │   ├── test_dm_service.py
│   │   ├── test_actions_route.py
│   │   └── conftest.py
│   │
│   ├── Dockerfile              # For Render
│   ├── requirements.txt        # FastAPI, dramatiq, anthropic, openai, etc.
│   ├── pyproject.toml          # Optional: poetry config
│   ├── .env.example
│   ├── pytest.ini
│   └── wsgi.py (optional: for gunicorn on Render)
│
├── docker-compose.yml          # Local dev: Postgres, Redis, Supabase
├── README.md
├── .gitignore
└── .env.example
```

---

## 🔐 Supabase Auth Integration (JWT)

### Frontend (Next.js):
```typescript
// lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// middleware.ts — Verify JWT on protected routes
export async function middleware(request: Request) {
  const session = await getSession(request)
  if (!session && request.nextUrl.pathname.startsWith('/games')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
}
```

### Backend (FastAPI):
```python
# api/dependencies.py
from fastapi import Depends, HTTPException
from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Verify JWT and return user_id"""
    user = supabase.auth.get_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user.id
```

---

## 🎯 Service Boundaries

### Next.js Handles:
- ✅ Authentication UI (login, signup, password reset)
- ✅ Game lobby & player list (display, filtering)
- ✅ Real-time game view (Supabase Realtime subscription)
- ✅ Action input form & validation (client-side)
- ✅ Token refresh & session management

### FastAPI Handles:
- ✅ Business logic validation (game rules, player state)
- ✅ Claude DM orchestration (RAG, calls, event extraction)
- ✅ Job queue management (Dramatiq)
- ✅ Database mutations (inserts, updates, RLS enforcement)
- ✅ Background tasks (event aggregation, summaries)
- ✅ External API calls (Anthropic, OpenAI)

### Supabase Handles:
- ✅ User auth (JWT, refresh tokens)
- ✅ Data persistence (6 tables)
- ✅ RLS policies (row-level security per user)
- ✅ Real-time broadcasting (game_messages, game_events)
- ✅ Vector search (pgvector on game_events)

---

## 🚀 Deployment Strategy

### Frontend (Vercel)
```bash
# git push → Auto-deploys to production
# Environment variables:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - NEXT_PUBLIC_BACKEND_URL (points to Render FastAPI)
```

### Backend (Render)
```bash
# git push → Auto-deploys to production
# Dockerfile builds Python 3.11 + FastAPI
# Gunicorn worker (3 workers, 4 threads each)
# Dramatiq worker (separate dyno or subprocess)
# Environment variables:
# - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# - ANTHROPIC_API_KEY, OPENAI_API_KEY
# - REDIS_URL (Render provides)
# - DATABASE_URL (Render provides via Supabase)
```

### Cost (All Free Tier)
- **Vercel:** Next.js, free tier (100GB bandwidth/month)
- **Render:** FastAPI + Celery worker, free tier (750 hrs/month = 1 always-on service)
- **Supabase:** Postgres + pgvector, free tier (500MB)
- **OpenAI:** $0.02 per 1M tokens (embeddings, negligible)
- **Anthropic:** Claude API calls, pay-as-you-go

---

## 📝 Key Implementation Notes

### RAG Flow (in dm_service.py):
1. **Embed** incoming action text via OpenAI
2. **Search** game_events table using pgvector `<=>` cosine operator
3. **Fetch** top 5-10 relevant events (context)
4. **Inject** into Claude system prompt
5. **Parse** Claude response for `<event>` markers
6. **Extract** and embed events
7. **Insert** to game_events with vectors

### State Validation (in dm_service.py):
- Pydantic models enforce game rules before Claude call
- Example: Check player inventory before allowing spell cast
- Log violations (potential rule-breaking by Claude)

### Dramatiq Task with Retries:
```python
@dramatiq_app.actor(max_retries=3, min_backoff=1000)
def dm_response_task(game_id: str, action_id: str):
    """Process DM response with exponential backoff on failure"""
    # If fails 3 times, dead-letter queue (manual review needed)
```

### Realtime Broadcasting:
- Backend inserts to `game_messages` → Supabase triggers broadcast
- Frontend subscribes: `supabase.channel('game_messages').on('*', ...)`
- No polling needed

---

## ✅ Checklist Before You Code

- [ ] Monorepo created, cloned locally
- [ ] `/frontend` and `/backend` folders initialized
- [ ] Vercel project linked to frontend
- [ ] Render account created, Redis enabled
- [ ] Supabase schema finalized (6 tables, pgvector enabled)
- [ ] Environment variables template created (.env.example for both)
- [ ] API documentation planned (FastAPI auto-docs at /docs)
- [ ] Test structure planned (pytest for backend, vitest for frontend)

---

## 🎓 What You'll Learn

**Backend (Python/FastAPI):**
- Async Python with FastAPI
- Job queues with Dramatiq
- Working with LLM APIs (Anthropic, OpenAI)
- Postgres queries + pgvector
- Error handling & retries
- API design (RESTful endpoints)
- Testing async code

**Frontend (TypeScript/Next.js):**
- Reuse patterns from ICT Data Viewer
- Real-time subscriptions (Supabase Realtime)
- Supabase Auth integration
- Inter-service communication (frontend ↔ backend)

**DevOps/Infrastructure:**
- Monorepo management
- GitHub Actions CI/CD
- Vercel + Render deployments
- Environment variable management

---

## Next Steps

1. **Create the monorepo** (GitHub)
2. **Set up folder structure** (frontend + backend templates)
3. **Connect Vercel + Render**
4. **Build backend API skeleton** (routes, models, services)
5. **Build frontend scaffold** (auth flow, game layout, API client)
6. **Implement RAG flow** (the meat of the project)
7. **Integrate Dramatiq** (background task processing)
8. **Deploy & iterate**

---

**Questions before implementation?** This is your north star document—refer back when decisions get fuzzy.
