-- RPC to mark an invite code as used after successful signup.
-- Uses security definer (same pattern as validate_invite_code)
-- so it works even for users who just signed up and don't have
-- RLS permissions on the invites table yet.
create or replace function public.mark_invite_used(p_invite_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invites
  set used_at = now()
  where code = p_invite_code
    and used_at is null;
end;
$$;
