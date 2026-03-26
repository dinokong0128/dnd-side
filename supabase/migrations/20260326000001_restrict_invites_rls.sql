-- Remove the overly permissive public select policy that allows
-- enumerating all invite codes via the REST API.
drop policy if exists "Public can read invites by code" on public.invites;

-- Create a security-definer RPC function that validates a single code
-- without exposing the table to direct reads. This prevents code enumeration.
create or replace function public.validate_invite_code(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
begin
  select game_id into v_game_id
  from public.invites
  where code = invite_code
    and used_at is null;

  return v_game_id;
end;
$$;
