# Follow-up fixes: Strava, original plan, and training rules

## What will change
- Repair the published Strava authorization hand-off so the callback exchanges the code, stores tokens and athlete details server-side, displays exact failures, and immediately syncs the last 365 days without deleting or duplicating runs.
- Replace the reset seed and current saved plan with the exact seven-week schedule provided, including Tuesday long runs from week 3 onward, the requested milestones, and the one-time Sunday note for week 1.
- Use one plan-based pace system everywhere, simplify effort chips and warnings, and remove automatic Easy workout labels from pasted runs.
- Add WHOOP recovery to the morning check-in, show the training safeguards in a collapsible Plan rules section, and add the Sep 29 checkpoint plus long-run fueling/race-shoe reminders.
- Tune the 4:15:00 NYC race splits to the specified course sections while preserving the no-time-banking rule.
- Verify the callback, sync status, fixed plan, run display, and check-in behavior, then publish the app.

## Data safety
- Existing run rows will not be deleted or overwritten by the plan migration.
- Strava matching will only attach an activity to a same-date run within 0.1 mile; otherwise it creates or updates by Strava activity ID.
- Reset plan will restore only plan rows and relink existing runs by date.

## Technical details
- Keep credentials and refresh/access tokens server-side in the existing private connection record.
- Apply a database migration for the current plan, profile note/day, milestones, checklist pace text, and change-log entry; no run-table delete/update statements.
- Keep the daily auto-sync throttle at 15 minutes and detail calls capped at 80 per sync.
