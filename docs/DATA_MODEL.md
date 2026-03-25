# D&D App — Data Model Reference

**Supabase project:** `ytxncykyfbhoyvxkocrs`
**Migration:** `supabase/migrations/20260322155519_initial_schema.sql`

---

## Extensions

| Extension | Schema | Purpose |
|---|---|---|
| `uuid-ossp` | `extensions` | UUID generation (`uuid_generate_v4()`) |
| `pgcrypto` | `extensions` | Cryptographic functions |
| `vector` (pgvector v0.8.0) | `extensions` | `vector(1536)` type + HNSW index for similarity search |

---

## Enums

| Enum | Values |
|---|---|
| `public.game_status` | `lobby`, `active`, `paused`, `ended` |
| `public.player_status` | `active`, `dead`, `inactive` |
| `public.message_role` | `player`, `dm`, `system` |
| `public.event_source` | `claude`, `player` |

---

## Tables

### `profiles`
Extends `auth.users` 1:1. Auto-created on signup via trigger.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE | Same as Supabase auth user ID |
| `username` | `text` | UNIQUE NOT NULL | Defaults to email prefix if not provided at signup |
| `avatar_url` | `text` | nullable | |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |

**RLS:**
- `select`: own row only (`auth.uid() = id`)
- `update`: own row only (`auth.uid() = id`)
- No insert policy — row created by `handle_new_user` trigger (security definer)

---

### `games`
A campaign or session. One creator, multiple players.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT `uuid_generate_v4()` | |
| `name` | `text` | NOT NULL | Display name of the game |
| `dm_persona` | `text` | NOT NULL DEFAULT `'You are a creative and engaging Dungeon Master.'` | System prompt fragment for Claude |
| `status` | `public.game_status` | NOT NULL DEFAULT `'lobby'` | `lobby` → `active` → `paused`/`ended` |
| `created_by` | `uuid` | NOT NULL FK → `profiles(id)` | Game creator |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT `now()` | Auto-updated by `games_set_updated_at` trigger |

**RLS:**
- `select`: any authenticated user
- `insert`: creator only (`auth.uid() = created_by`)
- `update`: creator only
- `delete`: creator only

---

### `players`
Join table between `profiles` and `games`, storing character state.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT `uuid_generate_v4()` | |
| `game_id` | `uuid` | NOT NULL FK → `games(id)` ON DELETE CASCADE | |
| `profile_id` | `uuid` | NOT NULL FK → `profiles(id)` ON DELETE CASCADE | |
| `character_name` | `text` | NOT NULL | |
| `character_class` | `text` | NOT NULL | e.g. `Fighter`, `Wizard` |
| `hp_current` | `int` | NOT NULL DEFAULT `10` | |
| `hp_max` | `int` | NOT NULL DEFAULT `10` | |
| `stats` | `jsonb` | NOT NULL DEFAULT `{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}` | Full ability score block |
| `status` | `public.player_status` | NOT NULL DEFAULT `'active'` | |
| `joined_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |
| — | UNIQUE | `(game_id, profile_id)` | One character per profile per game |

**RLS:**
- `select`: players in the same game (`exists` check on `players` table)
- `insert`: own row only (`auth.uid() = profile_id`)
- `update`: own row only

---

### `player_inventory`
Items held by a player character.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT `uuid_generate_v4()` | |
| `player_id` | `uuid` | NOT NULL FK → `players(id)` ON DELETE CASCADE | |
| `item_name` | `text` | NOT NULL | |
| `quantity` | `int` | NOT NULL DEFAULT `1` | |
| `properties` | `jsonb` | nullable | Arbitrary item attributes (damage, weight, magic, etc.) |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |

**RLS:**
- `all` operations: owning player only (join to `players` → `profile_id = auth.uid()`)

---

### `game_messages`
Chat log and Supabase Realtime broadcast source.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT `uuid_generate_v4()` | |
| `game_id` | `uuid` | NOT NULL FK → `games(id)` ON DELETE CASCADE | |
| `role` | `public.message_role` | NOT NULL | `player`, `dm`, or `system` |
| `profile_id` | `uuid` | nullable FK → `profiles(id)` | null for `dm`/`system` messages |
| `content` | `text` | NOT NULL | Raw message text (DM responses have events stripped out) |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |

**Realtime:** Supabase broadcasts Postgres Changes on this table. Frontend subscribes per `game_id`.

**RLS:**
- `select`: players in the same game
- `insert`: players in the same game (anon key allowed for player + system messages; DM messages inserted server-side with service role key)

---

### `game_events`
Structured narrative events with pgvector embeddings — Claude's long-term memory (RAG source).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT `uuid_generate_v4()` | |
| `game_id` | `uuid` | NOT NULL FK → `games(id)` ON DELETE CASCADE | |
| `event_type` | `text` | NOT NULL | e.g. `combat`, `discovery`, `npc_interaction` |
| `summary` | `text` | NOT NULL | Human-readable event description (also the embedded text) |
| `embedding` | `vector(1536)` | nullable | OpenAI `text-embedding-3-small` output |
| `source` | `public.event_source` | NOT NULL DEFAULT `'claude'` | `claude` = auto-extracted from DM response; `player` = manually confirmed |
| `metadata` | `jsonb` | nullable | Extra context (location, involved players, items, etc.) |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |

**Insert path:** Server-side only via `SUPABASE_SERVICE_ROLE_KEY`. No insert RLS policy — anon/user key cannot write events.

**RLS:**
- `select`: players in the same game
- No `insert`/`update`/`delete` policy — service role bypasses RLS

---

## Indexes

| Index | Table | Columns | Type | Purpose |
|---|---|---|---|---|
| `players_game_id_idx` | `players` | `game_id` | btree | FK lookup |
| `players_profile_id_idx` | `players` | `profile_id` | btree | FK lookup |
| `player_inventory_player_id_idx` | `player_inventory` | `player_id` | btree | FK lookup |
| `game_messages_game_id_idx` | `game_messages` | `game_id` | btree | FK lookup |
| `game_events_game_id_idx` | `game_events` | `game_id` | btree | FK lookup |
| `game_messages_game_id_created_at_idx` | `game_messages` | `(game_id, created_at)` | btree | Chronological message fetch |
| `game_events_embedding_hnsw_idx` | `game_events` | `embedding` | HNSW (`vector_cosine_ops`) | ANN similarity search (m=16, ef_construction=64) |

---

## Triggers & Functions

### `handle_new_user` → `on_auth_user_created`
- **Table:** `auth.users` (AFTER INSERT)
- **Action:** Inserts a `profiles` row using `new.id` and username from `raw_user_meta_data`, falling back to the email prefix.
- **Security:** `SECURITY DEFINER` — runs as the function owner, bypassing RLS on `profiles`.

### `set_updated_at` → `games_set_updated_at`
- **Table:** `public.games` (BEFORE UPDATE)
- **Action:** Sets `new.updated_at = now()` on every update.

---

## Key Notes

- **Embedding dimensions:** 1536 — matches OpenAI `text-embedding-3-small`. Do not change without re-embedding all existing events.
- **Cosine similarity:** Use the `<=>` operator for RAG queries: `ORDER BY embedding <=> $1 LIMIT 10`.
- **Service role key:** Required for all `game_events` writes and DM `game_messages` inserts. Never expose in `NEXT_PUBLIC_` env vars.
- **Storage estimate:** ~6 KB per embedding vector → 1,000 events ≈ 6 MB (well within Supabase free tier 500 MB).
