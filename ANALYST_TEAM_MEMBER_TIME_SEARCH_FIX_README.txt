TICKY TICKY — ANALYST TEAM / MEMBERS TIME SEARCH FIX

Problem found
-------------
The Analyst Record Corrections page uses get_my_analyst_editable_records_page().
For timer_sessions, the ownership check correctly follows timer_sessions.profiling_job_id
to profiling_jobs.analyst_id, but the search text did not include profiling_job_id or
session_type. Therefore, searching for a Profiling Job ID (for example 2197) could show
the profiling job under Profiling Jobs but return no child timer sessions under Timer Sessions.

The UI also did not identify timer session cards as TEAM or MEMBERS time.

Changes
-------
1. Updated js/analyst-edits.js so Timer Sessions are labelled "Team time" or "Members time".
2. Timer session summaries now display their session type and linked Profiling Job ID.
3. Updated both SQL copies of get_my_analyst_editable_records_page() so Timer Sessions
   can be found by their own ID, linked profiling_job_id, session_type, team name, or team ID.
4. Kept session_type and profiling_job_id out of the analyst edit form. TEAM/MEMBERS sessions
   are a paired relationship and should not be independently retyped by this generic form.

IMPORTANT DEPLOYMENT
--------------------
The SQL function must be updated in Supabase; uploading the JavaScript alone is not enough.

Run the updated file:
  supabase_analyst_records_server_pagination.sql

in Supabase SQL Editor, after reviewing that it targets the intended project.

Then deploy the updated frontend files:
  js/analyst-edits.js
  (and keep the updated SQL file in the project for source control/documentation).

No table data is deleted or rewritten by this fix.

Validation to perform
---------------------
1. Sign in as the analyst who owns Profiling Job 2197.
2. Open Record Corrections > Find a record to correct.
3. Select Profiling Jobs and search 2197; confirm the job appears.
4. Select Timer Sessions and search 2197; confirm the linked TEAM and MEMBERS sessions appear.
5. Confirm each session card identifies its type and shows Profiling Job 2197.
6. Confirm another analyst cannot see these sessions.

This package has been source-reviewed; live Supabase behavior and production deployment
have not been tested from this environment.
