-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "vector" with schema extensions;

-- ============================================================
-- ENUMS
-- ============================================================
do $$ begin
  create type public.game_status as enum ('lobby', 'active', 'paused', 'ended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.player_status as enum ('active', 'dead', 'inactive');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.message_role as enum ('player', 'dm', 'system');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.event_source as enum ('claude', 'player');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- TABLES
-- ============================================================

-- profiles: shadow table extending auth.users 1:1
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- games: a campaign/session
create table if not exists public.games (
  id          uuid primary key default extensions.uuid_generate_v4(),
  name        text not null,
  dm_persona  text not null default 'You are a creative and engaging Dungeon Master.',
  status      public.game_status not null default 'lobby',
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- players: profile <-> game join table with character state
create table if not exists public.players (
  id               uuid primary key default extensions.uuid_generate_v4(),
  game_id          uuid not null references public.games(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  character_name   text not null,
  character_class  text not null,
  hp_current       int not null default 10,
  hp_max           int not null default 10,
  stats            jsonb not null default '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  status           public.player_status not null default 'active',
  joined_at        timestamptz not null default now(),
  unique(game_id, profile_id)
);

-- player_inventory: items per player
create table if not exists public.player_inventory (
  id          uuid primary key default extensions.uuid_generate_v4(),
  player_id   uuid not null references public.players(id) on delete cascade,
  item_name   text not null,
  quantity    int not null default 1,
  properties  jsonb,
  created_at  timestamptz not null default now()
);

-- game_messages: chat log + realtime broadcast source
create table if not exists public.game_messages (
  id          uuid primary key default extensions.uuid_generate_v4(),
  game_id     uuid not null references public.games(id) on delete cascade,
  role        public.message_role not null,
  profile_id  uuid references public.profiles(id),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- game_events: structured narrative events with pgvector embeddings (Claude's long-term memory)
create table if not exists public.game_events (
  id          uuid primary key default extensions.uuid_generate_v4(),
  game_id     uuid not null references public.games(id) on delete cascade,
  event_type  text not null,
  summary     text not null,
  embedding   vector(1536),
  source      public.event_source not null default 'claude',
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Foreign key indexes (Postgres doesn't auto-create these)
create index if not exists players_game_id_idx           on public.players(game_id);
create index if not exists players_profile_id_idx        on public.players(profile_id);
create index if not exists player_inventory_player_id_idx on public.player_inventory(player_id);
create index if not exists game_messages_game_id_idx     on public.game_messages(game_id);
create index if not exists game_events_game_id_idx       on public.game_events(game_id);

-- Chronological message fetch (most common query pattern)
create index if not exists game_messages_game_id_created_at_idx on public.game_messages(game_id, created_at);

-- pgvector: HNSW index for approximate nearest-neighbour search on embeddings
-- cosine distance (<=>) suits normalised text embeddings
create index if not exists game_events_embedding_hnsw_idx on public.game_events
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    -- Prefer explicit username from metadata; fall back to email local-part + first 8 chars
    -- of the user UUID to guarantee uniqueness (e.g. alex_a1b2c3d4 vs alex_e5f6g7h8).
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      split_part(new.email, '@', 1) || '_' || substr(replace(new.id::text, '-', ''), 1, 8)
    )
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep games.updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger games_set_updated_at
  before update on public.games
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles         enable row level security;
alter table public.games            enable row level security;
alter table public.players          enable row level security;
alter table public.player_inventory enable row level security;
alter table public.game_messages    enable row level security;
alter table public.game_events      enable row level security;

-- profiles: read own, update own
drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: read own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);

-- games: any authenticated user can read and create; only creator can update/delete
drop policy if exists "games: read all"   on public.games;
drop policy if exists "games: insert own" on public.games;
drop policy if exists "games: update own" on public.games;
drop policy if exists "games: delete own" on public.games;
create policy "games: read all"   on public.games for select using (auth.role() = 'authenticated');
create policy "games: insert own" on public.games for insert with check (auth.uid() = created_by);
create policy "games: update own" on public.games for update using (auth.uid() = created_by);
create policy "games: delete own" on public.games for delete using (auth.uid() = created_by);

-- players: readable by all players in the same game; insert/update own row
drop policy if exists "players: read game members" on public.players;
drop policy if exists "players: insert own"        on public.players;
drop policy if exists "players: update own"        on public.players;
create policy "players: read game members" on public.players for select
  using (
    exists (
      select 1 from public.players p2
      where p2.game_id = players.game_id
        and p2.profile_id = auth.uid()
    )
  );
create policy "players: insert own" on public.players for insert with check (auth.uid() = profile_id);
create policy "players: update own" on public.players for update using (auth.uid() = profile_id);

-- player_inventory: readable/writable by the owning player only
drop policy if exists "inventory: own player" on public.player_inventory;
create policy "inventory: own player" on public.player_inventory for all
  using (
    exists (
      select 1 from public.players p
      where p.id = player_inventory.player_id
        and p.profile_id = auth.uid()
    )
  );

-- game_messages: readable by all players in the game
-- Insert is split by role:
--   • Players may only insert their own messages (role='player', profile_id = caller)
--   • DM / system messages are written by the FastAPI backend via the service role,
--     which bypasses RLS entirely — no insert policy is created for those roles.
drop policy if exists "messages: read game"           on public.game_messages;
drop policy if exists "messages: insert game member"  on public.game_messages;
drop policy if exists "messages: insert player"       on public.game_messages;
create policy "messages: read game" on public.game_messages for select
  using (
    exists (
      select 1 from public.players p
      where p.game_id = game_messages.game_id
        and p.profile_id = auth.uid()
    )
  );
-- Players can only post as themselves with role = 'player'
create policy "messages: insert player" on public.game_messages for insert
  with check (
    role = 'player'
    and profile_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.game_id = game_messages.game_id
        and p.profile_id = auth.uid()
    )
  );

-- game_events: readable by game members; inserts via service role only (no insert policy)
drop policy if exists "events: read game" on public.game_events;
create policy "events: read game" on public.game_events for select
  using (
    exists (
      select 1 from public.players p
      where p.game_id = game_events.game_id
        and p.profile_id = auth.uid()
    )
  );
