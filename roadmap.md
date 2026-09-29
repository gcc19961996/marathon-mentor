# Roadmap

- [x] Repair and verify Strava callback, token storage, immediate 365-day sync, and exact errors
- [x] Load the supplied seven-week schedule as current and original plan without changing runs
- [x] Apply one plan-based pace system, effort labels, warnings, and workout-label rules
- [x] Add WHOOP, plan rules, 16-mile checkpoint, and long-run reminders
- [x] Tune 4:15 NYC race splits and remove duplicate Today pace text
- [x] Verify the full experience and publish

- [x] Improve Progress run log readability, grouping, filters, and mobile cards
- [x] Correct effort, race, workout-chip, warning, milestone, and split rules
- [x] Count and backfill Strava splits, verify, and publish
- [x] Save recent race date as Apr 26, allow 13.1–13.8 mi race matching, and preserve notes/manual workout choices
- [x] Report split coverage, race relabels, and effort-band totals
- [x] Unify both tabs at 950px, replace run paging with a scroll box, and improve Strava pill contrast

- [x] Lock every table behind a passcode-protected backend, gate Strava/AI, add Lock this device

- [x] Remove passcode; public read-only data, validated + rate-limited backend writes, soft-deleted runs, JSON backup
- [x] Polish Today accent, run warnings, pace labels, filters, and cross-training field; verify and publish

## Passcode gate + full lockdown (in progress)
- [x] APP_PASSCODE secret (single passcode, owner only; viewer role deferred)
- [x] Signed 90-day token, 5-try lockout, Lock this device
- [x] RLS on every table, no anon/authenticated policies
- [x] Token required on all backend reads/writes incl. Strava
- [x] Verify + rescan + publish

- [x] Flexible ±2-day run-to-plan matching, week completion, moved/extra labels
- [x] Long-run hold only when a week has no matched long run
- [x] Today card "Already done", distance milestones within 0.2 mi, live 16-miler checkpoint
- [x] Week-complete card and Completed weeks list

## Mile detail before redesign
- [x] Make long-run averages reconcile and show each row's excluded-split count
- [x] Add one-at-a-time, keyboard-accessible mile detail to long-run and run-log rows
- [x] Add summary, quarters, split bars, elevation, cumulative time, and data-derived takeaway
- [x] Verify Sep 19 detail, publish, and pause for review

## Approved interface redesign — after mile-detail review
- [x] Confirm the fresh JSON backup control in Settings before visual changes
- [x] Pass 1: restyle the app shell and Weekly Plan only; verify fixed metrics and publish for review
- [ ] Pass 2: restyle Progress, Pace Analysis, Race Day, and Settings; verify fixed metrics and publish
- [ ] Preserve all calculation, backend, access, matching, filters, labels, and accessibility behavior

## Navigation and layout revision
- [x] Replace the sidebar with a collapsing sticky desktop top bar and fixed mobile bottom tabs
- [x] Use one centered 1200px container and aligned 12-column page grid
- [x] Restyle Today as a white, green-accented card and prevent This Week overflow
- [x] Verify presentation-only changes without changing protected training metrics
- [x] Restore the two-row desktop top bar and retain the capped width, action buttons, and filter chips

## Layout cleanup, run log, and header additions
- [x] Fix Pace Analysis and run-log overlap/containment issues across all requested widths
- [x] Rebuild the desktop/mobile run-log presentation with fixed, non-overlapping columns
- [x] Add current-plan Stage details and the runner profile menu using existing controls
- [x] Verify protected metrics, exact header/column measurements, publish, and report

## Pace vs distance analysis
- [x] Add stored-run scatter with races, logarithmic distance fits, confidence bands, and comparison periods
- [x] Add effort-normalized mode, required fitted summary, caveats, and like-for-like distance table
- [x] Apply sparse-data thresholds, bounded trend lines, hidden insufficient comparisons, and padded axes
- [x] Verify current/comparison metrics across desktop and mobile, then publish and report

## Final presentation polish
- [x] Refine desktop/mobile header spacing and bottom-tab labels
- [x] Simplify Today and Weekly Plan summary; verify moved-run fade flags
- [x] Deduplicate and reorder Pace Analysis copy and sections; shorten prediction ticks
- [x] Label weekly mileage marker and add accessible Fuelling disclosures
- [x] Verify protected figures at six widths, publish, and report
