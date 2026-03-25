# D&D Multiplayer App — Project Context

**Last Updated:** March 22, 2026  
**Status:** Architected and ready for implementation  
**Repository:** Single monorepo (`dnd-side` on GitHub)  
**Detailed Architecture:** See `docs/ARCHITECTURE.md` (complete design doc)

---

## Project Overview

A multiplayer D&D app where Claude acts as the Dungeon Master. Players send actions via Next.js frontend, FastAPI backend orchestrates Claude responses asynchronously, and long-term narrative memory is maintained via RAG (pgvector similarity search).

---

## 🎯 Core Tech Stack

| Component | Technology | Host |
|---|---|---|
| Frontend | Next.js latest (App Router, TypeScript) | Vercel |
| Backend | FastAPI + Python latest | Render |
| Database | Supabase (Postgres + pgvector + Realtime) | Managed |
| Job Queue | Dramatiq + Redis | Render |
| Auth | Supabase Auth (JWT) | Supabase |
| LLM | Claude 3.5 Sonnet | Anthropic API |
| Embeddings | OpenAI `text-embedding-3-small` | OpenAI API |

**→ Full rationale in docs/ARCHITECTURE.md § "Final Tech Stack"**

---

## 🏗️ Architecture: Scenario A (DM Orchestration in FastAPI)

**Flow:** Player action → FastAPI validation + RAG → Queue Dramatiq task → Worker calls Claude → Response broadcast via Supabase Realtime → Frontend re-renders

**Why FastAPI (not Next.js)?**
- ✅ No cold start penalty on DM latency
- ✅ Proper job queue pattern (Dramatiq with retries)
- ✅ Separation of concerns (frontend = UI, backend = logic)
- ✅ Real async Python backend (learning opportunity)

**→ Detailed flow in docs/ARCHITECTURE.md § "Architecture Decision: Scenario A"**

---

## 📁 Project Structure

Monorepo with `/frontend` (Next.js) and `/backend` (FastAPI).

**→ Complete directory tree in docs/ARCHITECTURE.md § "Monorepo Structure"**  
**→ File placement guide in FILE_PLACEMENT_GUIDE.md**

---

## 🗄️ Database Schema

Six tables in Supabase (`ytxncykyfbhoyvxkocrs`):

| Table | Purpose |
|---|---|
| `profiles` | Extends Supabase Auth users |
| `games` | Game sessions, DM persona |
| `players` | Players in game, stats (jsonb) |
| `player_inventory` | Items per player |
| `game_messages` | Chat log, Realtime broadcast |
| `game_events` | Events with pgvector embeddings (1536-dim) |

**→ Full schema details in `docs/DATA_MODEL.md`**

---

## 🔄 Key Decisions

| Decision | Choice | Why |
|---|---|---|
| DM Orchestration | FastAPI backend | Job queues, retries, always-on workers |
| Job Queue | Dramatiq | Lightweight, works on Render free tier |
| Auth | Supabase JWT | Built-in, integrates with RLS |
| Monorepo | Single repo | One place for both services |
| Realtime | Supabase Changes | Native to Postgres, easy broadcast |

**→ Full rationale in docs/ARCHITECTURE.md § "Architecture Decision" sections**

---

## 🎯 Service Boundaries

### Next.js (Frontend)
- Auth UI, game lobby, real-time views
- Supabase Realtime subscriptions
- Token refresh, session management

### FastAPI (Backend)
- Business logic validation, game rules
- Claude DM orchestration (RAG, API calls)
- Job queue management (Dramatiq)
- DB mutations, background tasks

### Supabase
- User auth (JWT, refresh tokens)
- Data persistence & RLS
- Real-time broadcasting
- Vector search (pgvector)

**→ Detailed boundaries in docs/ARCHITECTURE.md § "Service Boundaries"**

---

## 🚀 Deployment

- **Frontend:** Vercel (auto-deploy on git push)
- **Backend:** Render (auto-deploy on git push)
- **All services on free tier**

**→ Deployment details & cost breakdown in docs/ARCHITECTURE.md § "Deployment Strategy"**

---

## 🔑 Implementation Notes

**RAG Flow:** Embed action → Search pgvector → Inject context into Claude prompt → Parse response for events → Embed + store events

**Dramatiq:** Queue task with max_retries=3, exponential backoff. Dead-letter queue if all retries fail.

**Realtime:** Backend inserts to game_messages → Supabase broadcasts → Frontend re-renders

**→ Code examples in docs/ARCHITECTURE.md § "Key Implementation Notes"**

---

## ✅ Pre-Implementation Checklist

- [ ] GitHub monorepo created (`dnd-multiplayer`)
- [ ] Vercel linked to frontend
- [ ] Render account with Redis enabled
- [ ] Environment variables configured
- [ ] Supabase schema finalized

**→ Full checklist in docs/ARCHITECTURE.md § "Checklist Before You Code"**

---

## 📚 Documentation

| Document | Contents |
|---|---|
| **docs/ARCHITECTURE.md** | Complete design: flows, decisions, code examples, learning outcomes |
| **docs/DATA_MODEL.md** | Tables, columns, enums, indexes, triggers, RLS policies |
| **FILE_PLACEMENT_GUIDE.md** | Exact file locations & copy-paste instructions |
| **This file (CLAUDE.md)** | Project overview & reference links |

---

## Conventions

- **Frontend:** TypeScript strict, named exports, no `any`, reuse ICT patterns
- **Backend:** Type hints, Pydantic validation, docstrings, pytest tests
- **Both:** Environment variables in `.env`, migrations tracked

**→ Full conventions in docs/ARCHITECTURE.md § "Conventions" (original doc)**

---

## Cost & Constraints (Free Tier)

- **Render:** 750 hrs/month (= 1 always-on service)
- **Supabase:** 500MB storage
- **Redis:** 30MB (Render free)
- **OpenAI embeddings:** ~$0.02/1M tokens (negligible)
- **Claude API:** Pay-as-you-go (~$0.003/1K input tokens)

---

## What You'll Learn

**Backend:** Async Python, job queues, LLM APIs, pgvector, error handling, API design, testing

**Frontend:** Supabase Auth, Realtime subscriptions, inter-service communication, ICT patterns

**DevOps:** Monorepo management, GitHub Actions, Vercel + Render deployments

**→ Full learning outcomes in docs/ARCHITECTURE.md § "What You'll Learn"**

---

## Next Steps

1. Read docs/ARCHITECTURE.md (complete design north star)
2. Review FILE_PLACEMENT_GUIDE.md (file locations)
3. Create monorepo structure
4. Copy template files
5. Implement backend (RAG search first)
6. Implement frontend (auth → game view)
7. Deploy & iterate

---

## References

- **Full architecture:** `docs/ARCHITECTURE.md`
- **File placement:** `FILE_PLACEMENT_GUIDE.md`
- **GitHub repo:** https://github.com/dinokong0128/dnd-side
- **Supabase project:** `ytxncykyfbhoyvxkocrs`

---

## Maintenance

When schema migrations, architecture decisions, or features change, update `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md` and keep this file as a lightweight reference.
