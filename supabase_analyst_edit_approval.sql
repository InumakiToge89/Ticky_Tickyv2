
-- ============================================================
-- TICKY TICKY: ANALYST EDIT REQUESTS (ADMIN APPROVAL)
-- Apply once in Supabase SQL Editor after reviewing the schema.
-- Analysts may request changes/deletions only for their own
-- operational records. Official rows change only after an
-- Admin approves the request.
-- ============================================================

create table if not exists public.analyst_edit_requests (
    id uuid primary key default gen_random_uuid(),
    requester_id uuid not null references auth.users(id) on delete restrict,
    target_table text not null,
    target_record_id text not null,
    action text not null check (action in ('UPDATE','DELETE')),
    original_data jsonb not null,
    proposed_changes jsonb not null default '{}'::jsonb,
    related_data jsonb not null default '{}'::jsonb,
    analyst_justification text not null,
    status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewer_justification text,
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    applied_at timestamptz
);

create index if not exists idx_analyst_edit_requests_requester_created
    on public.analyst_edit_requests (requester_id, created_at desc);
create index if not exists idx_analyst_edit_requests_status_created
    on public.analyst_edit_requests (status, created_at desc);

alter table public.analyst_edit_requests enable row level security;
revoke all on public.analyst_edit_requests from public, anon, authenticated;

create or replace function public.analyst_edit_table_allowed(p_table text)
returns boolean
language sql immutable
as $$
    select p_table in (
        'profiling_jobs',
        'timer_sessions',
        'timer_events',
        'task_logs',
        'task_activity_events',
        'manual_time_requests'
    );
$$;

create or replace function public.analyst_edit_column_allowed(p_table text, p_column text)
returns boolean
language sql immutable
as $$
    select case p_table
        when 'profiling_jobs' then p_column in (
            'team_id','team_name','member_count','status','started_at','finished_at','total_seconds'
        )
        when 'timer_sessions' then p_column in (
            'status','started_at','stopped_at','total_seconds'
        )
        when 'timer_events' then p_column in (
            'event_type','event_time'
        )
        when 'task_logs' then p_column in (
            'category','task_name','started_at','ended_at','duration_seconds',
            'manual_duration_seconds','live_duration_seconds','duration_source','justification'
        )
        when 'task_activity_events' then p_column in (
            'event_type','event_time'
        )
        when 'manual_time_requests' then p_column in (
            'task_name','started_at','ended_at','duration_seconds','justification'
        )
        else false
    end;
$$;

create or replace function public.analyst_edit_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and upper(coalesce(p.role::text,'')) = 'ADMIN'
          and upper(coalesce(p.status::text,'ACTIVE')) = 'ACTIVE'
    );
$$;

create or replace function public.analyst_edit_record_is_owned(
    p_table text,
    p_record_id text,
    p_user_id uuid
)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
    owned boolean := false;
begin
    if p_user_id is null or not public.analyst_edit_table_allowed(p_table) then
        return false;
    end if;

    if p_table in ('profiling_jobs','task_logs','manual_time_requests') then
        execute format(
            'select exists(select 1 from public.%I r where r.id::text = $1 and r.analyst_id = $2)',
            p_table
        ) into owned using p_record_id, p_user_id;
    elsif p_table = 'timer_sessions' then
        select exists (
            select 1
            from public.timer_sessions ts
            join public.profiling_jobs pj on pj.id = ts.profiling_job_id
            where ts.id::text = p_record_id
              and pj.analyst_id = p_user_id
        ) into owned;
    elsif p_table = 'timer_events' then
        select exists (
            select 1
            from public.timer_events te
            join public.timer_sessions ts on ts.id = te.session_id
            join public.profiling_jobs pj on pj.id = ts.profiling_job_id
            where te.id::text = p_record_id
              and pj.analyst_id = p_user_id
        ) into owned;
    elsif p_table = 'task_activity_events' then
        select exists (
            select 1
            from public.task_activity_events tae
            join public.task_logs tl on tl.id = tae.task_log_id
            where tae.id::text = p_record_id
              and tl.analyst_id = p_user_id
        ) into owned;
    end if;

    return coalesce(owned,false);
end;
$$;

create or replace function public.analyst_edit_related_snapshot(
    p_table text,
    p_record_id text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    result jsonb := '{}'::jsonb;
begin
    if p_table = 'task_logs' then
        select jsonb_build_object(
            'task_activity_events',
            coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.task_activity_events x
                      where x.task_log_id::text = p_record_id), '[]'::jsonb)
        ) into result;
    elsif p_table = 'timer_sessions' then
        select jsonb_build_object(
            'timer_events',
            coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.timer_events x
                      where x.session_id::text = p_record_id), '[]'::jsonb)
        ) into result;
    elsif p_table = 'profiling_jobs' then
        select jsonb_build_object(
            'timer_sessions',
            coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.timer_sessions x
                      where x.profiling_job_id::text = p_record_id), '[]'::jsonb),
            'timer_events',
            coalesce((
                select jsonb_agg(to_jsonb(te) order by te.id)
                from public.timer_events te
                join public.timer_sessions ts on ts.id = te.session_id
                where ts.profiling_job_id::text = p_record_id
            ), '[]'::jsonb)
        ) into result;
    end if;
    return coalesce(result,'{}'::jsonb);
end;
$$;

create or replace function public.get_my_analyst_editable_records(
    p_table text,
    p_limit integer default null,
    p_search text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    result jsonb;
begin
    if auth.uid() is null then
        raise exception 'You must be signed in.';
    end if;

    if not public.analyst_edit_table_allowed(p_table) then
        raise exception 'This record type is not available for analyst editing.';
    end if;

    -- p_limit remains for RPC signature compatibility, but is intentionally not applied.
    execute format(
        'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb)
         from (
             select r.*
             from public.%I r
             where public.analyst_edit_record_is_owned(%L, r.id::text, $1)
               and ($2 is null or to_jsonb(r)::text ilike ''%%'' || $2 || ''%%'')
             order by r.id desc
         ) x',
        p_table, p_table
    ) into result using auth.uid(), nullif(trim(p_search),'');

    return coalesce(result,'[]'::jsonb);
end;
$$;

create or replace function public.get_my_analyst_edit_requests()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare result jsonb;
begin
    if auth.uid() is null then raise exception 'You must be signed in.'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
    into result
    from (
        select id, target_table, target_record_id, action, original_data,
               proposed_changes, related_data, analyst_justification, status,
               reviewer_justification, created_at, reviewed_at, applied_at
        from public.analyst_edit_requests
        where requester_id = auth.uid()
    ) x;
    return result;
end;
$$;

create or replace function public.get_pending_analyst_edit_requests()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare result jsonb;
begin
    if not public.analyst_edit_is_admin() then
        raise exception 'Only active Admins can review analyst edit requests.';
    end if;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc),'[]'::jsonb)
    into result
    from (
        select r.*, coalesce(p.full_name,'Analyst') as requester_name
        from public.analyst_edit_requests r
        left join public.profiles p on p.id = r.requester_id
        where r.status = 'PENDING'
    ) x;
    return result;
end;
$$;

create or replace function public.submit_analyst_edit_request(
    p_target_table text,
    p_target_record_id text,
    p_action text,
    p_proposed_changes jsonb,
    p_justification text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
    snapshot jsonb;
    new_id uuid;
    key_name text;
    action_value text := upper(trim(coalesce(p_action,'')));
    admin_row record;
    admin_count integer := 0;
begin
    if auth.uid() is null then raise exception 'You must be signed in to submit an edit request.'; end if;
    if not exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and upper(coalesce(p.role::text,'')) = 'ANALYST'
          and upper(coalesce(p.status::text,'ACTIVE')) = 'ACTIVE'
    ) then
        raise exception 'Only active Analysts can submit edit or deletion requests.';
    end if;
    if not public.analyst_edit_table_allowed(p_target_table) then
        raise exception 'This record type cannot be edited through this workflow.';
    end if;
    if action_value not in ('UPDATE','DELETE') then
        raise exception 'Choose Edit or Delete.';
    end if;
    if length(trim(coalesce(p_justification,''))) < 5 then
        raise exception 'Please provide a justification of at least 5 characters.';
    end if;
    if not public.analyst_edit_record_is_owned(p_target_table,p_target_record_id,auth.uid()) then
        raise exception 'You can only request changes to your own records.';
    end if;
    if exists (
        select 1 from public.analyst_edit_requests r
        where r.requester_id = auth.uid()
          and r.target_table = p_target_table
          and r.target_record_id = p_target_record_id
          and r.status = 'PENDING'
    ) then
        raise exception 'You already have a pending request for this record. Wait for an Admin decision before submitting another.';
    end if;

    execute format(
        'select to_jsonb(r) from public.%I r where r.id::text = $1 for update',
        p_target_table
    ) into snapshot using p_target_record_id;

    if snapshot is null then raise exception 'The selected record no longer exists.'; end if;

    if action_value = 'UPDATE' then
        if p_proposed_changes is null or jsonb_typeof(p_proposed_changes) <> 'object'
           or p_proposed_changes = '{}'::jsonb then
            raise exception 'Provide at least one field to update.';
        end if;
        for key_name in select jsonb_object_keys(p_proposed_changes) loop
            if not public.analyst_edit_column_allowed(p_target_table,key_name) then
                raise exception 'The field % cannot be edited by analysts.', key_name;
            end if;
        end loop;
    else
        p_proposed_changes := '{}'::jsonb;
    end if;

    insert into public.analyst_edit_requests (
        requester_id,target_table,target_record_id,action,
        original_data,proposed_changes,related_data,analyst_justification
    ) values (
        auth.uid(),p_target_table,p_target_record_id,action_value,
        snapshot,p_proposed_changes,public.analyst_edit_related_snapshot(p_target_table,p_target_record_id),
        left(trim(p_justification),2000)
    ) returning id into new_id;

    for admin_row in
        select id from public.profiles
        where upper(coalesce(role::text,'')) = 'ADMIN'
          and upper(coalesce(status::text,'ACTIVE')) = 'ACTIVE'
    loop
        insert into public.app_notifications (
            recipient_id,type,title,message,reference_id,is_read
        ) values (
            admin_row.id,
            'ANALYST_EDIT_REQUEST',
            'Analyst Edit Request',
            'An analyst submitted a ' || lower(action_value) || ' request for ' ||
                replace(p_target_table,'_',' ') || '.',
            new_id,
            false
        );
        admin_count := admin_count + 1;
    end loop;

    if admin_count = 0 then
        raise exception 'No active Admin account is available to receive this request.';
    end if;

    return new_id;
end;
$$;

create or replace function public.review_analyst_edit_request(
    p_request_id uuid,
    p_decision text,
    p_reviewer_justification text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    req public.analyst_edit_requests%rowtype;
    current_snapshot jsonb;
    current_related jsonb;
    key_name text;
    set_parts text[] := '{}';
    sql_text text;
    result_row jsonb;
    decision_value text := upper(trim(coalesce(p_decision,'')));
    requester_name text;
begin
    if not public.analyst_edit_is_admin() then
        raise exception 'Only active Admins can review analyst edit requests.';
    end if;
    if decision_value not in ('APPROVED','REJECTED') then
        raise exception 'Decision must be APPROVED or REJECTED.';
    end if;
    if length(trim(coalesce(p_reviewer_justification,''))) < 5 then
        raise exception 'Please provide an Admin review justification of at least 5 characters.';
    end if;

    select * into req
    from public.analyst_edit_requests
    where id = p_request_id
    for update;

    if not found then raise exception 'Edit request was not found.'; end if;
    if req.status <> 'PENDING' then raise exception 'This request has already been reviewed.'; end if;

    select coalesce(full_name,'Analyst') into requester_name
    from public.profiles where id = req.requester_id;

    if decision_value = 'APPROVED' then
        if not public.analyst_edit_record_is_owned(req.target_table,req.target_record_id,req.requester_id) then
            raise exception 'The original record is no longer available or no longer belongs to this analyst.';
        end if;

        execute format(
            'select to_jsonb(r) from public.%I r where r.id::text = $1 for update',
            req.target_table
        ) into current_snapshot using req.target_record_id;

        if current_snapshot is distinct from req.original_data then
            raise exception 'This record changed after the request was submitted. Refresh the record and submit a new request.';
        end if;

        if req.action = 'DELETE' then
            current_related := public.analyst_edit_related_snapshot(req.target_table,req.target_record_id);
            if current_related is distinct from req.related_data then
                raise exception 'Related activity changed after the deletion request was submitted. Refresh and submit a new request.';
            end if;
        end if;

        if req.action = 'UPDATE' then
            for key_name in select jsonb_object_keys(req.proposed_changes) loop
                if not public.analyst_edit_column_allowed(req.target_table,key_name) then
                    raise exception 'The requested field % is no longer permitted.', key_name;
                end if;
                set_parts := array_append(
                    set_parts,
                    format('%I = (jsonb_populate_record(NULL::public.%I, $2)).%I',
                           key_name,req.target_table,key_name)
                );
            end loop;

            sql_text := format(
                'update public.%I set %s where id::text = $1 returning to_jsonb(%I.*)',
                req.target_table,array_to_string(set_parts,', '),req.target_table
            );
            execute sql_text into result_row using req.target_record_id,req.proposed_changes;
        elsif req.action = 'DELETE' then
            sql_text := format(
                'delete from public.%I where id::text = $1 returning to_jsonb(%I.*)',
                req.target_table,req.target_table
            );
            execute sql_text into result_row using req.target_record_id;
        end if;

        if result_row is null then raise exception 'The record could not be changed.'; end if;
    end if;

    update public.analyst_edit_requests
    set status = decision_value,
        reviewed_by = auth.uid(),
        reviewer_justification = left(trim(p_reviewer_justification),2000),
        reviewed_at = now(),
        applied_at = case when decision_value = 'APPROVED' then now() else null end
    where id = p_request_id;

    insert into public.app_notifications (
        recipient_id,type,title,message,reference_id,is_read
    ) values (
        req.requester_id,
        'ANALYST_EDIT_REQUEST_UPDATE',
        case when decision_value = 'APPROVED' then 'Edit Request Approved' else 'Edit Request Rejected' end,
        case
            when decision_value = 'APPROVED' and req.action = 'DELETE'
                then 'Your deletion request for ' || replace(req.target_table,'_',' ') || ' was approved.'
            when decision_value = 'APPROVED'
                then 'Your edit request for ' || replace(req.target_table,'_',' ') || ' was approved and applied.'
            else 'Your edit request for ' || replace(req.target_table,'_',' ') || ' was rejected.'
        end,
        req.id,
        false
    );

    return jsonb_build_object(
        'request_id',req.id,
        'status',decision_value,
        'action',req.action,
        'record',result_row
    );
end;
$$;

revoke all on function public.analyst_edit_table_allowed(text) from public, anon, authenticated;
revoke all on function public.analyst_edit_column_allowed(text,text) from public, anon, authenticated;
revoke all on function public.analyst_edit_is_admin() from public, anon, authenticated;
revoke all on function public.analyst_edit_record_is_owned(text,text,uuid) from public, anon, authenticated;
revoke all on function public.analyst_edit_related_snapshot(text,text) from public, anon, authenticated;

revoke all on function public.get_my_analyst_editable_records(text,integer,text) from public, anon;
revoke all on function public.get_my_analyst_edit_requests() from public, anon;
revoke all on function public.get_pending_analyst_edit_requests() from public, anon;
revoke all on function public.submit_analyst_edit_request(text,text,text,jsonb,text) from public, anon;
revoke all on function public.review_analyst_edit_request(uuid,text,text) from public, anon;

grant execute on function public.get_my_analyst_editable_records(text,integer,text) to authenticated;
grant execute on function public.get_my_analyst_edit_requests() to authenticated;
grant execute on function public.get_pending_analyst_edit_requests() to authenticated;
grant execute on function public.submit_analyst_edit_request(text,text,text,jsonb,text) to authenticated;
grant execute on function public.review_analyst_edit_request(uuid,text,text) to authenticated;

-- End of migration.


-- Ticky Ticky: efficient server-side pagination for Analyst Record Corrections.
-- All matching records remain accessible across pages; each request returns only one page.
-- Ownership is enforced in SQL for each supported record type.

create or replace function public.get_my_analyst_editable_records_page(
    p_table text,
    p_page integer default 1,
    p_page_size integer default 20,
    p_search text default null,
    p_from_date date default null,
    p_to_date date default null,
    p_sort text default 'newest'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_page integer := greatest(coalesce(p_page, 1), 1);
    v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 50);
    v_offset integer;
    v_search text := nullif(trim(coalesce(p_search, '')), '');
    v_sort text := lower(coalesce(p_sort, 'newest'));
    v_owner_predicate text;
    v_date_expr text;
    v_name_expr text;
    v_where text;
    v_total bigint := 0;
    v_records jsonb := '[]'::jsonb;
begin
    if v_user is null then
        raise exception 'You must be signed in.';
    end if;

    if not public.analyst_edit_table_allowed(p_table) then
        raise exception 'This record type is not available for analyst editing.';
    end if;

    if v_sort not in ('newest', 'oldest', 'name') then
        v_sort := 'newest';
    end if;

    v_offset := (v_page - 1) * v_page_size;

    if p_table in ('profiling_jobs', 'task_logs', 'manual_time_requests') then
        v_owner_predicate := 'r.analyst_id = $1';
    elsif p_table = 'timer_sessions' then
        v_owner_predicate := 'exists (
            select 1 from public.profiling_jobs pj
            where pj.id = r.profiling_job_id and pj.analyst_id = $1
        )';
    elsif p_table = 'timer_events' then
        v_owner_predicate := 'exists (
            select 1
            from public.timer_sessions ts
            join public.profiling_jobs pj on pj.id = ts.profiling_job_id
            where ts.id = r.session_id and pj.analyst_id = $1
        )';
    elsif p_table = 'task_activity_events' then
        v_owner_predicate := 'exists (
            select 1 from public.task_logs tl
            where tl.id = r.task_log_id and tl.analyst_id = $1
        )';
    else
        raise exception 'Unsupported record type.';
    end if;

    v_date_expr := 'coalesce(
        nullif(to_jsonb(r)->>''started_at'', ''''),
        nullif(to_jsonb(r)->>''event_time'', ''''),
        nullif(to_jsonb(r)->>''created_at'', ''''),
        nullif(to_jsonb(r)->>''startedAt'', ''''),
        nullif(to_jsonb(r)->>''finished_at'', ''''),
        nullif(to_jsonb(r)->>''ended_at'', '''')
    )::timestamptz';

    v_name_expr := 'lower(coalesce(
        to_jsonb(r)->>''team_name'',
        to_jsonb(r)->>''task_name'',
        to_jsonb(r)->>''activity_name'',
        to_jsonb(r)->>''category'',
        to_jsonb(r)->>''id'',
        ''''
    ))';

    v_where := v_owner_predicate || '
        and ($2 is null or concat_ws('' '',
            r.id::text,
            to_jsonb(r)->>''profiling_job_id'',
            to_jsonb(r)->>''session_type'',
            to_jsonb(r)->>''team_name'',
            to_jsonb(r)->>''team_id'',
            to_jsonb(r)->>''task_name'',
            to_jsonb(r)->>''activity_name'',
            to_jsonb(r)->>''category'',
            to_jsonb(r)->>''status'',
            to_jsonb(r)->>''event_type'',
            (select coalesce(pj.team_name, '''') from public.profiling_jobs pj
             where pj.id = r.profiling_job_id)
        ) ilike ''%%'' || $2 || ''%%'')
        and ($3 is null or (' || v_date_expr || ')::date >= $3)
        and ($4 is null or (' || v_date_expr || ')::date <= $4)';

    execute format(
        'select count(*) from public.%I r where ' || v_where,
        p_table
    )
    into v_total
    using v_user, v_search, p_from_date, p_to_date;

    execute format(
        'select coalesce(jsonb_agg(to_jsonb(page_rows)), ''[]''::jsonb)
         from (
             select r.*
             from public.%I r
             where ' || v_where || '
             order by
                case when $5 = ''name'' then ' || v_name_expr || ' end asc nulls last,
                case when $5 = ''oldest'' then (' || v_date_expr || ') end asc nulls last,
                case when $5 = ''newest'' then (' || v_date_expr || ') end desc nulls last,
                r.id desc
             limit $6 offset $7
         ) as page_rows',
        p_table
    )
    into v_records
    using v_user, v_search, p_from_date, p_to_date, v_sort, v_page_size, v_offset;

    return jsonb_build_object(
        'records', coalesce(v_records, '[]'::jsonb),
        'total_count', v_total,
        'page', v_page,
        'page_size', v_page_size,
        'total_pages', greatest(ceil(v_total::numeric / v_page_size)::integer, 1)
    );
end;
$$;

revoke all on function public.get_my_analyst_editable_records_page(text,integer,integer,text,date,date,text) from public, anon;
grant execute on function public.get_my_analyst_editable_records_page(text,integer,integer,text,date,date,text) to authenticated;
