# DnD Side Project — Post-Merge Smoke Test

## When to Run
Run this smoke test every time a PR is merged into the `develop` branch. It verifies that the deployed frontend (Vercel), backend (Render), and database (Supabase) are consistent with what was merged.

## How to Run
Tell Claude: **"Run the smoke test"** or **"Run post-merge smoke test for DIN-XX"**. Claude will execute each section below and report a pass/fail summary.

---

## Configuration

```
GITHUB_REPO=dinokong0128/dnd-side
GITHUB_BRANCH=develop
VERCEL_PROJECT_ID=prj_fgN3YvJDnx0o0IWPws3nxPDjvp2i
VERCEL_TEAM_ID=team_6IJVghkczbD3MjiUrF8JfVoR
VERCEL_PROD_URL=https://dnd-side.vercel.app
SUPABASE_PROJECT_REF=ytxncykyfbhoyvxkocrs
RENDER_BACKEND_URL=https://dnd-backend-xk1o.onrender.com
```

---

## Section 1: GitHub — Repo Health

**Tools:** GitHub API via PAT (fetch from Supabase `secrets` table, key: `github_pat_dnd`)

| # | Check | How |
|---|---|---|
| 1.1 | Latest commit on `develop` | `GET /repos/{repo}/commits/develop` — record SHA + message |
| 1.2 | No open PRs targeting `develop` with merge conflicts | `GET /repos/{repo}/pulls?state=open&base=develop` — check `mergeable` |
| 1.3 | CI status on latest commit | `GET /repos/{repo}/commits/{sha}/status` — should be `success` or no CI |

---

## Section 2: Vercel — Frontend Deployment

**Tools:** Vercel MCP (`Vercel:get_project`, `Vercel:web_fetch_vercel_url`), `bash_tool` with `curl`

| # | Check | How |
|---|---|---|
| 2.1 | Latest deployment is `READY` | `Vercel:get_project` → `latestDeployment.readyState === 'READY'` |
| 2.2 | Latest deployment target is `production` | `latestDeployment.target === 'production'` |
| 2.3 | Root `/` redirects to `/auth/login` (unauthenticated) | `curl` — expect HTTP 307 redirect |
| 2.4 | `/auth/login` returns 200 (renders login page) | `Vercel:web_fetch_vercel_url` — check for "Realm & Ruin" or "Welcome Back" in body |
| 2.5 | `/auth/signup` returns 200 (renders invite-required) | `Vercel:web_fetch_vercel_url` — check for "Invite Required" or "invite-required-message" in body |
| 2.6 | `/dashboard` redirects to `/auth/login` (unauthenticated) | `curl` — expect HTTP 307 redirect to `/auth/login` |
| 2.7 | `/games/nonexistent-id` redirects to `/auth/login` (unauthenticated) | `curl` — expect HTTP 307 redirect to `/auth/login` |

---

## Section 3: Backend — FastAPI on Render

**Tools:** `bash_tool` with `curl`

**Base URL:** `https://dnd-backend-xk1o.onrender.com`

**Note on trailing slashes:** FastAPI redirects `POST /games` (no slash) → `POST /games/` (with slash) via HTTP 307. The smoke test uses the canonical URL with trailing slash where applicable. For path-parameterized routes (e.g., `/games/{id}/start`), no trailing slash is needed.

### 3A: Health & Auth Guards

| # | Check | How | Expected |
|---|---|---|---|
| 3.1 | `/health` returns 200 | `curl {URL}/health` | `{"status": "ok", "service": "dnd-backend", ...}` |
| 3.2 | `POST /games/` without auth returns 401 | `curl -X POST {URL}/games/` | `{"detail": "Not authenticated"}` |
| 3.3 | `POST /games/{id}/players` without auth returns 401 | `curl -X POST {URL}/games/fake-id/players` | 401 |

### 3B: Invite Endpoints ([DIN-33](https://linear.app/dino-kong/issue/DIN-33))

| # | Check | How | Expected |
|---|---|---|---|
| 3.4 | `POST /games/{id}/invites` without auth returns 401 | `curl -X POST {URL}/games/fake-id/invites` | 401 |

### 3C: Session Lifecycle Endpoints ([DIN-8](https://linear.app/dino-kong/issue/DIN-8), [DIN-9](https://linear.app/dino-kong/issue/DIN-9), [DIN-10](https://linear.app/dino-kong/issue/DIN-10))

| # | Check | How | Expected |
|---|---|---|---|
| 3.5 | `POST /games/{id}/start` without auth returns 401 | `curl -X POST {URL}/games/fake-id/start` | 401 |
| 3.6 | `POST /games/{id}/pause` without auth returns 401 | `curl -X POST {URL}/games/fake-id/pause` | 401 |
| 3.7 | `POST /games/{id}/end` without auth returns 401 | `curl -X POST {URL}/games/fake-id/end` | 401 |
| 3.8 | `POST /games/{id}/resume` without auth returns 401 | `curl -X POST {URL}/games/fake-id/resume` | 401 |

### 3D: Game Loop Endpoints ([DIN-11](https://linear.app/dino-kong/issue/DIN-11))

| # | Check | How | Expected |
|---|---|---|---|
| 3.9 | `POST /games/{id}/actions` without auth returns 401 | `curl -X POST {URL}/games/fake-id/actions` | 401 |

### 3F: Message Edit/Delete Endpoints ([DIN-61](https://linear.app/dino-kong/issue/DIN-61))

| # | Check | How | Expected |
|---|---|---|---|
| 3.11 | `DELETE /games/{id}/messages/{msgId}` without auth returns 401 | `curl -X DELETE {URL}/games/fake-id/messages/fake-msg` | 401 |
| 3.12 | `PATCH /games/{id}/messages/{msgId}` without auth returns 401 | `curl -X PATCH {URL}/games/fake-id/messages/fake-msg` | 401 |

### 3E: Inventory Endpoint ([DIN-6](https://linear.app/dino-kong/issue/DIN-6), [DIN-34](https://linear.app/dino-kong/issue/DIN-34))

| # | Check | How | Expected |
|---|---|---|---|
| 3.10 | `GET /games/{id}/players/inventory` without auth returns 401 | `curl {URL}/games/fake-id/players/inventory` | 401 |

---

## Section 4: Supabase — Database Schema

**Tools:** `Supabase - DnD:execute_sql`

### 4A: Tables

| # | Check | How |
|---|---|---|
| 4.1 | All expected tables exist | `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name` — expect: `game_events`, `game_messages`, `games`, `invites`, `player_inventory`, `players`, `profiles`, `secrets` |

### 4B: Column Checks

| # | Check | How |
|---|---|---|
| 4.2 | `invites` table has correct columns | `SELECT column_name ...` — expect: `id`, `code`, `game_id`, `created_at`, `used_at` |
| 4.3 | `players` table has `race` column | Column exists with type `text` |
| 4.4 | `players` table has `level` column | Column exists with type `integer` |
| 4.13 | `games` table has `suggested_actions` column | Column exists with type `ARRAY` (`text[]`) — added by DIN-42 |

### 4C: Enums

| # | Check | How |
|---|---|---|
| 4.5 | `game_status` enum values correct | `SELECT unnest(enum_range(NULL::public.game_status))` — expect: `lobby`, `active`, `paused`, `ended` |

### 4D: RPC Functions

| # | Check | How |
|---|---|---|
| 4.6 | `validate_invite_code` RPC exists | Query `information_schema.routines` |
| 4.7 | `validate_invite_code_v2` RPC exists | Same — returns jsonb with status/game_id/game_name |
| 4.8 | `mark_invite_used` RPC exists | Same |
| 4.9 | `match_game_events` RPC exists | Same — pgvector cosine similarity search |
| 4.10 | `handle_new_user` function exists | Same — auto-creates profile on auth.users insert |

### 4E: Infrastructure

| # | Check | How |
|---|---|---|
| 4.11 | RLS enabled on all public tables | `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` — all should be `true` |
| 4.12 | pgvector extension enabled | `SELECT extname FROM pg_extension WHERE extname = 'vector'` |

---

## Section 5: Code Consistency — Key Files

**Tools:** GitHub API (fetch file content from `develop` branch)

**IMPORTANT — Next.js version note:** This project uses **Next.js 16.2.1**. In Next.js 16, `middleware.ts` was renamed to `proxy.ts` and the exported function renamed from `middleware` to `proxy`. All checks below use the correct Next.js 16 convention.

### 5A: Auth & Routing ([DIN-18](https://linear.app/dino-kong/issue/DIN-18), [DIN-30](https://linear.app/dino-kong/issue/DIN-30))

| # | Check | How |
|---|---|---|
| 5.1 | `proxy.ts` exists (Next.js 16 request proxy) | `GET .../frontend/src/proxy.ts` — 200 |
| 5.2 | No `user!` non-null assertion in dashboard | Fetch `dashboard/page.tsx`, verify no `user!.id` pattern |

### 5B: Game Data Layer ([DIN-21](https://linear.app/dino-kong/issue/DIN-21), [DIN-33](https://linear.app/dino-kong/issue/DIN-33))

| # | Check | How |
|---|---|---|
| 5.3 | `Game` type includes `created_by` | Fetch `games.ts`, verify `created_by` in type |
| 5.4 | All `fetchGame*` queries select `created_by` | Same file, verify `created_by` in all `.select()` strings |
| 5.5 | Backend `players.py` does NOT reference `invitee_id` | Fetch file, verify no `invitee_id` string |
| 5.6 | Backend DM persona default matches frontend | Fetch `games.py`, verify default contains `"A classic high-fantasy"` |

### 5C: Invite Flow ([DIN-17](https://linear.app/dino-kong/issue/DIN-17), [DIN-33](https://linear.app/dino-kong/issue/DIN-33))

| # | Check | How |
|---|---|---|
| 5.7 | `InviteSection.tsx` exists | `GET .../components/games/InviteSection.tsx` — 200 |
| 5.8 | `backend/api/routes/invites.py` exists | `GET .../backend/api/routes/invites.py` — 200 |
| 5.9 | Frontend invite proxy route exists | `GET .../app/api/games/[gameId]/invites/route.ts` — 200 |

### 5D: Inventory ([DIN-6](https://linear.app/dino-kong/issue/DIN-6), [DIN-34](https://linear.app/dino-kong/issue/DIN-34), [DIN-35](https://linear.app/dino-kong/issue/DIN-35))

| # | Check | How |
|---|---|---|
| 5.10 | `InventoryPanel.tsx` exists | `GET .../components/games/InventoryPanel.tsx` — 200 |
| 5.11 | `CLASS_STARTING_INVENTORY` defined in backend | Fetch `backend/utils/dnd.py`, verify string present |

### 5E: Session Lifecycle ([DIN-8](https://linear.app/dino-kong/issue/DIN-8), [DIN-9](https://linear.app/dino-kong/issue/DIN-9), [DIN-10](https://linear.app/dino-kong/issue/DIN-10))

| # | Check | How |
|---|---|---|
| 5.12 | `GameSessionView.tsx` exists | `GET .../components/games/GameSessionView.tsx` — 200 |
| 5.13 | `StartSessionButton.tsx` exists | `GET .../components/games/StartSessionButton.tsx` — 200 |
| 5.14 | `SessionStatusBanner.tsx` exists | `GET .../components/games/SessionStatusBanner.tsx` — 200 |
| 5.15 | `ConfirmModal.tsx` exists | `GET .../components/games/ConfirmModal.tsx` — 200 |
| 5.16 | Frontend start proxy route exists | `GET .../app/api/games/[gameId]/start/route.ts` — 200 |
| 5.17 | Frontend pause proxy route exists | `GET .../app/api/games/[gameId]/pause/route.ts` — 200 |
| 5.18 | Frontend end proxy route exists | `GET .../app/api/games/[gameId]/end/route.ts` — 200 |
| 5.19 | Frontend resume proxy route exists | `GET .../app/api/games/[gameId]/resume/route.ts` — 200 |

### 5F: Core Game Loop ([DIN-11](https://linear.app/dino-kong/issue/DIN-11), [DIN-12](https://linear.app/dino-kong/issue/DIN-12), [DIN-14](https://linear.app/dino-kong/issue/DIN-14))

| # | Check | How |
|---|---|---|
| 5.20 | `ChatLog.tsx` exists | `GET .../components/games/ChatLog.tsx` — 200 |
| 5.21 | `ChatInput.tsx` exists | `GET .../components/games/ChatInput.tsx` — 200 |
| 5.22 | `ChatMessage.tsx` exists | `GET .../components/games/ChatMessage.tsx` — 200 |
| 5.23 | `TypingIndicator.tsx` exists | `GET .../components/games/TypingIndicator.tsx` — 200 |
| 5.24 | `GameHeader.tsx` exists | `GET .../components/games/GameHeader.tsx` — 200 |
| 5.25 | Frontend actions proxy route exists | `GET .../app/api/games/[gameId]/actions/route.ts` — 200 |
| 5.26 | `lib/types/message.ts` exists | `GET .../lib/types/message.ts` — 200 |
| 5.27 | `lib/validations/action.ts` exists | `GET .../lib/validations/action.ts` — 200 |

### 5G: Backend Services & Infrastructure

| # | Check | How |
|---|---|---|
| 5.28 | `backend/constants.py` exists | `GET .../backend/constants.py` — 200 |
| 5.29 | `backend/services/dm_service.py` exists | `GET .../backend/services/dm_service.py` — 200 |
| 5.30 | `backend/services/embedding_service.py` exists | `GET .../backend/services/embedding_service.py` — 200 |
| 5.31 | `backend/tasks/dm_tasks.py` exists | `GET .../backend/tasks/dm_tasks.py` — 200 |

### 5H: DM Action Suggestions ([DIN-42](https://linear.app/dino-kong/issue/DIN-42))

| # | Check | How |
|---|---|---|
| 5.32 | `ChatInput.tsx` has `cycle-suggestion-btn` testid | Fetch file, grep `cycle-suggestion-btn` |
| 5.33 | `dm_tasks.py` parses `<suggested_actions>` block | Fetch file, grep `suggested_actions` |
| 5.34 | `Game` type includes `suggested_actions` | Fetch `games.ts`, grep `suggested_actions` |

### 5I: Auto-Generate Text Fields ([DIN-63](https://linear.app/dino-kong/issue/DIN-63))

| # | Check | How |
|---|---|---|
| 5.35 | `generate-text/route.ts` exists | `GET .../app/api/generate-text/route.ts` — 200 |
| 5.36 | `CreateGameForm.tsx` has `generate-name-btn` and `generate-persona-btn` | Fetch file, grep testids |
| 5.37 | `CharacterCreationForm.tsx` calls `/api/generate-text` | Fetch file, grep `generate-text` |

### 5J: Edit/Delete Last Player Message ([DIN-61](https://linear.app/dino-kong/issue/DIN-61))

| # | Check | How |
|---|---|---|
| 5.38 | `messages/[messageId]/route.ts` exists (frontend proxy) | `GET .../app/api/games/[gameId]/messages/[messageId]/route.ts` — 200 |
| 5.39 | `backend/api/routes/messages.py` exists | `GET .../backend/api/routes/messages.py` — 200 |
| 5.40 | `ChatMessage.tsx` has `edit-message-btn`, `delete-message-btn`, `save-edit-btn` testids | Fetch file, grep testids |
| 5.41 | `ChatMessage.tsx` does NOT have dead `messageId?:` in interface | Fetch file, grep absent |
| 5.42 | `ChatLog.tsx` does NOT pass `messageId={msg.id}` to ChatMessage | Fetch file, grep absent |

---

## Section 6: Feature-Specific Checks (conditional)

Only run the checks that are relevant to the most recently merged ticket. Claude should determine which section to run based on the ticket number mentioned, or run all if "full smoke test" is requested.

### After [DIN-30](https://linear.app/dino-kong/issue/DIN-30) (proxy / auth guard)
- 2.3, 2.6, 2.7 (auth redirect checks — expect 307)
- 5.1 and 5.2

### After [DIN-33](https://linear.app/dino-kong/issue/DIN-33) (invite flow)
- 3.4 (invite endpoint auth)
- 4.2, 4.6, 4.7, 4.8 (invite table + RPCs)
- 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9

### After [DIN-34](https://linear.app/dino-kong/issue/DIN-34) / [DIN-35](https://linear.app/dino-kong/issue/DIN-35) (inventory)
- 3.10 (inventory endpoint)
- 5.10, 5.11

### After [DIN-8](https://linear.app/dino-kong/issue/DIN-8) (session start + opening narration)
- 3.5 (start endpoint auth)
- 5.12, 5.13, 5.16

### After [DIN-9](https://linear.app/dino-kong/issue/DIN-9) (pause/end session)
- 3.6, 3.7 (pause/end endpoint auth)
- 5.14, 5.15, 5.17, 5.18

### After [DIN-10](https://linear.app/dino-kong/issue/DIN-10) (resume session)
- 3.8 (resume endpoint auth)
- 5.19

### After [DIN-11](https://linear.app/dino-kong/issue/DIN-11) / [DIN-12](https://linear.app/dino-kong/issue/DIN-12) (actions + DM response)
- 3.9 (actions endpoint auth)
- 5.20–5.27

### After [DIN-14](https://linear.app/dino-kong/issue/DIN-14) (chat log)
- 5.20, 5.22

### After [DIN-42](https://linear.app/dino-kong/issue/DIN-42) (DM action suggestions)
- 4.13 (`games.suggested_actions` column)
- 5.32, 5.33, 5.34

### After [DIN-63](https://linear.app/dino-kong/issue/DIN-63) (auto-generate text fields)
- 5.35, 5.36, 5.37

### After [DIN-61](https://linear.app/dino-kong/issue/DIN-61) (edit/delete last player message)
- 3.11, 3.12 (new endpoint auth guards)
- 5.38, 5.39, 5.40, 5.41, 5.42

---

## Output Format

Claude should output results in this format:

```
## Smoke Test Results — Post-Merge DIN-XX
**Date:** YYYY-MM-DD
**Commit:** {sha} — {message}
**Vercel deployment:** {deployment_id} — {status}

### Results
| # | Check | Result | Notes |
|---|---|---|---|
| 1.1 | Latest commit | ✅ | abc1234 — "feat: ..." |
| 2.1 | Vercel deployment ready | ✅ | dpl_xxx |
| ... | ... | ... | ... |

### Summary
✅ X passed | ❌ Y failed | ⏭️ Z skipped

### Failed Checks (if any)
- **2.6:** Expected redirect to /auth/login, got 500
- ...
```

---

## Linear Issue Quick Reference

| ID | Title | Status |
|---|---|---|
| [DIN-6](https://linear.app/dino-kong/issue/DIN-6) | US-09: Starting inventory by class | Done |
| [DIN-8](https://linear.app/dino-kong/issue/DIN-8) | US-11: Start session + opening narration | Done |
| [DIN-9](https://linear.app/dino-kong/issue/DIN-9) | US-12: Pause or end session | Done |
| [DIN-10](https://linear.app/dino-kong/issue/DIN-10) | US-13: Resume paused session | Done |
| [DIN-11](https://linear.app/dino-kong/issue/DIN-11) | US-14: Submit free-text action | Done |
| [DIN-12](https://linear.app/dino-kong/issue/DIN-12) | US-15: Receive AI DM response | Done |
| [DIN-14](https://linear.app/dino-kong/issue/DIN-14) | US-17: Scroll chat log | Done |
| [DIN-17](https://linear.app/dino-kong/issue/DIN-17) | US-01: Sign up via invite link | In Progress |
| [DIN-18](https://linear.app/dino-kong/issue/DIN-18) | US-02: Log in as returning user | Done |
| [DIN-20](https://linear.app/dino-kong/issue/DIN-20) | US-04: Create a new game | Done |
| [DIN-21](https://linear.app/dino-kong/issue/DIN-21) | US-05: View games on dashboard | Done |
| [DIN-30](https://linear.app/dino-kong/issue/DIN-30) | T1+T2: proxy.ts + auth guard | Done |
| [DIN-31](https://linear.app/dino-kong/issue/DIN-31) | T3: Align pending → lobby | Done |
| [DIN-32](https://linear.app/dino-kong/issue/DIN-32) | P1: Magic link login | Backlog |
| [DIN-33](https://linear.app/dino-kong/issue/DIN-33) | T5-T7: Invite creation flow | Done |
| [DIN-34](https://linear.app/dino-kong/issue/DIN-34) | T8+T9: Inventory backend | Done |
| [DIN-35](https://linear.app/dino-kong/issue/DIN-35) | T10: InventoryPanel + lobby | Done |
| [DIN-58](https://linear.app/dino-kong/issue/DIN-58) | Theme game lobby page | Backlog |
| [DIN-42](https://linear.app/dino-kong/issue/DIN-42) | DM action suggestions — ✨ chat input cycling | In Progress |
| [DIN-61](https://linear.app/dino-kong/issue/DIN-61) | Edit/delete last player message | In Progress |
| [DIN-63](https://linear.app/dino-kong/issue/DIN-63) | Auto-generate text fields (game name, DM persona, character name) | In Progress |

---

## Maintenance

When new tables, RPCs, endpoints, or components are added, update this file:
- Section 3: Add new endpoint auth checks
- Section 4: Add new table/column/RPC checks
- Section 5: Add new file existence checks
- Section 6: Add feature-specific checks for the new ticket
- Linear Issue Quick Reference: Add new tickets

**Next.js version:** If the project upgrades Next.js, check whether the file convention has changed. As of Next.js 16, the convention is `proxy.ts` (not `middleware.ts`).
