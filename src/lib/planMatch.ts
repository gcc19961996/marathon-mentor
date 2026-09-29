// Flexible matching between planned workouts and logged runs.
// A planned workout can be satisfied by a run within +/-2 days in the same week,
// preferring the closest date, then the closest distance. Each run matches at
// most one planned workout.

import type { PlanDayRow, Run } from "./data";
import { weekDates } from "./fixedPlan";
import { DAY_NAMES } from "./training";
import { typeLabel } from "./fixedPlan";

export const DONE_FRACTION = 0.75;
export const MATCH_WINDOW_DAYS = 2;

export function dayDiff(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${a}T00:00:00`) - Date.parse(`${b}T00:00:00`)) / 86400000,
  );
}

export type PlanMatch = {
  row: PlanDayRow;
  run: Run | null;
  /** The run happened on a different date than the plan day. */
  moved: boolean;
  /** Matched run covers at least 75% of the planned distance. */
  done: boolean;
};

export type WeekMatch = {
  weekStart: string;
  weekEnd: string;
  dates: string[];
  matches: PlanMatch[];
  /** plan date -> match */
  byPlanDate: Map<string, PlanMatch>;
  /** run id -> the plan row it satisfies */
  planForRun: Map<string, PlanDayRow>;
  /** runs in the week that satisfy no planned workout */
  extras: Run[];
  complete: boolean;
  plannedMi: number;
  actualMi: number;
  runCount: number;
  longestRun: Run | null;
  lastMatchedDate: string | null;
  /** days before the week ended that the last planned workout was covered */
  daysEarly: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function matchWeek(planRows: PlanDayRow[], runs: Run[], weekStart: string): WeekMatch {
  const dates = weekDates(weekStart);
  const weekEnd = dates[6] ?? weekStart;
  const rows = planRows
    .filter((r) => r.date >= weekStart && r.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weekRuns = runs
    .filter((r) => r.date >= weekStart && r.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));

  type Pair = { row: PlanDayRow; run: Run; diff: number; distGap: number };
  const pairs: Pair[] = [];
  for (const row of rows) {
    for (const run of weekRuns) {
      const diff = Math.abs(dayDiff(run.date, row.date));
      if (diff > MATCH_WINDOW_DAYS) continue;
      pairs.push({
        row,
        run,
        diff,
        distGap: Math.abs(Number(run.distance_mi) - Number(row.target_miles)),
      });
    }
  }
  pairs.sort((a, b) => a.diff - b.diff || a.distGap - b.distGap);

  const runForRow = new Map<string, Run>();
  const usedRuns = new Set<string>();
  for (const p of pairs) {
    if (runForRow.has(p.row.id) || usedRuns.has(p.run.id)) continue;
    runForRow.set(p.row.id, p.run);
    usedRuns.add(p.run.id);
  }

  const planForRun = new Map<string, PlanDayRow>();
  const matches: PlanMatch[] = rows.map((row) => {
    const run = runForRow.get(row.id) ?? null;
    const target = Number(row.target_miles) || 0;
    const done = !!run && (target <= 0 || Number(run.distance_mi) >= target * DONE_FRACTION);
    if (run && done) planForRun.set(run.id, row);
    return { row, run, moved: !!run && run.date !== row.date, done };
  });

  const byPlanDate = new Map(matches.map((m) => [m.row.date, m]));
  const extras = weekRuns.filter((r) => !planForRun.has(r.id));
  const complete = rows.length > 0 && matches.every((m) => m.done);

  const matchedDates = matches
    .map((m) => (m.done ? m.run!.date : null))
    .filter((x): x is string => !!x)
    .sort();
  const lastMatchedDate = matchedDates[matchedDates.length - 1] ?? null;

  const longestRun = weekRuns.reduce<Run | null>(
    (best, r) => (!best || Number(r.distance_mi) > Number(best.distance_mi) ? r : best),
    null,
  );

  return {
    weekStart,
    weekEnd,
    dates,
    matches,
    byPlanDate,
    planForRun,
    extras,
    complete,
    plannedMi: round1(rows.reduce((s, r) => s + Number(r.target_miles), 0)),
    actualMi: round1(weekRuns.reduce((s, r) => s + Number(r.distance_mi), 0)),
    runCount: weekRuns.length,
    longestRun,
    lastMatchedDate,
    daysEarly: lastMatchedDate ? Math.max(0, dayDiff(weekEnd, lastMatchedDate)) : 0,
  };
}

/** "Long run, planned Sun" — shown on the day a moved run was actually done. */
export function movedRunNote(row: PlanDayRow): string {
  const i = (new Date(`${row.date}T00:00:00`).getDay() + 6) % 7;
  return `${typeLabel(row.workout_type)}, planned ${DAY_NAMES[i]}`;
}

/** Whether a week contains a matched long run (used by the skipped-long-run rule). */
export function hasMatchedLongRun(week: WeekMatch): boolean {
  const long = week.matches.filter((m) => m.row.workout_type === "long");
  if (!long.length) return true; // nothing planned, nothing to hold
  return long.some((m) => m.done);
}
