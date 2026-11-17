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
            to_jsonb(r)->>''team_name'',
            to_jsonb(r)->>''task_name'',
            to_jsonb(r)->>''activity_name'',
            to_jsonb(r)->>''category'',
            to_jsonb(r)->>''status'',
            to_jsonb(r)->>''event_type''
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
