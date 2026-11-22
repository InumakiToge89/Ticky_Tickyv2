TICKY TICKY — REPORTS & PROFILING CLEANUP PATCH
================================================

Files included (project-relative paths)
- js/profiling.js
- js/reports.js
- pages/reports.html
- css/reports.css

BUG 1 — EXCEL TOTAL TIME
- Added Excel elapsed-time formatting [h]:mm:ss to Productivity Data column H (Total Time).
- Extended the Productivity Data autofilter and styling range through column J (Completed).
- Added the missing Completed column width and centered alignment.

BUG 2 — COMPLETED TEAMS REAPPEARING IN PROFILING DROPDOWN
- Profiling's saved-team query now loads only teams whose status is PENDING.
- The existing timer completion workflow already marks the saved team COMPLETED.
- Therefore, completed teams remain in the database but are excluded from the new-profiling dropdown, even if a profiling_jobs row is later deleted.
- Teams with IN_PROGRESS or PAUSED jobs are still excluded by the existing pending-job logic.
- No schema change is required: the supplied schema audit confirms teams.status already exists and the existing completion code writes COMPLETED.

OPTIONAL ONE-TIME RECONCILIATION
Run this only if you want to mark teams as COMPLETED for completed profiling_jobs that still exist but whose team status was left PENDING by an earlier version:

UPDATE public.teams t
SET status = 'COMPLETED',
    updated_at = now()
WHERE t.status = 'PENDING'
  AND EXISTS (
      SELECT 1
      FROM public.profiling_jobs pj
      WHERE pj.analyst_id = t.created_by
        AND pj.team_id = t.team_id
        AND pj.status = 'COMPLETED'
  );

This cannot identify jobs that were already deleted before the team status was updated, because no remaining profiling_jobs row would prove that history.

BUG 3 — REPORTS PAGE ORGANIZATION
- Added three report tabs:
  1. Charts & Summary
  2. Profiling Reports + PROD
  3. NON-PROD + PROD LOSS + TRAINING
- Kept the Export Report Excel button in the original global filter-card header.
- Kept Analyst, Team Search, From and To filters global across tabs.
- Moved the Activity Category filter into Work Activity Logs so the global filter card is less crowded.
- The Work Activity Logs section is moved between the second and third tab panels (the same DOM/table is reused, so pagination and event handlers remain attached).
- Tab 2 defaults the activity category to PROD.
- Tab 3 defaults to the combined NON-PROD / PROD LOSS / TRAINING group.
- Tab 1 clears the category filter so summary charts use all work-activity categories.
- Reset preserves the active tab's category preset.

INSTALLATION
1. Back up the current project.
2. Extract this ZIP into the project root.
3. Replace only the four files listed above, preserving their folders.
4. Deploy to a development/staging environment first.
5. Test all three report tabs, global filters, activity pagination, and Excel export.

VALIDATION PERFORMED
- Node syntax checks passed for js/profiling.js and js/reports.js.
- HTML structural checks passed: 3 tab buttons, 3 tab panels, no duplicate IDs.
- CSS parser reported no stylesheet syntax errors.

NOT YET VERIFIED
- Live Supabase data behavior.
- Browser interaction and responsive visual appearance.
- Actual Excel rendering in desktop Excel after deployment.
