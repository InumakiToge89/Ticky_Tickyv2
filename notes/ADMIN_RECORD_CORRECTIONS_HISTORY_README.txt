TICKY TICKY — ADMIN RECORD CORRECTIONS ORGANIZATION

WHAT CHANGED
- Removed the Manual Non-Prod Time Requests approval section from Reports.
- Reports is now reserved for productivity reporting and analytics.
- Added three Admin-only tabs to the Admin Record Corrections page:
  1. Analyst Edit & Deletion
  2. Manual Time Approvals
  3. Review History
- Manual time requests continue using the existing review_manual_time_request RPC.
- The Review History tab reads completed decisions from analyst_edit_requests and
  manual_time_requests through an Admin-only database function.
- History filters include request type, decision, and text search.

DATABASE STEP REQUIRED
Run supabase_admin_record_corrections_history.sql in the Supabase SQL Editor.
This creates get_admin_record_correction_history(), a read-only Admin-only RPC.
The migration does not replace or modify the existing approval RPCs or request tables.

IMPORTANT LIMITATIONS
- Manual time history shows the rejection_reason as the Admin review note when one
  exists. The existing manual-time review RPC does not store an approval note.
- Analyst edit/deletion history displays reviewer_justification from the existing
  analyst_edit_requests table.
- Existing records without reviewed_at or reviewer metadata cannot be fully shown
  as reviewed history.
- Live Supabase execution and browser integration testing are still required.

PRESERVED EXISTING PROJECT WORK
- Retained the previously corrected clock-style time picker and its HH:mm value output.
- Re-added the shared time-picker script to all project pages in this combined package.
