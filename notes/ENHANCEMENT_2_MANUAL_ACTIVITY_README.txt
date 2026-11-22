TICKY TICKY — ENHANCEMENT #2: MANUAL ACTIVITY ENTRY

SCOPE
- PROD remains on the existing live timer, including Pause/Resume/Stop and Floating Timer.
- NON-PROD, PROD LOSS, and TRAINING become manual date + start/end time entries.
- Manual entries require an activity selection, an Admin reviewer, and analyst justification.
- Entries are not written to official task_logs until an Admin approves.
- Admins review and approve/reject in the existing Reports > Manual Time Requests area.
- Approved entries are written to task_logs with the selected category and duration_source=MANUAL.
- Existing manual_time_requests rows are migrated to category NON-PROD.

INSTALLATION
1. Back up the Supabase database.
2. Review supabase_manual_activity_categories.sql.
3. Run that SQL once in Supabase SQL Editor.
4. Replace the project files with this archive.
5. Test with an Analyst account and an Admin account before production use.

TEST CHECKLIST
- PROD: existing live timer starts, pauses, resumes, stops, and floating timer still works.
- NON-PROD: manual form shown; timer controls hidden.
- PROD LOSS: manual form shown; timer controls hidden.
- TRAINING: manual form shown; timer controls hidden.
- Missing date/time, invalid time range, missing Admin, or missing justification is rejected.
- Analyst submission creates a PENDING request only; it does not create task_logs.
- Assigned Admin sees category and request details in Reports.
- Admin rejection leaves task_logs unchanged and notifies analyst.
- Admin approval creates one MANUAL task_logs row with the exact category, time range, duration, and justification.
- Dashboard, History, and Reports include the approved row through their existing task_logs queries.

IMPORTANT
The original approval RPC implementation was not included in the uploaded project archive.
This enhancement therefore adds new dedicated RPCs named
submit_manual_activity_request and review_manual_activity_request.
The existing submit_manual_time_request and review_manual_time_request RPCs are
left untouched. Validate the table schema, constraints, RLS, and notification
behavior against a Supabase backup/staging project before production rollout.


TIME PICKER UI UPDATE
- All project pages now load a shared clock-style time picker component.
- All current time inputs (Work Activity start/end time) use the same analog clock dialog.
- The dialog supports hour selection, minute selection, AM/PM, Cancel, and OK.
- The selected time is written back in the existing 24-hour HH:mm format so existing
  Work Activity duration calculations and Supabase timestamp construction remain compatible.
- Date pickers are unchanged.


CLOCK PICKER RESPONSIVENESS REFINEMENT
- Corrected clock-hand angle so 12 o'clock is the -90 degree CSS direction.
- Added smooth hand and selection transitions.
- Added pointer/touch drag support for selecting individual minutes (1-minute precision).
- Added viewport-aware dialog and dial sizing, safe-area padding, and short-screen layout.
- Added focus restoration and keyboard focus containment while the dialog is open.
- Retained the existing 24-hour HH:mm value written to the original inputs.


CLOCK PICKER HOUR DIAL ALIGNMENT FIX
- Corrected hour-number placement to use the actual hour value rather than array index.
- 12 is now at 12 o'clock, 1 at 1 o'clock, and 11 at 11 o'clock.
- This aligns the highlighted hour number with the analog hand angle.
- Minute dial layout and minute selection behavior remain unchanged.


MANUAL DURATION RULE (ADDED)
- Applies to NON-PROD, PROD LOSS, and TRAINING manual requests.
- Minimum allowed duration is 1 hour (3,600 seconds).
- Durations must be exact multiples of 30 minutes (1,800 seconds):
  1:00, 1:30, 2:00, 2:30, 3:00, 3:30, and so on.
- Any duration below 1 hour, or containing excess minutes/seconds outside
  those increments, is rejected in the Work Activity interface.
- The submit_manual_activity_request database function enforces the same
  rule server-side so API/RPC calls cannot bypass the restriction.
- PROD continues to use the existing live timer and is not subject to this rule.
