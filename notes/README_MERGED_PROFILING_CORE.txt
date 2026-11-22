TICKY TICKY — MERGED PROFILING CORE UPDATE

This patch updates the uploaded project files only. It does not contain the full project.

FILES TO REPLACE (preserve these relative paths):
  pages/profiling.html
  pages/timer.html
  pages/profiling-complete.html
  js/profiling.js
  js/timer.js
  js/profiling-complete.js
  js/account-menu.js
  css/profiling.css
  css/timer.css

WHAT THIS PATCH IMPLEMENTS
1. Adds Separate Method Timer and Merged Method Timer tabs on Profiling.
2. Keeps the existing Separate Method form and TEAM/MEMBERS session creation.
3. Creates MERGED jobs with one MERGED timer session.
4. Displays Pending Profiling even when there are no pending jobs.
5. Shows each pending job's method, team, member count, status, and accumulated saved time.
6. Resuming a pending job reactivates its PAUSED job status and resumes its PAUSED timer session.
7. Renames the existing Finish Later control to Pause & Switch Team. Its existing pause-and-save behavior is retained; it pauses the timer and marks the profiling job PAUSED, releasing the one-active-job-per-analyst slot.
8. Makes timer completion validation method-aware: Separate requires TEAM + MEMBERS completed; Merged requires its single MERGED session completed.
9. Adds a Merged Profiling time card to the completion summary.
10. Removes the timer-page "Request Session Type Change" action.
11. Removes the injected "Request Member Count Change" action from the timer page.
12. Keeps the global Request Change / My Requests controls available; analysts can use Record Corrections for supported edits.

IMPORTANT SCOPE LIMIT
This is the core Profiling/Timer/Completion implementation slice. History, Reports, and Dashboard have NOT yet been updated to display MERGED breakdowns. Do not deploy this patch to production for analysts until the reporting integration and end-to-end testing are completed.

DEPLOYMENT / TESTING
1. Back up the current project files.
2. Replace only the nine listed project files in their matching folders.
3. Keep the two applied Supabase migrations already verified in the database.
4. Test in a staging/development deployment first.
5. Test both methods: create, auto-start, pause & switch, see Pending Profiling, resume, stop, finish, and verify the correct completion summary.
6. Test that a paused job remains PAUSED and that starting another job does not violate the one-active-job-per-analyst unique index.
7. Do not treat the reporting integration as complete until History, Reports, and Dashboard are updated and verified.

STATIC CHECKS PERFORMED
- Node syntax check passed for js/profiling.js.
- Node syntax check passed for js/timer.js.
- Node syntax check passed for js/profiling-complete.js.

No live Supabase write operations or browser end-to-end tests were run as part of preparing this patch.

FOLLOW-UP UI REFINEMENT
- The timer still displays Session Type and Members as read-only information.
- The two direct correction buttons are removed from the timer screen.
- The topbar Request Change and My Requests actions remain available.
- No database schema, RLS policy, or approval workflow was changed by this refinement.
