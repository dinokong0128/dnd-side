# D&D App — Data Model Reference

**Supabase project:** `ytxncykyfbhoyvxkocrs`
**Migrations:** `supabase/migrations/`
**Last Updated:** April 17, 2026

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
| `suggested_actions` | `text[]` | nullable | Cache of Claude's most recent `<suggested_actions>` block (DIN-42) — refreshed after each DM response |

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
| `race` | `text` | NOT NULL DEFAULT `'Human'` | e.g. `Human`, `Elf`, `Dwarf` |
| `level` | `int` | NOT NULL DEFAULT `1` | 1–20; enforced by `players_level_range` CHECK constraint |
| `hp_current` | `int` | NOT NULL DEFAULT `10` | |
| `hp_max` | `int` | NOT NULL DEFAULT `10` | |
| `stats` | `jsonb` | NOT NULL DEFAULT `{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}` | See "JSONB shape" below |
| `status` | `public.player_status` | NOT NULL DEFAULT `'active'` | |
| `joined_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |
| — | UNIQUE | `(game_id, profile_id)` | One character per profile per game |

**`stats` JSONB shape.** Six ability scores are always present. Epic-7 (Character State) and Epic-8 (Combat) optionally add keys inside this JSONB — schema doesn't change, but the frontend `Player` type (in `lib/types/player.ts`) permits:

```jsonc
{
  "str": 13, "dex": 17, "con": 14, "int": 10, "wis": 14, "cha": 12,
  "xp": 1250,                                                // DIN-28
  "spell_slots": {                                           // DIN-27
    "1": { "max": 4, "used": 1 },
    "2": { "max": 3, "used": 0 },
    "3": { "max": 2, "used": 0 }
  },
  "cantrips": ["Fire Bolt", "Mage Hand"]                     // DIN-27
}
```

**IMPORTANT — Python key access:** `stats["int"]` as dict key, never `stats.int` or `**stats` — `int` is a Python built-in and will shadow / collide.

**RLS:**
- `select`: players in the same game (fixed in `20260407000002_fix_players_rls_recursion.sql` to avoid infinite recursion)
- `insert`: own row only (`auth.uid() = profile_id`)
- `update`: own row only

**Note:** `race` and `level` are required by all Claude DM prompt templates — they appear in the party roster injected into every system prompt.

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
| — | UNIQUE | `(player_id, item_name)` | Added in `20260414120000_player_inventory_unique_constraint.sql` — prevents duplicate item rows; quantity is incremented instead |

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
| `content` | `text` | NOT NULL | Display text — all structured blocks (`<event>`, `<state_changes>`, `<dice_rolls>`, `<suggested_actions>`) stripped out |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |
| `dice_rolls` | `jsonb` | nullable | Array of dice roll events (DIN-24) — see "DiceRollEvent" shape in `frontend/src/lib/types/message.ts` |

**`dice_rolls` JSONB shape:**

```jsonc
[
  {
    "type": "dice_roll",
    "die": "d20",
    "count": 1,
    "result": 14,
    "modifier": 3,
    "total": 17,
    "label": "Stealth Check",
    "dc": 15,
    "success": true,
    "advantage": true,
    "all_rolls": [14, 8]
  }
]
```

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
| `event_type` | `text` | NOT NULL | e.g. `combat`, `discovery`, `dialogue`, `death`, `milestone` |
| `summary` | `text` | NOT NULL | Human-readable event description (also the embedded text) |
| `embedding` | `vector(1536)` | nullable | OpenAI `text-embedding-3-small` output |
| `source` | `public.event_source` | NOT NULL DEFAULT `'claude'` | `claude` = auto-extracted from DM response; `player` = manually confirmed |
| `metadata` | `jsonb` | nullable | Extra context (location, involved players, items, etc.) |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |

**Insert path:** Server-side only via `SUPABASE_SERVICE_ROLE_KEY`, from `dm_bookkeeping_task` after the SSE stream completes. No insert RLS policy — anon/user key cannot write events.

**RLS:**
- `select`: players in the same game
- No `insert`/`update`/`delete` policy — service role bypasses RLS

---

### `invites`
One-time invite codes that gate signup to specific games.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT `gen_random_uuid()` | |
| `code` | `text` | NOT NULL UNIQUE | Randomly generated invite code |
| `game_id` | `uuid` | NOT NULL FK → `games(id)` ON DELETE CASCADE | |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |
| `used_at` | `timestamptz` | nullable | Set when invite is consumed at signup |

**RLS** (tightened in `20260326000001_restrict_invites_rls.sql`):
- Direct reads restricted — validation happens via the `validate_invite_code` RPC (security definer)
- `insert`: authenticated users only

**Usage flow:** Host generates invite → code sent via link → player lands on signup with `?invite_code=...` → frontend calls `validate_invite_code` RPC → on signup success, invite marked used via `mark_invite_used` RPC.

---

### `secrets`
Server-side credentials accessed only via the Supabase service role key (used by tooling / Claude agent workflows, not by application code at runtime).

| Column | Type | Notes |
|---|---|---|
| `key` | `text` | e.g. `github_pat_dnd`, `render_api_key`, `anthropic_api_key`, `openai_api_key` |
| `value` | `text` | Secret value |

No RLS select policy — only the service role can read.

---

## Indexes

| Index | Table | Columns | Type | Purpose |
|---|---|---|---|---|
| `players_game_id_idx` | `players` | `game_id` | btree | FK lookup |
| `players_profile_id_idx` | `players` | `profile_id` | btree | FK lookup |
| `player_inventory_player_id_idx` | `player_inventory` | `player_id` | btree | FK lookup |
| `player_inventory_player_item_unique` | `player_inventory` | `(player_id, item_name)` | UNIQUE btree | Prevents duplicate item rows per player |
| `game_messages_game_id_idx` | `game_messages` | `game_id` | btree | FK lookup |
| `game_events_game_id_idx` | `game_events` | `game_id` | btree | FK lookup |
| `game_messages_game_id_created_at_idx` | `game_messages` | `(game_id, created_at)` | btree | Chronological message fetch (paginated chat, DIN-62) |
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

### `match_game_events(p_game_id, p_embedding, p_top_k)` → RPC
- **Purpose:** Cosine similarity search on `game_events.embedding` for RAG context retrieval.
- **Called from:** `dm_service.search_rag()` in the FastAPI backend (in the `POST /actions` background coroutine).
- **Operator:** `<=>` (pgvector cosine distance), ascending order (lowest distance = most similar).
- **Returns:** Top `p_top_k` events for the given `p_game_id`, ordered by similarity.

### `validate_invite_code(p_code)` and `validate_invite_code_v2(p_code)` → RPCs
- **Purpose:** Validate that an invite code exists and has not been used (`used_at IS NULL`).
- `v2` returns structured JSONB (`status`, `game_id`, `game_name`) instead of a raw row.
- **Called from:** Frontend signup flow before showing the signup form.

### `mark_invite_used(p_code)` → RPC
- **Purpose:** Sets `used_at = now()` on an invite after successful signup.
- **Called from:** Backend after user creation succeeds.

---

## Migrations (Applied)

| Migration | Description |
|---|---|
| `20260322155519_initial_schema.sql` | All core tables, enums, indexes, triggers |
| `20260325000001_create_invites_table.sql` | `invites` table + RLS policies |
| `20260326000001_restrict_invites_rls.sql` | Tightened invite RLS (restricted direct reads) |
| `20260326000002_match_game_events_fn.sql` | `match_game_events` RPC for RAG |
| `20260405000001_mark_invite_used.sql` | `mark_invite_used` RPC |
| `20260406000002_validate_invite_code_v2.sql` | `validate_invite_code` RPC (v2, structured JSONB) |
| `20260407000001_add_race_level_to_players.sql` | `race` (text) + `level` (int 1–20) columns on `players` |
| `20260407000002_fix_players_rls_recursion.sql` | Fixed infinite-recursion bug in `players` select policy |
| `20260413000001_add_suggested_actions_to_games.sql` | `games.suggested_actions text[]` (DIN-42) |
| `20260414000001_add_dice_rolls_to_game_messages.sql` | `game_messages.dice_rolls jsonb` (DIN-24) |
| `20260414120000_player_inventory_unique_constraint.sql` | `UNIQUE (player_id, item_name)` on `player_inventory` |

---

## Key Notes

- **Embedding dimensions:** 1536 — matches OpenAI `text-embedding-3-small`. Do not change without re-embedding all existing events.
- **Cosine similarity:** Use the `<=>` operator for RAG queries: `ORDER BY embedding <=> $1 LIMIT 5`.
- **Service role key:** Required for all `game_events` writes and DM `game_messages` inserts. Never expose in `NEXT_PUBLIC_` env vars.
- **Storage estimate:** ~6 KB per embedding vector → 1,000 events ≈ 6 MB (well within Supabase free tier 500 MB).
- **`race` + `level` in prompts:** Both columns are injected into every Claude system prompt in `dm_service.build_dm_system_prompt()` as part of the party roster.
- **JSONB growth path:** New Epic-7 / Epic-8 / Epic-9 state (conditions, skill proficiencies, inspiration, rests) will extend the `players.stats` JSONB rather than adding columns — check the frontend `Player` type in `lib/types/player.ts` for the current shape.
