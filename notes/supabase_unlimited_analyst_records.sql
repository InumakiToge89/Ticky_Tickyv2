-- Ticky Ticky: remove the 250-row cap from analyst record retrieval.
-- Keeps the existing RPC signature so current frontend calls remain compatible.
-- Ownership is still enforced for every returned record.
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

    -- p_limit is retained only for RPC signature compatibility; no row limit is applied.
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
