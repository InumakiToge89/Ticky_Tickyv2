-- TickyTicky: profiling job pause/resume database fix
-- Run this ONCE in Supabase SQL Editor.
--
-- Goal:
--   IN_PROGRESS = one active profiling job per analyst
--   PAUSED      = saved for later; multiple allowed
--   COMPLETED   = finished profiling job
--
-- This also converts old jobs created by the previous "Finish Later"
-- implementation: jobs marked IN_PROGRESS whose timer sessions are
-- PAUSED (and none are RUNNING) become PAUSED.

ALTER TABLE public.profiling_jobs
DROP CONSTRAINT IF EXISTS profiling_jobs_status_check;

ALTER TABLE public.profiling_jobs
ADD CONSTRAINT profiling_jobs_status_check
CHECK (status IN ('IN_PROGRESS', 'PAUSED', 'COMPLETED'));

UPDATE public.profiling_jobs AS pj
SET status = 'PAUSED'
WHERE pj.status = 'IN_PROGRESS'
  AND EXISTS (
      SELECT 1
      FROM public.timer_sessions AS ts
      WHERE ts.profiling_job_id = pj.id
        AND ts.status = 'PAUSED'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.timer_sessions AS ts
      WHERE ts.profiling_job_id = pj.id
        AND ts.status = 'RUNNING'
  );

ALTER TABLE public.profiling_jobs
DROP CONSTRAINT IF EXISTS one_active_profiling_job_per_analyst;

DROP INDEX IF EXISTS one_active_profiling_job_per_analyst;

CREATE UNIQUE INDEX one_active_profiling_job_per_analyst
ON public.profiling_jobs (analyst_id)
WHERE status = 'IN_PROGRESS';
