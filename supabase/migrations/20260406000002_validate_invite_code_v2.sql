create or replace function public.validate_invite_code_v2(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  select game_id, used_at into v_invite
  from public.invites
  where code = invite_code;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_invite.used_at is not null then
    return jsonb_build_object('status', 'used');
  end if;

  return jsonb_build_object('status', 'valid', 'game_id', v_invite.game_id);
end;
$$;
