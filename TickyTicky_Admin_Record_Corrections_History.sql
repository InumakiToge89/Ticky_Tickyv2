-- =============================================================
-- TICKY TICKY: ADMIN RECORD CORRECTIONS REVIEW HISTORY
-- Adds a read-only, Admin-only combined audit history for:
--   1) Analyst edit requests
--   2) Analyst deletion requests
--   3) Manual time requests
--
-- Existing review RPCs and request tables remain in place.
-- =============================================================

create or replace function public.get_admin_record_correction_history(
    p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result jsonb;
begin
    if not exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and upper(trim(coalesce(p.role, ''))) = 'ADMIN'
          and upper(trim(coalesce(p.status, 'ACTIVE'))) = 'ACTIVE'
    ) then
        raise exception 'Administrator access is required to view review history.';
    end if;

    with combined_history as (
        select
            case when upper(coalesce(r.action, '')) = 'DELETE' then 'ANALYST_DELETE' else 'ANALYST_EDIT' end::text as request_type,
            r.id::text as request_id,
            r.requester_id as analyst_id,
            r.action,
            r.target_table,
            r.target_record_id,
            r.status,
            r.created_at as submitted_at,
            r.reviewed_at,
            r.reviewed_by,
            r.analyst_justification,
            r.reviewer_justification as admin_justification,
            r.original_data,
            r.proposed_changes,
            null::text as record_label
        from public.analyst_edit_requests r
        where upper(coalesce(r.status, '')) in ('APPROVED', 'REJECTED')
          and r.reviewed_at is not null

        union all

        select
            'MANUAL_TIME'::text as request_type,
            m.id::text as request_id,
            m.analyst_id,
            'MANUAL_TIME'::text as action,
            'manual_time_requests'::text as target_table,
            m.id::text as target_record_id,
            m.status,
            m.created_at as submitted_at,
            m.reviewed_at,
            m.reviewed_by,
            m.justification as analyst_justification,
            m.rejection_reason as admin_justification,
            '{}'::jsonb as original_data,
            '{}'::jsonb as proposed_changes,
            m.task_name as record_label
        from public.manual_time_requests m
        where upper(coalesce(m.status, '')) in ('APPROVED', 'REJECTED')
          and m.reviewed_at is not null
    ),
    enriched_history as (
        select
            h.*,
            analyst.full_name as analyst_name,
            reviewer.full_name as reviewer_name
        from combined_history h
        left join public.profiles analyst on analyst.id = h.analyst_id
        left join public.profiles reviewer on reviewer.id = h.reviewed_by
        order by h.reviewed_at desc nulls last, h.submitted_at desc
        limit greatest(1, least(coalesce(p_limit, 500), 1000))
    )
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'request_type', request_type,
                'request_id', request_id,
                'analyst_name', analyst_name,
                'reviewer_name', reviewer_name,
                'action', action,
                'target_table', target_table,
                'target_record_id', target_record_id,
                'record_label', record_label,
                'status', status,
                'submitted_at', submitted_at,
                'reviewed_at', reviewed_at,
                'analyst_justification', analyst_justification,
                'admin_justification', admin_justification,
                'original_data', original_data,
                'proposed_changes', proposed_changes
            )
            order by reviewed_at desc nulls last, submitted_at desc
        ),
        '[]'::jsonb
    )
    into v_result
    from enriched_history;

    return v_result;
end;
$$;

revoke all on function public.get_admin_record_correction_history(integer) from public, anon;
grant execute on function public.get_admin_record_correction_history(integer) to authenticated;
