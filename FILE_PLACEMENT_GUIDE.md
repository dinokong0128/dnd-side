# File Placement Guide for dnd-multiplayer Monorepo

## Directory Structure (Create These Folders)

```
dnd-multiplayer/                          ← Your GitHub repo root
│
├── frontend/                              ← Next.js app
│   ├── app/
│   │   ├── api/
│   │   │   └── games/
│   │   │       └── [gameId]/
│   │   │           └── actions/
│   │   │               └── route.ts       ← FROM: frontend_actions_route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── ...
│   ├── components/
│   ├── lib/
│   ├── types/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── .env.local.example
│   └── vercel.json
│
├── backend/                               ← FastAPI app
│   ├── main.py                           ← FROM: backend_main.py
│   ├── config.py                         ← FROM: backend_config.py
│   ├── redis_broker.py                   ← FROM: backend_redis_broker.py
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── middleware.py
│   │   ├── dependencies.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── games.py
│   │       ├── players.py
│   │       └── actions.py                ← FROM: backend_actions_route.py
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── dm_service.py                 ← You'll create this (RAG logic)
│   │   ├── db_service.py
│   │   └── embedding_service.py
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── game.py
│   │   ├── player.py
│   │   ├── action.py
│   │   └── message.py
│   │
│   ├── tasks/
│   │   ├── __init__.py
│   │   └── dm_tasks.py                   ← FROM: backend_dm_tasks.py
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_actions_route.py
│   │   └── conftest.py
│   │
│   ├── Dockerfile
│   ├── requirements.txt                  ← FROM: backend_requirements.txt
│   ├── .env.example
│   ├── pytest.ini
│   └── wsgi.py                           ← For Gunicorn on Render
│
├── .github/
│   └── workflows/
│       ├── test-backend.yml              ← You'll create this
│       ├── deploy-frontend.yml           ← You'll create this
│       └── deploy-backend.yml            ← You'll create this
│
├── docker-compose.yml                    ← For local dev (optional)
├── README.md
├── .gitignore
└── .env.example                          ← Combined env vars for reference
```

---

## Step-by-Step: Where Each File Goes

### **From the files I created:**

| File I Created | Where It Goes | New Filename |
|---|---|---|
| `DND_ARCHITECTURE.md` | `dnd-multiplayer/docs/` | `ARCHITECTURE.md` |
| `backend_main.py` | `backend/` | `main.py` |
| `backend_config.py` | `backend/` | `config.py` |
| `backend_redis_broker.py` | `backend/` | `redis_broker.py` |
| `backend_actions_route.py` | `backend/api/routes/` | `actions.py` |
| `backend_dm_tasks.py` | `backend/tasks/` | `dm_tasks.py` |
| `frontend_actions_route.ts` | `frontend/app/api/games/[gameId]/actions/` | `route.ts` |
| `backend_requirements.txt` | `backend/` | `requirements.txt` |

---

## Quick Copy-Paste Instructions

### 1. Create the folder structure
```bash
# From your monorepo root
mkdir -p frontend/app/api/games/\[gameId\]/actions
mkdir -p frontend/components
mkdir -p frontend/lib
mkdir -p frontend/types

mkdir -p backend/api/routes
mkdir -p backend/services
mkdir -p backend/models
mkdir -p backend/tasks
mkdir -p backend/tests

mkdir -p .github/workflows
```

### 2. Copy Python files to backend/
```bash
# Copy these files to their new homes in backend/:
cp backend_main.py backend/main.py
cp backend_config.py backend/config.py
cp backend_redis_broker.py backend/redis_broker.py
cp backend_requirements.txt backend/requirements.txt

# Copy route file
cp backend_actions_route.py backend/api/routes/actions.py

# Copy task file
cp backend_dm_tasks.py backend/tasks/dm_tasks.py
```

### 3. Copy TypeScript file to frontend/
```bash
cp frontend_actions_route.ts frontend/app/api/games/\[gameId\]/actions/route.ts
```

### 4. Copy architecture doc
```bash
cp DND_ARCHITECTURE.md docs/ARCHITECTURE.md
```

---

## Files You Still Need to Create (Stubs)

After copying the files above, create these empty/stub files:

### **Backend stubs (create these):**

`backend/api/__init__.py` — Empty file
`backend/api/middleware.py` — CORS setup
`backend/api/dependencies.py` — Auth helpers
`backend/api/routes/__init__.py` — Empty file
`backend/api/routes/games.py` — GET/POST games
`backend/api/routes/players.py` — GET players

`backend/services/__init__.py` — Empty file
`backend/services/db_service.py` — Supabase queries
`backend/services/dm_service.py` — RAG logic (YOU IMPLEMENT)
`backend/services/embedding_service.py` — OpenAI embeddings

`backend/models/__init__.py` — Empty file
`backend/models/game.py` — Pydantic Game schema
`backend/models/player.py` — Pydantic Player schema
`backend/models/action.py` — Pydantic Action schema
`backend/models/message.py` — Pydantic Message schema

`backend/tasks/__init__.py` — Empty file

`backend/tests/__init__.py` — Empty file
`backend/tests/conftest.py` — pytest fixtures

### **Frontend stubs (create these):**

`frontend/app/layout.tsx` — Root layout
`frontend/app/page.tsx` — Home page
`frontend/components/GameBoard.tsx` — Game view
`frontend/lib/api-client.ts` — Fetch wrapper
`frontend/lib/supabase-client.ts` — Supabase setup

---

## What You're Left With

After copying + creating stubs, you'll have the **skeleton**. Then you fill in the logic:

- **Backend logic:** RAG search, state validation, game rules (in services/)
- **Frontend logic:** UI components, Realtime subscriptions
- **Tests:** Write pytest for backend, vitest for frontend

---

## TL;DR — Three Commands

1. **Create folders:**
   ```bash
   mkdir -p frontend/app/api/games/\[gameId\]/actions
   mkdir -p backend/{api/routes,services,models,tasks,tests}
   ```

2. **Copy files I created:**
   ```bash
   cp backend_main.py backend/main.py
   cp backend_config.py backend/config.py
   cp backend_redis_broker.py backend/redis_broker.py
   cp backend_requirements.txt backend/requirements.txt
   cp backend_actions_route.py backend/api/routes/actions.py
   cp backend_dm_tasks.py backend/tasks/dm_tasks.py
   cp frontend_actions_route.ts frontend/app/api/games/\[gameId\]/actions/route.ts
   cp DND_ARCHITECTURE.md docs/ARCHITECTURE.md
   ```

3. **Create empty __init__.py files** so Python recognizes folders as packages:
   ```bash
   touch backend/api/__init__.py
   touch backend/services/__init__.py
   touch backend/models/__init__.py
   touch backend/tasks/__init__.py
   touch backend/tests/__init__.py
   ```

---

## Next: Which file should you tackle first?

Once the structure is in place:

1. **`backend/config.py`** — Set up environment variables & API clients
2. **`backend/api/dependencies.py`** — Auth middleware
3. **`backend/services/dm_service.py`** — RAG logic (core of the app)
4. **`backend/api/routes/actions.py`** — Already provided, just connect to dm_service
5. **`backend/tasks/dm_tasks.py`** — Already provided, just test it

Make sense now?
