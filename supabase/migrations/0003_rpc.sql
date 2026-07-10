-- Meet Plus — join-request RPC (Phase 0)
-- SECURITY DEFINER so callers bypass RLS through a controlled, authorized path only.

-- A user asks to join a session. Idempotent: re-requesting resets to 'pending'.
create or replace function public.request_to_join(p_session_id uuid)
returns public.session_participants
language plpgsql
security definer set search_path = public
as $$
declare
  result public.session_participants;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  insert into public.session_participants (session_id, user_id, role, status)
  values (p_session_id, auth.uid(), 'participant', 'pending')
  on conflict (session_id, user_id)
  do update set status = 'pending'
  returning * into result;

  return result;
end;
$$;

-- Host approves a pending participant.
create or replace function public.approve_join_request(p_participant_id uuid)
returns public.session_participants
language plpgsql
security definer set search_path = public
as $$
declare
  result public.session_participants;
begin
  update public.session_participants sp
  set status = 'approved', joined_at = now()
  from public.sessions s
  where sp.id = p_participant_id
    and sp.session_id = s.id
    and s.host_id = auth.uid()
  returning sp.* into result;

  if result.id is null then
    raise exception 'not authorized or participant not found';
  end if;
  return result;
end;
$$;

-- Host rejects a pending participant.
create or replace function public.reject_join_request(p_participant_id uuid)
returns public.session_participants
language plpgsql
security definer set search_path = public
as $$
declare
  result public.session_participants;
begin
  update public.session_participants sp
  set status = 'rejected'
  from public.sessions s
  where sp.id = p_participant_id
    and sp.session_id = s.id
    and s.host_id = auth.uid()
  returning sp.* into result;

  if result.id is null then
    raise exception 'not authorized or participant not found';
  end if;
  return result;
end;
$$;

-- Host directly invites a user (by id) as an approved participant.
create or replace function public.invite_participant(p_session_id uuid, p_user_id uuid)
returns public.session_participants
language plpgsql
security definer set search_path = public
as $$
declare
  result public.session_participants;
begin
  if not exists (
    select 1 from public.sessions s where s.id = p_session_id and s.host_id = auth.uid()
  ) then
    raise exception 'not authorized: only the host may invite';
  end if;

  insert into public.session_participants (session_id, user_id, role, status, joined_at)
  values (p_session_id, p_user_id, 'participant', 'approved', now())
  on conflict (session_id, user_id)
  do update set status = 'approved'
  returning * into result;

  return result;
end;
$$;

revoke all on function public.request_to_join(uuid) from public;
revoke all on function public.approve_join_request(uuid) from public;
revoke all on function public.reject_join_request(uuid) from public;
revoke all on function public.invite_participant(uuid, uuid) from public;

grant execute on function public.request_to_join(uuid) to authenticated;
grant execute on function public.approve_join_request(uuid) to authenticated;
grant execute on function public.reject_join_request(uuid) to authenticated;
grant execute on function public.invite_participant(uuid, uuid) to authenticated;
