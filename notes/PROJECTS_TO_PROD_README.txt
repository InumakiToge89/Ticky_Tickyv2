TICKY TICKY — PROJECTS TO PROD UPDATE

Included changes:
1. js/work-timer.js: Projects is now listed under PROD and removed from NON-PROD.
2. js/reports.js: legacy task_logs rows with task_name = Projects and category = NON-PROD are interpreted as PROD in the reports data set. This affects the reports UI and Excel export built from that data set.
3. migrate_projects_to_prod.sql: preview query for historical database records. The UPDATE is intentionally commented out to prevent accidental production data changes before reviewing the result.

Apply:
- Replace the project files with this full project folder (or copy the two changed JS files into your existing checkout).
- Deploy the site.
- Open Reports and export a workbook; check Work Activity Logs and the category totals.
- In Supabase SQL Editor, run the SELECT preview in migrate_projects_to_prod.sql first.
- After confirming the rows, uncomment the UPDATE and COMMIT lines, remove/replace ROLLBACK, and run the migration. Do not run a script containing both COMMIT and ROLLBACK. Prefer running the UPDATE as a separate reviewed statement:

UPDATE public.task_logs
SET category = 'PROD'
WHERE upper(trim(coalesce(category, ''))) = 'NON-PROD'
  AND lower(trim(coalesce(task_name, ''))) = 'projects';

Verify:
SELECT category, task_name, count(*) AS records,
       sum(coalesce(duration_seconds, 0)) AS duration_seconds
FROM public.task_logs
WHERE lower(trim(coalesce(task_name, ''))) = 'projects'
GROUP BY category, task_name
ORDER BY category;

Notes:
- The app-side compatibility mapping only changes how existing records are classified for reports/export; the SQL migration changes stored category values.
- The SQL assumes the current project uses public.task_logs with category, task_name, duration_seconds, started_at and ended_at, as referenced by js/reports.js. Confirm this against your live schema before running.
- Pending manual-time approval records may live in a separate table and are not modified by this migration. Check the approval workflow before approving old pending requests.
- No unrelated UI, theme, timer, authentication, or schema changes are intended.
