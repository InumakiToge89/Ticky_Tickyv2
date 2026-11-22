TICKY TICKY — PHASE 3 REPORTING INTEGRATION PATCH

Purpose
-------
Make History, Reports, and Dashboard recognize both profiling methods:
- SEPARATE: TEAM + MEMBERS sessions
- MERGED: one MERGED session

Files included
--------------
js/history.js
js/reports.js
js/dashboard.js
pages/history.html
pages/reports.html
pages/dashboard.html
css/history.css
css/reports.css
css/dashboard.css

Changes
-------
HISTORY
- Selects profiling_method from profiling_jobs.
- Calculates TEAM, MEMBERS, and MERGED time independently.
- Uses summed session time as the detailed total, with profiling_jobs.total_seconds
  as a fallback when no usable session total is present.
- Displays the method label and a separate Merged Time column.
- Adds merged time to the record details modal.

REPORTS
- Selects profiling_method for completed jobs.
- Includes MERGED sessions in detailed session totals and accuracy comparisons.
- Displays the method label and a separate Merged Time column.
- Adds merged session counts and merged duration to report details.
- Includes Merged Method time in the method breakdown chart and spreadsheet exports.
- Keeps existing TEAM and MEMBERS values separate; MERGED time is not misclassified.

DASHBOARD
- Selects profiling_method for completed jobs.
- Shows a Separate Method / Merged Method label in Recent Profiling.
- Continues to use the completed job's stored total_seconds for overall profiling
  productivity, avoiding a second addition of the timer session duration.

Installation
------------
1. Back up the current project files.
2. Extract this ZIP at the project root, preserving the included folder paths.
3. Replace only the nine listed files.
4. Deploy to the development environment first.
5. Test at least one completed Separate Method job and one completed Merged Method job.
6. Verify each appears once in History, Reports, and Dashboard, with time shown in
   the appropriate columns and included once in total profiling time.

Important
---------
This patch does not change the database schema, timer creation, timer controls,
completion workflow, or existing records. It assumes Migration 001 and the current
Merged Profiling core patch are already installed as tested.

Validation performed
--------------------
- Node syntax checks passed for history.js, reports.js, and dashboard.js.
- HTML parser checks passed for history.html, reports.html, and dashboard.html.
- Live Supabase/browser integration testing has not been performed in this environment.
