-- Ticky Ticky: reclassify historical Projects work-activity records.
-- Review the preview before running the UPDATE. This does not change durations or timestamps.

BEGIN;

-- Preview exactly which completed task_logs rows will be changed.
SELECT id, analyst_id, category, task_name, started_at, ended_at, duration_seconds
FROM public.task_logs
WHERE upper(trim(coalesce(category, ''))) = 'NON-PROD'
  AND lower(trim(coalesce(task_name, ''))) = 'projects'
ORDER BY ended_at DESC NULLS LAST;

-- After reviewing the preview above, execute this UPDATE in a separate run if you prefer
-- to inspect the preview before committing. To apply immediately, uncomment the UPDATE
-- and COMMIT below, then run the whole script.
 UPDATE public.task_logs
 SET category = 'PROD'
 WHERE upper(trim(coalesce(category, ''))) = 'NON-PROD'
   AND lower(trim(coalesce(task_name, ''))) = 'projects';

 COMMIT;
ROLLBACK;
