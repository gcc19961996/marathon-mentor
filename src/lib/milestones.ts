import type { Milestone } from "./data";
import type { Dashboard } from "./dashboard";
import { milestoneDistance } from "./dashboard";

/** How close a run has to be to count for a distance milestone. */
export const MILESTONE_TOLERANCE_MI = 0.2;

/** Earliest run that satisfies a distance milestone, or null. */
export function distanceMilestoneRun(m: Milestone, d: Dashboard) {
  const miles = milestoneDistance(m);
  if (!miles || miles < 8) return null;
  return [...d.runs]
    .filter((r) => Number(r.distance_mi) >= miles - MILESTONE_TOLERANCE_MI)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

/** Date a milestone becomes complete, or null. */
export function autoCompleteDate(m: Milestone, d: Dashboard): string | null {
  const criteria = m.criteria ?? "";

  // A named distance counts as soon as any logged run reaches it (±0.2 mi),
  // whatever day it happened on.
  const run = distanceMilestoneRun(m, d);
  if (run) return run.date;

  // "day:<date>" — done when that plan day is done or a run covers it.
  if (criteria.startsWith("day:")) {
    const date = criteria.slice(4);
    const row = d.planDays.find((r) => r.date === date);
    const dayRun = d.runs.find((r) => r.date === date);
    if (row?.status === "done") return date;
    if (dayRun && Number(dayRun.distance_mi) >= Number(row?.min_miles ?? row?.target_miles ?? 0))
      return date;
    return null;
  }

  // "date" — a point in the calendar, done once it has passed.
  if (criteria === "date" && m.target_date) return d.today > m.target_date ? m.target_date : null;

  return null;
}

export function formatMilestoneDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function shortMilestoneDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
