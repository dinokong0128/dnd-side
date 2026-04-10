# TDD Skeleton Workflow

**When to use:** Whenever a Linear issue is provided *before* implementation begins, produce the three artifacts below before writing any production code.

---

## Three Output Artifacts

1. **Spec doc** — a short markdown block (can be inline) listing: acceptance criteria mapped from the Linear issue, the layer(s) being touched, and the mocking boundary for each layer.
2. **Failing test stubs** — files that import the not-yet-existing code and contain `it.todo(...)` / `pytest.mark.skip` placeholders. The suite must be runnable and fail (not error) immediately.
3. **Implementation scaffold** — the minimum file stubs (empty functions, empty route handlers, empty Pydantic models) needed for the test stubs to import without crashing.

Produce all three before any real implementation. Only then fill in logic.

---

## Test File Placement

All frontend tests live in a `__tests__/` subdirectory adjacent to the module they test. Never co-locate `.test.tsx` files next to source files.

| What you are testing | Test file location |
|---|---|
| React component in `src/components/{category}/` | `src/components/{category}/__tests__/{Component}.test.tsx` |
| Next.js page in `src/app/{route}/` | `src/app/{route}/__tests__/page.test.tsx` |
| Top-level module (e.g. `proxy.ts`) | `src/__tests__/{module}.test.ts` |
| Supabase lib helper in `src/lib/supabase/` | `src/lib/supabase/__tests__/{module}.test.ts` |
| FastAPI route / service / task | `backend/tests/test_{module}.py` (flat, no nesting) |

---

## Layer 1 — React Component

**Tool:** Jest + React Testing Library (`testEnvironment: jsdom` — default)
**File:** `src/components/{category}/__tests__/{Component}.test.tsx`

**Mocking rules:**
- Components call Next.js API routes via `fetch` — not Supabase directly. Mock `global.fetch`:
  ```ts
  const mockFetch = jest.fn()
  global.fetch = mockFetch
  ```
- Mock `next/navigation` when the component uses `useRouter`, `useParams`, etc.:
  ```ts
  const mockPush = jest.fn()
  jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
  }))
  ```
- Clear all mocks in `beforeEach(() => { jest.clearAllMocks() })`.
- Never mock `@/lib/supabase` in component tests — components must not call Supabase directly (architecture violation if they do).

**Test shapes to cover:**
- Renders without crashing (smoke)
- Renders correct UI given mocked `fetch` response data
- Calls `fetch` with the correct URL, method, and body on user interaction
- Displays error state when `fetch` resolves with `{ ok: false }`
- Displays error state when `fetch` rejects (network error)

---

## Layer 2 — Next.js API Route (Proxy Layer)

**Tool:** Jest (`@jest-environment node` directive required — web `Request`/`Response` globals are unavailable in jsdom)
**File:** `src/__tests__/{module}.test.ts` for top-level modules; `src/app/api/{route}/__tests__/route.test.ts` for nested routes

**Mocking rules:**
- Mock `@supabase/ssr`'s `createServerClient` to control auth state:
  ```ts
  const mockGetUser = jest.fn()
  jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(() => ({
      auth: { getUser: mockGetUser },
    })),
  }))
  ```
- Mock `global.fetch` to simulate FastAPI responses — never make real HTTP calls.
- Always add `/** @jest-environment node */` at the top of the file.

**Test shapes to cover:**
- `200` — valid session + FastAPI succeeds; response shape forwarded correctly
- `307` — no valid session on a protected route; redirects to `/auth/login`
- `400` — Zod rejects malformed request body before proxying
- `500` — FastAPI returns 5xx; proxy surfaces a safe error message

---

## Layer 3 — Supabase Lib Helper

**Tool:** Jest (`testEnvironment: jsdom` — default)
**File:** `src/lib/supabase/__tests__/{module}.test.ts`

These are the only frontend files that call Supabase directly. Test them in isolation from the components and routes that consume them.

**Mocking rules:**
- Mock `@/lib/supabase/server` (the server client factory), not the raw `@supabase/ssr` package:
  ```ts
  const mockFrom = jest.fn()
  jest.mock('@/lib/supabase/server', () => ({
    createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
  }))
  ```
- Chain mock return values to match the Supabase query builder pattern (e.g. `.select().eq().order()`).
- Clear all mocks in `beforeEach(() => { jest.clearAllMocks() })`.

**Test shapes to cover:**
- Returns correct data on success
- Calls `from(...)`, `select(...)`, and filter methods with the correct arguments
- Returns empty array / `null` when `data` is `null`
- Throws with a descriptive message on Supabase error

---

## Layer 4 — FastAPI Endpoint

**Tool:** pytest + `fastapi.testclient.TestClient`
**File:** `backend/tests/test_{route_module}.py`

**Mocking rules:**
- Use the shared `conftest.py` fixtures — do not re-declare them per file:
  - `client` — `TestClient` with `get_current_user` dependency overridden and `config.supabase_client` mocked
  - `unauthed_client` — `TestClient` with no auth override
  - `mock_supabase` — patches `config.supabase_client`
  - `mock_anthropic` — patches `config.anthropic_client`
  - `mock_openai` — patches `config.openai_client`
- Chain mock return values on `mock_supabase.table.return_value` to match Supabase query builder calls.
- Never hit a real database or external service.

**Test shapes to cover:**
- Happy path — correct payload → correct `mock_supabase.table(...)` calls → expected response shape and status
- Auth failure — `unauthed_client` with no token → 401
- Validation failure — malformed request body → 422 (Pydantic)
- Service error — `mock_supabase` raises → endpoint returns 500 with safe message

---

## Layer 5 — Dramatiq Task

**Tool:** pytest
**File:** `backend/tests/test_dm_tasks.py`

Dramatiq actors import config clients at module load time. Guard against real client initialization with a module-level `with patch(...)` block **before** the import statement.

**Mocking rules:**
- Patch all config clients at module level before importing the task module:
  ```python
  from unittest.mock import MagicMock, patch

  with patch("config.supabase_client", MagicMock()), \
       patch("config.anthropic_client", MagicMock()), \
       patch("config.openai_client", MagicMock()), \
       patch("redis_broker.redis_broker", MagicMock()), \
       patch("redis_broker.redis_client", MagicMock()):
      from tasks.dm_tasks import my_task
  ```
- Inside each test, use a fresh `with patch("config.supabase_client") as mock_sb` block — do not reuse the module-level MagicMock instances.
- Call tasks directly via `.fn(...)` to bypass the Dramatiq broker (no Redis connection needed):
  ```python
  my_task.fn("game-id", ...)
  ```
- Use a `table_side_effect` function to route `mock_sb.table(name)` calls to per-table mocks.
- Never use a real Redis connection, real DB, or real external API.

**Test shapes to cover:**
- Task completes; assert `mock_sb.table("game_messages").insert(...)` called with correct payload
- Claude response contains `<event>` markers; assert events extracted and `mock_sb.table("game_events").insert(...)` called
- Claude response contains `<event>` markers; assert display message has tags stripped before insert
- Task raises on fatal error; assert the exception propagates so Dramatiq can retry

---

## Summary Table

| Layer | Test Tool | File Location | Key Mock |
|---|---|---|---|
| React component | Jest + RTL (jsdom) | `src/components/{cat}/__tests__/{Component}.test.tsx` | `global.fetch` for API route calls |
| Next.js API route | Jest (node env) | `src/__tests__/{module}.test.ts` or `src/app/api/{route}/__tests__/route.test.ts` | `@supabase/ssr` `createServerClient` + `global.fetch` |
| Supabase lib helper | Jest (jsdom) | `src/lib/supabase/__tests__/{module}.test.ts` | `@/lib/supabase/server` `createClient` |
| FastAPI endpoint | pytest + TestClient | `backend/tests/test_{route_module}.py` | `conftest.py` fixtures (`client`, `mock_supabase`, etc.) |
| Dramatiq task | pytest | `backend/tests/test_dm_tasks.py` | Module-level `with patch(...)` guard + per-test patches |

