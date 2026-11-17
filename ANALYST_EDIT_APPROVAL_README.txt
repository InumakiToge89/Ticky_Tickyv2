TICKY TICKY — ANALYST RECORD CORRECTION & ADMIN APPROVAL

Files added:
- pages/analyst-edits.html
- css/analyst-edits.css
- js/analyst-edits.js
- supabase_analyst_edit_approval.sql

Files updated:
- Sidebar navigation in pages/*.html (adds Record Corrections)
- js/account-menu.js (routes analyst-edit notifications to Record Corrections)

PERMISSION MODEL
- Only active ANALYST accounts can submit requests.
- Analysts can request edits/deletions only for records that belong to their own account.
- The browser never directly updates/deletes official records.
- Active ADMIN accounts can review requests.
- Both analyst and admin justifications are mandatory (minimum 5 characters).
- Approved requests are applied inside the review RPC transaction.
- Rejected requests leave the original record unchanged.
- A pending request blocks another pending request for the same record.
- The record is checked against its original snapshot at review time. If it changed after submission, approval fails and no update/delete is applied.
- Deletion requests retain the original record snapshot and related activity snapshots for profiling_jobs, timer_sessions, and task_logs.

SUPPORTED RECORD TYPES
- profiling_jobs (not analyst_id)
- timer_sessions (not session_type; paired TEAM/MEMBERS sessions must remain consistent)
- timer_events (not session_id)
- task_logs (not analyst_id)
- task_activity_events (not task_log_id)
- manual_time_requests (not analyst_id, assigned_admin_id, status, reviewed_by, reviewed_at, or rejection_reason)

Protected/shared Developer Console areas are intentionally not exposed:
- profiles (roles/status/account identity)
- teams (shared team records)
- app_notifications (system-owned notifications)
The Developer Console and its existing developer-owner workflow are unchanged.

INSTALLATION
1. Back up the current working project and database.
2. Review supabase_analyst_edit_approval.sql against the live Supabase schema.
3. Run supabase_analyst_edit_approval.sql in Supabase SQL Editor using the project owner account.
4. Deploy the updated frontend folder.
5. Sign in as an Analyst and test:
   a. Load own Profiling Jobs, Timer Sessions, Timer Events, Work Activity Logs, Work Activity Events, and Manual Time Requests.
   b. Submit an edit with a justification.
   c. Confirm official Dashboard/History/Reports values remain unchanged while the request is pending.
   d. Submit a deletion request and confirm the record remains present while pending.
6. Sign in as an active Admin:
   a. Open Record Corrections.
   b. Compare original and proposed values.
   c. Reject one request with an Admin justification; verify the original record remains unchanged.
   d. Approve another request; verify the official record changes.
   e. Approve a deletion request in a test record and verify the row is removed while the request/audit snapshot remains.
7. Verify notifications are delivered to active Admins and the requesting Analyst.

IMPORTANT LIMITATIONS / VALIDATION
- This archive has not been connected to or tested against the live Supabase project.
- The SQL was written against the column/table references present in the supplied Ticky source archive, but must be checked against the actual live schema before production use.
- Deletion behavior depends on the existing foreign-key ON DELETE rules. The request captures known dependent rows, but the actual delete may fail if a foreign key uses RESTRICT/NO ACTION. If it fails, the transaction rolls back and the original record remains.
- The frontend lists up to 200 records per selected type; use Search to narrow the results.
- The SQL migration must be applied before the Record Corrections page can work.
- No service-role key is used or required in browser code.
