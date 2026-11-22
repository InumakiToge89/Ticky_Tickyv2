
-- =============================================================
-- TICKY ENHANCEMENT #2
-- Manual activity entry for NON-PROD, PROD LOSS, and TRAINING
-- PROD continues to use the existing live timer.
--
-- BACK UP PRODUCTION DATA BEFORE RUNNING.
-- This migration preserves existing requests by defaulting their
-- category to NON-PROD.
-- =============================================================

alter table public.manual_time_requests
    add column if not exists category text not null default 'NON-PROD';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.manual_time_requests'::regclass
          and conname = 'manual_time_requests_category_check'
    ) then
        alter table public.manual_time_requests
            add constraint manual_time_requests_category_check
            check (category in ('NON-PROD', 'PROD LOSS', 'TRAINING'));
    end if;
end
$$;

-- Submit a manual activity request. No official task_logs row is
-- created until the assigned Admin approves the request.
create or replace function public.submit_manual_activity_request(
    p_admin_id uuid,
    p_category text,
    p_task_name text,
    p_started_at timestamptz,
    p_ended_at timestamptz,
    p_justification text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_request_id uuid;
    v_category text := upper(trim(coalesce(p_category, '')));
    v_justification text := trim(coalesce(p_justification, ''));
begin
    if v_user_id is null then
        raise exception 'You must be signed in to submit an activity.';
    end if;

    if v_category not in ('NON-PROD', 'PROD LOSS', 'TRAINING') then
        raise exception 'Manual submission is only available for Non-Prod, Prod Loss, and Training.';
    end if;

    if nullif(trim(coalesce(p_task_name, '')), '') is null then
        raise exception 'Please select an activity.';
    end if;

    if p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at then
        raise exception 'The end time must be later than the start time.';
    end if;

    -- Enforce a minimum of 60 minutes and exact 30-minute increments.
    -- This is a server-side guard; client-side validation is not trusted.
    if extract(epoch from (p_ended_at - p_started_at)) < 3600
       or mod(extract(epoch from (p_ended_at - p_started_at)), 1800) <> 0 then
        raise exception 'Duration must be at least 1 hour and use exact 30-minute increments (1:00, 1:30, 2:00, 2:30, and so on).';
    end if;

    if v_justification = '' or length(v_justification) > 1000 then
        raise exception 'A justification of 1 to 1,000 characters is required.';
    end if;

    if not exists (
        select 1
        from public.profiles
        where id = v_user_id
          and upper(role) = 'ANALYST'
          and upper(status) = 'ACTIVE'
    ) then
        raise exception 'Only active analysts can submit manual activity requests.';
    end if;

    if not exists (
        select 1
        from public.profiles
        where id = p_admin_id
          and upper(role) = 'ADMIN'
          and upper(status) = 'ACTIVE'
    ) then
        raise exception 'Please select an active Admin reviewer.';
    end if;

    insert into public.manual_time_requests (
        analyst_id,
        assigned_admin_id,
        category,
        task_name,
        started_at,
        ended_at,
        duration_seconds,
        justification,
        status
    )
    values (
        v_user_id,
        p_admin_id,
        v_category,
        trim(p_task_name),
        p_started_at,
        p_ended_at,
        floor(extract(epoch from (p_ended_at - p_started_at)))::integer,
        v_justification,
        'PENDING'
    )
    returning id into v_request_id;

    insert into public.app_notifications (
        recipient_id,
        type,
        title,
        message,
        reference_id,
        is_read,
        created_at
    )
    values (
        p_admin_id,
        'MANUAL_TIME_REQUEST',
        'Manual Activity Approval Required',
        'An analyst submitted a ' || v_category || ' activity for your review.',
        v_request_id,
        false,
        now()
    );

    return v_request_id;
end;
$$;

-- Review a manual activity request. Approval creates the official
-- task_logs record in the same transaction as the request update.
create or replace function public.review_manual_activity_request(
    p_request_id uuid,
    p_decision text,
    p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin_id uuid := auth.uid();
    v_decision text := upper(trim(coalesce(p_decision, '')));
    v_request public.manual_time_requests%rowtype;
    v_task_log_id uuid;
    v_analyst_message text;
    v_analyst_title text;
begin
    if v_admin_id is null then
        raise exception 'You must be signed in to review requests.';
    end if;

    if not exists (
        select 1
        from public.profiles
        where id = v_admin_id
          and upper(role) = 'ADMIN'
          and upper(status) = 'ACTIVE'
    ) then
        raise exception 'Only active Admins can review manual activity requests.';
    end if;

    if v_decision not in ('APPROVED', 'REJECTED') then
        raise exception 'Decision must be APPROVED or REJECTED.';
    end if;

    select *
    into v_request
    from public.manual_time_requests
    where id = p_request_id
    for update;

    if not found then
        raise exception 'Manual activity request was not found.';
    end if;

    if v_request.assigned_admin_id <> v_admin_id then
        raise exception 'This request is assigned to a different Admin.';
    end if;

    if upper(v_request.status) <> 'PENDING' then
        raise exception 'This request has already been reviewed.';
    end if;

    if v_decision = 'APPROVED' then
        insert into public.task_logs (
            analyst_id,
            category,
            task_name,
            started_at,
            ended_at,
            duration_seconds,
            manual_duration_seconds,
            live_duration_seconds,
            duration_source,
            justification
        )
        values (
            v_request.analyst_id,
            coalesce(v_request.category, 'NON-PROD'),
            v_request.task_name,
            v_request.started_at,
            v_request.ended_at,
            v_request.duration_seconds,
            v_request.duration_seconds,
            0,
            'MANUAL',
            v_request.justification
        )
        returning id into v_task_log_id;

        update public.manual_time_requests
        set status = 'APPROVED',
            reviewed_by = v_admin_id,
            reviewed_at = now(),
            rejection_reason = null
        where id = p_request_id;

        v_analyst_title := 'Manual Activity Approved';
        v_analyst_message := 'Your ' || coalesce(v_request.category, 'NON-PROD')
            || ' activity (' || v_request.task_name
            || ') was approved and added to your official productivity records.';
    else
        update public.manual_time_requests
        set status = 'REJECTED',
            reviewed_by = v_admin_id,
            reviewed_at = now(),
            rejection_reason = nullif(trim(coalesce(p_rejection_reason, '')), '')
        where id = p_request_id;

        v_analyst_title := 'Manual Activity Rejected';
        v_analyst_message := 'Your ' || coalesce(v_request.category, 'NON-PROD')
            || ' activity (' || v_request.task_name
            || ') was rejected. Review the Admin feedback in your request history.';
    end if;

    insert into public.app_notifications (
        recipient_id,
        type,
        title,
        message,
        reference_id,
        is_read,
        created_at
    )
    values (
        v_request.analyst_id,
        case when v_decision = 'APPROVED'
            then 'MANUAL_TIME_APPROVED'
            else 'MANUAL_TIME_REJECTED'
        end,
        v_analyst_title,
        v_analyst_message,
        p_request_id,
        false,
        now()
    );

    return jsonb_build_object(
        'request_id', p_request_id,
        'decision', v_decision,
        'task_log_id', v_task_log_id
    );
end;
$$;

revoke all on function public.submit_manual_activity_request(uuid, text, text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.review_manual_activity_request(uuid, text, text) from public, anon;
grant execute on function public.submit_manual_activity_request(uuid, text, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.review_manual_activity_request(uuid, text, text) to authenticated;
