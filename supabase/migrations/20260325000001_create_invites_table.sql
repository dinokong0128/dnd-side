create table public.invites (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  game_id    uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at    timestamptz
);

alter table public.invites enable row level security;

-- Unauthenticated users must be able to validate a code on the signup page
create policy "Public can read invites by code"
  on public.invites for select using (true);

create policy "Authenticated users can create invites"
  on public.invites for insert
  with check (auth.role() = 'authenticated');
