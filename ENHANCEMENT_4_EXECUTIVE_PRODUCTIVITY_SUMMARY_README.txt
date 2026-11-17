TICKY TICKY — ENHANCEMENT #4
EXECUTIVE PRODUCTIVITY SUMMARY

WHAT CHANGED
- Expanded the Report Summary worksheet with analyst-level productivity overview.
- Added team-level profiling overview.
- Added activity record counts, durations, and shares based on work-activity records.
- Added a management snapshot with unique analyst/team counts and profiling data-quality counts.
- Retained the existing six-sheet export structure from Enhancement #3:
  1. Report Summary
  2. Productivity Data
  3. PROD
  4. NON PROD
  5. PROD LOSS
  6. TRAINING
- Kept existing report filters as the source for all summary and detail data.
- Corrected chart helper references so profiling and category charts read the actual summary table rows.
- Clarified that the overall tracked-time KPI includes profiling plus work activities.

CALCULATION NOTES
- Analyst combined tracked time = profiling time + work-activity time for the selected report filters.
- Team overview is based on profiling records and the team/member duration fields already present in those records.
- Activity record counts and category duration are based only on work-activity records. The tracked-time category breakdown continues to include profiling time under PROD, consistent with the existing report's production accounting.
- Data issues count records marked INCONSISTENT or NO_BREAKDOWN. It is a review indicator, not a performance rating.
- Verified profiling count includes VERIFIED and SESSION_VERIFIED statuses.
- No targets, utilization rates, or efficiency scores are fabricated; those require scheduled-hour and target data not included in this export.

VALIDATION
- JavaScript syntax validation: reports.js and excel-export-server/server.mjs.
- Workbook export still uses the existing browser-to-chart-server flow.
- Live Supabase and hosted chart-server integration must be tested in the user's environment before production use.
