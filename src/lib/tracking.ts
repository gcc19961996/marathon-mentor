// Pure helpers for pasted-run import, weekly recap and the long-run hold rule.

import type { Run } from "./data";
import {
  DAY_NAMES,
  dayIndexOf,
  easyPaceFlag,
  isoDate,
  parseDuration,
  startOfWeek,
  type PlanDay,
} from "./training";

/* ---------- paste runs ---------- */

export type PastedRow = {
  line: string;
  date: string;
  miles: number;
  seconds: number;
  notes: string | null;
  status: "new" | "duplicate" | "error";
  message?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePastedRuns(text: string, existing: Run[]): PastedRow[] {
  const seen: { date: string; miles: number }[] = existing.map((r) => ({
    date: r.date,
    miles: Number(r.distance_mi),
  }));

  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): PastedRow => {
      const parts = line.split(",").map((p) => p.trim());
      const [date = "", milesRaw = "", timeRaw = "", ...rest] = parts;
      const notes = rest.join(", ").trim() || null;
      const miles = Number(milesRaw);
      const seconds = parseDuration(timeRaw) ?? 0;
      const base = { line, date, miles, seconds, notes };

      if (!DATE_RE.test(date))
        return { ...base, status: "error", message: "Date must be YYYY-MM-DD" };
      if (!Number.isFinite(miles) || miles <= 0)
        return { ...base, status: "error", message: "Miles must be a number" };
      if (!seconds) return { ...base, status: "error", message: "Time must be h:mm:ss or mm:ss" };

      const dup = seen.some((r) => r.date === date && Math.abs(r.miles - miles) <= 0.1);
      if (dup) return { ...base, status: "duplicate", message: "Already logged" };

      seen.push({ date, miles });
      return { ...base, status: "new" };
    });
}

/** Plan day for a date in the active week, or null when it's another week. */
export function planDayFor(date: string, activeDays: PlanDay[]): { index: number; day: PlanDay } | null {
  const i = dayIndexOf(date, startOfWeek());
  if (i < 0 || i > 6) return null;
  const day = activeDays[i];
  return day ? { index: i, day } : null;
}

/* ---------- weekly recap ---------- */

export type WeekRecap = {
  weekStart: string;
  plannedMi: number;
  actualMi: number;
  longRun: "done" | "short" | "missed" | "none planned";
  longRunPlannedMi: number;
  longRunActualMi: number;
  fastEasyRuns: number;
  line: string;
};

export function weekRecap(
  runs: Run[],
  planDays: PlanDay[],
  weekStart: string,
): WeekRecap {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = isoDate(new Date(start.getTime() + 6 * 86400000));
  const weekRuns = runs.filter((r) => r.date >= weekStart && r.date <= end);

  const plannedMi = Math.round(planDays.reduce((s, d) => s + (d.distance_mi ?? 0), 0) * 10) / 10;
  const actualMi = Math.round(weekRuns.reduce((s, r) => s + Number(r.distance_mi), 0) * 10) / 10;

  const plannedLong = planDays.find((d) => d.type === "Long Run");
  const longRunPlannedMi = plannedLong?.distance_mi ?? 0;
  const longRunActualMi = weekRuns.reduce((m, r) => Math.max(m, Number(r.distance_mi)), 0);
  const longRun: WeekRecap["longRun"] = !longRunPlannedMi
    ? "none planned"
    : longRunActualMi >= longRunPlannedMi * 0.95
      ? "done"
      : longRunActualMi >= longRunPlannedMi * 0.75
        ? "short"
        : "missed";

  const fastEasyRuns = weekRuns.filter((r) => easyPaceFlag(r.type, r.avg_pace_seconds)).length;

  let line = "Solid week.";
  if (fastEasyRuns >= 2) line = "Easy days were too fast. Slow down this week.";
  else if (longRun === "missed") line = "The long run didn't happen. Pick it up again this week.";
  else if (plannedMi > 0 && actualMi < plannedMi * 0.8)
    line = "Mileage came in low. Don't make it up; just resume the plan.";
  else if (longRun === "short") line = "Long run was cut short — hold the distance this week.";

  return {
    weekStart,
    plannedMi,
    actualMi,
    longRun,
    longRunPlannedMi,
    longRunActualMi: Math.round(longRunActualMi * 10) / 10,
    fastEasyRuns,
    line,
  };
}

/* ---------- missed or short long run ---------- */

export type LongRunHold = {
  plannedMi: number;
  suggestMi: number;
  dayIndex: number;
  message: string;
};

/**
 * When the last long run was skipped or under 75% of its target, suggest holding
 * this week's long run at the last completed long-run distance.
 */
export function longRunHold(args: {
  runs: Run[];
  lastWeekPlan: PlanDay[];
  lastWeekStart: string;
  activeDays: PlanDay[];
  taper: boolean;
}): LongRunHold | null {
  if (args.taper) return null;
  const recap = weekRecap(args.runs, args.lastWeekPlan, args.lastWeekStart);
  if (recap.longRun !== "short" && recap.longRun !== "missed") return null;

  const idx = args.activeDays.findIndex((d) => d.type === "Long Run");
  const planned = idx >= 0 ? (args.activeDays[idx]?.distance_mi ?? 0) : 0;
  if (!planned) return null;

  const lastCompleted = [...args.runs]
    .filter((r) => Number(r.distance_mi) >= 8)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const suggest = Math.round((lastCompleted ? Number(lastCompleted.distance_mi) : recap.longRunActualMi) * 10) / 10;
  if (!suggest || suggest >= planned) return null;

  return {
    plannedMi: planned,
    suggestMi: suggest,
    dayIndex: idx,
    message: `Last long run was cut short. Suggest holding at ${suggest} mi instead of ${planned} mi (${DAY_NAMES[idx]}).`,
  };
}
