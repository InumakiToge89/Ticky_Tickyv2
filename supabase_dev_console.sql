-- =============================================================
-- TICKY TICKY — PRIVATE DEVELOPER CONSOLE
-- =============================================================
-- Run this ONCE in Supabase SQL Editor.
--
-- The migration creates:
--   1. A frozen dev_owners list. It captures the current ADMIN
--      profile whose name is Ivee so access is not based only on
--      a mutable display name in the browser.
--   2. Analyst change requests.
--   3. Security-definer RPCs used by the Developer Console.
--
-- IMPORTANT:
-- This console intentionally does NOT expose auth.users passwords,
-- sessions, or storage objects. Account authentication remains under
-- Supabase Auth.
-- =============================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- PRIVATE OWNER LIST
-- -------------------------------------------------------------

create table if not exists public.dev_owners (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

-- Capture the existing ADMIN account named Ivee.
insert into public.dev_owners (user_id)
select p.id
from public.profiles p
where upper(trim(coalesce(p.full_name, ''))) = 'IVEE'
  and upper(trim(coalesce(p.role, ''))) = 'ADMIN'
  and upper(trim(coalesce(p.status, ''))) = 'ACTIVE'
  and not exists (
      select 1
      from public.dev_owners d
      where d.user_id = p.id
  );

alter table public.dev_owners enable row level security;

drop policy if exists "dev owners are not directly readable" on public.dev_owners;
create policy "dev owners are not directly readable"
on public.dev_owners
for all
to authenticated
using (false)
with check (false);

-- -------------------------------------------------------------
-- OWNER CHECK
-- -------------------------------------------------------------

create or replace function public.is_dev_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1
        from public.dev_owners
        where user_id = auth.uid()
    );
$$;

revoke all on function public.is_dev_owner() from public;
grant execute on function public.is_dev_owner() to authenticated;

-- -------------------------------------------------------------
-- CHANGE REQUESTS
-- -------------------------------------------------------------

create table if not exists public.dev_change_requests (
    id uuid primary key default gen_random_uuid(),
    requester_id uuid not null references auth.users(id) on delete cascade,
    target_table text not null,
    target_record_id text,
    action text not null check (action in ('UPDATE', 'DELETE')),
    requested_change text not null default '',
    reason text not null default '',
    status text not null default 'PENDING'
        check (status in ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED')),
    reviewer_id uuid references auth.users(id) on delete set null,
    reviewer_note text,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists dev_change_requests_status_idx
on public.dev_change_requests(status, created_at desc);

create index if not exists dev_change_requests_requester_idx
on public.dev_change_requests(requester_id, created_at desc);

alter table public.dev_change_requests enable row level security;

drop policy if exists "requesters can view own developer requests" on public.dev_change_requests;
create policy "requesters can view own developer requests"
on public.dev_change_requests
for select
to authenticated
using (requester_id = auth.uid());

drop policy if exists "requesters can create developer requests" on public.dev_change_requests;
create policy "requesters can create developer requests"
on public.dev_change_requests
for insert
to authenticated
with check (requester_id = auth.uid());

-- No direct update/delete policy is granted to ordinary users.
-- The owner-side RPC handles review changes.

-- -------------------------------------------------------------
-- SHARED TABLE WHITELIST
-- -------------------------------------------------------------

create or replace function public.dev_table_allowed(p_table text)
returns boolean
language sql
immutable
as $$
    select p_table in (
        'profiles',
        'teams',
        'profiling_jobs',
        'timer_sessions',
        'timer_events',
        'task_logs',
        'task_activity_events',
        'manual_time_requests',
        'app_notifications'
    );
$$;

create or replace function public.dev_editable_column_allowed(
    p_table text,
    p_column text
)
returns boolean
language sql
immutable
as $$
    select case p_table
        when 'profiles' then p_column in ('full_name', 'employee_code', 'role', 'status')
        when 'teams' then p_column in ('team_id', 'team_name', 'no_of_members', 'status')
        when 'profiling_jobs' then p_column in ('analyst_id', 'team_id', 'team_name', 'member_count', 'status', 'started_at', 'finished_at', 'total_seconds')
        when 'timer_sessions' then p_column in ('profiling_job_id', 'status', 'started_at', 'stopped_at', 'total_seconds')
        when 'timer_events' then p_column in ('session_id', 'event_type', 'event_time')
        when 'task_logs' then p_column in ('analyst_id', 'category', 'task_name', 'started_at', 'ended_at', 'duration_seconds', 'manual_duration_seconds', 'live_duration_seconds', 'duration_source', 'justification')
        when 'task_activity_events' then p_column in ('task_log_id', 'event_type', 'event_time')
        when 'manual_time_requests' then p_column in ('analyst_id', 'assigned_admin_id', 'task_name', 'started_at', 'ended_at', 'duration_seconds', 'justification', 'status', 'reviewed_by', 'reviewed_at', 'rejection_reason')
        when 'app_notifications' then p_column in ('recipient_id', 'type', 'title', 'message', 'reference_id', 'is_read', 'read_at')
        else false
    end;
$$;

-- -------------------------------------------------------------
-- LIST RECORDS
-- -------------------------------------------------------------

create or replace function public.dev_list_records(
    p_table text,
    p_limit integer default 250
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    result jsonb;
    safe_limit integer := greatest(1, least(coalesce(p_limit, 250), 250));
    sql text;
begin
    if not public.is_dev_owner() then
        raise exception 'Developer Console access is restricted to the designated developer account.';
    end if;

    if not public.dev_table_allowed(p_table) then
        raise exception 'This data area is not available in the Developer Console.';
    end if;

    sql := case p_table
        when 'profiles' then
            'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select id, full_name, employee_code, role, status from public.profiles order by full_name nulls last limit $1) x'
        when 'teams' then
            'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select id, team_id, team_name, no_of_members, status, created_by, created_at, updated_at from public.teams order by created_at desc nulls last limit $1) x'
        when 'profiling_jobs' then
            'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select id, analyst_id, team_id, team_name, member_count, status, started_at, finished_at, total_seconds from public.profiling_jobs order by started_at desc nulls last limit $1) x'
        when 'timer_sessions' then
            'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select id, profiling_job_id, session_type, status, started_at, stopped_at, total_seconds from public.timer_sessions order by started_at desc nulls last limit $1) x'
        when 'timer_events' then
            'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select id, session_id, event_type, event_time from public.timer_events order by event_time desc nulls last limit $1) x'
        when 'task_logs' then
            'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select id, analyst_id, category, task_name, started_at, ended_at, duration_seconds, manual_duration_seconds, live_duration_seconds, duration_source, justification from public.task_logs order by started_at desc nulls last limit $1) x'
        when 'task_activity_events' then
            'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select id, task_log_id, event_type, event_time from public.task_activity_events order by event_time desc nulls last limit $1) x'
        when 'manual_time_requests' then
            'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select id, analyst_id, assigned_admin_id, task_name, started_at, ended_at, duration_seconds, justification, status, reviewed_by, reviewed_at, rejection_reason, created_at from public.manual_time_requests order by created_at desc nulls last limit $1) x'
        when 'app_notifications' then
            'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select id, recipient_id, type, title, message, reference_id, is_read, read_at, created_at from public.app_notifications order by created_at desc nulls last limit $1) x'
    end;

    execute sql into result using safe_limit;
    return coalesce(result, '[]'::jsonb);
end;
$$;

revoke all on function public.dev_list_records(text, integer) from public;
grant execute on function public.dev_list_records(text, integer) to authenticated;

-- -------------------------------------------------------------
-- UPDATE ONE RECORD
-- -------------------------------------------------------------

create or replace function public.dev_update_record(
    p_table text,
    p_record_id text,
    p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    key_name text;
    set_parts text[] := '{}';
    result jsonb;
    sql text;
begin
    if not public.is_dev_owner() then
        raise exception 'Developer Console access is restricted to the designated developer account.';
    end if;

    if not public.dev_table_allowed(p_table) then
        raise exception 'This data area is not available in the Developer Console.';
    end if;

    if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
        raise exception 'Changes must be a JSON object.';
    end if;

    for key_name in select jsonb_object_keys(p_changes) loop
        if not public.dev_editable_column_allowed(p_table, key_name) then
            raise exception 'Column % cannot be edited from the Developer Console.', key_name;
        end if;

        set_parts := array_append(
            set_parts,
            format('%I = (jsonb_populate_record(NULL::public.%I, $2)).%I', key_name, p_table, key_name)
        );
    end loop;

    if coalesce(array_length(set_parts, 1), 0) = 0 then
        raise exception 'No editable fields were supplied.';
    end if;

    sql := format(
        'update public.%I set %s where id::text = $1 returning to_jsonb(public.%I.*)',
        p_table,
        array_to_string(set_parts, ', '),
        p_table
    );

    execute sql into result using p_record_id, p_changes;

    if result is null then
        raise exception 'Record % was not found in %.', p_record_id, p_table;
    end if;

    return result;
end;
$$;

revoke all on function public.dev_update_record(text, text, jsonb) from public;
grant execute on function public.dev_update_record(text, text, jsonb) to authenticated;


-- -------------------------------------------------------------
-- OWNER: SAFE DIRECT SESSION-TYPE EDIT
-- -------------------------------------------------------------
-- Used only by the Developer Console when Ivee changes Session Type.
-- The companion session is switched in the same transaction so the pair
-- remains TEAM + MEMBERS.

drop function if exists public.dev_switch_session_type_by_session(uuid, text);
drop function if exists public.dev_switch_session_type_by_session(bigint, text);
drop function if exists public.dev_switch_session_type_by_session(text, text);

create or replace function public.dev_switch_session_type_by_session(
    p_session_id text,
    p_requested_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    target_session public.timer_sessions%rowtype;
    companion_session public.timer_sessions%rowtype;
    requested_type text := upper(trim(coalesce(p_requested_type, '')));
    current_type text;
    companion_type text;
begin
    if not public.is_dev_owner() then
        raise exception 'Developer Console access is restricted to the designated developer account.';
    end if;

    if requested_type not in ('TEAM', 'MEMBERS') then
        raise exception 'Session Type must be TEAM or MEMBERS.';
    end if;

    select * into target_session
    from public.timer_sessions
    where id::text = p_session_id
    for update;

    if not found then
        raise exception 'Timer session was not found.';
    end if;

    current_type := upper(coalesce(target_session.session_type, ''));
    if current_type not in ('TEAM', 'MEMBERS') then
        raise exception 'The current timer session type is invalid.';
    end if;

    if current_type = requested_type then
        return to_jsonb(target_session);
    end if;

    select * into companion_session
    from public.timer_sessions
    where profiling_job_id = target_session.profiling_job_id
      and id::text <> target_session.id::text
      and upper(session_type::text) in ('TEAM', 'MEMBERS')
    order by id
    limit 1
    for update;

    if not found then
        raise exception 'The companion TEAM/MEMBERS session could not be found.';
    end if;

    companion_type := upper(coalesce(companion_session.session_type, ''));
    if companion_type <> requested_type then
        raise exception 'The companion session is not the expected opposite type.';
    end if;

    -- Use dynamic SQL with string literals so PostgreSQL resolves the value
    -- against the actual timer_sessions.session_type column type (text,
    -- varchar, enum, or another compatible domain) instead of relying on an
    -- implicit PL/pgSQL assignment cast.
    execute format(
        'update public.timer_sessions set session_type = %L where id::text = %L',
        case when requested_type = 'TEAM' then 'MEMBERS' else 'TEAM' end,
        target_session.id::text
    );

    execute format(
        'update public.timer_sessions set session_type = %L where id::text = %L',
        requested_type,
        companion_session.id::text
    );

    return jsonb_build_object(
        'target_session_id', target_session.id,
        'companion_session_id', companion_session.id,
        'target_type', requested_type,
        'companion_type', current_type
    );
end;
$$;

revoke all on function public.dev_switch_session_type_by_session(text, text) from public;
grant execute on function public.dev_switch_session_type_by_session(text, text) to authenticated;

-- -------------------------------------------------------------
-- DEVELOPER HEALTH / INTEGRITY CHECK
-- -------------------------------------------------------------

drop function if exists public.dev_health_check();

create or replace function public.dev_health_check()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    result jsonb;
    active_timers bigint := 0;
    open_work bigint := 0;
    pending_requests bigint := 0;
    unread_notifications bigint := 0;
    orphan_sessions bigint := 0;
    invalid_session_types bigint := 0;
    broken_pairs bigint := 0;
begin
    if not public.is_dev_owner() then
        raise exception 'Developer Console access is restricted to the designated developer account.';
    end if;

    select count(*) into active_timers
    from public.timer_sessions
    where status in ('RUNNING', 'PAUSED');

    select count(*) into open_work
    from public.task_logs
    where ended_at is null;

    select count(*) into pending_requests
    from public.dev_change_requests
    where status = 'PENDING';

    select count(*) into unread_notifications
    from public.app_notifications
    where is_read = false;

    select count(*) into orphan_sessions
    from public.timer_sessions ts
    left join public.profiling_jobs pj on pj.id = ts.profiling_job_id
    where pj.id is null;

    select count(*) into invalid_session_types
    from public.timer_sessions
    where upper(coalesce(session_type, '')) not in ('TEAM', 'MEMBERS');

    select count(*) into broken_pairs
    from (
        select pj.id
        from public.profiling_jobs pj
        left join lateral (
            select count(*) filter (where upper(coalesce(ts.session_type,'')) = 'TEAM') as team_count,
                   count(*) filter (where upper(coalesce(ts.session_type,'')) = 'MEMBERS') as members_count
            from public.timer_sessions ts
            where ts.profiling_job_id = pj.id
        ) x on true
        where x.team_count <> 1 or x.members_count <> 1
    ) q;

    select jsonb_build_array(
        jsonb_build_object('label','Active timer sessions','value',active_timers,'level',case when active_timers > 2 then 'WARN' else 'OK' end,'detail','RUNNING or PAUSED profiling sessions'),
        jsonb_build_object('label','Open Work Activity','value',open_work,'level',case when open_work > 0 then 'WARN' else 'OK' end,'detail','Records without an ended_at timestamp'),
        jsonb_build_object('label','Pending requests','value',pending_requests,'level',case when pending_requests > 0 then 'WARN' else 'OK' end,'detail','Developer requests awaiting review'),
        jsonb_build_object('label','Unread notifications','value',unread_notifications,'level','OK','detail','Unread in-app notifications'),
        jsonb_build_object('label','Orphan timer sessions','value',orphan_sessions,'level',case when orphan_sessions > 0 then 'ERROR' else 'OK' end,'detail','Timer sessions whose profiling job is missing'),
        jsonb_build_object('label','Invalid session types','value',invalid_session_types,'level',case when invalid_session_types > 0 then 'ERROR' else 'OK' end,'detail','Values other than TEAM or MEMBERS'),
        jsonb_build_object('label','Broken profiling pairs','value',broken_pairs,'level',case when broken_pairs > 0 then 'ERROR' else 'OK' end,'detail','Jobs that do not have exactly one TEAM and one MEMBERS session')
    ) into result;

    return result;
end;
$$;

revoke all on function public.dev_health_check() from public;
grant execute on function public.dev_health_check() to authenticated;

-- -------------------------------------------------------------
-- DELETE ONE RECORD
-- -------------------------------------------------------------

create or replace function public.dev_delete_record(
    p_table text,
    p_record_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    result jsonb;
    sql text;
begin
    if not public.is_dev_owner() then
        raise exception 'Developer Console access is restricted to the designated developer account.';
    end if;

    if not public.dev_table_allowed(p_table) then
        raise exception 'This data area is not available in the Developer Console.';
    end if;

    sql := format(
        'delete from public.%I where id::text = $1 returning to_jsonb(public.%I.*)',
        p_table,
        p_table
    );

    execute sql into result using p_record_id;

    if result is null then
        raise exception 'Record % was not found in %.', p_record_id, p_table;
    end if;

    return result;
end;
$$;

revoke all on function public.dev_delete_record(text, text) from public;
grant execute on function public.dev_delete_record(text, text) to authenticated;

-- -------------------------------------------------------------
-- SUBMIT ANALYST REQUEST
-- -------------------------------------------------------------

create or replace function public.submit_dev_change_request(
    p_target_table text,
    p_target_record_id text,
    p_action text,
    p_requested_change text,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    new_id uuid;
    owner_id uuid;
begin
    if auth.uid() is null then
        raise exception 'You must be signed in to submit a request.';
    end if;

    if not public.dev_table_allowed(p_target_table) then
        raise exception 'That area cannot be requested through the Developer Console.';
    end if;

    if upper(trim(coalesce(p_action, ''))) not in ('UPDATE', 'DELETE') then
        raise exception 'Choose Edit or Delete.';
    end if;

    select user_id
    into owner_id
    from public.dev_owners
    order by created_at asc
    limit 1;

    if owner_id is null then
        raise exception 'No Developer Console owner is configured.';
    end if;

    insert into public.dev_change_requests (
        requester_id,
        target_table,
        target_record_id,
        action,
        requested_change,
        reason
    ) values (
        auth.uid(),
        p_target_table,
        nullif(trim(p_target_record_id), ''),
        upper(trim(p_action)),
        left(coalesce(trim(p_requested_change), ''), 5000),
        left(coalesce(trim(p_reason), ''), 2000)
    )
    returning id into new_id;

    insert into public.app_notifications (
        recipient_id,
        type,
        title,
        message,
        reference_id,
        is_read
    ) values (
        owner_id,
        'DEV_CHANGE_REQUEST',
        'New Developer Request',
        'An analyst submitted an edit/delete request for ' || p_target_table || '.',
        new_id,
        false
    );

    return new_id;
end;
$$;

revoke all on function public.submit_dev_change_request(text, text, text, text, text) from public;
grant execute on function public.submit_dev_change_request(text, text, text, text, text) to authenticated;

-- -------------------------------------------------------------
-- OWNER: LIST REQUESTS
-- -------------------------------------------------------------

create or replace function public.dev_list_change_requests(
    p_status text default 'PENDING'
)
returns table (
    id uuid,
    requester_id uuid,
    requester_name text,
    target_table text,
    target_table_label text,
    target_record_id text,
    action text,
    requested_change text,
    reason text,
    status text,
    reviewer_id uuid,
    reviewer_note text,
    reviewed_at timestamptz,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_dev_owner() then
        raise exception 'Developer Console access is restricted to the designated developer account.';
    end if;

    return query
    select
        r.id,
        r.requester_id,
        coalesce(p.full_name, 'Unknown Analyst'),
        r.target_table,
        initcap(replace(r.target_table, '_', ' ')),
        r.target_record_id,
        r.action,
        r.requested_change,
        r.reason,
        r.status,
        r.reviewer_id,
        r.reviewer_note,
        r.reviewed_at,
        r.created_at
    from public.dev_change_requests r
    left join public.profiles p on p.id = r.requester_id
    where upper(coalesce(p_status, 'PENDING')) = 'ALL'
       or r.status = upper(coalesce(p_status, 'PENDING'))
    order by r.created_at desc;
end;
$$;

revoke all on function public.dev_list_change_requests(text) from public;
grant execute on function public.dev_list_change_requests(text) to authenticated;

-- -------------------------------------------------------------
-- OWNER: APPLY SAFE SESSION-TYPE SWITCH
-- -------------------------------------------------------------
-- A profiling job always contains a TEAM and a MEMBERS timer session.
-- This helper swaps those two labels together so correcting the current
-- session can never leave the pair as TEAM/TEAM or MEMBERS/MEMBERS.

create or replace function public.dev_apply_session_type_switch(
    p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    target_request public.dev_change_requests%rowtype;
    target_session public.timer_sessions%rowtype;
    other_session public.timer_sessions%rowtype;
    requested_type text;
    current_type text;
begin
    if not public.is_dev_owner() then
        raise exception 'Developer Console access is restricted to the designated developer account.';
    end if;

    select *
    into target_request
    from public.dev_change_requests
    where id = p_request_id
    for update;

    if not found then
        raise exception 'Developer request was not found.';
    end if;

    if target_request.target_table <> 'timer_sessions'
       or target_request.action <> 'UPDATE'
       or target_request.status <> 'APPROVED' then
        raise exception 'This request is not an approved session type correction.';
    end if;

    if coalesce(target_request.requested_change, '') not like 'SESSION_TYPE_SWITCH|%' then
        raise exception 'This timer session request is not a protected session type switch.';
    end if;

    requested_type := upper(substring(
        target_request.requested_change
        from 'TO=(TEAM|MEMBERS)'
    ));

    if requested_type is null then
        raise exception 'The requested session type could not be determined.';
    end if;

    select *
    into target_session
    from public.timer_sessions
    where id::text = target_request.target_record_id
    for update;

    if not found then
        raise exception 'The requested timer session no longer exists.';
    end if;

    current_type := upper(coalesce(target_session.session_type, ''));

    if current_type not in ('TEAM', 'MEMBERS') then
        raise exception 'The current timer session type is invalid.';
    end if;

    if requested_type = current_type then
        raise exception 'The requested session type is already active.';
    end if;

    if target_session.status = 'COMPLETED' then
        raise exception 'A completed timer session cannot be relabeled through this request.';
    end if;

    select *
    into other_session
    from public.timer_sessions
    where profiling_job_id = target_session.profiling_job_id
      and id <> target_session.id
      and session_type in ('TEAM', 'MEMBERS')
    order by id
    limit 1
    for update;

    if not found then
        raise exception 'The paired TEAM/MEMBERS timer session could not be found.';
    end if;

    if upper(coalesce(other_session.session_type, '')) = requested_type then
        raise exception 'The paired timer session already has the requested type.';
    end if;

    if other_session.status = 'COMPLETED' then
        raise exception 'The paired timer session is already completed; the sequence cannot be safely relabeled.';
    end if;

    update public.timer_sessions
    set session_type = requested_type
    where id = target_session.id;

    update public.timer_sessions
    set session_type = current_type
    where id = other_session.id;

    return true;
end;
$$;

revoke all on function public.dev_apply_session_type_switch(uuid) from public;
grant execute on function public.dev_apply_session_type_switch(uuid) to authenticated;

-- -------------------------------------------------------------
-- OWNER: REVIEW REQUEST
-- -------------------------------------------------------------

create or replace function public.dev_review_change_request(
    p_request_id uuid,
    p_status text,
    p_reviewer_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    target_request public.dev_change_requests%rowtype;
    requester_name text;
    next_status text := upper(trim(coalesce(p_status, '')));
begin
    if not public.is_dev_owner() then
        raise exception 'Developer Console access is restricted to the designated developer account.';
    end if;

    if next_status not in ('APPROVED', 'COMPLETED', 'REJECTED') then
        raise exception 'Invalid request status.';
    end if;

    select * into target_request
    from public.dev_change_requests
    where id = p_request_id
    for update;

    if not found then
        raise exception 'Developer request was not found.';
    end if;

    if next_status = 'APPROVED' and target_request.status <> 'PENDING' then
        raise exception 'Only pending requests can be approved.';
    end if;

    if next_status = 'COMPLETED' and target_request.status <> 'APPROVED' then
        raise exception 'Only approved requests can be marked completed.';
    end if;

    select coalesce(full_name, 'Analyst') into requester_name
    from public.profiles
    where id = target_request.requester_id;

    if next_status = 'COMPLETED'
       and target_request.target_table = 'timer_sessions'
       and target_request.action = 'UPDATE'
       and coalesce(target_request.requested_change, '') like 'SESSION_TYPE_SWITCH|%' then
        perform public.dev_apply_session_type_switch(p_request_id);
    end if;

    update public.dev_change_requests
    set status = next_status,
        reviewer_id = auth.uid(),
        reviewer_note = nullif(left(coalesce(trim(p_reviewer_note), ''), 2000), ''),
        reviewed_at = now()
    where id = p_request_id;

    insert into public.app_notifications (
        recipient_id,
        type,
        title,
        message,
        reference_id,
        is_read
    ) values (
        target_request.requester_id,
        'DEV_CHANGE_REQUEST_UPDATE',
        case next_status
            when 'APPROVED' then 'Developer Request Approved'
            when 'COMPLETED' then 'Developer Request Completed'
            else 'Developer Request Rejected'
        end,
        case next_status
            when 'APPROVED' then 'Your edit/delete request was approved and is being handled by the developer.'
            when 'COMPLETED' then 'Your edit/delete request has been completed.'
            else 'Your edit/delete request was rejected.'
        end,
        p_request_id,
        false
    );

    return true;
end;
$$;

revoke all on function public.dev_review_change_request(uuid, text, text) from public;
grant execute on function public.dev_review_change_request(uuid, text, text) to authenticated;

-- -------------------------------------------------------------
-- OPTIONAL VERIFICATION
-- -------------------------------------------------------------
-- After running the script, this should return the Ivee account:
-- select * from public.dev_owners;
--
-- If it returns zero rows, the profile is not currently named exactly
-- "Ivee" with role ADMIN and status ACTIVE. Fix the profile name/role,
-- then run the INSERT block above again.
-- =============================================================


-- -------------------------------------------------------------
-- ANALYST: MY REQUESTS / RESULT VIEW
-- -------------------------------------------------------------

create or replace function public.get_my_dev_change_requests()
returns table (
    id uuid,
    target_table text,
    target_table_label text,
    target_record_id text,
    action text,
    requested_change text,
    reason text,
    status text,
    reviewer_note text,
    reviewer_name text,
    reviewer_id uuid,
    reviewed_at timestamptz,
    created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
    select
        r.id,
        r.target_table,
        initcap(replace(r.target_table, '_', ' ')),
        r.target_record_id,
        r.action,
        r.requested_change,
        r.reason,
        r.status,
        r.reviewer_note,
        coalesce(p.full_name, 'Ivee'),
        r.reviewer_id,
        r.reviewed_at,
        r.created_at
    from public.dev_change_requests r
    left join public.profiles p on p.id = r.reviewer_id
    where r.requester_id = auth.uid()
    order by r.created_at desc;
$$;

revoke all on function public.get_my_dev_change_requests() from public;
grant execute on function public.get_my_dev_change_requests() to authenticated;

create or replace function public.get_my_dev_request_result(p_request_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
    target_request public.dev_change_requests%rowtype;
    result jsonb;
    sql text;
begin
    select * into target_request
    from public.dev_change_requests
    where id = p_request_id
      and requester_id = auth.uid();

    if not found then
        raise exception 'Developer request was not found.';
    end if;

    if target_request.status <> 'COMPLETED' then
        raise exception 'This request does not have a completed result yet.';
    end if;

    if target_request.target_record_id is null or not public.dev_table_allowed(target_request.target_table) then
        return jsonb_build_object('deleted', target_request.action = 'DELETE', 'record', null);
    end if;

    sql := case target_request.target_table
        when 'profiles' then 'select to_jsonb(x) from (select id, full_name, employee_code, role, status from public.profiles where id::text = $1 limit 1) x'
        when 'teams' then 'select to_jsonb(x) from (select id, team_id, team_name, no_of_members, status, created_at, updated_at from public.teams where id::text = $1 limit 1) x'
        when 'profiling_jobs' then 'select to_jsonb(x) from (select id, analyst_id, team_id, team_name, member_count, status, started_at, finished_at, total_seconds from public.profiling_jobs where id::text = $1 limit 1) x'
        when 'timer_sessions' then 'select to_jsonb(x) from (select id, profiling_job_id, session_type, status, started_at, stopped_at, total_seconds from public.timer_sessions where id::text = $1 limit 1) x'
        when 'timer_events' then 'select to_jsonb(x) from (select id, session_id, event_type, event_time from public.timer_events where id::text = $1 limit 1) x'
        when 'task_logs' then 'select to_jsonb(x) from (select id, analyst_id, category, task_name, started_at, ended_at, duration_seconds, manual_duration_seconds, live_duration_seconds, duration_source, justification from public.task_logs where id::text = $1 limit 1) x'
        when 'task_activity_events' then 'select to_jsonb(x) from (select id, task_log_id, event_type, event_time from public.task_activity_events where id::text = $1 limit 1) x'
        when 'manual_time_requests' then 'select to_jsonb(x) from (select id, analyst_id, assigned_admin_id, task_name, started_at, ended_at, duration_seconds, justification, status, reviewed_by, reviewed_at, rejection_reason, created_at from public.manual_time_requests where id::text = $1 limit 1) x'
        when 'app_notifications' then 'select to_jsonb(x) from (select id, type, title, message, is_read, read_at, created_at from public.app_notifications where id::text = $1 limit 1) x'
        else null
    end;

    if sql is null then
        return jsonb_build_object('deleted', false, 'record', null);
    end if;

    execute sql into result using target_request.target_record_id;

    return jsonb_build_object(
        'deleted', result is null and target_request.action = 'DELETE',
        'record', result
    );
end;
$$;

revoke all on function public.get_my_dev_request_result(uuid) from public;
grant execute on function public.get_my_dev_request_result(uuid) to authenticated;
